import fs from 'fs';

import { txIds } from '../testdata/txids_000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7';
import { Cat21ParserService } from './cat21-parser.service';
import { readTransaction } from './test.helper';
import { MooncatParser } from './lib/mooncat-parser';


const testdriveHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Testing Cats</title>

    <style>
      svg {
        width: 50px;
        border: 1px solid silver;
        display: block;
        float: left;
      }
    </style>
  </head>
  <body>
    CATS!
  </body>
</html>`

describe('Cat21ParserService', () => {

  const baseTxn = {
    txid: '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892',
    locktime: 21,
    vout: [{ scriptpubkey_address: 'bc1pValidAddress' }],
  };

  it('should parse a valid CAT-21 transaction', () => {
    const txn = { ...baseTxn };
    const parsedCat = Cat21ParserService.parseCat(txn);
    expect(parsedCat).not.toBeNull();
    expect(parsedCat?.catId).toBe('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    expect(parsedCat?.getImage()).toContain('<svg');
  });

  it('should return null for transactions with incorrect nLockTime', () => {
    const txn = { ...baseTxn, locktime: 20 };
    expect(Cat21ParserService.parseCat(txn)).toBeNull();
  });

  it('should render the Genesis cat!', () => {

    const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    const parsedCat = Cat21ParserService.parseCat(txn);
    expect(parsedCat?.getImage()).toContain('<svg');

    fs.writeFileSync('testdist/genesis-cat.svg', parsedCat?.getImage() || '');
  });

  it('should render all potential cats of a block!', () => {

    let svgContent = '';
    for (let i = 0; i < txIds.length; i++) {
      svgContent += MooncatParser.generateMoonCatSvg(txIds[i]);
      if (i >= 1000) { break; }
    }

    fs.writeFileSync('testdist/cat-block-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });

  it('should generate examples with laser eyes in all the possible palettes', () => {

    // const steps = [0, 28, 56, 84, 112, 140, 168, 196, 224, 255];
    const steps = [0, 51, 102, 153, 204, 255];

    let svgContent = '';

    for (let k = 0; k < steps.length; k++) {
      for (let r = 0; r < steps.length; r++) {
        for (let g = 0; g < steps.length; g++) {

          for (let b = 0; b < steps.length; b++) {

            const txId = '00' +
              steps[k].toString(16).padStart(2, '0') +
              steps[r].toString(16).padStart(2, '0') +
              steps[g].toString(16).padStart(2, '0') +
              steps[b].toString(16).padStart(2, '0') +
              (224).toString(16).padStart(2, '0');

            svgContent += `<span title="${k} | ${r} | ${g} | ${b}">` + MooncatParser.generateMoonCatSvg(txId) + '</span>';
          }

          svgContent += '<br style="clear:both">'
        }
        svgContent += `<br style="clear:both">`
      }
      svgContent += `<br style="clear:both">`
    }

    fs.writeFileSync('testdist/cat-lasereye-palettes-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });

  it('should generate examples with laser eyes in all poses', () => {

    let svgContent = '';

    for (let k = 0; k < 256; k++) {

      const txId = '00' +
        k.toString(16).padStart(2, '0') +
        (0).toString(16).padStart(2, '0') +
        (3).toString(16).padStart(2, '0') +
        (4).toString(16).padStart(2, '0') +
        (224).toString(16).padStart(2, '0');

      svgContent += `<span title="${k}">` + MooncatParser.generateMoonCatSvg(txId) + '</span>';
    }

    fs.writeFileSync('testdist/cat-lasereye-poses-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });
});
