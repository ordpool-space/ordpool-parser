import fs from 'fs';

import { Cat21ParserService } from './cat21-parser.service';
import { readTransaction } from '../../testdata/test.helper';


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
    expect(parsedCat?.transactionId).toBe('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    expect(parsedCat?.blockId).toBe('000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7');
    expect(parsedCat?.getImage().startsWith('<svg')).toBe(true);
    expect(parsedCat?.getTraits()?.genesis).toBe(true);
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

    expect(parsedCat?.getImage().startsWith('<svg')).toBe(true);
    expect(parsedCat?.getTraits()).toBeNull();

    fs.writeFileSync('testdist/placholder-cat.svg', parsedCat?.getImage() || '');
  });

  it('should render the Genesis cat', () => {

    const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    const parsedCat = Cat21ParserService.parse(txn);
    expect(parsedCat?.getImage().startsWith('<svg')).toBe(true);

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

  // Byte-for-byte SVG snapshot tests.
  // CAT-21 is a FROZEN protocol -- every cat's image is deterministic from
  // SHA256(txid + blockId) + feeRate. Real holders own these. Any change to
  // the algorithm that changes a single byte of these snapshots is a consensus
  // break and MUST NOT happen. We sample a handful of representative cats
  // (genesis, sub-1k, sub-10k, modern) -- not all 64k+ -- which is enough to
  // pin every code path: trait derivation, design index, pose, pattern, color
  // palette, fee-rate-driven coloring, and background type.
  describe('byte-for-byte SVG snapshots (FROZEN -- never modify)', () => {
    const samples: Array<{ num: number; txid: string; expectedTraits: Partial<{
      gender: string; designIndex: number; designPose: string; background: string; laserEyes: string;
    }> }> = [
      // Genesis cat #0 -- the very first nLockTime=21 transaction in Bitcoin
      { num: 0, txid: '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892',
        expectedTraits: { gender: 'Female', designIndex: 24, designPose: 'Standing', background: 'Orange', laserEyes: 'Red' } },
      // Cat #1 -- second cat ever, different palette + cyberpunk background
      { num: 1, txid: '90dcf7825be098d1700014f15c6e4b5f99371d61cc7fc40cd5c3ae9228c64290',
        expectedTraits: { gender: 'Male', designIndex: 92, designPose: 'Standing', background: 'Cyberpunk', laserEyes: 'Red' } },
      // Sub-1k era cat (#100) -- exercises Block9 background + Pouting expression
      { num: 100, txid: '08c9d06afba86dbd72b40b733d37f2796e4d7aaa9fe837606333c010ab609ef3',
        expectedTraits: { gender: 'Female', designIndex: 40, designPose: 'Standing', background: 'Block9', laserEyes: 'Red' } },
      // Sub-10k era cat (#1000) -- exercises Stalking pose + Shy expression
      { num: 1000, txid: '411d3127ca98b01620d3aa7fbdf4ed818fa62b474cb0ffed39d0eacca59125d7',
        expectedTraits: { gender: 'Male', designIndex: 123, designPose: 'Stalking', background: 'Cyberpunk', laserEyes: 'Red' } },
      // Modern cat (#10000) -- Pouncing pose, no laser eyes, Block9 background
      { num: 10000, txid: '31ff34185058de9ca4c1c7d720bf83fd9482f54b8e4a1c1ed18c2f7e1b87abd9',
        expectedTraits: { gender: 'Male', designIndex: 78, designPose: 'Pouncing', background: 'Block9', laserEyes: 'None' } },
    ];

    for (const { num, txid, expectedTraits } of samples) {
      it(`should produce identical SVG for cat #${num}`, () => {
        const txn = readTransaction(txid);
        const parsed = Cat21ParserService.parse(txn);
        const actualSvg = parsed!.getImage();
        const expectedSvg = fs.readFileSync(`testdata/cat21_${num}_${txid}.svg`, 'utf8');

        // Pin the traits first (smaller diff if both fail)
        const traits = parsed!.getTraits()!;
        expect(traits.gender).toBe(expectedTraits.gender);
        expect(traits.designIndex).toBe(expectedTraits.designIndex);
        expect(traits.designPose).toBe(expectedTraits.designPose);
        expect(traits.background).toBe(expectedTraits.background);
        expect(traits.laserEyes).toBe(expectedTraits.laserEyes);

        // Byte-for-byte SVG identity. ANY diff is a consensus break.
        expect(actualSvg).toBe(expectedSvg);
      });
    }
  });

  // Visual galleries of cats (no assertions) are rendered by `npm run cat21:gallery` (scripts/cat21-gallery.ts).
});
