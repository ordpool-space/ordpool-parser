import { CatTraits } from '../types/parsed-cat21';
import { hexToBytes } from './conversions';
import {
  getBgRect,
  getCypherpunksManifestoText,
  getIsomometricCubePattern,
  getWhitepaperText,
} from './mooncat-parser.backgrounds';
import { generativeColorPalette } from './mooncat-parser.colors';
import { designs } from './mooncat-parser.designs';
import { map, deriveDarkPalette, derivePalette } from './mooncat-parser.helper';
import { applyCrown, applyLaserEyes, applyLaserEyesSunglasses, applyLaserEyesSunglasses2, applySunglasses, applySunglasses2, decodeTraits } from './mooncat-parser.traits';

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
    const r = bytes[2];
    const g = bytes[3];
    const b = bytes[4];

    // Genesis cat has value 121 here (redLaserEyes)
    const orangeLaserEyes = bytes[5] >= 0 && bytes[5] <= 50;   // 20%
    const greenLaserEyes = bytes[5] >= 51 && bytes[5] <= 101;  // 20%
    const redLaserEyes = bytes[5] >= 102 && bytes[5] <= 152;   // 20%
    const blueLaserEyes = bytes[5] >= 153 && bytes[5] <= 203;  // 20%
    const noLaserEyes = bytes[5] >= 204 && bytes[5] <= 255;    // ~20% (+ one more)

    // Genesis cat has value 120 here (orangeBackground)
    const block9Background = bytes[6] >= 0 && bytes[6] <= 63;        // 25%
    const orangeBackground = bytes[6] >= 64 && bytes[6] <= 127;      // 25%
    const whitepaperBackground = bytes[6] >= 128 && bytes[6] <= 191; // 25%
    const cyberpunkBackground = bytes[6] >= 192 && bytes[6] <= 255;  // 25%

    // 10% chance of crown
    const crown = bytes[7] >= 120 && bytes[7] <= 145;

    // 10% chance of sunglasses
    const sunglasses = bytes[8] >= 0 && bytes[8] <= 25;   // 10%
    const sunglasses2 = bytes[8] >= 26 && bytes[8] <= 51; // 10%

    // 50% chance of inverted colors
    const inverted = k >= 128;

    // results in a uniform distribution of values in a range of 0 to 127,
    // which is the exact amount of available designs
    const designIndex = k % 128;

    let design = designs[designIndex];

    if (!noLaserEyes) {
      design = applyLaserEyes(design, designIndex);
    }

    if (noLaserEyes && sunglasses) {
      design = applySunglasses(design, designIndex);
    }

    if (!noLaserEyes && sunglasses) {
      design = applyLaserEyesSunglasses(design, designIndex);
    }

    if (noLaserEyes && sunglasses2) {
      design = applySunglasses2(design, designIndex);
    }

    if (!noLaserEyes && sunglasses2) {
      design = applyLaserEyesSunglasses2(design, designIndex);
    }
    
    if (crown) {
      design = applyCrown(design, designIndex);
    }

    let colors: (string | null)[];

    let laserEyesColors: (string | null)[] = [null, null]
    let laserEyesName: 'Orange' | 'Red' | 'Green' | 'Blue' | 'None' = 'None';

    // gold crown by default
    // orange background gets diamond crown for better contrast
    let crownColors = orangeBackground ? ["#b8d8e7", "#cbe3f0"] : ["#ffaf51", "#ffcf39"];

    // as a homage to the good old days, only "web save colors" are used here
    if (redLaserEyes) {
      laserEyesColors = ['#ff0000', '#ff9900'];
      laserEyesName = 'Red';
    } else if (greenLaserEyes) {
      laserEyesColors = ['#009900', '#33ff00'];
      laserEyesName = 'Green';
    } else if (blueLaserEyes) {
      laserEyesColors = ['#0033cc', '#66ccff'];
      laserEyesName = 'Blue';
    } else if (orangeLaserEyes) {
      laserEyesColors = ['#ff9900', '#ffe0b3'];
      laserEyesName = 'Orange';
    }

    // Use a phase shifting palette
    const rgb = generativeColorPalette(
      feeRate / 300,
      [0.5, 0.5, 0.5],
      [-0.9, 0.6, 0.4],
      [2.5, 2.5, 2.5],
      [0.0, 0.0, 0.0]
    );

    const saturation = map(feeRate % 40, 0, 39, 0.6, 1.0);
    if (feeRate < 75) {
      rgb[0] += 0.4;
      rgb[2] = 0;
    } else {
      rgb[1] = 0;
    }
    colors = derivePalette(rgb[0], rgb[1], rgb[2], saturation);


    if (genesis) {

      // 50% chance
      if (inverted) {
        colors = [null, '#555555', '#d3d3d3', '#ffffff', '#aaaaaa', '#ff9999'];
      } else {
        colors = [null, '#555555', '#222222', '#111111', '#bbbbbb', '#ff9999'];
      }
    }

    // very dark colors
    const [dark1, dark2, dark3, dark4] = deriveDarkPalette(r, g, b);

    const sunglassesColors = ['#000000', dark3, dark2, dark1];


    // add laser eye and crown colors
    colors = [
      ...colors,          // 0 to 5
      laserEyesColors[0], // 6
      laserEyesColors[1], // 7
      crownColors[0],     // 8
      crownColors[1],     // 9
      ...sunglassesColors // 10 to 13
    ];

    const catData = design.map(row => {
      return row.map(cell => colors[cell]);
    });

    const designTraits = decodeTraits(designIndex);

    // turning left is a female cat, turning right is a male cat
    const genderName: 'Female' | 'Male' = designIndex < 64 ? 'Female' : 'Male';

    let backgroundColors: string[] = ['#ff9900'];
    let backgroundName: 'Block9' | 'Cyberpunk' | 'Whitepaper' | 'Orange' = 'Orange';
    if (block9Background) {
      backgroundName = 'Block9';
      backgroundColors = inverted ? [dark2, dark4, dark3, '#ff9900', '#cc7a00', '#ffad33'] :
                                    [dark2, dark3, dark4, '#ff9900', '#ffad33', '#cc7a00'];
    } else if (cyberpunkBackground) {
      const [,,, c4] = derivePalette(r, g, b);
      backgroundColors = (inverted ? [dark1, c4] : [c4, dark1]) as string[];
      backgroundName = 'Cyberpunk';
    } else if (whitepaperBackground) {
      const [,,, c4] = derivePalette(r, g, b);
      backgroundColors = (inverted ? ['#ffffff', dark2] : [c4, '#ffffff']) as string[];
      backgroundName = 'Whitepaper';
    }

    const crownName :  'Gold' | 'Diamond' | 'None' = crown ? orangeBackground ? 'Diamond' : 'Gold' : 'None';

    const traits = {
      genesis,
      colors: [
        colors[1],
        colors[2],
        colors[3],
        colors[4],
        colors[5]
      ] as string[],
      backgroundColors,
      gender: genderName,
      designIndex,
      designPose: designTraits.pose,
      designExpression: designTraits.expression,
      designPattern: designTraits.pattern,
      designFacing: designTraits.facing,
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

    const design = designs[128];
    const catData = design.map(row => {
      return row.map(cell => colors[cell]);
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
    const catWidth = catData[0].length; // Width is now determined by the length of the first row
    const catHeight = catData.length; // Height is determined by the number of rows

    // Calculate x-offset to center the cat
    const xOffset = Math.floor((gridWidth - catWidth) / 2);

    // Calculate the y-offset to align the cat at the bottom of the 22x22 grid
    // the -1 adds 1px padding to the bottom if possible otherwise 0
    const yOffset = Math.max(gridHeight - catHeight - 1, 0);

    let svg = `<svg viewBox="0 0 ${gridWidth} ${gridHeight}" xmlns="http://www.w3.org/2000/svg">\n`;

    switch(traits?.background) {
      case 'Block9': {

        const rows = 14;
        const columns = 17;
        const cubeSize = 2.21;

        svg += getIsomometricCubePattern(rows, columns, cubeSize, gridWidth, gridHeight, traits.backgroundColors);
        break;
      }
      case 'Cyberpunk': {
        svg += getCypherpunksManifestoText(traits.backgroundColors);
        break;
      }
      case 'Whitepaper': {
        svg += getWhitepaperText(traits.backgroundColors);
        break;
      }
      default: {
        svg += getBgRect(traits?.backgroundColors[0] as string);
        break;
      }
    }

    for (let rowIndex = 0; rowIndex < catHeight; rowIndex++) {
      for (let colIndex = 0; colIndex < catWidth; colIndex++) {
        const color = catData[rowIndex][colIndex];
        if (color) {
          svg += `<rect x="${colIndex + xOffset}" y="${rowIndex + yOffset}" width="1" height="1" fill="${color}" stroke="${color}" stroke-width="0.05" />\n`;
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





