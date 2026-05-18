import { OtsAttestation, OtsNode, OtsOp, ParsedOtsFile } from './parsed-ots';

/**
 * Structural facts about ONE leaf's path through a calendar's batch
 * Merkle tree AND the Bitcoin block-header Merkle tree that anchors
 * that calendar batch on-chain, derived purely from the operations
 * recorded in a parsed .ots receipt -- no Bitcoin lookup required.
 *
 * Computed once per Bitcoin attestation found in the parsed tree. A
 * receipt with attestations across multiple Bitcoin blocks yields one
 * entry per attestation.
 */
export interface MerkleMath {
  /** Bitcoin block this attestation anchors to. */
  blockheight: number;

  /** The Merkle root the OTS path terminates at -- 32 bytes in OTS
   *  INTERNAL byte order (NOT the display byte order used by explorers).
   *  Equal to `node.msg` at the attestation node. Callers verifying
   *  against a block header must reverse() before comparing. */
  merkleRootInternal: Uint8Array;

  /** Every operation on the path from the file hash to this attestation,
   *  in application order (file-hash → ... → root). */
  pathOps: ReadonlyArray<PathOp>;

  /** Number of cryptographic-hash ops (sha256 / sha1 / ripemd160 /
   *  keccak256) on the path. Each one is one hashing round a verifier
   *  re-executes. */
  hashRoundCount: number;

  /** Sum of all bytes that OP_APPEND / OP_PREPEND injected into the
   *  running message. Equivalently, the receipt's "payload bytes
   *  excluding ops/markers/attestation headers" -- this is what the
   *  proof carries beyond the file hash itself. */
  proofPayloadBytes: number;

  /**
   * Calendar batch tree facts -- the part of the proof that says
   * "where in the calendar's batch was my submission?". One level per
   * `[append|prepend 32B sibling, sha256]` pair on the path, scanned
   * from the boundary with the Bitcoin tree backwards toward the file
   * hash. Null when no such pattern is detectable (e.g. pending-only
   * receipts, or chains using a non-SHA-256 family that don't fit the
   * single-sha-per-level shape).
   */
  calendar: TreeMath | null;

  /**
   * Bitcoin block-header tree facts -- the levels connecting the
   * calendar's anchor transaction to the block's merkleroot, same for
   * every user that batched into the same calendar tx. One level per
   * `[append|prepend 32B sibling, sha256, sha256]` triplet at the END
   * of the path (Bitcoin uses double-SHA-256). `leafIndex` here is the
   * calendar's anchor tx position within the block; `estimatedBatchSize`
   * here means "block tx count bound". Null when no Bitcoin triplets
   * are present.
   */
  bitcoin: TreeMath | null;
}

export interface TreeMath {
  /** Number of tree levels detected. */
  depth: number;

  /** Leaf position in a balanced tree of this depth. Bits are read
   *  top-of-tree (MSB) → leaf-level (LSB):
   *    OP_APPEND  → "I'm the LEFT  child at this level" → bit 0
   *    OP_PREPEND → "I'm the RIGHT child at this level" → bit 1
   *  In an unbalanced tree (rightmost branch short-circuited because
   *  the leaf count isn't a power of two), treat as "best-effort
   *  position" -- still a deterministic identifier, just not always
   *  the canonical leaf number. */
  leafIndex: bigint;

  /** Bounds on the number of leaves at this tree's level: between
   *  2^(depth-1)+1 and 2^depth (inclusive). Exact count not recoverable
   *  from one receipt because OTS / Bitcoin merkle accumulators can
   *  short-circuit unbalanced rightmost branches. */
  estimatedBatchSize: { min: bigint; max: bigint };
}

export type PathOp =
  | { kind: 'sha1' }
  | { kind: 'ripemd160' }
  | { kind: 'sha256' }
  | { kind: 'keccak256' }
  | { kind: 'reverse' }
  | { kind: 'hexlify' }
  | { kind: 'append'; payloadBytes: number }
  | { kind: 'prepend'; payloadBytes: number };

/**
 * Walk the parsed OTS tree and, for every Bitcoin attestation found,
 * return the structural facts about the path that leads to it.
 *
 * Receipt with no Bitcoin attestation (e.g. pending-only): empty array.
 * Receipt with multiple Bitcoin anchors: one entry per anchor.
 */
export function computeMerkleMath(file: ParsedOtsFile): MerkleMath[] {
  const out: MerkleMath[] = [];

  const visit = (node: OtsNode, pathSoFar: PathOp[]): void => {
    for (const att of node.attestations) {
      if (att.kind === 'bitcoin') {
        out.push(buildMath(att, node.msg, pathSoFar));
      }
    }
    for (const c of node.children) {
      visit(c.node, [...pathSoFar, opToPathOp(c.op)]);
    }
  };

  visit(file.root, []);
  return out;
}

function opToPathOp(op: OtsOp): PathOp {
  switch (op.kind) {
    case 'append':  return { kind: 'append',  payloadBytes: op.arg.length };
    case 'prepend': return { kind: 'prepend', payloadBytes: op.arg.length };
    default:        return { kind: op.kind };
  }
}

function buildMath(
  att: Extract<OtsAttestation, { kind: 'bitcoin' }>,
  attNodeMsg: Uint8Array,
  pathOps: PathOp[],
): MerkleMath {
  let hashRoundCount = 0;
  let proofPayloadBytes = 0;
  for (const op of pathOps) {
    if (op.kind === 'append' || op.kind === 'prepend') {
      proofPayloadBytes += op.payloadBytes;
    } else if (op.kind === 'sha256' || op.kind === 'sha1' || op.kind === 'ripemd160' || op.kind === 'keccak256') {
      hashRoundCount++;
    }
  }

  // Peel Bitcoin block-tree triplets (double-SHA-256) from the end
  // first; they sit furthest down the path because the receipt walks
  // file-hash → calendar root → tx body → tx hash → block merkleroot.
  const bitcoinPeel = peelTreeLevels(pathOps, /* sha256RoundsPerLevel */ 2);
  // Between Bitcoin levels and the calendar tree there's the tx body
  // assembly (prepend tx prefix, append tx suffix, sha256, sha256 for
  // the txid). Skip backwards through that until we find the trailing
  // `[append|prepend 32, sha256]` of the calendar tree top.
  const calendarEnd = findCalendarTail(pathOps, bitcoinPeel.remaining);
  const calendarPeel = calendarEnd === -1
    ? { depth: 0, leafIndex: 0n, remaining: 0 }
    : peelTreeLevels(pathOps.slice(0, calendarEnd), /* sha256RoundsPerLevel */ 1);

  return {
    blockheight: att.height,
    merkleRootInternal: attNodeMsg,
    pathOps,
    hashRoundCount,
    proofPayloadBytes,
    calendar: calendarPeel.depth === 0 ? null : asTreeMath(calendarPeel),
    bitcoin:  bitcoinPeel.depth  === 0 ? null : asTreeMath(bitcoinPeel),
  };
}

interface Peel {
  depth: number;
  leafIndex: bigint;
  /** Index in pathOps just BEFORE the peeled portion -- where the next
   *  peel (a different tree, say) should start scanning from. */
  remaining: number;
}

/**
 * Peel as many `[append|prepend 32-byte sibling] + N × sha256` blocks
 * as possible from the END of `pathOps`, where N is the number of
 * SHA-256 rounds per tree level (1 for calendar's single-sha trees,
 * 2 for Bitcoin's double-sha header tree).
 *
 * Returns the depth peeled, the leaf-index bits accumulated MSB-first
 * (so the resulting BigInt reads as the binary leaf index in a balanced
 * tree), and the count of ops still remaining at the front of the path.
 */
function peelTreeLevels(pathOps: ReadonlyArray<PathOp>, sha256RoundsPerLevel: number): Peel {
  const levelSize = 1 + sha256RoundsPerLevel;  // 1 sibling op + N sha256 ops
  let i = pathOps.length;
  let depth = 0;
  let leafIndex = 0n;

  while (i >= levelSize) {
    // Last `sha256RoundsPerLevel` ops must all be sha256.
    let allSha = true;
    for (let k = 0; k < sha256RoundsPerLevel; k++) {
      if (pathOps[i - 1 - k].kind !== 'sha256') { allSha = false; break; }
    }
    if (!allSha) break;

    // Op at position `i - levelSize` must be a 32-byte sibling.
    const sib = pathOps[i - levelSize];
    if (sib.kind !== 'append' && sib.kind !== 'prepend') break;
    if (sib.payloadBytes !== 32) break;

    // append → I'm LEFT (bit 0); prepend → I'm RIGHT (bit 1).
    const bit = sib.kind === 'prepend' ? 1n : 0n;
    // Insert at LSB end; previous bits shift up. Final order: first
    // peel (TOP of tree) → MSB; last peel (LEAF level) → LSB.
    leafIndex = (leafIndex << 1n) | bit;
    depth++;
    i -= levelSize;
  }

  return { depth, leafIndex, remaining: i };
}

/**
 * Walk backwards from `after` until the last two ops form a calendar
 * tree level shape `[append|prepend 32B, sha256]`. Returns the index
 * just AFTER that calendar top-level sha256 -- i.e. where peelTreeLevels
 * should start scanning calendar pairs from. Returns -1 if no such
 * pattern exists anywhere in `pathOps[0..after-1]`.
 */
function findCalendarTail(pathOps: ReadonlyArray<PathOp>, after: number): number {
  let i = after;
  while (i >= 2) {
    const last = pathOps[i - 1];
    const beforeLast = pathOps[i - 2];
    if (
      last.kind === 'sha256' &&
      (beforeLast.kind === 'append' || beforeLast.kind === 'prepend') &&
      beforeLast.payloadBytes === 32
    ) {
      return i;
    }
    i -= 1;
  }
  return -1;
}

function asTreeMath(p: Peel): TreeMath {
  return {
    depth: p.depth,
    leafIndex: p.leafIndex,
    estimatedBatchSize: {
      min: (1n << BigInt(p.depth - 1)) + 1n,
      max: 1n << BigInt(p.depth),
    },
  };
}
