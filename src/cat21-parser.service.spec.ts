import fs from 'fs';

import { txIds } from '../testdata/txids_000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7';
import { Cat21ParserService } from './cat21-parser.service';
import { readTransaction } from './test.helper';
import { MooncatParser } from './lib/mooncat-parser';

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

  it('should return null for transactions that are not payments to a pay-to-taproot (P2TR) address', () => {
    const txn = { ...baseTxn, vout: [{ scriptpubkey_address: 'invalidAddress' }] };
    expect(Cat21ParserService.parseCat(txn)).toBeNull();
  });

  it('should render the Genesis cat!', () => {

    const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    const parsedCat = Cat21ParserService.parseCat(txn);
    expect(parsedCat?.getImage()).toContain('<svg');

    fs.writeFileSync('testdist/genesis-cat.svg', parsedCat?.getImage() || '');
  });

  it('should render all potential cats of a block!', () => {

    let stopAt = 1000;
    let svgContent = '';
    for (let i = 0; i < txIds.length; i++) {
      svgContent += MooncatParser.generateMoonCatSvg(txIds[i]);
      if (i >= stopAt) { break; }
    }

    const finalHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Testing Cats</title>

    <style>
      svg {
        max-width: 100px;
        max-height: 100px;
        border: 1px solid silver;
        display: block;
        float: left;
      }
    </style>
  </head>
  <body>
    ${svgContent}
  </body>
</html>
</svg>`;


    fs.writeFileSync('testdist/cat-testdrive.html', finalHtml);
  });
});
