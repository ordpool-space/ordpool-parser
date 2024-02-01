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
  // if (Array.isArray(r)) {
  //   g = r[1];
  //   b = r[2];
  //   r = r[0];
  // }
  var r = r / 255;
  var g = g / 255;
  var b = b / 255;
  var cMax = Math.max(r, g, b);
  var cMin = Math.min(r, g, b);
  var delta = cMax - cMin;
  if (delta == 0) {
    var h = 0;
  } else if (cMax == r) {
    var h = 60 * (((g - b) / delta) % 6);
  } else if (cMax == g) {
    var h = 60 * ((b - r) / delta + 2);
  } else if (cMax == b) {
    var h = 60 * ((r - g) / delta + 4);
  }
  if (h! < 0) {
    h! += 360;
  }
  var l = (cMax + cMin) / 2;

  if (delta == 0) {
    var s = 0;
  } else {
    var s = delta / (1 - Math.abs(2 * l - 1));
  }

  return [h!, s, l]
}

/**
 * Converts HSL color values to RGB.
 * @param h - Hue component (0-360).
 * @param s - Saturation component (0-1).
 * @param l - Lightness component (0-1).
 * @returns The RGB representation.
 */
export function HSLToRGB(h: number, s: number, l: number): [number, number, number] {
  // if (Array.isArray(h)) {
  //   s = h[1];
  //   l = h[2];
  //   h = h[0];
  // }
  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs((h / 60) % 2 - 1));
  var m = l - c / 2;
  if (h >= 0 && h < 60) {
    var r = c,
      g = x,
      b = 0;
  } else if (h >= 60 && h < 120) {
    var r = x,
      g = c,
      b = 0;
  } else if (h >= 120 && h < 180) {
    var r = 0,
      g = c,
      b = x;
  } else if (h >= 180 && h < 240) {
    var r = 0,
      g = x,
      b = c;
  } else if (h >= 240 && h < 300) {
    var r = x,
      g = 0,
      b = c;
  } else if (h >= 300 && h < 360) {
    var r = c,
      g = 0,
      b = x;
  }
  r = Math.round((r! + m) * 255);
  g = Math.round((g! + m) * 255);
  b = Math.round((b! + m) * 255);
  return [r, g, b];
}

/**
 * Converts an RGB array to a hex color string.
 * @param arr - RGB array.
 * @returns The hex color string.
 */
export function RGBToHex(arr: [number, number, number]): string {
  var r = arr[0],
    g = arr[1],
    b = arr[2];
  return "#" + ("0" + r.toString(16)).slice(-2) + ("0" + g.toString(16)).slice(-2) + ("0" + b.toString(16)).slice(-2);
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
  var hsl = RGBToHSL(r, g, b);

  var h = hsl[0];
  // var s = hsl[1];
  // var l = hsl[2];
  var hx = h % 360;
  var hy = (h + 320) % 360;

  var c1 = HSLToRGB(hx, 1, 0.1);
  if (invert) {
    var c4 = HSLToRGB(hx, 1, 0.2);
    var c5 = HSLToRGB(hx, 1, 0.45);
    var c2 = HSLToRGB(hx, 1, 0.7);
    var c3 = HSLToRGB(hy, 1, 0.8);
  } else {
    var c2 = HSLToRGB(hx, 1, 0.2);
    var c3 = HSLToRGB(hx, 1, 0.45);
    var c4 = HSLToRGB(hx, 1, 0.7);
    var c5 = HSLToRGB(hy, 1, 0.8);
  }

  return [
    null,
    RGBToHex(c1),
    RGBToHex(c2),
    RGBToHex(c3),
    RGBToHex(c4),
    RGBToHex(c5)
  ];
}
