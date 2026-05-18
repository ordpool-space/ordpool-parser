import { readFileSync } from 'fs';
import { computeMerkleMath, TreeMath } from './merkle-math';
import { parseOtsFile } from './ots-parser.service';
import { OtsAttestation, OtsNode, OtsOp, ParsedOtsFile } from './parsed-ots';

function readOts(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`testdata/ots_${name}.ots`));
}

// ---- synthetic-tree helpers ----
//
// We need precise control over the receipt shape for the leaf-index math
// tests. Building real .ots binaries with chosen left/right paths would
// mean re-implementing the calendar's Merkle hashing; faking the parsed
// ParsedOtsFile struct directly is the same thing minus the I/O.

const ZERO32 = new Uint8Array(32);

function makeNode(msg: Uint8Array, children: Array<{ op: OtsOp; node: OtsNode }> = [], atts: OtsAttestation[] = []): OtsNode {
  return { msg, attestations: atts, children };
}

/** Build a synthetic chain from a list of ops, terminating in a Bitcoin
 *  attestation at the given block height. Messages are placeholder
 *  Uint8Arrays -- the math under test never inspects them past the
 *  attestation node, so concrete values don't matter. */
function synthChain(
  ops: OtsOp[],
  height: number,
  fileHash: Uint8Array = new Uint8Array(32),
): ParsedOtsFile {
  let tail = makeNode(new Uint8Array(32), [], [{ kind: 'bitcoin', height }]);
  for (let i = ops.length - 1; i >= 0; i--) {
    tail = makeNode(new Uint8Array(32), [{ op: ops[i], node: tail }]);
  }
  tail.msg = fileHash;
  return { fileHashAlgo: 'sha256', fileHash, root: tail };
}

const A32 = (): OtsOp => ({ kind: 'append',  arg: new Uint8Array(32) });
const P32 = (): OtsOp => ({ kind: 'prepend', arg: new Uint8Array(32) });
const SHA = (): OtsOp => ({ kind: 'sha256' });
const A = (n: number): OtsOp => ({ kind: 'append',  arg: new Uint8Array(n) });
const P = (n: number): OtsOp => ({ kind: 'prepend', arg: new Uint8Array(n) });

/** Trailing block-tree shape for a Bitcoin merkle level. */
const BTC_PAIR_APP = (): OtsOp[] => [A32(), SHA(), SHA()];
const BTC_PAIR_PRE = (): OtsOp[] => [P32(), SHA(), SHA()];

/** Calendar (single-sha) level. */
const CAL_APP = (): OtsOp[] => [A32(), SHA()];
const CAL_PRE = (): OtsOp[] => [P32(), SHA()];

/** Plumbing between calendar tree and Bitcoin tree: prepend tx prefix,
 *  append tx suffix, double-sha to get the txid. Matches what real
 *  OTS receipts (e.g. ordpool-parser/testdata/ots_bitcoin.pdf.ots) have. */
const TX_PLUMBING = (): OtsOp[] => [P(199), A(4), SHA(), SHA()];

describe('computeMerkleMath', () => {

  // ============================================================
  // Pathological inputs
  // ============================================================

  it('returns an empty array for a receipt with no Bitcoin attestation', () => {
    const pending: ParsedOtsFile = {
      fileHashAlgo: 'sha256',
      fileHash: ZERO32,
      root: makeNode(ZERO32, [], [{ kind: 'pending', uri: 'https://alice.example' }]),
    };
    expect(computeMerkleMath(pending)).toEqual([]);
  });

  it('Bitcoin attestation directly on the root: empty path, both trees null', () => {
    const file: ParsedOtsFile = {
      fileHashAlgo: 'sha256',
      fileHash: ZERO32,
      root: makeNode(ZERO32, [], [{ kind: 'bitcoin', height: 12345 }]),
    };
    const [m] = computeMerkleMath(file);
    expect(m).toMatchObject({
      blockheight: 12345,
      hashRoundCount: 0,
      proofPayloadBytes: 0,
      calendar: null,
      bitcoin: null,
    });
    expect(m.pathOps).toEqual([]);
  });

  // ============================================================
  // Bitcoin tree (double-SHA) detection -- with a SYNTHETIC tail
  // ============================================================

  it('depth-1 Bitcoin tree (one anchor tx pair), I am LEFT', () => {
    const f = synthChain([...BTC_PAIR_APP()], 900_000);
    const [m] = computeMerkleMath(f);
    expect(m.bitcoin).toEqual<TreeMath>({
      depth: 1,
      leafIndex: 0n,
      estimatedBatchSize: { min: 2n, max: 2n },
    });
    expect(m.calendar).toBeNull();
  });

  it('depth-1 Bitcoin tree, I am RIGHT', () => {
    const f = synthChain([...BTC_PAIR_PRE()], 900_000);
    expect(computeMerkleMath(f)[0].bitcoin!.leafIndex).toBe(1n);
  });

  it('depth-3 Bitcoin tree, anchor tx index 5 (binary 101)', () => {
    // bit_0 (LSB, leaf level): RIGHT → prepend
    // bit_1 (mid level):       LEFT  → append
    // bit_2 (MSB, top level):  RIGHT → prepend
    // Apply leaf-first, so the receipt op order is: leaf, mid, top.
    const f = synthChain([
      ...BTC_PAIR_PRE(),  // leaf-level RIGHT
      ...BTC_PAIR_APP(),  // mid LEFT
      ...BTC_PAIR_PRE(),  // top RIGHT
    ], 900_000);
    const [m] = computeMerkleMath(f);
    expect(m.bitcoin).toEqual<TreeMath>({
      depth: 3,
      leafIndex: 5n,
      estimatedBatchSize: { min: 5n, max: 8n },
    });
  });

  it('all eight anchor-tx indices in a depth-3 Bitcoin tree line up with their L/R encodings', () => {
    const encodeBitcoin = (i: number): OtsOp[] => {
      const bit = (k: number) => (i >> k) & 1;
      return [
        ...(bit(0) ? BTC_PAIR_PRE() : BTC_PAIR_APP()),
        ...(bit(1) ? BTC_PAIR_PRE() : BTC_PAIR_APP()),
        ...(bit(2) ? BTC_PAIR_PRE() : BTC_PAIR_APP()),
      ];
    };
    for (let idx = 0; idx < 8; idx++) {
      const m = computeMerkleMath(synthChain(encodeBitcoin(idx), 900_000))[0];
      expect({ idx, leafIndex: m.bitcoin!.leafIndex, depth: m.bitcoin!.depth })
        .toEqual({ idx, leafIndex: BigInt(idx), depth: 3 });
    }
  });

  // ============================================================
  // Calendar tree (single-SHA) detection -- needs Bitcoin tail + plumbing
  // ============================================================

  it('calendar depth-1 + Bitcoin depth-1 with proper plumbing between', () => {
    const f = synthChain([
      ...CAL_APP(),           // depth-1 calendar, I'm LEFT
      ...TX_PLUMBING(),       // wraps the calendar root in a tx, hashes txid
      ...BTC_PAIR_PRE(),      // depth-1 Bitcoin, anchor tx RIGHT in block
    ], 900_000);
    const [m] = computeMerkleMath(f);
    expect(m.calendar).toEqual<TreeMath>({
      depth: 1,
      leafIndex: 0n,
      estimatedBatchSize: { min: 2n, max: 2n },
    });
    expect(m.bitcoin).toEqual<TreeMath>({
      depth: 1,
      leafIndex: 1n,
      estimatedBatchSize: { min: 2n, max: 2n },
    });
  });

  it('calendar tree leaf bits (LSB-first peel) reproduce arbitrary indices', () => {
    // Build a 5-level calendar tree where I'm at index 13 (binary 01101).
    // bit_0 (LSB / leaf level):  1 → RIGHT → prepend (applied first)
    // bit_1:                     0 → LEFT  → append
    // bit_2:                     1 → RIGHT → prepend
    // bit_3:                     1 → RIGHT → prepend
    // bit_4 (MSB / top):         0 → LEFT  → append (applied last)
    const f = synthChain([
      ...CAL_PRE(),  // leaf
      ...CAL_APP(),
      ...CAL_PRE(),
      ...CAL_PRE(),
      ...CAL_APP(),  // top
      ...TX_PLUMBING(),
      ...BTC_PAIR_APP(),
    ], 900_000);
    expect(computeMerkleMath(f)[0].calendar!.leafIndex).toBe(13n);
    expect(computeMerkleMath(f)[0].calendar!.depth).toBe(5);
  });

  it('calendar tree without Bitcoin tail (pure calendar, no anchor levels) is detected', () => {
    // Edge case: receipt with calendar levels and a Bitcoin attestation
    // RIGHT AFTER the calendar root, no Bitcoin merkle levels.
    // Op order: CAL_APP (leaf level, LEFT → bit 0), CAL_PRE (top, RIGHT → bit 1).
    // Binary MSB→LSB: "1 0" = 0b10 = 2.
    const f = synthChain([...CAL_APP(), ...CAL_PRE()], 900_000);
    const [m] = computeMerkleMath(f);
    expect(m.calendar).toEqual<TreeMath>({
      depth: 2,
      leafIndex: 0b10n,
      estimatedBatchSize: { min: 3n, max: 4n },
    });
    expect(m.bitcoin).toBeNull();
  });

  // ============================================================
  // Detection robustness -- non-balanced shapes shouldn't get counted
  // ============================================================

  it('a non-32-byte append/prepend is NOT counted as a Bitcoin tree level', () => {
    const f = synthChain([
      ...BTC_PAIR_APP(),
      // A 28-byte sibling would be nonsense; the detector should stop.
      { kind: 'append', arg: new Uint8Array(28) }, SHA(), SHA(),
    ], 900_000);
    expect(computeMerkleMath(f)[0].bitcoin).toBeNull();
  });

  it('a single-sha trailing pair is NOT counted as a Bitcoin level (wrong shape)', () => {
    // [sib 32, sha256] is a calendar level, not a Bitcoin level. Bitcoin
    // requires the second sha256.
    const f = synthChain([...CAL_APP(), ...CAL_PRE()], 900_000);
    expect(computeMerkleMath(f)[0].bitcoin).toBeNull();
  });

  it('a triplet-shape level is NOT counted as a calendar level even when no Bitcoin tail exists', () => {
    // Receipt ends in [sib 32, sha, sha]. That's the Bitcoin shape; the
    // calendar detector should NOT mistake it for a calendar pair.
    const f = synthChain([...BTC_PAIR_APP()], 900_000);
    expect(computeMerkleMath(f)[0].calendar).toBeNull();
  });

  // ============================================================
  // Aggregate counters
  // ============================================================

  it('hashRoundCount counts every cryptographic-hash op', () => {
    const f = synthChain([
      { kind: 'sha1' },
      { kind: 'ripemd160' },
      { kind: 'sha256' },
      { kind: 'keccak256' },
      { kind: 'reverse' },   // not a hash op
    ], 900_000);
    expect(computeMerkleMath(f)[0].hashRoundCount).toBe(4);
  });

  it('proofPayloadBytes sums append + prepend payloads, ignores hash ops', () => {
    const f = synthChain([
      { kind: 'append',  arg: new Uint8Array(10) },
      { kind: 'prepend', arg: new Uint8Array(20) },
      { kind: 'sha256' },
      { kind: 'append',  arg: new Uint8Array(32) },
      { kind: 'sha256' },
    ], 900_000);
    expect(computeMerkleMath(f)[0].proofPayloadBytes).toBe(10 + 20 + 32);
  });

  it('pathOps surfaces ONLY kind + payloadBytes (no raw byte arrays leak)', () => {
    const f = synthChain([{ kind: 'append', arg: new Uint8Array([1, 2, 3, 4]) }, SHA()], 900_000);
    const m = computeMerkleMath(f)[0];
    expect(m.pathOps).toEqual([
      { kind: 'append', payloadBytes: 4 },
      { kind: 'sha256' },
    ]);
    expect((m.pathOps[0] as { arg?: unknown }).arg).toBeUndefined();
  });

  // ============================================================
  // Multiple attestations + tree-walk order
  // ============================================================

  it('emits one entry per Bitcoin attestation found, in tree-walk order', () => {
    const leafA: OtsNode = makeNode(ZERO32, [], [{ kind: 'bitcoin', height: 100_000 }]);
    const leafB: OtsNode = makeNode(ZERO32, [], [{ kind: 'bitcoin', height: 200_000 }]);
    const root = makeNode(ZERO32, [
      { op: A32(), node: makeNode(ZERO32, [{ op: SHA(), node: leafA }]) },
      { op: P32(), node: makeNode(ZERO32, [{ op: SHA(), node: leafB }]) },
    ]);
    const file: ParsedOtsFile = { fileHashAlgo: 'sha256', fileHash: ZERO32, root };
    const out = computeMerkleMath(file);
    expect(out.map(m => m.blockheight)).toEqual([100_000, 200_000]);
    expect(out[0].calendar!.leafIndex).toBe(0n);   // append → left
    expect(out[1].calendar!.leafIndex).toBe(1n);   // prepend → right
  });

  // ============================================================
  // Immutability of the parsed tree
  // ============================================================

  it('does not mutate the parsed tree it receives', async () => {
    const parsed = await parseOtsFile(readOts('hello-world.txt'));
    const before = JSON.stringify(serializableTree(parsed.root));
    computeMerkleMath(parsed);
    const after = JSON.stringify(serializableTree(parsed.root));
    expect(after).toEqual(before);
  });

  // ============================================================
  // Real-world fixtures (sanity)
  // ============================================================

  it('hello-world.txt.ots: pre-aggregation receipt with NO calendar tree, only Bitcoin levels', async () => {
    // hello-world.txt.ots is anchored in block 358391 (May 2015), an
    // era when the calendar made a unique Bitcoin tx per submission --
    // no per-batch Merkle tree on top. The path starts with ripemd160
    // (to fit the commitment into a 20-byte address-like commitment),
    // then wraps it as a tx body, then walks the block's merkle tree.
    const parsed = await parseOtsFile(readOts('hello-world.txt'));
    const [m] = computeMerkleMath(parsed);
    expect(m.blockheight).toBe(358391);
    expect(m.calendar).toBeNull();                  // no per-batch tree
    expect(m.bitcoin).not.toBeNull();
    expect(m.bitcoin!.depth).toBe(11);              // log2(block tx count) ≈ 11
    expect(m.bitcoin!.leafIndex).toBe(1351n);
    expect(m.bitcoin!.leafIndex).toBeLessThan(1n << BigInt(m.bitcoin!.depth));
  });

  it('bitcoin.pdf.ots: aggregating-era receipt with both a calendar tree and a Bitcoin tree', async () => {
    // bitcoin.pdf.ots is anchored in block 465751 (March 2017), after
    // OTS calendars adopted per-batch Merkle aggregation. The path
    // walks: file → calendar tree (single-sha) → tx body wrap → tx
    // double-sha → Bitcoin block tree (double-sha).
    const parsed = await parseOtsFile(readOts('bitcoin.pdf'));
    const [m] = computeMerkleMath(parsed);
    expect(m.blockheight).toBe(465751);
    expect(m.calendar).not.toBeNull();
    expect(m.calendar!.depth).toBe(29);
    expect(m.calendar!.leafIndex).toBe(258428401n);
    expect(m.bitcoin).not.toBeNull();
    expect(m.bitcoin!.depth).toBe(12);              // log2(block tx count) ≈ 12
    expect(m.bitcoin!.leafIndex).toBe(2809n);
  });

  it('pending-only receipts (no Bitcoin attestations) yield no entries', async () => {
    for (const fixture of ['merkle1.txt', 'two-calendars.txt', 'incomplete.txt']) {
      const parsed = await parseOtsFile(readOts(fixture));
      expect(computeMerkleMath(parsed)).toEqual([]);
    }
  });

  // ============================================================
  // Estimated batch bounds
  // ============================================================

  it('estimatedBatchSize bounds always satisfy 2^(depth-1)+1 ≤ leaves ≤ 2^depth', () => {
    for (let depth = 1; depth <= 20; depth++) {
      const ops: OtsOp[] = [];
      for (let lvl = 0; lvl < depth; lvl++) ops.push(...CAL_APP());
      const m = computeMerkleMath(synthChain(ops, 900_000))[0];
      expect(m.calendar!.depth).toBe(depth);
      expect(m.calendar!.estimatedBatchSize.min).toBe((1n << BigInt(depth - 1)) + 1n);
      expect(m.calendar!.estimatedBatchSize.max).toBe(1n << BigInt(depth));
      expect(m.calendar!.leafIndex).toBeLessThan(m.calendar!.estimatedBatchSize.max);
    }
  });
});

// JSON-stable snapshot of a parsed tree (Uint8Array → number[]).
function serializableTree(n: OtsNode): unknown {
  return {
    msg: Array.from(n.msg),
    attestations: n.attestations,
    children: n.children.map(c => ({
      op: opSnapshot(c.op),
      node: serializableTree(c.node),
    })),
  };
}
function opSnapshot(op: OtsOp): unknown {
  if (op.kind === 'append' || op.kind === 'prepend') {
    return { kind: op.kind, arg: Array.from(op.arg) };
  }
  return { kind: op.kind };
}
