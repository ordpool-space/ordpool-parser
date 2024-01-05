import { hexToBytes } from "./conversions";
import { designs, laser_designs } from "./mooncat-parser.designs";
import { derivePalette } from "./mooncat-parser.helper";

/*
ORIGINAL LICENSE

Copyright © 2017 ponderware ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

Except with the prior written authorization from ponderware ltd., any modifications made to the Software shall not be represented, promoted, or sold as the official or canonical Software or property of MoonCatRescue or ponderware ltd., and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * Typescript version of
 * https://github.com/ponderware/mooncatparser/blob/master/mooncatparser.js
 *
 * This parser takes a 5 byte hex catId and returns a 2D array of hex color value strings, or null for transparency.
 * New: It generates a SVG file, instead of a pixel image.
 *
 * Learn more:
 * --> https://github.com/cryptocopycats/mooncats/
 * --> https://github.com/cryptocopycats/awesome-mooncatrescue-bubble
 *
 */
export class MooncatParser {

  /**
   * Parses the MoonCat design based on the given transaction ID.
   *
   * Note:
   * In the original Mooncat algorithm, the first byte was used as a boolean
   * flag to toggle between genesis status and normal cat status.
   * However, I hereby define that every cat gets the 'genesis' status if its
   * transaction ID starts with exactly the ID 98 (hex), which corresponds to
   * 152 in decimal. This is because the very first CAT-21 had that ID.
   *
   * @param catId - The transaction ID.
   * @returns MoonCat design as a 2D array.
   */
  public static parse(catId: string): (string | null)[][] {

    const bytes = hexToBytes(catId);

    // const genesis = bytes[0]; // old logic, which assumed that this is boolean
    const genesis = bytes[0] === 152; // new CAT-21 logic!

    const k = bytes[1];
    const r = bytes[2];
    const g = bytes[3];
    const b = bytes[4];

    const laser = bytes[5] >= 224 && bytes[5] < 240; // 6.25% chance of laser eyes
    const invert = k >= 128;
    const designIndex = k % 128;

    let design;
    if (laser) {
      design = laser_designs[designIndex].split(".");
    } else {
      design = designs[designIndex].split(".");
    }
    let colors: (string | null)[];

    if (genesis) {
      if (designIndex % 2 === 0 && invert || designIndex % 2 === 1 && !invert) {
        colors = [null, "#555555", "#d3d3d3", "#ffffff", "#aaaaaa", "#ff9999", "#ffac1c", "#ff0000"];
      } else {
        colors = [null, "#555555", "#222222", "#111111", "#bbbbbb", "#ff9999", "#ffac1c", "#ff0000"];
      }
    } else {
      colors = derivePalette(r, g, b, invert);
    }

    return design.map(row => {
      return row.split("").map(cell => colors[parseInt(cell, 10)]);
    });
  }

  /**
   * Generates an SVG representation of a MoonCat from a given catId.
   *
   * This function parses the MoonCat design from the catId and constructs an SVG
   * image, where each pixel of the MoonCat design is represented as an SVG rectangle.
   *
   * @param catId - The unique identifier of the MoonCat (transaction ID).
   * @returns A string containing the SVG markup of the MoonCat.
   */
  public static generateMoonCatSvg(catId: string): string {

    const data = MooncatParser.parse(catId);
    const gridWidth = 22;
    const gridHeight = 22;
    const catWidth = data.length;
    const catHeight = data[0].length;

    // Calculate x-offset to center the cat
    const xOffset = Math.floor((gridWidth - catWidth) / 2);

    // Calculate the y-offset to align the cat at the bottom of the 22x22 grid
    const yOffset = gridHeight - catHeight;

    let svgContent = '';
    for (let i = 0; i < catWidth; i++) {
      for (let j = 0; j < catHeight; j++) {
        const color = data[i][j];
        if (color) {
          svgContent += `<rect x="${i + xOffset}" y="${j + yOffset}" width="1" height="1" fill="${color}" stroke="${color}" stroke-width="0.05" />\n`;
        }
      }
    }

    return `<svg viewBox="0 0 ${gridWidth} ${gridHeight}" xmlns="http://www.w3.org/2000/svg">\n${svgContent}</svg>`;
  }
}
