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
    locktime: 21
  };

  it('should parse a valid CAT-21 transaction', () => {
    const txn = { ...baseTxn };
    const parsedCat = Cat21ParserService.parse(txn);
    expect(parsedCat).not.toBeNull();
    expect(parsedCat?.transactionId).toBe('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    expect(parsedCat?.getImage()).toContain('<svg');
  });

  it('should return null for transactions with incorrect nLockTime', () => {
    const txn = { ...baseTxn, locktime: 20 };
    expect(Cat21ParserService.parse(txn)).toBeNull();
  });

  it('should render the Genesis cat!', () => {

    const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    const parsedCat = Cat21ParserService.parse(txn);
    expect(parsedCat?.getImage()).toContain('<svg');

    const traits = parsedCat?.getTraits();

    expect(traits?.genesis).toBe(true);
    expect(traits?.inverted).toBe(false);

    expect(traits?.designIndex).toEqual(49);
    expect(traits?.designPose).toEqual('Sleeping');
    expect(traits?.designExpression).toEqual('Shy');
    expect(traits?.designPattern).toEqual('Solid');
    expect(traits?.designFacing).toEqual('Left');

    expect(traits?.laserEyes).toEqual('red');
    expect(traits?.orangeBackground).toBe(true);

    fs.writeFileSync('testdist/genesis-cat.svg', parsedCat?.getImage() || '');
  });

  it('should render the first historic cats', () => {

    const txIds = [
      // minted from 3JnXMJNpYC4W9aBAtfcpF9zUkW2WPMxW8G
      '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892',
      '90dcf7825be098d1700014f15c6e4b5f99371d61cc7fc40cd5c3ae9228c64290',
      '4130bd5520fff85dd98aeb8a3e03895062afb2cfd5215f878a9df835b261980e',
      '76448f79c6c90281ec4d15f3a027c48d3a1f72e9de20f4ca3461932384866513',
      '499e011170e99189b2fb43bf3de790d10a7ff4c6c855bc9f7986e0db82a19c67',
      '7fd952b2723eccdff0f0169931ed7fcf7d7a58581e6affc9209d30060f224a65',
      '5ee1320ff65acbe01cb5074ec89deca1220dc30a29c672a6b97a2936b2613f4c',
      '917320c3a6a92f0c30e1876c164a1b06f57aae8be3c37aff74d8ec1f1a7da240',
      'd2dd3b67658416b27657fdb72d9a19021c1ebe3f797bf659182190c566ee4e57',
      'eccac793d22d66a14c3fd6cd5adf5002d1347b503d3fe5171178bd4edf4cf57d',
      'dc0628339faf50149bc7fffbb25544328fabc10ee16ac7326e1754f08025d7ca',
      // minted someone else
      '2a6514a04d7b3ea839f177b6aec9418c24262629d885f09fdd83420853c2d7cc',
      '5a68ffaea166743b41f8ad02bbb77933e1b29729b338098280574cd7482de87c',
      '8145338a41e2b8c8b275f38aa7b5b669f4d22ddf1b627f2632a157fb906104a0',
      'bab0ca815cc56a281ff510067984f38236f533e9100d737a9fd28bd12521ac6f',
      '6d895bcdb8af42669305f3360b35c403b35064ed7ff3e6845983016adb29af01',
      'e8b98486b151fcc4570dbd526f6ef50d5c194e54e248592d04bb092d5c08c430'
    ]

    let svgContent = '';
    for (let i = 0; i < txIds.length; i++) {
      const svgAndTraits = MooncatParser.parseAndGenerateSvg(txIds[i]);
      const traitsJSON = JSON.stringify(svgAndTraits.traits).replaceAll('"', "'");
      svgContent += `<span title="${traitsJSON}">` + svgAndTraits.svg + '</span>';

      if (i >= 1000) { break; }
    }

    fs.writeFileSync('testdist/cat-historic-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });

  it('should render all potential cats of a block!', () => {

    let svgContent = '';
    for (let i = 0; i < txIds.length; i++) {
      const svgAndTraits = MooncatParser.parseAndGenerateSvg(txIds[i]);
      svgContent += svgAndTraits.svg;
      if (i >= 2000) { break; }
    }

    fs.writeFileSync('testdist/cat-block-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });

  it('should generate examples with laser eyes in all the possible palettes', () => {

    // const steps = [0, 28, 56, 84, 112, 140, 168, 196, 224, 255];
    const steps = [0, 51, 102, 153, 204, 255];

    const laserEyesByte = 224; // red
    // const laserEyesByte = 198; // green
    // const laserEyesByte = 172; // blue

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
              (laserEyesByte).toString(16).padStart(2, '0');

            const svgAndTraits = MooncatParser.parseAndGenerateSvg(txId);
            const traitsJSON = JSON.stringify(svgAndTraits.traits).replaceAll('"', "'");

            svgContent += `<span title="${k} | ${r} | ${g} | ${b} –– ${traitsJSON}">` + svgAndTraits.svg + '</span>';
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

      svgContent += `<span title="${k}">` + MooncatParser.parseAndGenerateSvg(txId) + '</span>';
    }

    fs.writeFileSync('testdist/cat-lasereye-poses-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });
});
