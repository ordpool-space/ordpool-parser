import { CatTraits } from '../types/parsed-cat21';
import { hexToBytes } from './conversions';
import {
  getBgRect,
  getCypherpunksManifestoText,
  getIsomometricCubePattern,
  getWhitepaperText,
} from './mooncat-parser.backgrounds';
import { feeRateToColor } from './mooncat-parser.colors';
import { designs } from './mooncat-parser.designs';
import { deriveDarkPalette, derivePalette } from './mooncat-parser.helper';
import {
  applyBlackSunglasses,
  applyCoolSunglasses,
  applyCrown,
  applyLaserEyes,
  applyLaserEyesBlackSunglasses,
  applyLaserEyesCoolSunglasses,
  applyNounsGlasses,
  applyThreeDimensionsGlasses,
  decodeTraits,
  enlargeAndAlignDesign,
} from './mooncat-parser.traits';

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
    const dark_r = bytes[2];
    const dark_g = bytes[3];
    const dark_b = bytes[4];

    // Genesis cat has value 121 here (redLaserEyes)
    const laserEyesByte = bytes[5];
    const orangeLaserEyes = laserEyesByte >= 0   && laserEyesByte <= 50;  // 20%
    const greenLaserEyes  = laserEyesByte >= 51  && laserEyesByte <= 101; // 20%
    const redLaserEyes    = laserEyesByte >= 102 && laserEyesByte <= 152; // 20%
    const blueLaserEyes   = laserEyesByte >= 153 && laserEyesByte <= 203; // 20%
    const noLaserEyes     = laserEyesByte >= 204 && laserEyesByte <= 255; // ~20% (+ one more)

    // Genesis cat has value 120 here (orangeBackground)
    const backgroundByte = bytes[6];
    const block9Background     = backgroundByte >= 0   && backgroundByte <= 63;  // 25%
    const orangeBackground     = backgroundByte >= 64  && backgroundByte <= 127; // 25%
    const whitepaperBackground = backgroundByte >= 128 && backgroundByte <= 191; // 25%
    const cyberpunkBackground  = backgroundByte >= 192 && backgroundByte <= 255; // 25%

    // 10% chance of crown
    const crown = bytes[7] >= 120 && bytes[7] <= 145;

    const glassesByte            = bytes[8];
    const blackSunglasses        = glassesByte >= 0 && glassesByte  <= 25; // 10%
    const coolSunglasses         = glassesByte >= 26 && glassesByte <= 51; // 10%

    // VERY rare glasses - only if there are no laser eyes!
    const threeDimensionsGlasses = noLaserEyes && glassesByte >= 52 && glassesByte <= 77; // 10%
    const nounsGlasses           = noLaserEyes && glassesByte >= 78 && glassesByte <= 153; // 10%

    // 50% chance of inverted colors (only used for genesis cats and for some backgrounds)
    const inverted = k >= 128;

    // results in a uniform distribution of values in a range of 0 to 127,
    // which is the exact amount of available designs
    const designIndex = k % 128;

    let design = enlargeAndAlignDesign(designs[designIndex]);

    // very dark colors
    const [dark1, dark2, dark3, dark4] = deriveDarkPalette(dark_r, dark_g, dark_b);
    let glassesColors: string[] = [];

    let glassesName: 'Black' | 'Cool' | '3D' | 'Nouns' | 'None' = 'None';
    if (!noLaserEyes) {
      design = applyLaserEyes(design, designIndex);
    }

    if (noLaserEyes && blackSunglasses) {
      glassesName = 'Black'
      // just black for the black sunglasses
      glassesColors = ['#000000'];
      design = applyBlackSunglasses(design, designIndex);
    }

    if (!noLaserEyes && blackSunglasses) {
      glassesName = 'Black'
      // just black for the black sunglasses
      glassesColors = ['#000000'];
      design = applyLaserEyesBlackSunglasses(design, designIndex);
    }

    if (noLaserEyes && coolSunglasses) {
      glassesName = 'Cool';
      // black for the frame three colored shades
      glassesColors = ['#000000', dark3, dark2, dark1];
      design = applyCoolSunglasses(design, designIndex);
    }

    if (!noLaserEyes && coolSunglasses) {
      glassesName = 'Cool';
      // black for the frame three colored shades
      glassesColors = ['#000000', dark3, dark2, dark1];
      design = applyLaserEyesCoolSunglasses(design, designIndex);
    }

    if (threeDimensionsGlasses) {
      glassesName = '3D';
      glassesColors = ['#ffffff', '#328dfd', '#fd3232'];
      design = applyThreeDimensionsGlasses(design, designIndex);
    }

    if (nounsGlasses) {
      glassesName = 'Nouns';

      // glassesByte goes until 153
      let firstColor = '#f3322c'; // the famous red

      // these are original colors from
      // https://github.com/nounsDAO/nouns-monorepo/tree/master/packages/nouns-assets/images/v0/4-glasses
      const colorMappings = [
        { range: [78, 81], color: '#ff638d' }, // hip rose
        { range: [82, 85], color: '#2b83f6' }, // blue med saturated
        { range: [86, 89], color: '#5648ed' }, // blue
        { range: [90, 93], color: '#8dd122' }, // frog green
        { range: [94, 97], color: '#9cb4b8' }, // grey light
        { range: [98, 101], color: '#e8705b' }, // guava
        { range: [102, 105], color: '#d19a54' }, // honey
        { range: [106, 109], color: '#b9185c' }, // magenta
        { range: [110, 113], color: '#fe500c' }, // orange
        { range: [114, 117], color: '#d7d3cd' }, // smoke
        { range: [118, 121], color: '#4bea69' }, // teal
        { range: [122, 126], color: '#ec5b43', }, // watermelon
        { range: [127, 130], color: '#ffef16' }  // yellow saturated
      ];

      for (const { range, color } of colorMappings) {
        if (glassesByte >= range[0] && glassesByte <= range[1]) {
          firstColor = color;
          break; // Stop the loop once a matching color is found
        }
      }

      glassesColors = [firstColor, '#ffffff', '#000000'];
      design = applyNounsGlasses(design, designIndex);
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

    const { rgb, saturation } = feeRateToColor(feeRate);
    colors = derivePalette(rgb[0], rgb[1], rgb[2], saturation);

    if (genesis) {

      // 50% chance
      if (inverted) {
        colors = [null, '#555555', '#d3d3d3', '#ffffff', '#aaaaaa', '#ff9999'];
      } else {
        colors = [null, '#555555', '#222222', '#111111', '#bbbbbb', '#ff9999'];
      }
    }

    // add laser eye and crown colors
    colors = [
      ...colors,          // 0 to 5
      laserEyesColors[0], // 6
      laserEyesColors[1], // 7
      crownColors[0],     // 8
      crownColors[1],     // 9
      ...glassesColors // 10 to 13
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
      const [,,, c4] = derivePalette(dark_r, dark_g, dark_b);
      backgroundColors = (inverted ? [dark1, c4] : [c4, dark1]) as string[];
      backgroundName = 'Cyberpunk';
    } else if (whitepaperBackground) {
      const [,,, c4] = derivePalette(dark_r, dark_g, dark_b);
      backgroundColors = (inverted ? ['#ffffff', dark2] : [c4, '#ffffff']) as string[];
      backgroundName = 'Whitepaper';
    }

    const crownName :  'Gold' | 'Diamond' | 'None' = crown ? orangeBackground ? 'Diamond' : 'Gold' : 'None';

    const traits = {
      genesis,
      catColors: [
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
      crown: crownName,
      glasses: glassesName,
      glassesColors
    }

    return {
      catData,
      traits
    }
  }

  /**
   * Returns a placeholder cat 2D array
   *
   * @returns Mooncat design.
   */
  public static parsePlaceholder(): { catData: (string | null)[][]; traits: null } {

    let colors: (string | null)[] = [null, '#bbbbbb', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#555555'];
    const design = enlargeAndAlignDesign(designs[128]);

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

    let svg = `<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">\n`;

    switch(traits?.background) {
      case 'Block9': {

        const rows = 14;
        const columns = 17;
        const cubeSize = 2.21;

        svg += getIsomometricCubePattern(rows, columns, cubeSize, 22, 22, traits.backgroundColors);
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
        const bgColor = traits?.backgroundColors[0] as string || '#000000';
        svg += getBgRect(bgColor);
        break;
      }
    }

    for (let rowIndex = 0; rowIndex < 22; rowIndex++) {
      for (let colIndex = 0; colIndex < 22; colIndex++) {
        const color = catData[rowIndex][colIndex];
        if (color) {
          svg += `<rect x="${colIndex}" y="${rowIndex}" width="1" height="1" fill="${color}" stroke="${color}" stroke-width="0.05" />\n`;
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





