import { extractPubkeys, hasKeyBurn } from './src20-parser.service.helper';

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

describe('extractPubkeys', () => {

  it('should extract public keys from a multisig redeem script', () => {

    // Example redeem script from the SRC-20 BTC Transaction Specification
    // see https://github.com/hydren-crypto/stampchain/blob/main/docs/src20.md#src-20-btc-transaction-specifications
    const redeemScript = '512103c46b73fe2ff939bea5d0a577950dc8876e863bed11c887d681417dfd70533e5121039036c8182c70770f8f6bd702a25c7179bfff1ccb3a844297a717226b88b976cc2102020202020202020202020202020202020202020202020202020202020202020253ae';

    // Expected public keys
    const expectedPubkeys = [
      '03c46b73fe2ff939bea5d0a577950dc8876e863bed11c887d681417dfd70533e51',
      '039036c8182c70770f8f6bd702a25c7179bfff1ccb3a844297a717226b88b976cc',
      '020202020202020202020202020202020202020202020202020202020202020202'
    ];

    const extractedPubkeys = extractPubkeys(redeemScript);
    expect(extractedPubkeys).toEqual(expectedPubkeys);
  });
});
