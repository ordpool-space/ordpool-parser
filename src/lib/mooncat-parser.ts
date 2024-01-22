import { createCatHash } from '../cat21-parser.service.helper';
import { CatTraits } from '../types/parsed-cat21';
import { hexToBytes } from './conversions';
import { designs, laser_designs } from './mooncat-parser.designs';
import { mooncatDesignsToTraits } from './mooncat-parser.designs-to-traits';
import { derivePalette } from './mooncat-parser.helper';

/*
ORIGINAL LICENSE

Copyright © 2017 ponderware ltd.
Copyright © 2024 HAUS HOPPE

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

Except with the prior written authorization from ponderware ltd., any modifications made to the Software shall not be represented, promoted, or sold as the official or canonical Software or property of MoonCatRescue or ponderware ltd., and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


/**
 * Modified Typescript version of
 * https://github.com/ponderware/mooncatparser/blob/master/mooncatparser.js
 *
 * This parser takes a catHash and returns a 2D array of hex color value strings, or null for transparency.
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
   * Parses the Mooncat design based on the given transaction ID.
   *
   * Note:
   * In the original Mooncat algorithm, the first byte was used as a boolean
   * flag to toggle between genesis status and normal cat status.
   * However, I hereby define that every cat gets the 'genesis' status if its
   * transaction ID starts with exactly the ID 98 (hex), which corresponds to
   * 152 in decimal. This is because the very first CAT-21 had that ID.
   * Same goes for the other new traits. First Genesis cat has all of them.
   *
   * @param catHash - concatenated transactionId and blockId
   * @returns Mooncat design as a 2D array.
   */
  public static parse(catHash: string): { catData: (string | null)[][]; traits: CatTraits } {

    const bytes = hexToBytes(catHash);

    // Genesis cat has value 79 here
    // Probability: 1/256 --> 0.00390625 --> ~0.4%
    const genesis = bytes[0] === 79;

    const k = bytes[1];
    const r = bytes[2];
    const g = bytes[3];
    const b = bytes[4];

    // Genesis cat has value 121 here
    // Second historic cat has has value 140 here - both should have red laser eyes
    // 10% chance of red laser eyes
    // 26 values between: 121 and 146 --> 26/256 --> 0.1015625 --> ~10%
    const redLaserEyes = bytes[5] >= 121 && bytes[5] <= 146;
    const greenLaserEyes = bytes[5] >= 95 && bytes[5] <= 120;
    const blueLaserEyes = bytes[5] >= 69 && bytes[5] <= 94;

    // First genesis cat has value 120 here
    // 10% chance of an orange background
    // 26 values between: 120 and 145 --> 26/256 --> 0.1015625 --> ~10%
    const orangeBackground  = bytes[6] >= 120 && bytes[6] <= 145;

    // 50% chance of inverted colors
    // 128/256  --> 0.5 --> exactly 50%
    const inverted = k >= 128;

    // results in a uniform distribution of values in a range of 0 to 127,
    // which is the exact amount of available designs
    const designIndex = k % 128;

    let design;
    if (redLaserEyes || greenLaserEyes || blueLaserEyes) {
      design = laser_designs[designIndex].split('.');
    } else {
      design = designs[designIndex].split('.');
    }
    let colors: (string | null)[];

    let laserEyesColors: (string | null)[] = [null, null]
    let laserEyesName: 'red' | 'green' | 'blue' | 'none' = 'none';

    // as a homage to the good old days, only "web save colors" are used here
    if (redLaserEyes) {
      laserEyesColors = ['#ff0000', '#ff9900'];
      laserEyesName = 'red';
    }

    if (greenLaserEyes) {
      laserEyesColors = ['#009900', '#33ff00'];
      laserEyesName = 'green';
    }

    if (blueLaserEyes) {
      laserEyesColors = ['#0033cc', '#66ccff'];
      laserEyesName = 'blue';
    }

    if (genesis) {
      if (designIndex % 2 === 0 && inverted || designIndex % 2 === 1 && !inverted) {
        colors = [null, '#555555', '#d3d3d3', '#ffffff', '#aaaaaa', '#ff9999'];
      } else {
        colors = [null, '#555555', '#222222', '#111111', '#bbbbbb', '#ff9999'];
      }
    } else {
      colors = derivePalette(r, g, b, inverted);
    }

    // add laser eyes colors
    colors = [...colors, laserEyesColors[0], laserEyesColors[1]];

    const catData = design.map(row => {
      return row.split('').map(cell => colors[parseInt(cell, 10)]);
    });

    const designTraits = mooncatDesignsToTraits.find(design => design[0] === designIndex)!;

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
      designPose: designTraits[1],
      designExpression: designTraits[2],
      designPattern: designTraits[3],
      designFacing: designTraits[4],
      laserEyes: laserEyesName,
      orangeBackground
    }

    return {
      catData,
      traits
    }
  }

  /**
   * Generates an SVG representation of a Mooncat from a given catHash.
   *
   * This function parses the Mooncat design from the catHash (transactionId + blockId) and constructs an SVG
   * image, where each pixel of the Mooncat design is represented as an SVG rectangle.
   *
   * @param catHash - transactionId in hex format
   * @param blockId - blockId in hex format
   * @returns The traits and a string containing the SVG markup of the Mooncat.
   */
  static parseAndGenerateSvg(catHash: string): { svg: string; traits: CatTraits } {

    const parsed = MooncatParser.parse(catHash);
    const catData = parsed.catData;
    const traits = parsed.traits

    const gridWidth = 22;
    const gridHeight = 22;
    const catWidth = catData.length;
    const catHeight = catData[0].length;

    // Calculate x-offset to center the cat
    const xOffset = Math.floor((gridWidth - catWidth) / 2);

    // Calculate the y-offset to align the cat at the bottom of the 22x22 grid
    // the -1 adds 1px padding to the bottom if possible otherwise 0
    const yOffset = Math.max(gridHeight - catHeight - 1, 0);

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
