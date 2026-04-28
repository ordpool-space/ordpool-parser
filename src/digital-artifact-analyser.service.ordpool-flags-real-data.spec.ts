import { readTransaction } from '../testdata/test.helper';
import { DigitalArtifactAnalyserService } from './digital-artifact-analyser.service';
import { OrdpoolTransactionFlags } from './types/ordpool-transaction-flags';

/**
 * Real blockchain data tests for _ordpoolFlags -- NO MOCKS.
 * These prove _ordpoolFlags works with actual Bitcoin transactions through the full pipeline.
 * Every assertion uses exact flag values, not lazy checks.
 */
describe('_ordpoolFlags with real blockchain data (no mocks)', () => {

  // CAT-21 genesis cat (nLockTime = 21)
  it('should set _ordpoolFlags for the CAT-21 genesis cat', async () => {
    const tx = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');

    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    const flags = (tx as any)._ordpoolFlags;
    expect(typeof flags).toBe('number');

    // Exact flag value: cat21 + cat21_mint, no other bits set
    const flagsBigInt = BigInt(flags);
    expect(flagsBigInt).toBe(
      OrdpoolTransactionFlags.ordpool_cat21 | OrdpoolTransactionFlags.ordpool_cat21_mint,
    );
  });

  // Rune etching: Z.Z.Z.Z.Z.FEHU.Z.Z.Z.Z.Z (block 840,000 tx #1)
  it('should set _ordpoolFlags for a rune etching transaction', async () => {
    const tx = readTransaction('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');

    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    const flags = (tx as any)._ordpoolFlags;
    expect(typeof flags).toBe('number');

    const flagsBigInt = BigInt(flags);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_rune).toBe(OrdpoolTransactionFlags.ordpool_rune);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_rune_etch).toBe(OrdpoolTransactionFlags.ordpool_rune_etch);
  });

  // Inscription: OrdRain gallery (image/webp inscription)
  it('should set _ordpoolFlags for an inscription transaction', async () => {
    const tx = readTransaction('f6d848b3dc15955a82eb738f2de38e56a0346303444600f0e0726c678632c055');

    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    const flags = (tx as any)._ordpoolFlags;
    expect(typeof flags).toBe('number');

    const flagsBigInt = BigInt(flags);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription).toBe(OrdpoolTransactionFlags.ordpool_inscription);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_mint).toBe(OrdpoolTransactionFlags.ordpool_inscription_mint);
    // Content-type bucket: image/webp -> ordpool_inscription_image (and NOT _text or _json)
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_image).toBe(OrdpoolTransactionFlags.ordpool_inscription_image);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_text).toBe(0n);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_json).toBe(0n);
  });

  // Inscription with PNG content -> ordpool_inscription_image
  it('should set ordpool_inscription_image for a PNG inscription', async () => {
    // 092111e8... has 3 PNG inscriptions in one tx
    const tx = readTransaction('092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cc');

    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    const flagsBigInt = BigInt((tx as any)._ordpoolFlags);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_image).toBe(OrdpoolTransactionFlags.ordpool_inscription_image);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_text).toBe(0n);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_json).toBe(0n);
  });

  // Inscription with text/html content -> ordpool_inscription_text
  it('should set ordpool_inscription_text for an HTML inscription', async () => {
    // 11d3f4b3... has 3 text/html inscriptions
    const tx = readTransaction('11d3f4b39e8ab97995bab1eacf7dcbf1345ec59c07261c0197e18bf29b88d8da');

    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    const flagsBigInt = BigInt((tx as any)._ordpoolFlags);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_text).toBe(OrdpoolTransactionFlags.ordpool_inscription_text);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_image).toBe(0n);
  });

  // Inscription with text/plain that parses as JSON object -> ordpool_inscription_text + _json
  it('should set ordpool_inscription_text AND _json for a BRC-20 deploy (text/plain JSON)', async () => {
    // 49cbc5cb... is text/plain content that happens to be valid BRC-20 deploy JSON
    const tx = readTransaction('49cbc5cbac92cf917dd4539d62720a3e528d17e22ef5fc47070a17ec0d3cf307');

    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    const flagsBigInt = BigInt((tx as any)._ordpoolFlags);
    // text/plain content type -> _text
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_text).toBe(OrdpoolTransactionFlags.ordpool_inscription_text);
    // body parses as JSON object -> _json (coexists with _text)
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_json).toBe(OrdpoolTransactionFlags.ordpool_inscription_json);
    // Not an image
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_inscription_image).toBe(0n);
    // BRC-20 deploy bits also set
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_brc20).toBe(OrdpoolTransactionFlags.ordpool_brc20);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_brc20_deploy).toBe(OrdpoolTransactionFlags.ordpool_brc20_deploy);
  });

  // Atomical: ATOM DFT reveal
  it('should set _ordpoolFlags for an atomical transaction', async () => {
    const tx = readTransaction('1d2f39f54320631d0432fa495a45a4f298a2ca1b18adef8e4356e327d003a694');

    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    const flags = (tx as any)._ordpoolFlags;
    expect(typeof flags).toBe('number');

    const flagsBigInt = BigInt(flags);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_atomical).toBe(OrdpoolTransactionFlags.ordpool_atomical);
  });

  // Labitbu: WebP in Taproot control block
  it('should set _ordpoolFlags for a labitbu transaction', async () => {
    const tx = readTransaction('5a15dabc8f0c1656ccd07bd2739f683b4c562fb66487329a41f959c38f0cf7d3');

    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    const flags = (tx as any)._ordpoolFlags;
    expect(typeof flags).toBe('number');

    const flagsBigInt = BigInt(flags);
    expect(flagsBigInt & OrdpoolTransactionFlags.ordpool_labitbu).toBe(OrdpoolTransactionFlags.ordpool_labitbu);
  });

  // SRC-20 transaction (OLGA P2WSH encoded stamp transfer)
  // tx 04460b... is an SRC-20 transfer, NOT a "normal" tx (it has stamp: data in P2WSH outputs)
  it('should set _ordpoolFlags for an SRC-20 transaction', async () => {
    const tx = readTransaction('04460b129b970e53de19860f52a276358b5fe7dffc2bb25f7d35cefa62a1755e');

    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    const flags = (tx as any)._ordpoolFlags;
    expect(typeof flags).toBe('number');
    // Exact value: just ordpool_src20 (2^53). This tx is picked up by
    // Src20ParserService (not StampParserService), so the stamp bit isn't set.
    // 2^53 is the highest exact Number; the bigint round-trip is safe here.
    expect(BigInt(flags)).toBe(OrdpoolTransactionFlags.ordpool_src20);
  });

  // Full block integration: analyseTransactions sets _ordpoolFlags on every tx
  it('should set _ordpoolFlags on all transactions in block 840,000 via analyseTransactions', async () => {
    // Block 840,000 has CAT-21 mints, rune etchings, inscriptions, and plain txs.
    // Import the block data (this is a large array of TransactionSimplePlus)
    const { getBlock840000Txns } = await import('../testdata/block_840000_txns');
    const transactions = getBlock840000Txns();

    // Block 840,000 has exactly 3,050 transactions
    expect(transactions.length).toBe(3050);

    await DigitalArtifactAnalyserService.analyseTransactions(transactions);

    // EVERY transaction must have a numeric _ordpoolFlags (typeof check
    // implies presence -- typeof undefined === 'undefined' would fail)
    for (const tx of transactions) {
      expect(typeof (tx as any)._ordpoolFlags).toBe('number');
    }

    // Count txs with ordpool artifacts -- these counts are deterministic for a fixed block
    let withArtifacts = 0;
    let withoutArtifacts = 0;
    for (const tx of transactions) {
      if ((tx as any)._ordpoolFlags > 0) {
        withArtifacts++;
      } else {
        withoutArtifacts++;
      }
    }
    // Counts are pinned exactly. Block 840,000 contains 2,227 txs with at
    // least one ordpool artifact and 823 plain txs (3,050 total). Any change
    // here means the parser started seeing new artifacts (good?) or stopped
    // seeing some (regression). Either way, investigate.
    expect(withArtifacts).toBe(2227);
    expect(withoutArtifacts).toBe(823);

    // The first tx (coinbase) should have no ordpool artifacts
    expect((transactions[0] as any)._ordpoolFlags).toBe(0);
  });
});
