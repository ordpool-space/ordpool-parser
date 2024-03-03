import fs from 'fs';

import { cat21GenesisBlockTxIds } from '../testdata/txids_000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7';
import { Cat21ParserService } from './cat21-parser.service';
import { createCatHash } from './cat21-parser.service.helper';
import { MooncatParser } from './lib/mooncat-parser';
import { readTransaction } from './test.helper';


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
    status: {
      block_hash: '000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7'
    }
  };

  it('should parse a valid CAT-21 transaction', () => {
    const txn = { ...baseTxn };
    const parsedCat = Cat21ParserService.parse(txn);
    expect(parsedCat).not.toBeNull();

    expect(parsedCat?.transactionId).toBe('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    expect(parsedCat?.blockId).toBe('000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7');
    expect(parsedCat?.getImage()).toContain('<svg');
    expect(parsedCat?.getTraits()).not.toBeNull();
  });

  it('should return null for transactions with incorrect nLockTime', () => {
    const txn = { ...baseTxn, locktime: 20 };
    const parsedCat = Cat21ParserService.parse(txn);
    expect(parsedCat).toBeNull();
  });

  it('should render a placeholder cat for unconfirmed transactions', () => {
    const txn = {
      ...baseTxn,
      status: {
        block_hash: undefined
      }
    };

    const parsedCat = Cat21ParserService.parse(txn)
    expect(parsedCat?.transactionId).toBe('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    expect(parsedCat?.blockId).toBeNull();

    expect(parsedCat?.getImage()).toContain('<svg');
    expect(parsedCat?.getTraits()).toBeNull();

    fs.writeFileSync('testdist/placholder-cat.svg', parsedCat?.getImage() || '');
  });

  it('should render the Genesis cat', () => {

    const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    const parsedCat = Cat21ParserService.parse(txn);
    expect(parsedCat?.getImage()).toContain('<svg');

    const traits = parsedCat?.getTraits();

    expect(traits?.genesis).toBe(true);
    expect(traits?.gender).toBe('female');
    expect(traits?.designIndex).toEqual(24);
    expect(traits?.designPose).toEqual('Standing');
    expect(traits?.designExpression).toEqual('Grumpy');
    expect(traits?.designPattern).toEqual('Eyepatch');
    expect(traits?.designFacing).toEqual('Left');
    expect(traits?.laserEyes).toEqual('red');
    expect(traits?.background).toBe('orange');
    expect(traits?.crown).toBe('none');

    fs.writeFileSync('testdist/genesis-cat.svg', parsedCat?.getImage() || '');
  });


  it('should render the first historic cats', async () => {

    const txIdsAndBlockIds = [
      ['98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892', '000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7'],
      ['90dcf7825be098d1700014f15c6e4b5f99371d61cc7fc40cd5c3ae9228c64290', '0000000000000000000382fcf79f2cfc7985f9299e55892e493f934731ee681a'],
      ['4130bd5520fff85dd98aeb8a3e03895062afb2cfd5215f878a9df835b261980e', '00000000000000000002c9d6f0fc5cb36e519618fb1eb71ef9f9e1df973e75e8'],
      ['76448f79c6c90281ec4d15f3a027c48d3a1f72e9de20f4ca3461932384866513', '0000000000000000000194b2d0f3b7760d06242fb002e07c3b4cc146eee56c41'],
      ['499e011170e99189b2fb43bf3de790d10a7ff4c6c855bc9f7986e0db82a19c67', '00000000000000000002688854684cb1c6621841d93a28d28fc9555cc87df447'],
      ['7fd952b2723eccdff0f0169931ed7fcf7d7a58581e6affc9209d30060f224a65', '00000000000000000002c95fa3e82fe73923535354143e4b99d7355f577f44dd'],
      ['5ee1320ff65acbe01cb5074ec89deca1220dc30a29c672a6b97a2936b2613f4c', '000000000000000000006547dca2ad39d376abe0fa682ec698bb3f62a52d0b28'],
      ['917320c3a6a92f0c30e1876c164a1b06f57aae8be3c37aff74d8ec1f1a7da240', '00000000000000000003cca25165b018b7fafbaacefc70f6cc07c7d69ff1aabd'],
      ['d2dd3b67658416b27657fdb72d9a19021c1ebe3f797bf659182190c566ee4e57', '00000000000000000001047f38cc2fb72340ad45c6898ac08ccb441b63ebfb59'],
      ['eccac793d22d66a14c3fd6cd5adf5002d1347b503d3fe5171178bd4edf4cf57d', '00000000000000000001f43fbaf33722c42f30ce7e06874c4ad87be6ec0e177c'],
      ['dc0628339faf50149bc7fffbb25544328fabc10ee16ac7326e1754f08025d7ca', '00000000000000000001409ed570c68254b79956d39f8fad0ec6b293fe13cc20'],
      ['2a6514a04d7b3ea839f177b6aec9418c24262629d885f09fdd83420853c2d7cc', '00000000000000000000eba9edf761f86002c3ceca8fc49d10a32d079c0af456'],
      ['5a68ffaea166743b41f8ad02bbb77933e1b29729b338098280574cd7482de87c', '00000000000000000000eba9edf761f86002c3ceca8fc49d10a32d079c0af456'],
      ['8145338a41e2b8c8b275f38aa7b5b669f4d22ddf1b627f2632a157fb906104a0', '00000000000000000000eba9edf761f86002c3ceca8fc49d10a32d079c0af456'],
      ['bab0ca815cc56a281ff510067984f38236f533e9100d737a9fd28bd12521ac6f', '00000000000000000000eba9edf761f86002c3ceca8fc49d10a32d079c0af456'],
      ['6d895bcdb8af42669305f3360b35c403b35064ed7ff3e6845983016adb29af01', '000000000000000000022502d8b1b15fd0292701968c9e50df6a380c39537167'],
      ['e8b98486b151fcc4570dbd526f6ef50d5c194e54e248592d04bb092d5c08c430', '00000000000000000003698c93c563347105eae4927d8c500c20102ba94d1752']
    ];

    let svgContent = '';
    for (let i = 0; i < txIdsAndBlockIds.length; i++) {

      const catHash = createCatHash(txIdsAndBlockIds[i][0], txIdsAndBlockIds[i][1]);
      const svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash);

      const traitsJSON = JSON.stringify(svgAndTraits.traits).replaceAll('"', "'");
      svgContent += `<span title="${traitsJSON}">` + svgAndTraits.svg + '</span>';

      if (i >= 1000) { break; }
    }

    fs.writeFileSync('testdist/cat-historic-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });

  it('should render all potential cats of a block!', async () => {

    const blockId = '000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7';

    let svgContent = '';
    for (let i = 0; i < cat21GenesisBlockTxIds.length; i++) {

      const catHash = createCatHash(cat21GenesisBlockTxIds[i], blockId);
      const svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash);
      svgContent += svgAndTraits.svg;
      if (i >= 2000) { break; }
    }

    fs.writeFileSync('testdist/cat-block-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });

  it('should generate examples with laser eyes in all the possible palettes', () => {

    // const steps = [0, 28, 56, 84, 112, 140, 168, 196, 224, 255];
    const steps = [0, 51, 102, 153, 204, 255];

    const laserEyesByte = 0; // orange
    // const laserEyesByte = 121; // red
    // const laserEyesByte = 128; // green
    // const laserEyesByte = 192; // blue

    let svgContent = '';

    for (let k = 0; k < steps.length; k++) {
      for (let r = 0; r < steps.length; r++) {
        for (let g = 0; g < steps.length; g++) {

          for (let b = 0; b < steps.length; b++) {

            const catHash = '00' +
              steps[k].toString(16).padStart(2, '0') +
              steps[r].toString(16).padStart(2, '0') +
              steps[g].toString(16).padStart(2, '0') +
              steps[b].toString(16).padStart(2, '0') +
              (laserEyesByte).toString(16).padStart(2, '0');

            const svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash);
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

    const laserEyesByte = 121; // red
    let svgContent = '';

    for (let k = 0; k < 256; k++) {

      const catHash =
        (0).toString(16).padStart(2, '0') +
        k.toString(16).padStart(2, '0') +
        (50).toString(16).padStart(2, '0') +
        (200).toString(16).padStart(2, '0') +
        (0).toString(16).padStart(2, '0') +
        (laserEyesByte).toString(16).padStart(2, '0');

      svgContent += `<span title="${k}">` + MooncatParser.parseAndGenerateSvg(catHash).svg + '</span>';
    }

    fs.writeFileSync('testdist/cat-lasereye-poses-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });
});
