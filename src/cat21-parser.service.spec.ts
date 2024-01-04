import { Cat21ParserService } from "./cat21-parser.service";
import { readTransaction } from "./test.helper";
import fs from 'fs';

describe('Cat21ParserService', () => {

  const baseTxn = {
    txid: 'testTxId',
    locktime: 21,
    vout: [{ scriptpubkey_address: 'bc1pValidAddress' }],
  };

  it('should parse a valid CAT-21 transaction', () => {
    const txn = { ...baseTxn };
    const parsedCat = Cat21ParserService.parseCat(txn);
    expect(parsedCat).not.toBeNull();
    expect(parsedCat?.catId).toBe('testTxId');
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

    // console.log(parsedCat?.getImage());
  });
});
