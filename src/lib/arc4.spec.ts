import { Arc4 } from "./arc4";
import { bytesToBinaryString, bytesToHex, hexToBytes, unicodeStringToBytes } from "./conversions";

describe('Arc4', () => {

  it('should decode the SRC-20 Bitcoin Transaction from the official specification', () => {

    const arc4Key = hexToBytes('6005ee8cc02e528e20c8e5ff71191723b0260391020862a03587a985f813dabe');
    const cipher = new Arc4(arc4Key);

    // as stated in the docs
    const concatenatedPubkeys = 'c46b73fe2ff939bea5d0a577950dc8876e863bed11c887d681417dfd70533e9036c8182c70770f8f6bd702a25c7179bfff1ccb3a844297a717226b88b976dc054e58b755f233295d2a8759a3e4cbf678619d8e75379e7989046dbce16b932b35a45d21395ac8bb54b8f9dae3fd2dbc309c24e550cf2211fe6aa897e5';
    const decryptedStr = cipher.decodeString(concatenatedPubkeys);
    const decryptedBytes = unicodeStringToBytes(decryptedStr);
    const decryptedHex = bytesToHex(decryptedBytes);

    // as stated in the docs
    expect(decryptedHex).toEqual('00457374616d703a7b2270223a227372632d3230222c226f70223a227472616e73666572222c227469636b223a225354455645222c22616d74223a22313030303030303030227d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  });

  it('should encode the SRC-20 Bitcoin Transaction from the official specification', () => {

    const arc4Key = hexToBytes('6005ee8cc02e528e20c8e5ff71191723b0260391020862a03587a985f813dabe');
    const cipher = new Arc4(arc4Key);

    // as stated in the docs
    const src20Hex = '00457374616d703a7b2270223a227372632d3230222c226f70223a227472616e73666572222c227469636b223a225354455645222c22616d74223a22313030303030303030227d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

    const src20Bytes = hexToBytes(src20Hex);
    const src20String = bytesToBinaryString(src20Bytes);
    const actualConcatenatedPubkeys = cipher.encodeString(src20String);

    // as stated in the docs
    const expectedConcatenatedPubkeys = 'c46b73fe2ff939bea5d0a577950dc8876e863bed11c887d681417dfd70533e9036c8182c70770f8f6bd702a25c7179bfff1ccb3a844297a717226b88b976dc054e58b755f233295d2a8759a3e4cbf678619d8e75379e7989046dbce16b932b35a45d21395ac8bb54b8f9dae3fd2dbc309c24e550cf2211fe6aa897e5';
    expect(actualConcatenatedPubkeys).toEqual(expectedConcatenatedPubkeys);
  });
});
