import { Src20ParserService } from './src20-parser.service';
import { readTransaction } from '../../testdata/test.helper';
import { hasKeyBurn } from './src20-parser.service.helper';

describe('SRC20 parser', () => {

  it('should parse SRC-20 Mint Transactions', () => {

    const txn = readTransaction('50aeb77245a9483a5b077e4e7506c331dc2f628c22046e7d2b4c6ad6c6236ae1');
    const content = Src20ParserService.parse(txn)?.getContent();
    expect(content).toEqual('{"p":"src-20","op":"transfer","tick":"STEVE","amt":"100000000"}')
  });

  it('should parse SRC-20 Mint Transactions with unicode characters 💎🙌🏽', () => {

    const txn = readTransaction('5ba7f995341b9eb70c0cec4f893912f1d853d25d43ade4d3d7739d43bda85a87');
    const content = Src20ParserService.parse(txn)?.getContent();
    expect(content).toEqual('{"p":"src-20","op":"mint","tick":"💎🙌🏽","amt":"420"}')
  });

  it('should parse SRC-20 Deploy Transactions', () => {

    const txn = readTransaction('bca22c3f97de8ff26979f2a2ce188dc19300881ac1721843d0850956e3be95eb');
    const content = Src20ParserService.parse(txn)?.getContent();
    expect(content).toEqual('{"p":"src-20","op":"deploy","tick":"SILLY","max":"2100000000000000","lim":"100000000"}')
  });

  it('should parse another SRC-20 Deploy Transaction', () => {

    const txn = readTransaction('0476e678a445db415dd88502aca9d29b5bff1f8de923c6b1c6de107ccf775017');
    const content = Src20ParserService.parse(txn)?.getContent();
    expect(content).toEqual('{"p":"src-20","op":"deploy","tick":"DODO","lim":"69696969696969696969696969696969", "max":"420420420420420420420420420"}')
  });
});

describe('hasKeyBurn', () => {
  it('returns true if a multisig output contains a known key burn address', () => {
    const transaction = {
      vout: [
        {
          scriptpubkey: 'some multisig data 033333333333333333333333333333333333333333333333333333333333333333 some other data',
          scriptpubkey_type: 'multisig'
        }
      ]
    };
    expect(hasKeyBurn(transaction)).toBe(true);
  });

  it('returns false if no multisig outputs contain a known key burn address', () => {
    const transaction = {
      vout: [
        {
          scriptpubkey: 'some script data without known key burn addresses',
          scriptpubkey_type: 'multisig'
        }
      ]
    };
    expect(hasKeyBurn(transaction)).toBe(false);
  });

  it('returns false for non-multisig outputs even if they contain a known key burn address', () => {
    const transaction = {
      vout: [
        {
          scriptpubkey: '033333333333333333333333333333333333333333333333333333333333333333 some other data',
          scriptpubkey_type: 'non-multisig'
        }
      ]
    };
    expect(hasKeyBurn(transaction)).toBe(false);
  });

  it('returns false for transactions with no multisig outputs', () => {
    const transaction = {
      vout: [
        { scriptpubkey: 'some non-multisig data', scriptpubkey_type: 'non-multisig' }
      ]
    };
    expect(hasKeyBurn(transaction)).toBe(false);
  });

  it('handles an empty transaction output array', () => {
    const transaction = { vout: [] };
    expect(hasKeyBurn(transaction)).toBe(false);
  });

  it('handles complex transactions with multiple outputs correctly', () => {
    const transaction = {
      vout: [
        { scriptpubkey: 'normal output', scriptpubkey_type: 'non-multisig' },
        { scriptpubkey: '022222222222222222222222222222222222222222222222222222222222222222', scriptpubkey_type: 'multisig' },
        { scriptpubkey: 'another normal output', scriptpubkey_type: 'non-multisig' }
      ]
    };
    expect(hasKeyBurn(transaction)).toBe(true);
  });
});

