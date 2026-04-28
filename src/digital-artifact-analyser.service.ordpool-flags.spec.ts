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

  it('should store _ordpoolFlags as type number (not bigint)', async () => {
    // The consumer does BigInt((tx as any)._ordpoolFlags).
    // If we stored bigint, the truthiness check `if (tx._ordpoolFlags)` would
    // behave differently for 0n (falsy) vs 0 (falsy) -- both are falsy, so ok.
    // But BigInt(0n) vs BigInt(0) could differ in some engines.
    // Storing as number is safer and matches the tx.flags convention.
    const tx = { txid: 'type-check', fee: 100 } as TransactionSimplePlus;

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([
      { type: 'Cat21' } as DigitalArtifact,
    ]);
    (DigitalArtifactAnalyserService.analyse as jest.Mock).mockReturnValue({
      flags: OrdpoolTransactionFlags.ordpool_cat21
    });

    await DigitalArtifactAnalyserService.analyseTransactions([tx]);

    // Must be a JS Number (not bigint) for upstream mempool's sync getTransactionFlags()
    expect(typeof (tx as any)._ordpoolFlags).toBe('number');
  });

  it('should be idempotent when called twice on the same tx', async () => {
    // Re-indexing scenario: analyseTransactions called twice on the same array.
    // _ordpoolFlags should be overwritten with the same value, not corrupted.
    const tx = { txid: 'idempotent-test', fee: 100 } as TransactionSimplePlus;

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([
      { type: 'Inscription' } as DigitalArtifact,
    ]);
    (DigitalArtifactAnalyserService.analyse as jest.Mock).mockReturnValue({
      flags: OrdpoolTransactionFlags.ordpool_inscription
    });

    // Call twice
    await DigitalArtifactAnalyserService.analyseTransactions([tx]);
    const firstValue = (tx as any)._ordpoolFlags;

    await DigitalArtifactAnalyserService.analyseTransactions([tx]);
    const secondValue = (tx as any)._ordpoolFlags;

    expect(firstValue).toBe(secondValue);
    expect(secondValue).toBe(Number(OrdpoolTransactionFlags.ordpool_inscription));
  });

  it('should simulate the early return path in getTransactionFlags', async () => {
    // Upstream getTransactionFlags has:
    //   let flags = tx.flags ? BigInt(tx.flags) : 0n;
    //   ... variable flags (CPFP, RBF) ...
    //   if ((tx as any)._ordpoolFlags) { flags |= BigInt(...); }  // our HACK
    //   if (tx.flags) { return Number(flags); }  // early return
    //
    // On FIRST call: tx.flags is 0/undefined -> full computation -> ordpool flags included
    // On SECOND call: tx.flags has all flags from first call (including ordpool)
    //   -> early return path -> ordpool flags already in tx.flags -> still present

    const tx = { txid: 'early-return-test', fee: 100 } as TransactionSimplePlus;

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([
      { type: 'Runestone' } as DigitalArtifact,
    ]);
    (DigitalArtifactAnalyserService.analyse as jest.Mock).mockReturnValue({
      flags: OrdpoolTransactionFlags.ordpool_rune
    });

    // Simulate $getBlockExtended: pre-enrich
    await DigitalArtifactAnalyserService.analyseTransactions([tx]);

    // Simulate FIRST call to getTransactionFlags (tx.flags not set yet)
    const upstreamV2Flag = 0b00000100n; // some upstream static flag
    let flags = (tx as any).flags ? BigInt((tx as any).flags) : 0n;
    flags |= upstreamV2Flag; // upstream adds its flags

    // Our HACK (runs before early return check)
    if ((tx as any)._ordpoolFlags) {
      flags |= BigInt((tx as any)._ordpoolFlags);
    }

    // No early return on first call (tx.flags was falsy)
    // Caller stores result:
    (tx as any).flags = Number(flags);

    // Verify first call result has BOTH upstream and ordpool flags
    expect(BigInt((tx as any).flags) & upstreamV2Flag).toBe(upstreamV2Flag);
    expect(BigInt((tx as any).flags) & OrdpoolTransactionFlags.ordpool_rune).toBe(OrdpoolTransactionFlags.ordpool_rune);

    // Simulate SECOND call to getTransactionFlags (tx.flags IS set now -> early return path)
    let flags2 = (tx as any).flags ? BigInt((tx as any).flags) : 0n;
    // variable flags (CPFP etc) would be added here...

    // Our HACK (still runs, but ordpool flags are already in flags2 via tx.flags)
    if ((tx as any)._ordpoolFlags) {
      flags2 |= BigInt((tx as any)._ordpoolFlags);
    }

    // Early return: if (tx.flags) { return Number(flags2); }
    // Ordpool flags survive because they're in tx.flags from the first call
    expect(BigInt(Number(flags2)) & OrdpoolTransactionFlags.ordpool_rune).toBe(OrdpoolTransactionFlags.ordpool_rune);
    expect(BigInt(Number(flags2)) & upstreamV2Flag).toBe(upstreamV2Flag);
  });

  it('should simulate the mempool path (single tx pre-enrichment)', async () => {
    // In mempool.ts, when a new tx arrives:
    // 1. await analyseTransaction(tx, 0n)  -- sets tx._ordpoolFlags
    // 2. tx.flags = Common.getTransactionFlags(tx)  -- sync, reads _ordpoolFlags
    //
    // This differs from the block path where analyseTransactions (plural) is used.

    const tx = { txid: 'mempool-tx', fee: 250 } as TransactionSimple;

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([
      { type: 'Cat21' } as DigitalArtifact,
    ]);
    (DigitalArtifactAnalyserService.analyse as jest.Mock).mockReturnValue({
      flags: OrdpoolTransactionFlags.ordpool_cat21 | OrdpoolTransactionFlags.ordpool_cat21_mint
    });

    // Step 1: mempool.ts calls analyseTransaction (async, sets _ordpoolFlags)
    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    // Step 2: getTransactionFlags (sync) reads _ordpoolFlags
    let flags = 0n;
    const upstreamFlag = 0b00001000n; // some upstream flag
    flags |= upstreamFlag;
    if ((tx as any)._ordpoolFlags) {
      flags |= BigInt((tx as any)._ordpoolFlags);
    }

    // Both upstream and ordpool flags present
    expect(flags & upstreamFlag).toBe(upstreamFlag);
    expect(flags & OrdpoolTransactionFlags.ordpool_cat21).toBe(OrdpoolTransactionFlags.ordpool_cat21);
    expect(flags & OrdpoolTransactionFlags.ordpool_cat21_mint).toBe(OrdpoolTransactionFlags.ordpool_cat21_mint);
  });
});
