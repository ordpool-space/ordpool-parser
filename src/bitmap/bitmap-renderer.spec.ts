import { MondrianLayout } from './mondrian-layout';
import { logTxSize, parseBitmapHeight, renderBitmapSvg, txSatsToSizes } from './bitmap-renderer';

describe('logTxSize', () => {

  it('clamps zero / sub-100k sats to size 1', () => {
    expect(logTxSize(0)).toBe(1);
    expect(logTxSize(1)).toBe(1);
    expect(logTxSize(99_999)).toBe(1);
    expect(logTxSize(100_000)).toBe(1);
  });

  it('rounds up to the next decade boundary', () => {
    // 100_001 sats: ceil(log10(100001)) = 6; 6 - 5 = 1.
    expect(logTxSize(100_001)).toBe(1);
    // 1 BTC = 1e8 sats: ceil(log10(1e8)) = 8; 8 - 5 = 3.
    expect(logTxSize(100_000_000)).toBe(3);
    // 50 BTC (genesis coinbase reward) = 5e9 sats: ceil(log10(5e9)) = 10; 10 - 5 = 5.
    expect(logTxSize(5_000_000_000)).toBe(5);
    // 21 million BTC = 2.1e15 sats: ceil(log10(2.1e15)) = 16; 16 - 5 = 11.
    expect(logTxSize(21_000_000 * 100_000_000)).toBe(11);
  });

  it('txSatsToSizes maps each tx total through logTxSize', () => {
    expect(txSatsToSizes([0, 100_000_000, 5_000_000_000])).toEqual([1, 3, 5]);
  });
});

describe('parseBitmapHeight', () => {

  it('accepts the canonical "<height>.bitmap" shape', () => {
    expect(parseBitmapHeight('0.bitmap')).toBe(0);
    expect(parseBitmapHeight('1.bitmap')).toBe(1);
    expect(parseBitmapHeight('842000.bitmap')).toBe(842000);
  });

  it('rejects leading zeros and non-canonical formatting', () => {
    expect(parseBitmapHeight('00.bitmap')).toBeNull();
    expect(parseBitmapHeight('01.bitmap')).toBeNull();
    expect(parseBitmapHeight(' 1.bitmap')).toBeNull();
    expect(parseBitmapHeight('1.bitmap\n')).toBeNull();
  });

  it('rejects anything that is not the .bitmap protocol marker', () => {
    expect(parseBitmapHeight('1.BITMAP')).toBeNull();
    expect(parseBitmapHeight('1bitmap')).toBeNull();
    expect(parseBitmapHeight('bitmap.1')).toBeNull();
    expect(parseBitmapHeight('')).toBeNull();
    expect(parseBitmapHeight('-1.bitmap')).toBeNull();
  });
});

describe('MondrianLayout', () => {

  it('places a single size-1 tx in a 1x1 grid', () => {
    const layout = new MondrianLayout([1]);
    expect(layout.slots).toEqual([{ position: { x: 0, y: 0 }, size: 1 }]);
    expect(layout.getSize()).toEqual({ width: 1, height: 1 });
  });

  it('places [2, 1] side-by-side in a 3x2 grid', () => {
    const layout = new MondrianLayout([2, 1]);
    expect(layout.slots).toEqual([
      { position: { x: 0, y: 0 }, size: 2 },
      { position: { x: 2, y: 0 }, size: 1 },
    ]);
    expect(layout.getSize()).toEqual({ width: 3, height: 2 });
  });

  it('places [3, 2, 1] — size-2 opens a new row because the size-3 leaves only a 1-wide gap', () => {
    const layout = new MondrianLayout([3, 2, 1]);
    expect(layout.slots).toEqual([
      { position: { x: 0, y: 0 }, size: 3 },
      { position: { x: 0, y: 3 }, size: 2 },
      { position: { x: 3, y: 0 }, size: 1 },
    ]);
    expect(layout.getSize()).toEqual({ width: 4, height: 5 });
  });

  it('keeps slots in placement order, not spatial order', () => {
    const layout = new MondrianLayout([1, 3, 2]);
    expect(layout.slots[0].size).toBe(1);
    expect(layout.slots[1].size).toBe(3);
    expect(layout.slots[2].size).toBe(2);
  });

  it('grid edge length = ceil(sqrt(sum of squares))', () => {
    // 3^2 + 2^2 + 1^2 = 14, ceil(sqrt(14)) = 4.
    expect(new MondrianLayout([3, 2, 1]).length).toBe(4);
    // 5^2 = 25, ceil(sqrt(25)) = 5.
    expect(new MondrianLayout([5]).length).toBe(5);
  });
});

describe('renderBitmapSvg', () => {

  it('emits the empty SVG for an empty block', () => {
    expect(renderBitmapSvg([])).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0"></svg>',
    );
  });

  it('renders [1] as a single half-unit-padded square in Bitcoin orange', () => {
    // padd = 0.5: a size-1 square renders as a 0.5x0.5 box from (0,0).
    expect(renderBitmapSvg([1])).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0.5 0.5">'
      + '<path d="M0 0H0.5V0.5H0Z" fill="#F7931A"/>'
      + '</svg>',
    );
  });

  it('renders [2, 1] with two path segments, viewBox = bounding box', () => {
    // (0,0) size 2 -> M0 0H1.5V1.5H0Z   (right=1.5, bottom=1.5)
    // (2,0) size 1 -> M2 0H2.5V0.5H2Z   (right=2.5, bottom=0.5)
    expect(renderBitmapSvg([2, 1])).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2.5 1.5">'
      + '<path d="M0 0H1.5V1.5H0ZM2 0H2.5V0.5H2Z" fill="#F7931A"/>'
      + '</svg>',
    );
  });

  it('honours custom color + background', () => {
    expect(renderBitmapSvg([1], { color: '#000', background: '#fff' })).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0.5 0.5">'
      + '<rect x="0" y="0" width="0.5" height="0.5" fill="#fff"/>'
      + '<path d="M0 0H0.5V0.5H0Z" fill="#000"/>'
      + '</svg>',
    );
  });

  it('renders [3, 2, 1] with placement order preserved in the path', () => {
    // Placement (see MondrianLayout test): (0,0)/3, (0,3)/2, (3,0)/1
    // viewBox right = max(2.5, 1.5, 3.5) = 3.5; bottom = max(2.5, 4.5, 0.5) = 4.5
    expect(renderBitmapSvg([3, 2, 1])).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3.5 4.5">'
      + '<path d="M0 0H2.5V2.5H0ZM0 3H1.5V4.5H0ZM3 0H3.5V0.5H3Z" fill="#F7931A"/>'
      + '</svg>',
    );
  });
});
