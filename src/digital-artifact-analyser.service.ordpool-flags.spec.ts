import { DigitalArtifactAnalyserService } from "./digital-artifact-analyser.service";
import { DigitalArtifactsParserService } from "./digital-artifacts-parser.service";
import { DigitalArtifact } from "./types/digital-artifact";
import { OrdpoolTransactionFlags } from "./types/ordpool-transaction-flags";
import { TransactionSimple, TransactionSimplePlus } from "./types/transaction-simple";

/**
 * Tests for the _ordpoolFlags pre-enrichment pattern.
 *
 * ordpool is a fork of mempool.space. Upstream's getTransactionFlags() is SYNC.
 * Making it async would cascade async/await changes through 15+ upstream files.
 *
 * Instead, analyseTransactions() and analyseTransaction() set tx._ordpoolFlags
 * as a SIDE EFFECT on each transaction object. Upstream's getTransactionFlags()
 * reads this property via a 3-line HACK:
 *
 *   if ((tx as any)._ordpoolFlags) {
 *     flags |= BigInt((tx as any)._ordpoolFlags);
 *   }
 *
 * Since JavaScript arrays are passed by reference, enriching tx objects in
 * $getBlockExtended makes them visible to summarizeBlockTransactions which
 * runs next on the same array. No async cascade needed.
 */

jest.spyOn(DigitalArtifactsParserService, 'parse').mockImplementation(jest.fn());
jest.spyOn(DigitalArtifactAnalyserService, 'analyse').mockImplementation(jest.fn());

describe('_ordpoolFlags side effect on analyseTransaction', () => {

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should set tx._ordpoolFlags to 0 when no artifacts are found', async () => {
    const tx = { txid: 'test-no-artifacts' } as TransactionSimple;
    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([]);

    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    expect((tx as any)._ordpoolFlags).toBe(0);
  });

  it('should set tx._ordpoolFlags with ordpool-only flags (not input flags)', async () => {
    const tx = { txid: 'test-cat21' } as TransactionSimple;
    const inputFlags = 0b00000001n; // some upstream flag (e.g., RBF)

    const mockArtifact = { type: 'Cat21' } as DigitalArtifact;
    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([mockArtifact]);
    (DigitalArtifactAnalyserService.analyse as jest.Mock).mockReturnValue({
      flags: OrdpoolTransactionFlags.ordpool_cat21
    });

    const result = await DigitalArtifactAnalyserService.analyseTransaction(tx, inputFlags);

    // _ordpoolFlags should contain ONLY ordpool flags, not the input flags
    expect((tx as any)._ordpoolFlags).toBe(Number(OrdpoolTransactionFlags.ordpool_cat21));

    // Return value should contain BOTH input flags and ordpool flags
    expect(result).toBe(inputFlags | OrdpoolTransactionFlags.ordpool_cat21);
  });

  it('should accumulate multiple artifact flags into _ordpoolFlags', async () => {
    const tx = { txid: 'test-multi' } as TransactionSimple;

    const mockArtifacts = [
      { type: 'Cat21' } as DigitalArtifact,
      { type: 'Inscription' } as DigitalArtifact,
    ];
    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue(mockArtifacts);
    (DigitalArtifactAnalyserService.analyse as jest.Mock)
      .mockReturnValueOnce({ flags: OrdpoolTransactionFlags.ordpool_cat21 })
      .mockReturnValueOnce({ flags: OrdpoolTransactionFlags.ordpool_inscription });

    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    const expected = OrdpoolTransactionFlags.ordpool_cat21 | OrdpoolTransactionFlags.ordpool_inscription;
    expect((tx as any)._ordpoolFlags).toBe(Number(expected));
  });
});


describe('_ordpoolFlags side effect on analyseTransactions', () => {

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should set _ordpoolFlags on each transaction in the array', async () => {
    const tx1 = { txid: 'tx1', fee: 100 } as TransactionSimplePlus;
    const tx2 = { txid: 'tx2', fee: 200 } as TransactionSimplePlus;
    const transactions = [tx1, tx2];

    // tx1 has a cat21 artifact
    const cat21Artifact = { type: 'Cat21' } as DigitalArtifact;
    // tx2 has no artifacts
    (DigitalArtifactsParserService.parse as jest.Mock)
      .mockReturnValueOnce([cat21Artifact])
      .mockReturnValueOnce([]);

    (DigitalArtifactAnalyserService.analyse as jest.Mock)
      .mockReturnValue({ flags: OrdpoolTransactionFlags.ordpool_cat21 });

    await DigitalArtifactAnalyserService.analyseTransactions(transactions);

    // tx1 should have cat21 flag
    expect((tx1 as any)._ordpoolFlags).toBe(Number(OrdpoolTransactionFlags.ordpool_cat21));

    // tx2 should have 0 (no artifacts)
    expect((tx2 as any)._ordpoolFlags).toBe(0);
  });

  it('should enable sync getTransactionFlags pattern (the whole point)', async () => {
    // This test simulates the exact flow in the ordpool backend:
    // 1. analyseTransactions enriches tx._ordpoolFlags
    // 2. A sync function reads tx._ordpoolFlags and ORs them into flags
    // This proves the pattern works without async/await in the consumer.

    const tx = { txid: 'tx-sync-test', fee: 500 } as TransactionSimplePlus;

    const mockArtifact = { type: 'Inscription' } as DigitalArtifact;
    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([mockArtifact]);
    (DigitalArtifactAnalyserService.analyse as jest.Mock).mockReturnValue({
      flags: OrdpoolTransactionFlags.ordpool_inscription | OrdpoolTransactionFlags.ordpool_inscription_mint
    });

    // Step 1: async enrichment (runs in $getBlockExtended)
    await DigitalArtifactAnalyserService.analyseTransactions([tx]);

    // Step 2: sync flag reading (simulates upstream getTransactionFlags)
    let flags = 0n;
    const upstreamFlag = 0b00000010n; // e.g., v2 transaction flag
    flags |= upstreamFlag;

    // HACK -- Ordpool: the 3 lines added to getTransactionFlags
    if ((tx as any)._ordpoolFlags) {
      flags |= BigInt((tx as any)._ordpoolFlags);
    }

    // Verify: both upstream and ordpool flags are present
    expect(flags & upstreamFlag).toBe(upstreamFlag);
    expect(flags & OrdpoolTransactionFlags.ordpool_inscription).toBe(OrdpoolTransactionFlags.ordpool_inscription);
    expect(flags & OrdpoolTransactionFlags.ordpool_inscription_mint).toBe(OrdpoolTransactionFlags.ordpool_inscription_mint);
  });

  it('should work with JavaScript reference semantics (same array, two consumers)', async () => {
    // This test proves the core insight: two functions operating on the same
    // array reference see each other's mutations.
    // In the real code:
    //   blockProcessor.$processNewBlock() passes cpfpSummary.transactions to both
    //   $getBlockExtended (which enriches) and summarizeBlockTransactions (which reads).

    const sharedTransactions = [
      { txid: 'shared-tx', fee: 300 } as TransactionSimplePlus,
    ];

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([
      { type: 'Runestone' } as DigitalArtifact,
    ]);
    (DigitalArtifactAnalyserService.analyse as jest.Mock).mockReturnValue({
      flags: OrdpoolTransactionFlags.ordpool_rune
    });

    // Simulate $getBlockExtended: enriches the shared array
    await DigitalArtifactAnalyserService.analyseTransactions(sharedTransactions);

    // Simulate summarizeBlockTransactions: reads from the SAME array
    // (this runs AFTER $getBlockExtended in block-processor.ts)
    const tx = sharedTransactions[0];
    expect((tx as any)._ordpoolFlags).toBe(Number(OrdpoolTransactionFlags.ordpool_rune));

    // A sync classifier can now read ordpool flags without any async:
    let classifiedFlags = 0n;
    if ((tx as any)._ordpoolFlags) {
      classifiedFlags |= BigInt((tx as any)._ordpoolFlags);
    }
    expect(classifiedFlags & OrdpoolTransactionFlags.ordpool_rune).toBe(OrdpoolTransactionFlags.ordpool_rune);
  });
});
