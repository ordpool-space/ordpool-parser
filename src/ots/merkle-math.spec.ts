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
// The anchored-fixture leafIndex values asserted below are SUT-pinned:
// they were computed by `computeMerkleMath` itself the first time we ran
// it against the fixtures. Independent verification would mean fetching
// each block's transaction list and locating the calendar's anchor tx
// position; recording that here as a follow-up TODO so a future
// maintainer can corroborate with an external source.

describe('computeMerkleMath', () => {

  it('hello-world.txt.ots: pre-aggregation receipt has NO calendar tree, only Bitcoin block-tree levels', async () => {
    // 2015-era OTS calendar: one Bitcoin transaction per submission,
    // so the calendar's "tree" is degenerate (just the file hash → P2SH
    // commitment wrap → tx body → block tree). No per-batch Merkle
    // aggregation, hence no [sib 32B, sha256] pairs preceding the
    // tx-body assembly.
    const parsed = await parseOtsFile(readOts('hello-world.txt'));
    const out = computeMerkleMath(parsed);
    expect(out).toHaveLength(1);
    const [m] = out;
    expect(m.blockheight).toBe(358391);
    expect(m.calendar).toBeNull();
    expect(m.bitcoin).not.toBeNull();
    expect(m.bitcoin!.depth).toBe(11);
    expect(m.bitcoin!.leafIndex).toBe(1351n);
    // depth=11 → between 2^10+1=1025 and 2^11=2048 txs in the block;
    // mempool.space block 358391 reports ~1500 (TODO: independent
    // verification against a Bitcoin Core / mempool API tx-count call).
    expect(m.bitcoin!.estimatedBatchSize).toEqual({ min: 1025n, max: 2048n });
    expect(m.bitcoin!.leafIndex).toBeLessThan(m.bitcoin!.estimatedBatchSize.max);
  });

  it('bitcoin.pdf.ots: aggregation-era receipt has both a calendar tree and a Bitcoin block tree', async () => {
    // 2017-era OTS calendar with per-batch Merkle aggregation. The path
    // walks: file → calendar tree (single-sha) → tx body wrap → txid
    // double-sha → Bitcoin block tree (double-sha).
    const parsed = await parseOtsFile(readOts('bitcoin.pdf'));
    const out = computeMerkleMath(parsed);
    expect(out).toHaveLength(1);
    const [m] = out;
    expect(m.blockheight).toBe(465751);

    expect(m.calendar).not.toBeNull();
    expect(m.calendar!.depth).toBe(29);
    expect(m.calendar!.leafIndex).toBe(258428401n);
    expect(m.calendar!.leafIndex).toBeLessThan(m.calendar!.estimatedBatchSize.max);
    // depth=29 here reflects the calendar's all-time cross-batch
    // accumulator depth at the moment of anchoring, NOT the per-batch
    // submission count. The calendar uses a merkle-mountain-range-style
    // chain so deeper-than-batch shapes are expected.

    expect(m.bitcoin).not.toBeNull();
    expect(m.bitcoin!.depth).toBe(12);
    expect(m.bitcoin!.leafIndex).toBe(2809n);
    expect(m.bitcoin!.leafIndex).toBeLessThan(m.bitcoin!.estimatedBatchSize.max);
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

  it('estimatedBatchSize bounds are mathematically consistent (2^(d-1)+1 ≤ max=2^d) across both trees of every anchored fixture', async () => {
    // Property test driven by REAL fixtures: the formula in the SUT is
    // load-bearing for downstream UI ("batch is between N and M leaves"),
    // so make sure that for every Bitcoin tree we detect, the bounds
    // honor the expected min/max relationship.
    for (const fixture of ['hello-world.txt', 'bitcoin.pdf']) {
      const parsed = await parseOtsFile(readOts(fixture));
      for (const m of computeMerkleMath(parsed)) {
        for (const tree of [m.calendar, m.bitcoin]) {
          if (!tree) continue;
          expect(tree.estimatedBatchSize.max).toBe(1n << BigInt(tree.depth));
          expect(tree.estimatedBatchSize.min).toBe((1n << BigInt(tree.depth - 1)) + 1n);
          expect(tree.leafIndex).toBeGreaterThanOrEqual(0n);
          expect(tree.leafIndex).toBeLessThan(tree.estimatedBatchSize.max);
        }
      }
    }
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
