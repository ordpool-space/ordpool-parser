import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import {
  collectBitcoinAttestations,
  parseAndCollectBitcoinAttestations,
  parseOtsFile,
} from './ots-parser.service';
import type { OtsAttestation, OtsNode } from './parsed-ots';

function readOts(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`testdata/ots_${name}.ots`));
}

function readFile(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`testdata/ots_${name}`));
}

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

/**
 * Bitcoin merkleroots are byte-reversed between INTERNAL order (the bytes
 * actually hashed in the block header — what the OTS attestation node's
 * msg holds) and DISPLAY order (what mempool.space / bitcoind / explorers
 * show). Verifiers must reverse before comparing across this boundary.
 */
function reverseBytes(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b[b.length - 1 - i];
  return out;
}

/** Walk a parsed tree and collect every attestation, regardless of kind. */
function allAttestations(node: OtsNode): OtsAttestation[] {
  const out: OtsAttestation[] = [];
  const visit = (n: OtsNode): void => {
    out.push(...n.attestations);
    for (const c of n.children) visit(c.node);
  };
  visit(node);
  return out;
}

/** Walk every op kind that appears in a tree. */
function opKindsUsed(node: OtsNode): string[] {
  const seen = new Set<string>();
  const visit = (n: OtsNode): void => {
    for (const c of n.children) {
      seen.add(c.op.kind);
      visit(c.node);
    }
  };
  visit(node);
  return [...seen].sort();
}

/**
 * Sanity-check the parser by replaying every op in the tree against the
 * parent's `msg`. Each child node's `msg` MUST equal the result of applying
 * the child's op to the parent's msg. We don't trust the parser's own
 * applyOp() here -- we hand-replay against Node's stdlib `crypto` to catch
 * any divergence.
 *
 * (Returns the count of nodes verified so the test can assert > 0.)
 */
function replayTreeWithStdlib(file: Awaited<ReturnType<typeof parseOtsFile>>): number {
  let count = 0;
  const replay = (msg: Uint8Array, op: any): Uint8Array => {
    switch (op.kind) {
      case 'sha256':    return new Uint8Array(createHash('sha256').update(msg).digest());
      case 'sha1':      return new Uint8Array(createHash('sha1').update(msg).digest());
      case 'ripemd160': return new Uint8Array(createHash('ripemd160').update(msg).digest());
      case 'append': {
        const out = new Uint8Array(msg.length + op.arg.length);
        out.set(msg, 0); out.set(op.arg, msg.length); return out;
      }
      case 'prepend': {
        const out = new Uint8Array(op.arg.length + msg.length);
        out.set(op.arg, 0); out.set(msg, op.arg.length); return out;
      }
      case 'reverse':   return reverseBytes(msg);
      default: throw new Error('cannot replay op kind: ' + op.kind);
    }
  };
  const visit = (node: OtsNode): void => {
    for (const c of node.children) {
      const expected = replay(node.msg, c.op);
      if (hex(expected) !== hex(c.node.msg)) {
        throw new Error(`stdlib-replay mismatch on op ${c.op.kind}:\n  parent.msg: ${hex(node.msg)}\n  expected:   ${hex(expected)}\n  parser got: ${hex(c.node.msg)}`);
      }
      count++;
      visit(c.node);
    }
  };
  visit(file.root);
  return count;
}

describe('parseOtsFile', () => {

  // -------- hello-world.txt.ots --------
  // The canonical OTS example. SHA256 file hash, RIPEMD160 + SHA256 in the
  // attestation chain, BitcoinBlockHeaderAttestation at block 358,391.
  describe('hello-world.txt.ots (canonical example)', () => {

    it('the input file is the literal "Hello World!\\n" (13 bytes)', () => {
      const data = readFile('hello-world.txt');
      expect(data.length).toBe(13);
      expect(new TextDecoder().decode(data)).toBe('Hello World!\n');
    });

    it('fileHashAlgo + fileHash match SHA-256("Hello World!\\n")', async () => {
      const file = await parseOtsFile(readOts('hello-world.txt'));
      expect(file.fileHashAlgo).toBe('sha256');

      // Hash the original file ourselves and compare to the parser's claim.
      const expected = createHash('sha256').update(readFile('hello-world.txt')).digest('hex');
      expect(hex(file.fileHash)).toBe(expected);
      expect(hex(file.fileHash)).toBe('03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340');
    });

    it('extracts the Bitcoin attestation pointing at mainnet block 358,391', async () => {
      const atts = await parseAndCollectBitcoinAttestations(readOts('hello-world.txt'));
      expect(atts.length).toBe(1);
      expect(atts[0].blockheight).toBe(358391);
      expect(hex(atts[0].expectedMerkleRoot))
        .toBe('007ee445d23ad061af4a36b809501fab1ac4f2d7e7a739817dd0cbb7ec661b8a');
    });

    it('expectedMerkleRoot reversed equals the live mainnet block 358,391 merkleroot', async () => {
      // Captured from mempool.space `/api/block/<hash>` on block 358391:
      // "merkle_root": "8a1b66ecb7cbd07d8139a7e7d7f2c41aab1f5009b8364aaf61d03ad245e47e00"
      // (Bitcoin returns merkleroots in DISPLAY order; OTS attestations
      // store them in INTERNAL/hashed order. Byte-reverse to compare.)
      const MAINNET_DISPLAY = '8a1b66ecb7cbd07d8139a7e7d7f2c41aab1f5009b8364aaf61d03ad245e47e00';

      const atts = await parseAndCollectBitcoinAttestations(readOts('hello-world.txt'));
      const reversed = reverseBytes(atts[0].expectedMerkleRoot);
      expect(hex(reversed)).toBe(MAINNET_DISPLAY);
    });

    it('uses both SHA256 + RIPEMD160 + append + prepend in the chain', async () => {
      const file = await parseOtsFile(readOts('hello-world.txt'));
      const ops = opKindsUsed(file.root);
      // The exact set in this fixture. Catches accidental op additions.
      expect(ops).toEqual(['append', 'prepend', 'ripemd160', 'sha256']);
    });

    it('every node\'s msg matches a stdlib (Node crypto) replay of its parent\'s op', async () => {
      const file = await parseOtsFile(readOts('hello-world.txt'));
      const verified = replayTreeWithStdlib(file);
      // hello-world has dozens of ops -- assert the chain was actually walked.
      expect(verified).toBeGreaterThan(10);
    });

    it('collectBitcoinAttestations is consistent with allAttestations', async () => {
      const file = await parseOtsFile(readOts('hello-world.txt'));
      const all = allAttestations(file.root);
      const btc = collectBitcoinAttestations(file);
      expect(btc.length).toBe(all.filter(a => a.kind === 'bitcoin').length);
    });
  });

  // -------- bitcoin.pdf.ots --------
  // The Bitcoin whitepaper itself. SHA1 file hash (yes, sha1 -- it predates
  // ord and the OTS protocol started with sha1 as a default). Bitcoin
  // attestation at block 465,751.
  describe('bitcoin.pdf.ots', () => {

    it('uses SHA1 as the file-hash algo (legacy default)', async () => {
      const file = await parseOtsFile(readOts('bitcoin.pdf'));
      expect(file.fileHashAlgo).toBe('sha1');
      expect(file.fileHash.length).toBe(20);
    });

    it('extracts the Bitcoin attestation pointing at mainnet block 465,751', async () => {
      const atts = await parseAndCollectBitcoinAttestations(readOts('bitcoin.pdf'));
      expect(atts.length).toBe(1);
      expect(atts[0].blockheight).toBe(465751);
      expect(hex(atts[0].expectedMerkleRoot))
        .toBe('76086b72bf393f2c72e3c8c4d07d6844abbd63de4af16c35522d522e8d9f9898');
    });

    it('expectedMerkleRoot reversed equals the live mainnet block 465,751 merkleroot', async () => {
      // From mempool.space on block 465751:
      // "merkle_root": "98989f8d2e522d52356cf14ade63bdab44687dd0c4c8e3722c3f39bf726b0876"
      const MAINNET_DISPLAY = '98989f8d2e522d52356cf14ade63bdab44687dd0c4c8e3722c3f39bf726b0876';

      const atts = await parseAndCollectBitcoinAttestations(readOts('bitcoin.pdf'));
      const reversed = reverseBytes(atts[0].expectedMerkleRoot);
      expect(hex(reversed)).toBe(MAINNET_DISPLAY);
    });

    it('replays cleanly against Node\'s stdlib crypto (no parser drift)', async () => {
      const file = await parseOtsFile(readOts('bitcoin.pdf'));
      const verified = replayTreeWithStdlib(file);
      expect(verified).toBeGreaterThan(10);
    });
  });

  // -------- incomplete.txt.ots --------
  describe('incomplete.txt.ots (pending only)', () => {

    it('parses without errors and has no Bitcoin attestation yet', async () => {
      const file = await parseOtsFile(readOts('incomplete.txt'));
      expect(file.fileHashAlgo).toBe('sha256');
      expect(collectBitcoinAttestations(file)).toEqual([]);
    });

    it('contains a single PendingAttestation pointing at alice', async () => {
      const file = await parseOtsFile(readOts('incomplete.txt'));
      const pending = allAttestations(file.root).filter(a => a.kind === 'pending');
      expect(pending.length).toBe(1);
      // narrow type
      expect(pending[0].kind === 'pending' && pending[0].uri).toBe('https://alice.btc.calendar.opentimestamps.org');
    });

    it('every chain node replays cleanly with stdlib SHA256', async () => {
      const file = await parseOtsFile(readOts('incomplete.txt'));
      expect(replayTreeWithStdlib(file)).toBeGreaterThan(0);
    });
  });

  // -------- merkle1.txt.ots --------
  describe('merkle1.txt.ots (two-calendar pending)', () => {

    it('parses + collects pending attestations from BOTH alice and bob', async () => {
      const file = await parseOtsFile(readOts('merkle1.txt'));
      const pending = allAttestations(file.root)
        .filter(a => a.kind === 'pending')
        .map(a => (a as any).uri)
        .sort();
      expect(pending).toEqual([
        'https://alice.btc.calendar.opentimestamps.org',
        'https://bob.btc.calendar.opentimestamps.org',
      ]);
      // Still pending → no Bitcoin attestation.
      expect(collectBitcoinAttestations(file)).toEqual([]);
    });
  });

  // -------- two-calendars.txt.ots --------
  describe('two-calendars.txt.ots', () => {

    it('parses + sees both calendars as pending', async () => {
      const file = await parseOtsFile(readOts('two-calendars.txt'));
      const pending = allAttestations(file.root).filter(a => a.kind === 'pending');
      expect(pending.length).toBe(2);
    });
  });

  // -------- error paths --------
  describe('rejects malformed input', () => {

    it('rejects bytes that are\'t a .ots file (bad magic)', async () => {
      const bogus = new Uint8Array(64).fill(0xab);
      await expect(parseOtsFile(bogus)).rejects.toThrow(/bad magic/i);
    });

    it('rejects input shorter than the 31-byte magic header', async () => {
      const tooShort = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
      await expect(parseOtsFile(tooShort)).rejects.toThrow();
    });

    it('rejects an unsupported major version', async () => {
      const valid = readOts('incomplete.txt');
      const tampered = new Uint8Array(valid);
      tampered[31] = 99;
      await expect(parseOtsFile(tampered)).rejects.toThrow(/unsupported major version/i);
    });

    it('rejects a truncated file', async () => {
      const valid = readOts('incomplete.txt');
      const truncated = valid.slice(0, valid.length - 5);
      await expect(parseOtsFile(truncated)).rejects.toThrow();
    });

    it('rejects trailing bytes after the timestamp tree', async () => {
      const valid = readOts('incomplete.txt');
      const padded = new Uint8Array(valid.length + 4);
      padded.set(valid, 0);
      padded.set([0, 0, 0, 0], valid.length);
      await expect(parseOtsFile(padded)).rejects.toThrow(/trailing bytes/i);
    });
  });
});
