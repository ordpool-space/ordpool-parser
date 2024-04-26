import fs from 'fs';

import { feeRateToColor, generativeColorPalette, map } from "./mooncat-parser.colors";
import { derivePalette } from './mooncat-parser.helper';

describe('colors', () => {

  it('should use a phase shifting palette', () => {

    let colors: (string | null)[];
    let colorCounter: { [key: string]: number } = {};

    let html = '';
    for (let feeRate = 0; feeRate < 1000; feeRate++) {

      const { rgb, saturation } = feeRateToColor(feeRate, 255);
      colors = derivePalette(rgb[0], rgb[1], rgb[2], saturation);

      let primaryColor = colors[3] as string;
      if (colorCounter[primaryColor]) {
        colorCounter[primaryColor] = colorCounter[primaryColor] + 1;
      } else {
        colorCounter[primaryColor] = 1;
      }

      html += `Fee rate ${(feeRate + '').padStart(3, ' ')}: `
        // + `<span style="color:${colors[1]}">${colors[1]}</span> `
        // + `<span style="color:${colors[2]}">${colors[2]}</span> `
        + `<span style="color:${colors[3]};font-weight:bold;">${colors[3]}</span> ` // primary cat color (the important one)
        // + `<span style="color:${colors[4]}">${colors[4]}</span> `
        // + `<span style="color:${colors[5]}">${colors[5]}</span> `
          + `${ colorCounter[primaryColor] > 1 ? colorCounter[primaryColor] + 'x' : '' }`
        + `\n`
    }

    const finalHtml = `<html>
    <pre>${html}</pre>
    </html>`

    expect(finalHtml).toBeTruthy();

    fs.writeFileSync('testdist/palette-testdrive.html', finalHtml);
  });

  it('should use a phase shifting palette (rainbow version to understand the generativeColorPalette algo)', () => {

    let colors: (string | null)[];

    let html = '';
    for (let feeRate = 0; feeRate < 1000; feeRate++) {

      const x = feeRate / 100;
      const rgb = generativeColorPalette(
        x,
        [0.5, 0.5, 0.5],
        [0.5, 0.5, 0.5],
        [1.0, 1.0, 1.0],
        [0.00, 0.33, 0.67]
      );

      colors = derivePalette(rgb[0], rgb[1], rgb[2]);

      html += `Fee rate ${(feeRate + '').padStart(3, ' ')}: `
      + `<span style="color:${colors[1]}">${colors[1]}</span> `
      + `<span style="color:${colors[2]}">${colors[2]}</span> `
      + `<span style="color:${colors[3]}font-weight:bold;">${colors[3]}</span> ` // primary cat color (the important one)
      + `<span style="color:${colors[4]}">${colors[4]}</span> `
      + `<span style="color:${colors[5]}">${colors[5]}</span>\n`
    }

    const finalHtml = `<html>
    <pre>${html}</pre>
    </html>`

    expect(finalHtml).toBeTruthy();

    fs.writeFileSync('testdist/palette-testdrive-rainbow.html', finalHtml);
  });
});

describe('map', () => {
  it('should map a number in the range', () => {
    const res = map(5, 0, 10, 0, 100);
    expect (res).toEqual(50);
  });

  it('should map a number outside the range', () => {
    const res = map(50, 0, 10, 0, 100);
    expect (res).toEqual(500);
  });

  it('should map floats', () => {
    const res = map(0.555, 0, 1, 0, 100);
    expect (res).toBeCloseTo(55.5);
  });

  it('should map negative numbers', () => {
    const res = map(-20, -100, 100, 0, 1);
    expect (res).toBeCloseTo(0.4);
  });
});
