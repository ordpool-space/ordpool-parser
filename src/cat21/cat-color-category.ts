import { hexToBytes } from '../lib/conversions';
import { createCatHash } from './cat21-parser.service.helper';
import { feeRateToColor } from './mooncat-parser.colors';
import { RGBToHSL } from './mooncat-parser.helper';

/**
 * Cat color bucketing for search/filtering.
 *
 * CAT-21 cats have a single body color derived from the fee rate
 * (`feeRateToColor` in mooncat-parser.colors) seeded by `bytes[1]` of the
 * `SHA256(txId + blockId)` cat hash. The 5-entry `catColors` palette is
 * just lighter/darker shades of that single hue. This helper recomputes
 * the body hue using the parser's own primitives and maps it to a
 * search-facing bucket so a UX can filter "red cats" etc.
 *
 * The bucket list intentionally goes beyond the hue wheel:
 *
 * - `'black'` / `'white'`: the two hardcoded genesis palettes. The
 *   parser's `genesis` trait fires when `catHash[0] === 79` — a ~0.4%
 *   visual variant that hits hundreds of cats out of the full supply,
 *   not just cat #0. Affected cats short-circuit the hue path and get
 *   one of these two looks depending on `bytes[1] >= 128` (the
 *   `inverted` flag). Genesis wins regardless of fee rate.
 * - `'fire'`: cats whose mint paid a fee rate in `[69, 70)` sat/vB. The
 *   parser repaints body slots 1..3 to red/orange/yellow — the
 *   easter-egg "fire cat 🔥". Without a dedicated bucket these would be
 *   mis-tagged as `'orange'` based on raw hue.
 * - `'saturated'`: cats whose mint paid a fee rate in `[420, 421)`
 *   sat/vB. The parser bumps the body saturation to 42.0 (joke value).
 *   Visually a "loud" version of whatever hue they'd otherwise have.
 *
 * There's no `'cyan'` bucket: `feeRateToColor` sweeps green → yellow →
 * orange → red → blue and never produces a hue in the [165°, 195°)
 * teal range. That range folds into blue.
 *
 * These are not traits — the parser's `CatTraits` shape is unchanged.
 * The bucket name just describes faithfully what the cat looks like, so
 * search returns the set spotters expect.
 *
 * `feeRateToColor` always emits saturated body colors (saturation in
 * [0.75, 1.0]), so there are no "gray" cats — no such bucket.
 *
 * NOT part of the frozen CAT-21 spec. New utility built on top of the
 * frozen primitives without modifying them.
 */

export type CatColorCategory =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'black'
  | 'white'
  | 'fire'
  | 'saturated';

/** Maps an HSL hue (0..360) to a named hue bucket.
 *
 *  No `cyan` bucket: `feeRateToColor` sweeps green → yellow → orange →
 *  red → blue and never produces a hue in the teal range, so the bucket
 *  would always be empty. The [165°, 195°) range is folded into blue.
 */
export function hueToColorCategory(
  hue: number,
): 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' {
  // Normalize into [0, 360).
  const h = ((hue % 360) + 360) % 360;
  // Red wraps the 0/360 seam.
  if (h >= 345 || h < 15) return 'red';
  if (h < 45) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 165) return 'green';
  if (h < 255) return 'blue';
  if (h < 285) return 'purple';
  return 'pink';
}

/**
 * Computes the dominant color bucket for a CAT-21 cat. Precedence
 * matches what the parser renders: genesis cats win the bucket
 * regardless of fee rate; otherwise the fee-rate easter eggs override
 * the hue path; otherwise the hue path runs.
 *
 *   1. catHash = SHA256(txId || blockId)
 *   2. bytes[0] === 79     → genesis → 'white' if bytes[1] >= 128 else 'black'
 *   3. feeRate ∈ [69, 70)  → 'fire'
 *   4. feeRate ∈ [420, 421)→ 'saturated'
 *   5. else                → hue bucket from feeRateToColor → RGBToHSL
 *
 * `feeRate` is sat/vB (fee / vsize). Throws for malformed inputs
 * (non-hex txid / blockId, wrong length) to match `createCatHash`.
 */
export function getCatColorCategory(
  txId: string,
  blockId: string,
  feeRate: number,
): CatColorCategory {
  const catHash = createCatHash(txId, blockId);
  const bytes = hexToBytes(catHash);

  // Genesis wins. The parser overwrites the body palette with one of
  // two hardcoded looks (see mooncat-parser.ts:236 — `colors = [...]`
  // inside `if (genesis)`), gated by the same `bytes[1] >= 128`
  // `inverted` flag the design index uses.
  if (bytes[0] === 79) {
    return bytes[1] >= 128 ? 'white' : 'black';
  }

  // Fee-rate easter eggs. Half-open windows; only feeRate == 69.x or
  // 420.x respectively qualify. Same conditions the parser uses in
  // mooncat-parser.ts:230 and mooncat-parser.colors.ts:66.
  if (feeRate >= 69 && feeRate < 70) return 'fire';
  if (feeRate >= 420 && feeRate < 421) return 'saturated';

  // Standard hue path.
  const saturationSeed = bytes[1];
  const { rgb } = feeRateToColor(feeRate, saturationSeed);
  const [hue] = RGBToHSL(rgb[0], rgb[1], rgb[2]);
  return hueToColorCategory(hue);
}
