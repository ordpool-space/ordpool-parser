// Bitmap (.bitmap inscription) block visualisation.
//
// The protocol inscribes the text "<height>.bitmap" to "claim" a Bitcoin
// block. The community renders the claimed block as a Mondrian-style
// arrangement of orange squares sized by per-transaction output value.
//
// Two pieces of math, both from bitlodo's MIT reference implementation:
//
//   - logTxSize(sats): per-tx square size from the sum of vout values.
//   - MondrianLayout (sibling file): pack the sizes into a 2D grid.
//
// Pixel-perfect parity with bitlodo's `padd = 0.5` half-unit gap is
// preserved. Output is a single <path> element matching the original.

import { MondrianLayout } from './mondrian-layout';

export interface BitmapRenderOptions {
  /** Fill color for the squares. Default: Bitcoin orange. */
  color?: string;
  /** SVG background. Default: none (transparent). */
  background?: string;
}

/**
 * Per-tx square size from a sat total. Matches bitlodo's `logTxSize`:
 *   size = max(1, ceil(log10(max(sats, 1))) - 5)
 *
 * 1 BTC (1e8 sats) -> size 3. 50 BTC coinbase (5e9 sats) -> size 5.
 * Anything below 100k sats clamps to 1.
 */
export function logTxSize(sats: number): number {
  const clamped = Math.max(1, sats);
  return Math.max(1, Math.ceil(Math.log10(clamped)) - 5);
}

/**
 * Convenience: given an array of per-tx sat totals (block order, including
 * coinbase, including OP_RETURNs), return the array of square sizes the
 * layout consumes. Esplora `tx.vout[i].value` is already in sats.
 */
export function txSatsToSizes(satTotals: number[]): number[] {
  return satTotals.map(logTxSize);
}

/**
 * Render the bitmap block visualisation as an SVG string. Pixel layout
 * matches bitlodo's SVGRenderer: one <path> element with chained
 * M / H / V / Z commands, half-unit gap between squares, viewBox = bbox.
 *
 * Pass the array of per-tx square sizes (from `txSatsToSizes`).
 */
export function renderBitmapSvg(txSizes: number[], opts: BitmapRenderOptions = {}): string {
  const color = opts.color ?? '#F7931A';
  const background = opts.background;

  if (txSizes.length === 0) {
    return svgFrame(0, 0, 0, 0, '', background);
  }

  const layout = new MondrianLayout(txSizes);
  const padd = 0.5;

  let d = '';
  let maxRight = 0;
  let maxBottom = 0;
  for (const slot of layout.slots) {
    const x = slot.position.x;
    const y = slot.position.y;
    const size = slot.size - padd;
    d += `M${x} ${y}H${x + size}V${y + size}H${x}Z`;
    if (x + size > maxRight) maxRight = x + size;
    if (y + size > maxBottom) maxBottom = y + size;
  }

  const inner = `<path d="${d}" fill="${color}"/>`;
  return svgFrame(0, 0, maxRight, maxBottom, inner, background);
}

function svgFrame(x: number, y: number, w: number, h: number, inner: string, background?: string): string {
  const bg = background
    ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${background}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">${bg}${inner}</svg>`;
}

/**
 * Parse the height claimed by a `.bitmap` inscription's text content.
 * Returns null if the content doesn't match the canonical `<height>.bitmap`
 * shape (non-negative integer, no leading zeros, exact `.bitmap` suffix).
 */
export function parseBitmapHeight(content: string): number | null {
  const m = /^(0|[1-9]\d*)\.bitmap$/.exec(content);
  return m ? Number(m[1]) : null;
}
