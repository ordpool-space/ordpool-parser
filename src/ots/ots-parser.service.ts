import { bytesToHex } from '../lib/conversions';
import { ripemd160 } from '../lib/ripemd160';
import {
  FileHashAlgo,
  OtsAttestation,
  OtsBitcoinAttestation,
  OtsNode,
  OtsOp,
  ParsedOtsFile,
} from './parsed-ots';

/**
 * Streaming reader for the .ots binary format. Wraps a Uint8Array with a
 * cursor; provides the few primitives the format actually uses.
 *
 * The .ots format uses LEB128 for varuints (see python-opentimestamps's
 * core/serialize.py:143-156 for the reference implementation).
 */
class OtsReader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  remaining(): number {
    return this.bytes.length - this.offset;
  }

  isAtEnd(): boolean {
    return this.offset >= this.bytes.length;
  }

  readByte(): number {
    if (this.offset >= this.bytes.length) throw new Error('OTS: unexpected EOF (byte)');
    return this.bytes[this.offset++];
  }

  readBytes(n: number): Uint8Array {
    if (this.offset + n > this.bytes.length) throw new Error(`OTS: unexpected EOF (read ${n} bytes)`);
    const out = this.bytes.subarray(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }

  /** LEB128 unsigned varint. */
  readVaruint(): number {
    let value = 0;
    let shift = 0;
    while (true) {
      const b = this.readByte();
      value |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
      if (shift > 35) throw new Error('OTS: varuint overflow');
    }
    return value >>> 0;   // ensure unsigned
  }

  readVarbytes(maxLen = 8192): Uint8Array {
    const len = this.readVaruint();
    if (len > maxLen) throw new Error(`OTS: varbytes length ${len} > max ${maxLen}`);
    return this.readBytes(len);
  }

  expectMagic(magic: Uint8Array): void {
    const got = this.readBytes(magic.length);
    for (let i = 0; i < magic.length; i++) {
      if (got[i] !== magic[i]) {
        throw new Error('OTS: bad magic header (not a .ots file)');
      }
    }
  }
}

/**
 * 31-byte header magic at the start of every .ots file.
 * Source: python-opentimestamps `core/timestamp.py:273`.
 */
export const OTS_HEADER_MAGIC = new Uint8Array([
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00,
  0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
]);

const MAJOR_VERSION = 1;
const SHA256_FILE_HASH_TAG = 0x08;

/** True if the byte buffer starts with the 31-byte OTS magic header. */
export function looksLikeOts(bytes: Uint8Array): boolean {
  if (bytes.length < OTS_HEADER_MAGIC.length) return false;
  for (let i = 0; i < OTS_HEADER_MAGIC.length; i++) {
    if (bytes[i] !== OTS_HEADER_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Build a complete v1 .ots file from a SHA-256 file digest and one or more
 * calendar reply subtrees. Each subtree is the raw response body from a
 * calendar's `/digest` POST or `/timestamp/<commit>` GET. Multiple subtrees
 * become siblings under the root; the wire format separates siblings with
 * a 0xff continuation byte (last subtree has no leading 0xff). Throws on
 * empty input.
 */
export function assembleOtsFile(fileHash: Uint8Array, subtrees: Uint8Array[]): Uint8Array {
  if (subtrees.length === 0) throw new Error('assembleOtsFile: at least one subtree required');
  let total = OTS_HEADER_MAGIC.length + 1 + 1 + fileHash.length;
  for (let i = 0; i < subtrees.length; i++) {
    total += subtrees[i].length + (i < subtrees.length - 1 ? 1 : 0);
  }
  const out = new Uint8Array(total);
  let p = 0;
  out.set(OTS_HEADER_MAGIC, p); p += OTS_HEADER_MAGIC.length;
  out[p++] = MAJOR_VERSION;
  out[p++] = SHA256_FILE_HASH_TAG;
  out.set(fileHash, p); p += fileHash.length;
  for (let i = 0; i < subtrees.length; i++) {
    if (i < subtrees.length - 1) out[p++] = 0xff;
    out.set(subtrees[i], p); p += subtrees[i].length;
  }
  return out;
}

/**
 * Walk a single-chain calendar body (the raw reply from `/digest`) forward,
 * op by op, and return the prefix that contains every op up to (but not
 * including) the first attestation marker (0x00). Used by upgrade-splice
 * logic: callers replace [PendingAttestation] with [upgrade response] by
 * concatenating the slice + the upgrade body.
 *
 * Throws if the body has continuations (0xff) or doesn't terminate in an
 * attestation -- calendar replies are always single chains, so any
 * deviation is a malformed body.
 */
export function sliceOpsBeforeAttestation(body: Uint8Array): Uint8Array {
  let p = 0;
  while (p < body.length) {
    const tag = body[p];
    if (tag === 0x00) return body.slice(0, p);
    if (tag === 0xff) throw new Error('OTS body has unexpected continuation');
    p++;
    // append (0xf0) and prepend (0xf1) carry varuint-prefixed bytes; every
    // other op tag has zero-byte payload.
    if (tag === 0xf0 || tag === 0xf1) {
      let len = 0, shift = 0;
      while (true) {
        const b = body[p++];
        len |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
        if (shift > 35) throw new Error('OTS varuint overflow');
      }
      p += len;
    }
  }
  throw new Error('OTS body has no attestation marker');
}

/** Op tag bytes (single byte each). */
const OP_TAG = {
  sha1:      0x02,
  ripemd160: 0x03,
  sha256:    0x08,
  keccak256: 0x67,
  append:    0xf0,
  prepend:   0xf1,
  reverse:   0xf2,
  hexlify:   0xf3,
} as const;

/** 8-byte attestation tags. */
const ATTESTATION_TAG = {
  pending:  '83dfe30d2ef90c8e',
  bitcoin:  '0588960d73d71901',
  litecoin: '06869a0d73d71b45',
  ethereum: '30fe8087b5c7ead7',     // dubious but documented
} as const;

/** Hash op output digest length, indexed by tag. */
const DIGEST_LEN: Record<number, number> = {
  [OP_TAG.sha1]: 20,
  [OP_TAG.ripemd160]: 20,
  [OP_TAG.sha256]: 32,
  [OP_TAG.keccak256]: 32,
};

/** Maximum recursion depth (matches python-opentimestamps). */
const MAX_RECURSION = 256;

function tagToFileHashAlgo(tag: number): FileHashAlgo {
  switch (tag) {
    case OP_TAG.sha1:      return 'sha1';
    case OP_TAG.ripemd160: return 'ripemd160';
    case OP_TAG.sha256:    return 'sha256';
    case OP_TAG.keccak256: return 'keccak256';
    default: throw new Error(`OTS: unknown file-hash op tag 0x${tag.toString(16).padStart(2, '0')}`);
  }
}

function readOp(r: OtsReader, tag: number): OtsOp {
  switch (tag) {
    case OP_TAG.sha1:      return { kind: 'sha1' };
    case OP_TAG.ripemd160: return { kind: 'ripemd160' };
    case OP_TAG.sha256:    return { kind: 'sha256' };
    case OP_TAG.keccak256: return { kind: 'keccak256' };
    case OP_TAG.reverse:   return { kind: 'reverse' };
    case OP_TAG.hexlify:   return { kind: 'hexlify' };
    case OP_TAG.append:    return { kind: 'append',  arg: new Uint8Array(r.readVarbytes(4096)) };
    case OP_TAG.prepend:   return { kind: 'prepend', arg: new Uint8Array(r.readVarbytes(4096)) };
    default: throw new Error(`OTS: unknown op tag 0x${tag.toString(16).padStart(2, '0')}`);
  }
}

function readAttestation(r: OtsReader): OtsAttestation {
  const tagBytes = r.readBytes(8);
  const tagHex = bytesToHex(tagBytes);
  const payload = new Uint8Array(r.readVarbytes());

  switch (tagHex) {
    case ATTESTATION_TAG.bitcoin: {
      const sub = new OtsReader(payload);
      const height = sub.readVaruint();
      return { kind: 'bitcoin', height };
    }
    case ATTESTATION_TAG.litecoin: {
      const sub = new OtsReader(payload);
      const height = sub.readVaruint();
      return { kind: 'litecoin', height };
    }
    case ATTESTATION_TAG.ethereum: {
      const sub = new OtsReader(payload);
      const height = sub.readVaruint();
      return { kind: 'ethereum', height };
    }
    case ATTESTATION_TAG.pending: {
      const sub = new OtsReader(payload);
      const uriBytes = sub.readVarbytes();
      const uri = new TextDecoder('utf-8').decode(uriBytes);
      return { kind: 'pending', uri };
    }
    default:
      return { kind: 'unknown', tag: tagHex, payload };
  }
}

/** Apply one op to a message. Pure: returns a new Uint8Array. */
async function applyOp(op: OtsOp, msg: Uint8Array): Promise<Uint8Array> {
  switch (op.kind) {
    case 'sha256': {
      const buf = await crypto.subtle.digest('SHA-256', msg);
      return new Uint8Array(buf);
    }
    case 'sha1': {
      const buf = await crypto.subtle.digest('SHA-1', msg);
      return new Uint8Array(buf);
    }
    case 'ripemd160':
      // RIPEMD-160 is not in WebCrypto; inlined in src/lib/ripemd160.ts.
      // OTS file-hash chains for git-commit timestamps + the canonical
      // hello-world.txt.ots example use this.
      return ripemd160(msg);
    case 'keccak256':
      throw new Error('OTS: KECCAK256 not yet implemented in this verifier');
    case 'reverse': {
      const out = new Uint8Array(msg.length);
      for (let i = 0; i < msg.length; i++) out[i] = msg[msg.length - 1 - i];
      return out;
    }
    case 'hexlify': {
      const hex = bytesToHex(msg);
      return new TextEncoder().encode(hex);
    }
    case 'append': {
      const out = new Uint8Array(msg.length + op.arg.length);
      out.set(msg, 0);
      out.set(op.arg, msg.length);
      return out;
    }
    case 'prepend': {
      const out = new Uint8Array(op.arg.length + msg.length);
      out.set(op.arg, 0);
      out.set(msg, op.arg.length);
      return out;
    }
  }
}

/**
 * Recursively deserialize a Timestamp tree. Mirrors python-opentimestamps's
 * `Timestamp.deserialize` (core/timestamp.py:131-183): siblings are prefixed
 * with `\xff`, the LAST sibling has no prefix; each sibling is either an
 * attestation (`\x00` followed by tag+payload) or an op (any other tag,
 * which then recursively contains a sub-Timestamp).
 *
 * `msg` is the message at THIS node; child nodes' `msg` is the result of
 * applying the child's op to this node's `msg`.
 */
async function readNode(r: OtsReader, msg: Uint8Array, depth: number): Promise<OtsNode> {
  if (depth > MAX_RECURSION) throw new Error('OTS: tree recursion limit exceeded');

  const node: OtsNode = { msg, attestations: [], children: [] };

  const handleOne = async (tag: number): Promise<void> => {
    if (tag === 0x00) {
      node.attestations.push(readAttestation(r));
    } else {
      const op = readOp(r, tag);
      const childMsg = await applyOp(op, msg);
      const childNode = await readNode(r, childMsg, depth + 1);
      node.children.push({ op, node: childNode });
    }
  };

  let tag = r.readByte();
  while (tag === 0xff) {
    await handleOne(r.readByte());
    tag = r.readByte();
  }
  await handleOne(tag);

  return node;
}

/**
 * Parse + replay an entire .ots file. Returns the parsed tree; consumers
 * extract Bitcoin attestations via collectBitcoinAttestations(parsed).
 *
 * Why async: the replay computes SHA256 (and SHA1) at each crypto-op node,
 * via WebCrypto's SubtleCrypto.digest -- the only zero-dep hash function
 * available in both Node 19+ and modern browsers.
 *
 * @throws on bad magic, unknown file-hash op, malformed binary, or hashing-
 *   not-implemented for an op (RIPEMD160 / KECCAK256 in some chains).
 */
export async function parseOtsFile(bytes: Uint8Array): Promise<ParsedOtsFile> {
  const r = new OtsReader(bytes);
  r.expectMagic(OTS_HEADER_MAGIC);

  const major = r.readByte();
  if (major !== MAJOR_VERSION) {
    throw new Error(`OTS: unsupported major version ${major}; expected ${MAJOR_VERSION}`);
  }

  const fileHashTag = r.readByte();
  const fileHashAlgo = tagToFileHashAlgo(fileHashTag);
  const digestLen = DIGEST_LEN[fileHashTag];
  const fileHash = new Uint8Array(r.readBytes(digestLen));

  const root = await readNode(r, fileHash, 0);

  if (!r.isAtEnd()) {
    throw new Error(`OTS: ${r.remaining()} trailing bytes after timestamp tree`);
  }

  return { fileHashAlgo, fileHash, root };
}

/**
 * Walk the parsed tree and collect every BitcoinBlockHeaderAttestation,
 * paired with the message at that node (which is the expected block
 * merkleroot the consumer must verify against the actual block header).
 */
export function collectBitcoinAttestations(file: ParsedOtsFile): OtsBitcoinAttestation[] {
  const out: OtsBitcoinAttestation[] = [];
  const visit = (node: OtsNode): void => {
    for (const att of node.attestations) {
      if (att.kind === 'bitcoin') {
        out.push({ blockheight: att.height, expectedMerkleRoot: node.msg });
      }
    }
    for (const c of node.children) visit(c.node);
  };
  visit(file.root);
  return out;
}

/** Convenience: parse a file and immediately get its Bitcoin attestations. */
export async function parseAndCollectBitcoinAttestations(bytes: Uint8Array): Promise<OtsBitcoinAttestation[]> {
  return collectBitcoinAttestations(await parseOtsFile(bytes));
}
