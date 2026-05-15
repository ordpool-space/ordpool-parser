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
 * just lighter/darker shades of that same hue. The search UX needs one
 * named bucket per cat ("show me red cats"), so this helper recomputes
 * the body hue using the parser's own primitives and maps it to one of
 * nine buckets. Genesis cats sit outside the hue-derivation path (they
 * get a hand-picked grayscale palette in mooncat-parser.ts) and bucket
 * as `gray`.
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
  | 'gray';

/**
 * Maps an HSL hue (0..360) to a named bucket. Saturation isn't a factor
 * here — the caller decides whether to short-circuit to `gray` for
 * genesis cats first.
 */
export function hueToColorCategory(hue: number): CatColorCategory {
  // Normalize into [0, 360).
  const h = ((hue % 360) + 360) % 360;
  // Red wraps the 0/360 seam.
  if (h >= 345 || h < 15) return 'red';
  if (h < 45) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 165) return 'green';
  if (h < 255) return 'blue';      // includes cyan; one-bucket consolidation per the search plan
  if (h < 285) return 'purple';
  return 'pink';
}

/**
 * Computes the dominant color bucket for a CAT-21 cat. Reproduces the
 * body-color derivation from `mooncat-parser.ts` exactly:
 *
 *   1. catHash  = SHA256(txId || blockId)
 *   2. genesis  = bytes[0] === 79  (genesis cats short-circuit to gray)
 *   3. seed     = bytes[1]
 *   4. rgb      = feeRateToColor(feeRate, seed).rgb     (0..1 floats)
 *   5. hue      = RGBToHSL(...).h
 *   6. category = hueToColorCategory(hue)
 *
 * `feeRate` is sat/vB (fee / vsize); the same scalar the mooncat-parser
 * is given. The function throws for malformed inputs (non-hex txid /
 * blockId, wrong length) to match `createCatHash` — that's the right
 * shape because the inputs come from the indexer's typed schema.
 */
export function getCatColorCategory(
  txId: string,
  blockId: string,
  feeRate: number,
): CatColorCategory {
  const catHash = createCatHash(txId, blockId);
  const bytes = hexToBytes(catHash);

  // Byte 0 === 79 is the genesis flag (matches mooncat-parser.ts:76).
  if (bytes[0] === 79) return 'gray';

  // Byte 1 is the saturation seed used by feeRateToColor.
  const saturationSeed = bytes[1];

  const { rgb } = feeRateToColor(feeRate, saturationSeed);
  const [hue] = RGBToHSL(rgb[0], rgb[1], rgb[2]);

  return hueToColorCategory(hue);
}
