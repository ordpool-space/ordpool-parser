import { Cat21ParserService } from "./cat21-parser.service";

describe('Cat21ParserService', () => {

  const baseTransaction = {
    txid: 'testTxId',
    status: { block_height: 1001 },
    locktime: 21,
    vin: [{}],
    vout: [{ scriptpubkey_address: 'bc1pValidAddress' }],
  };

  it('should parse a valid CAT-21 transaction', () => {
    const transaction = { ...baseTransaction };
    const result = Cat21ParserService.parseCat(transaction);
    expect(result).not.toBeNull();
    expect(result?.catId).toBe('testTxId');
    expect(result?.getImage()).toContain('data:');
  });

  it('should return null for transactions before activation block height', () => {
    const transaction = { ...baseTransaction, status: { block_height: 999 } };
    expect(Cat21ParserService.parseCat(transaction)).toBeNull();
  });

  it('should return null for transactions with incorrect nLockTime', () => {
    const transaction = { ...baseTransaction, locktime: 20 };
    expect(Cat21ParserService.parseCat(transaction)).toBeNull();
  });

  it('should return null for transactions with more than one input', () => {
    const transaction = { ...baseTransaction, vin: [{}, {}] };
    expect(Cat21ParserService.parseCat(transaction)).toBeNull();
  });

  it('should return null for transactions with more than one output', () => {
    const transaction = { ...baseTransaction, vout: [{ scriptpubkey_address: 'bc1pValidAddress1' }, { scriptpubkey_address: 'bc1pValidAddress2' }] };
    expect(Cat21ParserService.parseCat(transaction)).toBeNull();
  });

  it('should return null for transactions that are not Taproot transactions', () => {
    const transaction = { ...baseTransaction, vout: [{ scriptpubkey_address: 'invalidAddress' }] };
    expect(Cat21ParserService.parseCat(transaction)).toBeNull();
  });
});
