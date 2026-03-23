import { readTransaction } from '../testdata/test.helper';
import { DigitalArtifactAnalyserService } from './digital-artifact-analyser.service';
import { isFlagSet } from './digital-artifact-analyser.service.helper';
import { OrdpoolTransactionFlags } from './types/ordpool-transaction-flags';

/**
 * End-to-end tests for analyseTransaction using REAL blockchain data.
 * Each test parses a real mainnet transaction through the full pipeline:
 * parse() → analyse() → flags.
 *
 * No mocks — this verifies the entire chain from raw hex to final flags.
 */
describe('DigitalArtifactAnalyserService.analyseTransaction — real data', () => {

  // CAT-21 genesis cat (nLockTime = 21)
  it('should detect CAT-21 in the genesis cat transaction', async () => {
    const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    const flags = await DigitalArtifactAnalyserService.analyseTransaction(txn, 0n);

    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_cat21)).toBe(true);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_cat21_mint)).toBe(true);

    // Not an inscription, rune, atomical, or labitbu
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_inscription)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_rune)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_atomical)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_labitbu)).toBe(false);
  });

  // Atomical #0 (ATOM DFT token) — reveal txid
  it('should detect Atomical in the ATOM DFT reveal transaction', async () => {
    const txn = readTransaction('1d2f39f54320631d0432fa495a45a4f298a2ca1b18adef8e4356e327d003a694');
    const flags = await DigitalArtifactAnalyserService.analyseTransaction(txn, 0n);

    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_atomical)).toBe(true);

    // Atomicals also trigger inscription detection (they have an envelope in witness data)
    // This is expected — the inscription parser sees the witness script too
  });

  // Labitbu — WebP in Taproot control block
  it('should detect Labitbu in a real pathology transaction', async () => {
    const txn = readTransaction('5a15dabc8f0c1656ccd07bd2739f683b4c562fb66487329a41f959c38f0cf7d3');
    const flags = await DigitalArtifactAnalyserService.analyseTransaction(txn, 0n);

    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_labitbu)).toBe(true);

    // Not a CAT-21, rune, or atomical
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_cat21)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_rune)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_atomical)).toBe(false);
  });

  // UNCOMMON•GOODS rune etching — the first rune ever (block 840,000)
  it('should detect Rune etching in the UNCOMMON•GOODS transaction', async () => {
    const txn = readTransaction('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
    const flags = await DigitalArtifactAnalyserService.analyseTransaction(txn, 0n);

    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_rune)).toBe(true);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_rune_etch)).toBe(true);

    // This tx also has an inscription (the rune commitment is in tag 13)
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_inscription)).toBe(true);
  });

  // Gallery inscription — OrdRain (111 items, brotli-compressed properties)
  it('should detect inscription in the OrdRain gallery transaction', async () => {
    const txn = readTransaction('f6d848b3dc15955a82eb738f2de38e56a0346303444600f0e0726c678632c055');
    const flags = await DigitalArtifactAnalyserService.analyseTransaction(txn, 0n);

    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_inscription)).toBe(true);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_inscription_mint)).toBe(true);

    // Gallery inscriptions are not BRC-20 (content type is image/webp, not JSON)
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_brc20)).toBe(false);
  });

  // Batch inscription — 2000 inscriptions in one transaction
  it('should detect inscription in a batch inscription transaction', async () => {
    const txn = readTransaction('2740d27e3017da44ee439792f6f60449e43992fddffd9387685b14d21b725ff0');
    const flags = await DigitalArtifactAnalyserService.analyseTransaction(txn, 0n);

    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_inscription)).toBe(true);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_inscription_mint)).toBe(true);
  });

  // Non-artifact transaction — plain Bitcoin transfer
  it('should detect no artifacts in the REKT commit transaction', async () => {
    // The REKT commit tx is a plain p2tr payment — no envelope, no nLockTime=21
    const txn = readTransaction('9ba6f71c6176ef7dab6751e4b71f6e6d13694d65134935bb275d89d1f0e9fdb2');

    // Check if we have this test data
    if (!txn) return;

    const flags = await DigitalArtifactAnalyserService.analyseTransaction(txn, 0n);

    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_atomical)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_cat21)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_inscription)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_labitbu)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_rune)).toBe(false);
  });
});
