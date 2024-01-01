import { extractPubkeys } from "./src20-parser.service.helper";


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
