import { Cat21ParserService } from './cat21-parser.service';
import { getCatColorCategory, hueToColorCategory } from './cat-color-category';

// Genuine mainnet cats — pulled from the snapshot tests in
// mooncat-parser.traits.test.ts. Each entry pins the exact txid/blockId/feeRate
// that produces a known body color, so the bucket assignment becomes a
// regression check against the parser's own color algorithm.
//
// To find more: any cat detail page on cat21.space shows the txHash +
// blockHash + fee + weight. feeRate = fee / (weight / 4).

describe('hueToColorCategory', () => {

  it('buckets unambiguous primaries by hue', () => {
    expect(hueToColorCategory(0)).toBe('red');
    expect(hueToColorCategory(30)).toBe('orange');
    expect(hueToColorCategory(60)).toBe('yellow');
    expect(hueToColorCategory(120)).toBe('green');
    expect(hueToColorCategory(180)).toBe('cyan');
    expect(hueToColorCategory(210)).toBe('blue');
    expect(hueToColorCategory(270)).toBe('purple');
    expect(hueToColorCategory(315)).toBe('pink');
  });

  it('wraps red across the 0/360 seam', () => {
    expect(hueToColorCategory(355)).toBe('red');
    expect(hueToColorCategory(5)).toBe('red');
    expect(hueToColorCategory(360)).toBe('red');
  });

  it('splits cyan from blue at hue 195', () => {
    expect(hueToColorCategory(194)).toBe('cyan');
    expect(hueToColorCategory(195)).toBe('blue');
  });

  it('normalizes out-of-range hues into [0, 360)', () => {
    expect(hueToColorCategory(720)).toBe('red');
    expect(hueToColorCategory(-10)).toBe('red');
  });
});

describe('getCatColorCategory', () => {

  // The genesis cat: real mainnet txid + block hash from
  // cat21-parser.service.spec.ts.
  const GENESIS_TXID    = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';
  const GENESIS_BLOCKID = '000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7';
  const GENESIS_FEE_RATE = 40834 / (705 / 4);

  // Synthetic non-genesis IDs for fee-rate easter-egg tests. bytes[0] is
  // 245 for this pair (verified via SHA-256), so the genesis branch is
  // skipped and the feeRate path runs.
  const NON_GENESIS_TXID = '0'.repeat(64);
  const NON_GENESIS_BLOCKID = '0'.repeat(64);

  it('returns white for the genesis cat (bytes[1]=152 ≥ 128 → inverted palette)', () => {
    expect(getCatColorCategory(GENESIS_TXID, GENESIS_BLOCKID, GENESIS_FEE_RATE)).toBe('white');
  });

  it('genesis wins over fee-rate easter eggs', () => {
    // Even if a genesis cat had paid a fire-cat fee rate, it'd render as
    // the hardcoded genesis palette. Bucket follows the visual.
    expect(getCatColorCategory(GENESIS_TXID, GENESIS_BLOCKID, 69.5)).toBe('white');
    expect(getCatColorCategory(GENESIS_TXID, GENESIS_BLOCKID, 420.5)).toBe('white');
  });

  it('is deterministic — same inputs always yield the same bucket', () => {
    const a = getCatColorCategory(GENESIS_TXID, GENESIS_BLOCKID, GENESIS_FEE_RATE);
    const b = getCatColorCategory(GENESIS_TXID, GENESIS_BLOCKID, GENESIS_FEE_RATE);
    expect(a).toBe(b);
  });

  it('agrees with the parsed cat traits for the genesis cat (genesis flag matches white bucket)', () => {
    const txn = {
      txid: GENESIS_TXID,
      locktime: 21,
      weight: 705,
      fee: 40834,
      status: { block_hash: GENESIS_BLOCKID },
    };
    const parsed = Cat21ParserService.parse(txn);
    const traits = parsed?.getTraits();
    expect(traits?.genesis).toBe(true);
    expect(getCatColorCategory(txn.txid, txn.status.block_hash, GENESIS_FEE_RATE)).toBe('white');
  });

  describe('fee-rate easter eggs', () => {

    it("returns 'fire' for fee rates in [69, 70) on non-genesis cats", () => {
      expect(getCatColorCategory(NON_GENESIS_TXID, NON_GENESIS_BLOCKID, 69)).toBe('fire');
      expect(getCatColorCategory(NON_GENESIS_TXID, NON_GENESIS_BLOCKID, 69.5)).toBe('fire');
      expect(getCatColorCategory(NON_GENESIS_TXID, NON_GENESIS_BLOCKID, 69.999)).toBe('fire');
    });

    it("does NOT return 'fire' outside the [69, 70) window", () => {
      expect(getCatColorCategory(NON_GENESIS_TXID, NON_GENESIS_BLOCKID, 68.999)).not.toBe('fire');
      expect(getCatColorCategory(NON_GENESIS_TXID, NON_GENESIS_BLOCKID, 70)).not.toBe('fire');
    });

    it("returns 'saturated' for fee rates in [420, 421) on non-genesis cats", () => {
      expect(getCatColorCategory(NON_GENESIS_TXID, NON_GENESIS_BLOCKID, 420)).toBe('saturated');
      expect(getCatColorCategory(NON_GENESIS_TXID, NON_GENESIS_BLOCKID, 420.5)).toBe('saturated');
      expect(getCatColorCategory(NON_GENESIS_TXID, NON_GENESIS_BLOCKID, 420.999)).toBe('saturated');
    });

    it("does NOT return 'saturated' outside the [420, 421) window", () => {
      expect(getCatColorCategory(NON_GENESIS_TXID, NON_GENESIS_BLOCKID, 419.999)).not.toBe('saturated');
      expect(getCatColorCategory(NON_GENESIS_TXID, NON_GENESIS_BLOCKID, 421)).not.toBe('saturated');
    });
  });

  it('returns one of the twelve documented buckets for arbitrary non-genesis inputs', () => {
    const result = getCatColorCategory(NON_GENESIS_TXID, NON_GENESIS_BLOCKID, 17.5);
    expect([
      'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink',
      'black', 'white', 'fire', 'saturated',
    ]).toContain(result);
  });

  it('throws for malformed txid / blockId (delegated to createCatHash)', () => {
    expect(() => getCatColorCategory('short', '0'.repeat(64), 10)).toThrow();
    expect(() => getCatColorCategory('a'.repeat(64), 'not-hex'.padEnd(64, 'a'), 10)).toThrow();
  });
});
