import { CATEGORIES, CATEGORY_RANGES, deriveCategory } from './cat21-category';

// Pins the exact band boundaries. The HQ rule mandates every consumer
// replicate this CASE WHEN EXACTLY; this is the single implementation they
// import, so the boundaries are locked here.

describe('deriveCategory — smallest applicable band, inclusive-max', () => {
  it('cat #0 is sub1 (Genesis Cat only)', () => {
    expect(deriveCategory(0)).toBe('sub1');
  });

  it.each([
    [1, 'sub1k'],
    [999, 'sub1k'],
    [1000, 'sub10k'],
    [9999, 'sub10k'],
    [10000, 'sub50k'],
    [49999, 'sub50k'],
    [50000, 'sub100k'],
    [99999, 'sub100k'],
    [100000, 'sub250k'],
    [249999, 'sub250k'],
    [250000, 'sub500k'],
    [499999, 'sub500k'],
    [500000, 'sub1M'],
    [999999, 'sub1M'],
  ])('cat #%i is %s', (catNumber, expected) => {
    expect(deriveCategory(catNumber)).toBe(expected);
  });

  it('returns "" for cats at or beyond 1_000_000 (outside every band)', () => {
    expect(deriveCategory(1_000_000)).toBe('');
    expect(deriveCategory(5_000_000)).toBe('');
  });
});

describe('CATEGORIES / CATEGORY_RANGES shape', () => {
  it('lists all 8 bands smallest-first', () => {
    expect(CATEGORIES).toEqual([
      'sub1', 'sub1k', 'sub10k', 'sub50k', 'sub100k', 'sub250k', 'sub500k', 'sub1M',
    ]);
  });

  it('ranges are contiguous: each band starts one past the previous band max', () => {
    const bands = Object.values(CATEGORY_RANGES);
    for (let i = 1; i < bands.length; i++) {
      const prevMax = bands[i - 1][1];
      const thisMin = bands[i][0];
      expect(thisMin).toBe(prevMax + 1);
    }
  });
});
