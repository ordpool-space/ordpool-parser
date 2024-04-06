import fs from 'fs';

import { cat21GenesisBlockTxIds } from '../testdata/txids_000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7';
import { Cat21ParserService } from './cat21-parser.service';
import { createCatHash } from './cat21-parser.service.helper';
import { MooncatParser } from './lib/mooncat-parser';
import { readTransaction } from './test.helper';


function generateRandomHash(): string {
  const base = Math.floor(Math.random() * 90000000) + 10000000;
  return base.toString().repeat(8);
}

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
    weight: 705,
    fee: 40834,
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
    expect(traits?.gender).toBe('Female');
    expect(traits?.designIndex).toEqual(24);
    expect(traits?.designPose).toEqual('Standing');
    expect(traits?.designExpression).toEqual('Grumpy');
    expect(traits?.designPattern).toEqual('Eyepatch');
    expect(traits?.designFacing).toEqual('Left');
    expect(traits?.laserEyes).toEqual('Red');
    expect(traits?.background).toBe('Orange');
    expect(traits?.crown).toBe('None');

    fs.writeFileSync('testdist/genesis-cat.svg', parsedCat?.getImage() || '');
  });


  it('should render the first historic cats', async () => {

    // these are real values from mainnet
    const txIdsAndBlockIdsAndFeeRate: [string, string, number][] = [
      ['98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892', '000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7', 231.6822695035461],
      ['90dcf7825be098d1700014f15c6e4b5f99371d61cc7fc40cd5c3ae9228c64290', '0000000000000000000382fcf79f2cfc7985f9299e55892e493f934731ee681a', 70.19830028328612],
      ['4130bd5520fff85dd98aeb8a3e03895062afb2cfd5215f878a9df835b261980e', '00000000000000000002c9d6f0fc5cb36e519618fb1eb71ef9f9e1df973e75e8', 50.141643059490086],
      ['76448f79c6c90281ec4d15f3a027c48d3a1f72e9de20f4ca3461932384866513', '0000000000000000000194b2d0f3b7760d06242fb002e07c3b4cc146eee56c41', 50.141643059490086],
      ['499e011170e99189b2fb43bf3de790d10a7ff4c6c855bc9f7986e0db82a19c67', '00000000000000000002688854684cb1c6621841d93a28d28fc9555cc87df447', 50.212765957446805],
      ['7fd952b2723eccdff0f0169931ed7fcf7d7a58581e6affc9209d30060f224a65', '00000000000000000002c95fa3e82fe73923535354143e4b99d7355f577f44dd', 50.141643059490086],
      ['5ee1320ff65acbe01cb5074ec89deca1220dc30a29c672a6b97a2936b2613f4c', '000000000000000000006547dca2ad39d376abe0fa682ec698bb3f62a52d0b28', 50.151975683890576],
      ['917320c3a6a92f0c30e1876c164a1b06f57aae8be3c37aff74d8ec1f1a7da240', '00000000000000000003cca25165b018b7fafbaacefc70f6cc07c7d69ff1aabd', 50.141643059490086],
      ['d2dd3b67658416b27657fdb72d9a19021c1ebe3f797bf659182190c566ee4e57', '00000000000000000001047f38cc2fb72340ad45c6898ac08ccb441b63ebfb59', 50.141643059490086],
      ['eccac793d22d66a14c3fd6cd5adf5002d1347b503d3fe5171178bd4edf4cf57d', '00000000000000000001f43fbaf33722c42f30ce7e06874c4ad87be6ec0e177c', 50.212765957446805],
      ['dc0628339faf50149bc7fffbb25544328fabc10ee16ac7326e1754f08025d7ca', '00000000000000000001409ed570c68254b79956d39f8fad0ec6b293fe13cc20', 50.212765957446805],
      ['2a6514a04d7b3ea839f177b6aec9418c24262629d885f09fdd83420853c2d7cc', '00000000000000000000eba9edf761f86002c3ceca8fc49d10a32d079c0af456', 14.457831325301205],
      ['5a68ffaea166743b41f8ad02bbb77933e1b29729b338098280574cd7482de87c', '00000000000000000000eba9edf761f86002c3ceca8fc49d10a32d079c0af456', 48.25090470446321],
      ['8145338a41e2b8c8b275f38aa7b5b669f4d22ddf1b627f2632a157fb906104a0', '00000000000000000000eba9edf761f86002c3ceca8fc49d10a32d079c0af456', 72.28915662650603],
      ['bab0ca815cc56a281ff510067984f38236f533e9100d737a9fd28bd12521ac6f', '00000000000000000000eba9edf761f86002c3ceca8fc49d10a32d079c0af456', 72.28915662650603],
      ['6d895bcdb8af42669305f3360b35c403b35064ed7ff3e6845983016adb29af01', '000000000000000000022502d8b1b15fd0292701968c9e50df6a380c39537167', 48.25090470446321],
      ['e8b98486b151fcc4570dbd526f6ef50d5c194e54e248592d04bb092d5c08c430', '00000000000000000003698c93c563347105eae4927d8c500c20102ba94d1752', 48.19277108433735]
    ];

    let svgContent = '';
    for (let i = 0; i < txIdsAndBlockIdsAndFeeRate.length; i++) {

      const catHash = createCatHash(txIdsAndBlockIdsAndFeeRate[i][0], txIdsAndBlockIdsAndFeeRate[i][1]);
      const svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash, txIdsAndBlockIdsAndFeeRate[i][2]);

      const traitsJSON = JSON.stringify(svgAndTraits.traits).replaceAll('"', "'");
      svgContent += `<span title="${traitsJSON}">` + svgAndTraits.svg + '</span>';

      if (i >= 1000) { break; }
    }

    fs.writeFileSync('testdist/cat-historic-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });

it('should render a wide range of feeRate values', async () => {

    const feeRates = [
      1, 5, 8, 10, 12, 15, 20, 24, 27, 30, 33, 36, 40, 43,
      47, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115,
      120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190,
      195, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250, 260, 270, 280,
      300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000
    ];

    // Render genesis cat first to make sure it looks as expected
    const catHash = createCatHash('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892', '000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7');
    const svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash, 231.6822695035461);
    const traitsJSON = JSON.stringify(svgAndTraits.traits).replaceAll('"', "'");
    let svgContent = `<h3>Genesis cat</h3>` + `<span title="${traitsJSON}">` + svgAndTraits.svg + `</span>` + `<br style="clear: both;">`;

    for (const feeRate of feeRates) {
      svgContent += `<h3>${feeRate} sat/vB</h3>`;
      for (let i = 0; i < 12; i++) {
        const randomTxId = generateRandomHash();
        const randomBlockId = generateRandomHash();
        const catHash = createCatHash(randomTxId, randomBlockId);
        const svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash, feeRate);
        const traitsJSON = JSON.stringify(svgAndTraits.traits).replaceAll('"', "'");
        svgContent += `<span title="${traitsJSON}">` + svgAndTraits.svg + `</span>`;
      }
      svgContent += `<br style="clear: both;">`;
    }

    fs.writeFileSync('testdist/cat-fees-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });

  it('should render all potential cats of a block!', async () => {

    const blockId = '000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7';

    // random number between 1 and 500
    const feeRate = Math.floor(Math.random() * 500) + 1;

    let svgContent = '';
    for (let i = 0; i < cat21GenesisBlockTxIds.length; i++) {

      const catHash = createCatHash(cat21GenesisBlockTxIds[i], blockId);
      const svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash, feeRate);

      const traitsJSON = JSON.stringify(svgAndTraits.traits).replaceAll('"', "'");
      svgContent += `<span title="${traitsJSON}">` + svgAndTraits.svg + '</span>';
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
    const backgroundByte = 0;
    const crownByte = 120

    const feeRate = 20; // change this value to test other colors!

    let svgContent = '';

    for (let k = 0; k < steps.length; k++) {
      for (let r = 0; r < steps.length; r++) {
        for (let g = 0; g < steps.length; g++) {

          for (let b = 0; b < steps.length; b++) {

            const catHash = '00' +                            // genesis
              steps[k].toString(16).padStart(2, '0') +        // k
              steps[r].toString(16).padStart(2, '0') +        // r - used for bg
              steps[g].toString(16).padStart(2, '0') +        // g - used for bg
              steps[b].toString(16).padStart(2, '0') +        // b - used for bg
              (laserEyesByte).toString(16).padStart(2, '0') +
              (backgroundByte).toString(16).padStart(2, '0') +
              (crownByte).toString(16).padStart(2, '0');

            const svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash, feeRate);
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

    const laserEyesByte = 204;
    const backgroundByte = 100;
    const crownByte = 120;
    const glassesByte = 132;

    const feeRate = 1; // change this value to test other colors!

    let svgContent = '';

    for (let k = 0; k < 256; k++) {

      const catHash =
        (0).toString(16).padStart(2, '0') +             // genesis
        k.toString(16).padStart(2, '0') +               // k
        (50).toString(16).padStart(2, '0') +            // r - used for bg
        (200).toString(16).padStart(2, '0') +           // g - used for bg
        (0).toString(16).padStart(2, '0') +             // b - used for bg
        (laserEyesByte).toString(16).padStart(2, '0') +
        (backgroundByte).toString(16).padStart(2, '0') +
        (crownByte).toString(16).padStart(2, '0') +
        (glassesByte).toString(16).padStart(2, '0');

      const svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash, feeRate);

      const traitsJSON = JSON.stringify(svgAndTraits.traits).replaceAll('"', "'");
      svgContent += `<span title="${traitsJSON}">` +  svgAndTraits.svg + '</span>';
    }

    fs.writeFileSync('testdist/cat-lasereye-poses-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });

  it('should generate 4 different backgrounds', () => {

    const steps = [0, 64, 128, 192];
    const feeRate = 20; // change this value to test other colors!

    let svgContent = '';

    for (let i = 0; i < steps.length; i++) {

      const bg = steps[i];
      const catHash =
        (0).toString(16).padStart(2, '0') +    // genesis
        (0).toString(16).padStart(2, '0') +    // k
        (50).toString(16).padStart(2, '0') +   // r - used for bg
        (200).toString(16).padStart(2, '0') +  // g - used for bg
        (0).toString(16).padStart(2, '0') +    // b - used for bg
        (0).toString(16).padStart(2, '0') +    // laser eyes
        (bg).toString(16).padStart(2, '0') +   // background
        (0).toString(16).padStart(2, '0') +    // crown
        (26).toString(16).padStart(2, '0');     // sunglasses

      svgContent += `<span title="${bg}">` + MooncatParser.parseAndGenerateSvg(catHash, feeRate).svg + '</span>';
    }

    fs.writeFileSync('testdist/cat-backgrounds-testdrive.html', testdriveHtml.replace('CATS!', svgContent));
  });
});
