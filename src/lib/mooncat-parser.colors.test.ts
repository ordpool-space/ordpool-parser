import fs from 'fs';

import { generativeColorPalette } from "./mooncat-parser.colors";
import { RGBToHex, derivePalette } from './mooncat-parser.helper';

describe('colors', () => {

  it('should use a phase shifting palette (Ethspresso version)', () => {

    let colors: (string | null)[];

    // --- ethspresso version

    let htmlEthspresso = '';
    for (let feeRate = 0; feeRate < 1000; feeRate++) {

      const x = feeRate / 300;
      const rgb = generativeColorPalette(
        x,
        [0.5, 0.5, 0.5],
        [-0.9, 0.6, 0.4],
        [2.0, 1.0, 1.0],
        [0.0, 0.0, 0.0]
      );

      // If feeRate is less than 150, the palette will emphasize variations in the red and green channels,
      // resulting in colors that primarily vary along these axes.
      if (feeRate < 150) {
        colors = derivePalette(rgb[0], rgb[1], 0);

      // If feeRate is greater than or equal to 150, the palette will emphasize variations in the red and blue channels,
      // leading to colors that primarily vary along these axes instead.
      } else {
        colors = derivePalette(rgb[0], 0, rgb[2]);
      }

      htmlEthspresso += `Fee rate ${(feeRate + '').padStart(3, ' ')} / ${ x.toFixed(3) }: `
        + `<span style="color:${colors[1]}">${colors[1]}</span> `
        + `<span style="color:${colors[2]}">${colors[2]}</span> `
        + `<span style="color:${colors[3]};font-weight:bold;">${colors[3]}</span> `
        + `<span style="color:${colors[4]}">${colors[4]}</span> `
        + `<span style="color:${colors[5]}">${colors[5]}</span>\n`
    }

    // --- rainbow version to understand the algo

    let html2 = '';
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

      html2 += `Fee rate ${(feeRate + '').padStart(3, ' ')} / ${ x.toFixed(3) }: `
      + `<span style="color:${colors[1]}">${colors[1]}</span> `
      + `<span style="color:${colors[2]}">${colors[2]}</span> `
      + `<span style="color:${colors[3]}">${colors[3]}</span> `
      + `<span style="color:${colors[4]}">${colors[4]}</span> `
      + `<span style="color:${colors[5]}">${colors[5]}</span>\n`
    }


    const finalHtml = `<html>
    <table><tr>
      <td><pre>${htmlEthspresso}</pre></td>
      <td>&nbsp;</td>
      <td><pre>${html2}</pre></td>
    </html>`

    expect(finalHtml).toBeTruthy();

    fs.writeFileSync('testdist/palette-testdrive.html', finalHtml);
  });
});
