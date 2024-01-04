import { designs } from "./mooncat-parser.designs";

/*
ORIGINAL LICENSE

Copyright © 2017 ponderware ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

Except with the prior written authorization from ponderware ltd., any modifications made to the Software shall not be represented, promoted, or sold as the official or canonical Software or property of MoonCatRescue or ponderware ltd., and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


/**
 * Converts RGB color values to HSL.
 * @param r - Red component (0-255).
 * @param g - Green component (0-255).
 * @param b - Blue component (0-255).
 * @returns The HSL representation.
 */
export function RGBToHSL(r: number, g: number, b: number): [number, number, number] {
  r /= 255, g /= 255, b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max == min) {
    h = s = 0; // achromatic
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max == r) {
      h = (g - b) / d + (g < b ? 6 : 0);
    } else if (max == g) {
      h = (b - r) / d + 2;
    } else if (max == b) {
      h = (r - g) / d + 4;
    }
    h /= 6;
  }

  if (h < 0) {
    h = 360 + h;
  }
  return [h, s, l];
}

/**
 * Converts HSL color values to RGB.
 * @param h - Hue component (0-360).
 * @param s - Saturation component (0-1).
 * @param l - Lightness component (0-1).
 * @returns The RGB representation.
 */
export function HSLToRGB(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;

  if (s == 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    let p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Converts an RGB array to a hex color string.
 * @param arr - RGB array.
 * @returns The hex color string.
 */
export function RGBToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Derives a color palette based on RGB values and an invert flag.
 * @param r - Red component.
 * @param g - Green component.
 * @param b - Blue component.
 * @param invert - Whether to invert the palette.
 * @returns An array of hex color strings.
 */
export function derivePalette(r: number, g: number, b: number, invert: boolean): (string | null)[] {
  const hsl = RGBToHSL(r, g, b);
  const [h, s, l] = hsl;
  const hx = h % 360;
  const hy = (h + 320) % 360;

  const c1 = HSLToRGB(hx, 1, 0.1);
  const c2 = HSLToRGB(hx, 1, 0.2);
  const c3 = HSLToRGB(hx, 1, 0.45);
  const c4 = HSLToRGB(hx, 1, 0.7);
  const c5 = HSLToRGB(hy, 1, 0.8);

  let palette;
  if (invert) {
    palette = [c4, c5, c2, c3, c1];
  } else {
    palette = [c1, c2, c3, c4, c5];
  }

  return palette.map(color => RGBToHex(color));
}

/**
 * Converts a hexadecimal string to an array of bytes.
 * @param {string} hex - The hexadecimal string.
 * @returns {number[]} - The array of bytes.
 */
export function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}
