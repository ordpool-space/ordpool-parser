import { hexToBytes } from "./conversions";
import { designs, laser_designs } from "./mooncat-parser.designs";
import { derivePalette } from "./mooncat-parser.helper";

/*
ORIGINAL LICENSE

Copyright © 2017 ponderware ltd.
Copyright © 2024 HAUS HOPPE

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

Except with the prior written authorization from ponderware ltd., any modifications made to the Software shall not be represented, promoted, or sold as the official or canonical Software or property of MoonCatRescue or ponderware ltd., and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

export interface CatTraits {

  /**
   * The super rare genesis trait. Genesis cats are white or black, and have no bright colors.
   * Probability: ~0.4%
   */
  genesis: boolean;

  /**
   * All colors (or shades of gray for genesis cats) that are used to paint the cat.
   *
   * The genesis cats are always:
   * "#555555", "#d3d3d3", "#ffffff", "#aaaaaa", "#ff9999"
   * or
   * "#555555", "#222222", "#111111", "#bbbbbb", "#ff9999"
   *
   * see https://github.com/cryptocopycats/awesome-mooncatrescue-bubble/blob/master/COLORS.md
   */
  colors: string[];

  /**
   * Inverted cats have a mirrored design and an adjusted color palette.
   * There is a 50% chance to receive an inverted cat.
   *
   * see https://github.com/cryptocopycats/awesome-mooncatrescue-bubble/blob/master/COLORS.md
   */
  inverted: boolean;

  /**
   * One of the 128 designs (from 0 to 127)
   * The design is a combination of the following traits:
   *
   * Pose
   *   0: Standing
   *   1: Sleeping
   *   2: Pouncing
   *   3: Stalking
   *
   * Facing
   *   0: Left
   *   1: Right
   *
   * Pattern
   *   0: Solid
   *   1: Striped
   *   2: Eyepatch
   *   3: Half/Half
   *
   * Expression
   *   0: Smile
   *   1: Frown (look down)
   *   2: Frown (look up)
   *   3: Flat whiskers
   *
   * see https://github.com/cryptocopycats/awesome-mooncatrescue-bubble/blob/master/DESIGNS.md
   * see https://github.com/cryptocopycats/awesome-mooncatrescue-bubble/blob/master/TRAITS.md
   */
  designIndex: number;

  /**
   * The laser eyes trait.
   * There is a ~10% chance to receive a cat with laser eyes.
   */
  laserEyes: boolean;

  /**
   * The orange background trait.
   * There is a ~10% chance to receive a cat with an orange background instead of an transparent background.
   * The orange color is #ff9900, because this is the only true orange Bitcoin color!
   */
  orangeBackground: boolean;
}

/**
 * Modified Typescript version of
 * https://github.com/ponderware/mooncatparser/blob/master/mooncatparser.js
 *
 * This parser takes a 7 byte hex catId and returns a 2D array of hex color value strings, or null for transparency.
 * New: It generates a SVG file, instead of a pixel image.
 * New: Laser eyes trait
 * New: Orange background trait
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
   * Same goes for the other new traits. First Genesis cat has all of them.
   *
   * @param catId - The transaction ID.
   * @returns MoonCat design as a 2D array.
   */
  public static parse(catId: string): { catData: (string | null)[][]; traits: CatTraits } {

    const bytes = hexToBytes(catId);

    // First genesis cat has value 152 here
    // Probability: 1/256 --> 0.00390625 --> ~0.4%
    const genesis = bytes[0] === 152;

    const k = bytes[1];
    const r = bytes[2];
    const g = bytes[3];
    const b = bytes[4];

    // Second historic cat has has value 224 here - it should have laser eyes, too
    // 10% chance of laser eyes
    // 26 values between: 199 and 224 --> 26/256 --> 0.1015625 --> ~10%
    const laserEyes = bytes[5] >= 199 && bytes[5] <= 224;

    // First genesis cat has value 170 here
    // 10% chance of an orange background
    // 26 values between: 170 and 195 --> 26/256 --> 0.1015625 --> ~10%
    const orangeBackground  = bytes[6] >= 170 && bytes[6] <= 195;

    // 50% chance of inverted
    // 128/256  --> 0.5 --> exactly 50%
    const inverted = k >= 128;

    // results in a uniform distribution of values in a range of 0 to 127,
    // which is the exact amount of available designs
    const designIndex = k % 128;

    let design;
    if (laserEyes) {
      design = laser_designs[designIndex].split(".");
    } else {
      design = designs[designIndex].split(".");
    }
    let colors: (string | null)[];

    if (genesis) {
      if (designIndex % 2 === 0 && inverted || designIndex % 2 === 1 && !inverted) {
        colors = [null, "#555555", "#d3d3d3", "#ffffff", "#aaaaaa", "#ff9999", /* laser eyes: */ "#ffac1c", "#ff0000"];
      } else {
        colors = [null, "#555555", "#222222", "#111111", "#bbbbbb", "#ff9999", /* laser eyes: */ "#ffac1c", "#ff0000"];
      }
    } else {
      colors = derivePalette(r, g, b, inverted);
    }

    const catData = design.map(row => {
      return row.split("").map(cell => colors[parseInt(cell, 10)]);
    });

    const traits = {
      genesis,
      colors: [
        colors[1],
        colors[2],
        colors[3],
        colors[4],
        colors[5]
      ] as string[],
      inverted,
      designIndex,
      laserEyes,
      orangeBackground
    }

    return {
      catData,
      traits
    }
  }

  /**
   * Generates an SVG representation of a MoonCat from a given catId.
   *
   * This function parses the MoonCat design from the catId and constructs an SVG
   * image, where each pixel of the MoonCat design is represented as an SVG rectangle.
   *
   * @param catId - The unique identifier of the MoonCat (transaction ID).
   * @returns The traits and a string containing the SVG markup of the MoonCat.
   */
  public static generateMoonCatSvg(catId: string): { svg: string; traits: CatTraits } {

    const parsed = MooncatParser.parse(catId);
    const catData = parsed.catData;
    const traits = parsed.traits

    const gridWidth = 22;
    const gridHeight = 22;
    const catWidth = catData.length;
    const catHeight = catData[0].length;

    // Calculate x-offset to center the cat
    const xOffset = Math.floor((gridWidth - catWidth) / 2);

    // Calculate the y-offset to align the cat at the bottom of the 22x22 grid
    const yOffset = gridHeight - catHeight;

    let svgGrid = '';

    if (traits.orangeBackground) {
      svgGrid += '<rect x="0" y="0" width="22" height="22" fill="#ff9900" />'
    }

    for (let i = 0; i < catWidth; i++) {
      for (let j = 0; j < catHeight; j++) {
        const color = catData[i][j];
        if (color) {
          svgGrid += `<rect x="${i + xOffset}" y="${j + yOffset}" width="1" height="1" fill="${color}" stroke="${color}" stroke-width="0.05" />\n`;
        }
      }
    }

    const svg = `<svg viewBox="0 0 ${gridWidth} ${gridHeight}" xmlns="http://www.w3.org/2000/svg">\n${svgGrid}</svg>`;

    return {
      svg,
      traits
    };
  }
}
