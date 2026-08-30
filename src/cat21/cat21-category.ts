/**
 * CAT-21 rarity CATEGORIES (the number bands: sub1k, sub10k, …).
 *
 * The canonical spec is `CAT21-RARITY-SCORE.md` (this repo). This is the
 * single implementation every consumer imports instead of re-declaring
 * the CASE WHEN — the workspace HQ rule mandates the mapping be replicated
 * EXACTLY, which is drift-prone by construction; owning it here removes the
 * drift.
 *
 * Bands are mutually exclusive collections, smallest-first. Each cat carries
 * exactly ONE band: its smallest applicable (cat #0 → sub1, cat 500 → sub1k,
 * cat 5000 → sub10k). Thresholds are inclusive-max.
 *
 * `sub1` is the Genesis Cat's one-cat collection (cat #0 only). The `genesis`
 * boolean trait is separate — it fires for ~0.4% of cats (the visual
 * genesis-palette variant), not just cat #0. See `CAT21-RARITY-SCORE.md`.
 */

/**
 * band → [minCatNumber, maxCatNumber inclusive, dropSize].
 *
 * `dropSize` is the closed population: when a category's row count reaches it,
 * the category is "closed" and its rarity ranks freeze. Consumers that don't
 * rank (a plain category lookup) ignore the third element.
 */
export const CATEGORY_RANGES: Record<string, [number, number, number]> = {
  sub1:    [0,       0,       1],       // Genesis Cat only. Closed since the protocol's first mint.
  sub1k:   [1,       999,     999],     // cats 1..999 (cat #0 lives in sub1)
  sub10k:  [1000,    9999,    9000],
  sub50k:  [10000,   49999,   40000],
  sub100k: [50000,   99999,   50000],
  sub250k: [100000,  249999,  150000],
  sub500k: [250000,  499999,  250000],
  sub1M:   [500000,  999999,  500000],
};

/** Ordered band names, smallest-first (ES2015+ string-key insertion order). */
export const CATEGORIES: readonly string[] = Object.keys(CATEGORY_RANGES);

/**
 * Assign a cat to its smallest applicable band. Returns `''` for cats outside
 * every defined range (the current spec stops at < 1 000 000).
 */
export function deriveCategory(catNumber: number): string {
  for (const [name, [, max]] of Object.entries(CATEGORY_RANGES)) {
    if (catNumber <= max) return name;
  }
  return '';
}
