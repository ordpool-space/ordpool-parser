import { CatTraits } from '../types/parsed-cat21';
import { hexToBytes } from './conversions';
import { feeRateToMempoolColor } from './mooncat-parser.colors';
import { laserDesigns, laserCrownDesigns, placeholderDesign } from './mooncat-parser.designs';
import { mooncatDesignsToTraits } from './mooncat-parser.designs-to-traits';
import { derivePalette } from './mooncat-parser.helper';

/* *********************************************

THE CAT-21 PROJECT UTILIZES MODIFIED CODE FROM THE MOONCATS PROJECT BUT IS ENTIRELY INDEPENDENT AND NOT AFFILIATED WITH, ENDORSED BY, OR RELATED TO PONDERWARE LTD. OR ANY OF ITS CREATORS. THIS PROJECT IS NOT AN OFFICIAL EXTENSION OR RELEASE OF THE MOONCATS PROJECT. ANY USE OF MODIFIED CODE IS DONE SO UNDER THE TERMS OF THE ORIGINAL LICENSE, WHICH CAN BE FOUND AT:

https://raw.githubusercontent.com/haushoppe/ordpool-parser/main/LICENSE and
https://raw.githubusercontent.com/ponderware/mooncatparser/master/license.txt

EVERY DISTRIBUTION OF THIS SOFTWARE MUST INCLUDE A COPY OF THE LICENSE TO ENSURE COMPLIANCE AND TRANSPARENCY.

********************************************* */

/*
ORIGINAL MOONCAT LICENSE
OUR CODE FOLLOWS THE SAME LICENSE!

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
 * This parser takes data from a Bitcoin transaction and returns a pixelated cat image.
 *
 * Some of the various modifications to the original algorithm,
 * that make the artwork clearly differentiated from the original project, are:
 *
 * - It generates an SVG file, instead of a pixel image.
 * - Laser eyes trait for all cats.
 * - Orange or gray background trait.
 * - Gold or Diamond crown trait.
 * - Male or Female cats instead of the "inverted" trait.
 * - Cat color is derived from the paid miner fees (not from the hash), which
 *   is a new artistic value that is also very related to the canvas (Bitcoin).
 *
 * Learn more:
 * --> https://github.com/cryptocopycats/mooncats/
 * --> https://github.com/cryptocopycats/awesome-mooncatrescue-bubble
 *
 */
export class MooncatParser {

  /**
   * Parses a modified Mooncat design based on the given transaction ID + block ID + feeRate.
   *
   * @param catHash - concatenated transactionId and blockId
   * @param feeRate - the fee rate of the transaction in sat/vB
   * @returns Mooncat design as a 2D array.
   */
  public static parse(catHash: string, feeRate: number): { catData: (string | null)[][]; traits: CatTraits } {

    // TODO: @Ethspresso!
    // this is a number with decimal places, which is equal or larger than 0
    // console.log('Fee Rate in sat/vb', feeRate);

    const bytes = hexToBytes(catHash);

    // Genesis cat has value 79 here
    // Probability: 1/256 --> 0.00390625 --> ~0.4%
    const genesis = bytes[0] === 79;

    const k = bytes[1];
    const r = bytes[2];
    const g = bytes[3];
    const b = bytes[4];

    // Genesis cat has value 121 here
    const orangeLaserEyes = bytes[5] >= 0 && bytes[5] <= 63;
    const redLaserEyes = bytes[5] >= 64 && bytes[5] <= 127;
    const greenLaserEyes = bytes[5] >= 128 && bytes[5] <= 191;
    const blueLaserEyes = bytes[5] >= 192 && bytes[5] <= 255;

    // First genesis cat has value 120 here
    // 10% chance of an orange background
    // 26 values between: 120 and 145 --> 26/256 --> 0.1015625 --> ~10%
    const orangeBackground = bytes[6] >= 120 && bytes[6] <= 145;

    // 10% chance of crown
    const crown = bytes[7] >= 120 && bytes[7] <= 145;

    // 50% chance of inverted colors
    // 128/256  --> 0.5 --> exactly 50%
    const inverted = k >= 128;

    // results in a uniform distribution of values in a range of 0 to 127,
    // which is the exact amount of available designs
    const designIndex = k % 128;

    let design;
    if (crown) {
      design = laserCrownDesigns[designIndex].split('.');
    } else {
      design = laserDesigns[designIndex].split('.');
    }

    let colors: (string | null)[];

    let laserEyesColors: (string | null)[] = [null, null]
    let laserEyesName: 'red' | 'green' | 'blue' | 'orange';

    // gold crown
    let crownColors = ["#ffaf51", "#ffcf39"];
    if (orangeBackground) {
      // diamond crown for better contrast
      crownColors = ["#b8d8e7", "#cbe3f0"];
    }

    // as a homage to the good old days, only "web save colors" are used here
    if (redLaserEyes) {
      laserEyesColors = ['#ff0000', '#ff9900'];
      laserEyesName = 'red';
    } else if (greenLaserEyes) {
      laserEyesColors = ['#009900', '#33ff00'];
      laserEyesName = 'green';
    } else if (blueLaserEyes) {
      laserEyesColors = ['#0033cc', '#66ccff'];
      laserEyesName = 'blue';
    } else  if (orangeLaserEyes) {
      laserEyesColors = ['#ff9900', '#ffffff'];
      laserEyesName = 'orange';
    } else  {
      throw new Error('This should never never happen')!
    }

    if (genesis) {
      if (designIndex % 2 === 0 && inverted || designIndex % 2 === 1 && !inverted) {
        colors = [null, '#555555', '#d3d3d3', '#ffffff', '#aaaaaa', '#ff9999'];
      } else {
        colors = [null, '#555555', '#222222', '#111111', '#bbbbbb', '#ff9999'];
      }
    } else {

      // mooncat colors
      // colors = derivePalette(r, g, b, inverted);

      const mempoolColor = feeRateToMempoolColor(feeRate);

      // now every cat looks like garfield :D
      colors = derivePalette(mempoolColor.r, mempoolColor.g, mempoolColor.b, inverted);
    }

    // add laser eye and crown colors
    colors = [...colors, laserEyesColors[0], laserEyesColors[1], crownColors[0], crownColors[1]];

    const catData = design.map(row => {
      return row.split('').map(cell => colors[parseInt(cell, 10)]);
    });

    const designTraits = mooncatDesignsToTraits.find(design => design[0] === designIndex)!;

    // inverted=false is male cat, inverted=true is a female cat
    const genderName: 'female' | 'male' = inverted ? 'female' : 'male';
    const backgroundName: 'orange' | 'gray' = orangeBackground ? 'orange' : 'gray';
    const crownName :  'gold' | 'diamond' | 'none' = crown ? orangeBackground ? 'diamond' : 'gold' : 'none';

    const traits = {
      genesis,
      colors: [
        colors[1],
        colors[2],
        colors[3],
        colors[4],
        colors[5]
      ] as string[],

      gender: genderName,
      designIndex,
      designPose: designTraits[1],
      designExpression: designTraits[2],
      designPattern: designTraits[3],
      designFacing: designTraits[4],
      laserEyes: laserEyesName,
      background: backgroundName,
      crown: crownName
    }

    return {
      catData,
      traits
    }
  }

  /**
   * Returns a placeholder cat 2D array
   *
   * @returns Mooncat design as a 2D array.
   */
  public static parsePlaceholder(): { catData: (string | null)[][]; traits: null } {

    let colors: (string | null)[] = [null, '#bbbbbb', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#555555'];

    const catData = placeholderDesign.split('.')
      .map(row => {
        return row.split('').map(cell => colors[parseInt(cell, 10)]);
      });

    return {
      catData,
      traits: null
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
   * @param feeRate - the fee rate of the transaction in sat/vB
   * @returns The traits and a string containing the SVG markup of the Mooncat.
   */
  static parseAndGenerateSvg(catHash: string | null, feeRate: number): { svg: string; traits: CatTraits | null } {

    let parsed: { catData: (string | null)[][]; traits: CatTraits | null };

    if (catHash) {
      parsed = MooncatParser.parse(catHash, feeRate);
    } else {
      parsed = MooncatParser.parsePlaceholder();
    }
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
    if (traits?.background === 'orange') {
      svgGrid += '<rect x="0" y="0" width="22" height="22" fill="#ff9900" />'
    } else {
      svgGrid += '<rect x="0" y="0" width="22" height="22" fill="#4d4d4d" />'
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
