import { CatTraits } from '../types/parsed-cat21';
import { hexToBytes } from './conversions';
import { generativeColorPalette } from './mooncat-parser.colors';
import { getCypherpunksManifestoText, getIsomometricCubePattern, getWhitepaperText, textToBinary, splitAndWrapTextWithTspan, getBgRect } from './mooncat-parser.backgrounds';
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
 * - Male or Female cats.
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
    const bytes = hexToBytes(catHash);

    // Genesis cat has value 79 here
    // Probability: 1/256 --> 0.00390625 --> ~0.4%
    const genesis = bytes[0] === 79;

    const k = bytes[1];
    // const r = bytes[2];
    // const g = bytes[3];
    // const b = bytes[4];

    // Genesis cat has value 121 here (redLaserEyes)
    const orangeLaserEyes = bytes[5] >= 0 && bytes[5] <= 63;   // 25%
    const redLaserEyes = bytes[5] >= 64 && bytes[5] <= 127;    // 25%
    const greenLaserEyes = bytes[5] >= 128 && bytes[5] <= 191; // 25%
    const blueLaserEyes = bytes[5] >= 192 && bytes[5] <= 255;  // 25%

    // Genesis cat has value 120 here (whitepaperBackground)
    const block9Background = bytes[6] >= 0 && bytes[6] <= 25;       // 10%
    const cyberpunkBackground = bytes[6] >= 26 && bytes[6] <= 76;   // 20%
    const whitepaperBackground = bytes[6] >= 77 && bytes[6] <= 153; // 30%
    const orangeBackground = bytes[6] >= 154 && bytes[6] <= 255;    // 40%

    // 10% chance of crown
    const crown = bytes[7] >= 120 && bytes[7] <= 145;

    // results in a uniform distribution of values in a range of 0 to 127,
    // which is the exact amount of available designs
    const designIndex = k % 128;
    const design = crown ? laserCrownDesigns[designIndex].split('.') : laserDesigns[designIndex].split('.');

    let colors: (string | null)[];

    let laserEyesColors: (string | null)[] = [null, null]
    let laserEyesName: 'red' | 'green' | 'blue' | 'orange';

    // gold crown by default
    // orange background get diamond crown for better contrast
    let crownColors = orangeBackground ? ["#b8d8e7", "#cbe3f0"] : ["#ffaf51", "#ffcf39"];

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
    } else if (orangeLaserEyes) {
      laserEyesColors = ['#ff9900', '#ffffff'];
      laserEyesName = 'orange';
    } else {
      throw new Error('This should never never happen')!
    }

    // Use a phase shifting palette
    const rgb = generativeColorPalette(
      feeRate / 300,
      [0.5, 0.5, 0.5],
      [-0.9, 0.6, 0.4],
      [2.0, 1.0, 1.0],
      [0.0, 0.0, 0.0]
    );
    // Fees below 150 get a palette ranging from green to red to light blue
    // Fees above 150 get a palette that is a mix of red, blue and purple
    if (feeRate < 150) {
      colors = derivePalette(
        rgb[0],
        rgb[1],
        0
      );
    } else {
      colors = derivePalette(
        rgb[0],
        0,
        rgb[2]
      );
    }

    if (genesis) {

      // 50% chance
      const whiteGenesisCat = k >= 128;
      if (whiteGenesisCat) {
        colors = [null, '#555555', '#d3d3d3', '#ffffff', '#aaaaaa', '#ff9999'];
      } else {
        colors = [null, '#555555', '#222222', '#111111', '#bbbbbb', '#ff9999'];
      }
    }

    // add laser eye and crown colors
    colors = [...colors, laserEyesColors[0], laserEyesColors[1], crownColors[0], crownColors[1]];

    const catData = design.map(row => {
      return row.split('').map(cell => colors[parseInt(cell, 10)]);
    });

    const designTraits = mooncatDesignsToTraits.find(design => design[0] === designIndex)!;

    // turning left is female cat, turning right is a male cat
    const genderName: 'female' | 'male' = designIndex < 64 ? 'female' : 'male';

    let backgroundName: 'block9' | 'cyberpunk' | 'whitepaper' | 'orange' = 'orange';
    if (block9Background) {
      backgroundName = 'block9';
    } else if (cyberpunkBackground) {
      backgroundName = 'cyberpunk';
    } else if (whitepaperBackground) {
      backgroundName = 'whitepaper';
    }

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

    let svg = `<svg viewBox="0 0 ${gridWidth} ${gridHeight}" xmlns="http://www.w3.org/2000/svg">\n`;

    switch(traits?.background) {
      case 'block9': {

        const rows = 14;
        const columns = 17;
        const cubeSize = 2.21;

        svg += getBgRect('ffffff');
        svg += getIsomometricCubePattern(rows, columns, cubeSize, gridWidth, gridHeight);
        break;
      }
      case 'cyberpunk': {
        svg += getBgRect('1600ae');
        svg += getCypherpunksManifestoText();
        break;
      }
      case 'whitepaper': {
        svg += getBgRect('ffffff');
        svg += getWhitepaperText();
        break;
      }
      default: {
        svg += getBgRect('ff9900');
        break;
      }
    }

    for (let i = 0; i < catWidth; i++) {
      for (let j = 0; j < catHeight; j++) {
        const color = catData[i][j];
        if (color) {
          svg += `<rect x="${i + xOffset}" y="${j + yOffset}" width="1" height="1" fill="${color}" stroke="${color}" stroke-width="0.05" />\n`;
        }
      }
    }

    svg += '</svg>';

    return {
      svg,
      traits
    };
  }
}





