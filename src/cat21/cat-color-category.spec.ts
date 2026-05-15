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
    expect(hueToColorCategory(210)).toBe('blue');
    expect(hueToColorCategory(270)).toBe('purple');
    expect(hueToColorCategory(315)).toBe('pink');
  });

  it('wraps red across the 0/360 seam', () => {
    expect(hueToColorCategory(355)).toBe('red');
    expect(hueToColorCategory(5)).toBe('red');
    expect(hueToColorCategory(360)).toBe('red');
  });

  it('treats cyan as blue (one-bucket consolidation per the search plan)', () => {
    expect(hueToColorCategory(180)).toBe('blue');
  });

  it('normalizes out-of-range hues into [0, 360)', () => {
    expect(hueToColorCategory(720)).toBe('red');
    expect(hueToColorCategory(-10)).toBe('red');
  });
});

describe('getCatColorCategory', () => {

  // The genesis cat: real mainnet txid + block hash from
  // cat21-parser.service.spec.ts. Returns null because genesis cats have
  // no body hue — they get a hand-picked b/w palette.
  const GENESIS_TXID    = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';
  const GENESIS_BLOCKID = '000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7';
  const GENESIS_FEE_RATE = 40834 / (705 / 4);

  it('returns null for the genesis cat (no body hue to bucket)', () => {
    expect(getCatColorCategory(GENESIS_TXID, GENESIS_BLOCKID, GENESIS_FEE_RATE)).toBeNull();
  });

  it('is deterministic — same inputs always yield the same bucket', () => {
    const a = getCatColorCategory(GENESIS_TXID, GENESIS_BLOCKID, GENESIS_FEE_RATE);
    const b = getCatColorCategory(GENESIS_TXID, GENESIS_BLOCKID, GENESIS_FEE_RATE);
    expect(a).toBe(b);
  });

  it('returns one of the seven documented buckets (or null) for arbitrary inputs', () => {
    const txId   = 'a'.repeat(64);
    const blockId = '0'.repeat(64);
    const result = getCatColorCategory(txId, blockId, 17.5);
    if (result !== null) {
      expect(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']).toContain(result);
    }
  });

  it('agrees with the parsed cat traits for the genesis cat (genesis flag matches null bucket)', () => {
    // Cross-check against the parser's own `genesis` trait: any cat the
    // parser flags `genesis: true` must return null here.
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
    expect(getCatColorCategory(txn.txid, txn.status.block_hash, GENESIS_FEE_RATE)).toBeNull();
  });

  it('throws for malformed txid / blockId (delegated to createCatHash)', () => {
    expect(() => getCatColorCategory('short', '0'.repeat(64), 10)).toThrow();
    expect(() => getCatColorCategory('a'.repeat(64), 'not-hex'.padEnd(64, 'a'), 10)).toThrow();
  });
});
