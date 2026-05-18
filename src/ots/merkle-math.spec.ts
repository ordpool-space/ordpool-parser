import { readFileSync } from 'fs';
import { computeMerkleMath } from './merkle-math';
import { parseOtsFile } from './ots-parser.service';
import { OtsNode } from './parsed-ots';

function readOts(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`testdata/ots_${name}.ots`));
}

// Tests use only REAL .ots binaries that live in testdata/.
//
// Fixtures used here:
//   - ots_hello-world.txt.ots   (anchored, pre-aggregation era — block 358391, May 2015)
//   - ots_bitcoin.pdf.ots       (anchored, aggregation era — block 465751, March 2017)
//   - ots_merkle1.txt.ots       (pending-only)
//   - ots_two-calendars.txt.ots (pending-only, two calendar subtrees)
//   - ots_incomplete.txt.ots    (pending-only)
//   - ots_merkle-math-fixture.txt.pending.ots (pending-only, freshly stamped
//     via ordpool.space's backend digest proxy against alice + bob + finney +
//     catallaxy on 2026-05-18 — see commit message for the SHA-256 input)
//
// Independent verification of the Bitcoin-tree depth + leafIndex bounds
// is done by cross-checking against mempool.space's block API:
//
//   curl -sS https://mempool.space/api/block-height/358391
//     -> 000000000000000010fe11a78dbef0ec3aabf7b3d12d62d6d8b54d8e75a25ffa
//   curl -sS https://mempool.space/api/block/<hash> | jq .tx_count
//     -> 1433             (=> ceil(log2(1433)) = 11)
//   block 465751 -> tx_count = 3022   (=> ceil(log2(3022)) = 12)
//
// Those are the externally-verifiable facts the assertions below pin:
// the detector's reported bitcoin.depth must equal ceil(log2(tx_count))
// and the reported leafIndex must satisfy 0 <= leafIndex < tx_count.
//
// The exact leafIndex value (e.g. 1351) is the calendar's anchor tx
// position in the block; corroborating that position against the actual
// txid at that index would require knowing the calendar's anchor txid
// for each fixture, which neither python-opentimestamps's test data nor
// the OTS spec publish. We pin the SUT-computed value as a regression
// guard and rely on the bounds for correctness.
//
// The CALENDAR tree's leafIndex (e.g. 258428401 for bitcoin.pdf) is
// genuinely SUT-internal -- no public source enumerates positions in a
// calendar's per-batch tree. Pinned as a regression guard only.

describe('computeMerkleMath', () => {

  it('hello-world.txt.ots: pre-aggregation receipt has NO calendar tree, only Bitcoin block-tree levels', async () => {
    // 2015-era OTS calendar: one Bitcoin transaction per submission,
    // so the calendar's "tree" is degenerate (just the file hash → P2SH
    // commitment wrap → tx body → block tree). No per-batch Merkle
    // aggregation, hence no [sib 32B, sha256] pairs preceding the
    // tx-body assembly.
    const blockTxCount = 1433;   // mempool.space, block 358391, verified above.
    const parsed = await parseOtsFile(readOts('hello-world.txt'));
    const out = computeMerkleMath(parsed);
    expect(out).toHaveLength(1);
    const [m] = out;
    expect(m.blockheight).toBe(358391);
    expect(m.calendar).toBeNull();
    expect(m.bitcoin).not.toBeNull();
    // EXTERNALLY VERIFIED: depth must equal ceil(log2(tx_count)).
    expect(m.bitcoin!.depth).toBe(Math.ceil(Math.log2(blockTxCount)));
    // EXTERNALLY VERIFIED: anchor tx position must be within the block.
    expect(m.bitcoin!.leafIndex).toBeGreaterThanOrEqual(0n);
    expect(m.bitcoin!.leafIndex).toBeLessThan(BigInt(blockTxCount));
    // SUT-pinned regression guard for the exact position.
    expect(m.bitcoin!.leafIndex).toBe(1351n);
    // Single-subtree receipt: index 0 of 1.
    expect(m.subtreeIndex).toBe(0);
    expect(m.subtreeCount).toBe(1);
  });

  it('bitcoin.pdf.ots: aggregation-era receipt has both a calendar tree and a Bitcoin block tree', async () => {
    // 2017-era OTS calendar with per-batch Merkle aggregation. The path
    // walks: file → calendar tree (single-sha) → tx body wrap → txid
    // double-sha → Bitcoin block tree (double-sha).
    const blockTxCount = 3022;   // mempool.space, block 465751, verified above.
    const parsed = await parseOtsFile(readOts('bitcoin.pdf'));
    const out = computeMerkleMath(parsed);
    expect(out).toHaveLength(1);
    const [m] = out;
    expect(m.blockheight).toBe(465751);

    // Calendar tree: pinned values only -- no public source enumerates
    // positions in a calendar's batch / cross-batch tree, so this is a
    // regression guard rather than an independently-verified fact.
    expect(m.calendar).not.toBeNull();
    expect(m.calendar!.depth).toBe(29);
    expect(m.calendar!.leafIndex).toBe(258428401n);
    // depth=29 here reflects the calendar's all-time cross-batch
    // accumulator depth at the moment of anchoring, NOT the per-batch
    // submission count. The calendar uses a merkle-mountain-range-style
    // chain so deeper-than-batch shapes are expected.

    // Bitcoin tree: externally verified.
    expect(m.bitcoin).not.toBeNull();
    expect(m.bitcoin!.depth).toBe(Math.ceil(Math.log2(blockTxCount)));
    expect(m.bitcoin!.leafIndex).toBeGreaterThanOrEqual(0n);
    expect(m.bitcoin!.leafIndex).toBeLessThan(BigInt(blockTxCount));
    expect(m.bitcoin!.leafIndex).toBe(2809n);   // regression guard for exact position

    // bitcoin.pdf.ots is a single-calendar receipt with one Bitcoin anchor.
    expect(m.subtreeIndex).toBe(0);
    expect(m.subtreeCount).toBe(1);
  });

  it('merkle-math-fixture.txt.pending.ots: four top-level subtrees (one per calendar)', async () => {
    const parsed = await parseOtsFile(readOts('merkle-math-fixture.txt.pending'));
    // Even with no Bitcoin attestations, the receipt's structure is
    // observable: four root subtrees, one per calendar we POSTed to.
    expect(parsed.root.children.length).toBe(4);
    // computeMerkleMath returns no entries (pending-only), but the
    // root.children.length is what the next anchored multi-calendar
    // verification will use as subtreeCount.
    expect(computeMerkleMath(parsed)).toEqual([]);
  });

  it('pending-only fixtures yield no entries (no Bitcoin attestation exists yet)', async () => {
    for (const fixture of ['merkle1.txt', 'two-calendars.txt', 'incomplete.txt', 'merkle-math-fixture.txt.pending']) {
      const parsed = await parseOtsFile(readOts(fixture));
      expect(computeMerkleMath(parsed)).toEqual([]);
    }
  });

  it('merkle-math-fixture.txt.pending.ots: freshly-stamped four-calendar pending receipt parses cleanly', async () => {
    // This fixture was produced by POSTing the SHA-256 of a known
    // sentence ("Bitcoin: A Peer-to-Peer Electronic Cash System\n") to
    // each of the four configured OTS calendars via ordpool.space's
    // /api/v1/ordpool/ots/digest proxy, on 2026-05-18. Four subtrees
    // were assembled with the standard 0xff continuation separator.
    //
    // Once any one calendar publishes its Bitcoin anchor, the upgraded
    // .ots can replace this pending one and the test above
    // (anchored-fixture assertions) will gain a fourth case.
    const parsed = await parseOtsFile(readOts('merkle-math-fixture.txt.pending'));
    expect(parsed.fileHashAlgo).toBe('sha256');
    expect(Buffer.from(parsed.fileHash).toString('hex')).toBe(
      'd1f40227cfca27d026d6e769833231242536e6b19df9b8374bef1ded606ca7cd',
    );
    // No Bitcoin attestations yet.
    expect(computeMerkleMath(parsed)).toEqual([]);
    // But we should see one pending attestation per calendar (4 of them).
    const pending: string[] = [];
    const visit = (n: OtsNode) => {
      for (const a of n.attestations) if (a.kind === 'pending') pending.push(a.uri);
      for (const c of n.children) visit(c.node);
    };
    visit(parsed.root);
    expect(pending.length).toBe(4);
    // Each calendar advertises its own /timestamp/<hex> URL inside the
    // pending attestation. Sanity: the four hostnames we POSTed to.
    const hosts = pending.map(u => new URL(u).hostname).sort();
    expect(hosts).toEqual([
      'alice.btc.calendar.opentimestamps.org',
      'bob.btc.calendar.opentimestamps.org',
      'btc.calendar.catallaxy.com',
      'finney.calendar.eternitywall.com',
    ]);
  });

  it('does not mutate the parsed tree it receives', async () => {
    const parsed = await parseOtsFile(readOts('hello-world.txt'));
    const before = JSON.stringify(serializableTree(parsed.root));
    computeMerkleMath(parsed);
    const after = JSON.stringify(serializableTree(parsed.root));
    expect(after).toEqual(before);
  });

});

function serializableTree(n: OtsNode): unknown {
  return {
    msg: Array.from(n.msg),
    attestations: n.attestations,
    children: n.children.map(c => ({
      op: 'arg' in c.op ? { kind: c.op.kind, arg: Array.from(c.op.arg) } : { kind: c.op.kind },
      node: serializableTree(c.node),
    })),
  };
}
