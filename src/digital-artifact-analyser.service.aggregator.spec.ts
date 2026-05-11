import { readTransaction } from '../testdata/test.helper';
import { DigitalArtifactAnalyserService } from './digital-artifact-analyser.service';
import { isFlagSet } from './digital-artifact-analyser.service.helper';
import { OrdpoolTransactionFlags } from './types/ordpool-transaction-flags';
import { getEmptyStats } from './types/ordpool-stats';
import { TransactionSimplePlus } from './types/transaction-simple';

/**
 * Aggregator behaviours that aren't already covered by the block-scale
 * tests (block840000.spec.ts) or the per-tx flag-detection tests
 * (analyse-transaction-real-data.spec.ts).
 *
 * Both tests run against real artifact-shaped inputs -- the empty-input
 * case is literally `[]`, and the flag-preservation case feeds a real
 * mainnet CAT-21 transaction. No mocks: every code path the SUT touches
 * is the real production implementation.
 */
describe('DigitalArtifactAnalyserService — aggregator edge cases', () => {

  it('analyseTransactions([]) returns the same shape as getEmptyStats()', async () => {
    const stats = await DigitalArtifactAnalyserService.analyseTransactions([]);

    // The aggregator must start from a zeroed snapshot. Any state leak
    // (e.g. a static counter not reset between calls) would surface here.
    const empty = getEmptyStats();

    // Version is set on every analysis; everything else must match empty.
    expect(stats.amounts).toEqual(empty.amounts);
    expect(stats.fees).toEqual(empty.fees);
    expect(stats.inscriptions).toEqual(empty.inscriptions);
    expect(stats.runes.mostActiveMint).toBeNull();
    expect(stats.runes.mostActiveNonUncommonMint).toBeNull();
    expect(stats.brc20.mostActiveMint).toBeNull();
    expect(stats.src20.mostActiveMint).toBeNull();
  });

  it('analyseTransactions([]) called twice in a row produces independent results', async () => {
    // A second guard against state-leak regressions: any internal
    // accumulator stored on the class (rather than per-call) would
    // surface as non-zero counts on the second call.
    const first = await DigitalArtifactAnalyserService.analyseTransactions([]);
    const second = await DigitalArtifactAnalyserService.analyseTransactions([]);
    expect(first.amounts).toEqual(second.amounts);
    expect(first.fees).toEqual(second.fees);
  });

  it('analyseTransaction preserves existing flag bits while OR-ing in derived ones', async () => {
    // Real mainnet CAT-21 #0 genesis tx -- analyseTransaction must set
    // the cat21 + cat21_mint bits AND leave any pre-existing bits alone.
    const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');

    // Seed an unrelated upstream flag (rbf) so we can check it survives.
    // 1n is a safe "low" mempool flag value below all ordpool bits.
    const initialFlags = 1n;
    const out = await DigitalArtifactAnalyserService.analyseTransaction(txn as TransactionSimplePlus, initialFlags);
    const outNumber = Number(out);

    // Derived bits are set.
    expect(isFlagSet(outNumber, OrdpoolTransactionFlags.ordpool_cat21)).toBe(true);
    expect(isFlagSet(outNumber, OrdpoolTransactionFlags.ordpool_cat21_mint)).toBe(true);

    // Pre-existing low bit is still there -- the BigInt OR must not clobber
    // bits we didn't touch (i.e. analyseTransaction returns `initial | derived`,
    // not `derived` alone).
    expect((out & initialFlags)).toBe(initialFlags);
  });
});
