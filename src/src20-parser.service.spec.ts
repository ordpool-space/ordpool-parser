import { decodeSrc20Transaction } from './src20-parser.service';
import { readTransaction } from './test.helper';

describe('SRC20 parser', () => {

  it.skip('should parse SRC-20 Transactions', () => {

    const txn = readTransaction('50aeb77245a9483a5b077e4e7506c331dc2f628c22046e7d2b4c6ad6c6236ae1');
    const result = decodeSrc20Transaction(txn);

    expect(result).toEqual('{"p":"src-20","op":"transfer","tick":"STEVE","amt":"100000000"}')
  });

  it('should parse SRC-20 Transactions with unicode characters 💎🙌🏽', () => {

    const txn = readTransaction('5ba7f995341b9eb70c0cec4f893912f1d853d25d43ade4d3d7739d43bda85a87');
    const result = decodeSrc20Transaction(txn);

    console.log(result!.length)

    console.log('{"p":"src-20","op":"mint","tick":"💎🙌🏽","amt":"420"}'.length)

    expect(result).toEqual('{"p":"src-20","op":"mint","tick":"💎🙌🏽","amt":"420"}')
  });
});
