import { Arc4 } from "./arc4";
import { bytesToHex, unicodeStringToBytes } from "./conversions";

describe('Arc4', () => {
  let key: string;
  let data: string;
  let cipher: Arc4;

  beforeEach(() => {
    key = 'pippo';
    data = 'ciao';
    cipher = new Arc4(key);
  });

  it('should decode the SRC-20 Bitcoin Transaction from the offical specification', () => {

    const arc4Key = Buffer.from('6005ee8cc02e528e20c8e5ff71191723b0260391020862a03587a985f813dabe', 'hex');
    cipher.change(arc4Key);

    const concatenatedPubkeys = 'c46b73fe2ff939bea5d0a577950dc8876e863bed11c887d681417dfd70533e9036c8182c70770f8f6bd702a25c7179bfff1ccb3a844297a717226b88b976dc054e58b755f233295d2a8759a3e4cbf678619d8e75379e7989046dbce16b932b35a45d21395ac8bb54b8f9dae3fd2dbc309c24e550cf2211fe6aa897e5';
    const decryptedStr = cipher.decodeString(concatenatedPubkeys);
    const decryptedBytes = unicodeStringToBytes(decryptedStr);
    const decryptedHex = bytesToHex(decryptedBytes);

    // as stated in the docs
    expect(decryptedHex).toEqual('00457374616d703a7b2270223a227372632d3230222c226f70223a227472616e73666572222c227469636b223a225354455645222c22616d74223a22313030303030303030227d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000')
  });

  describe('encodeString and decodeString', () => {

    it('should return the same string after encoding and decoding', () => {
      const encrypted = cipher.encodeString(data);
      const decrypted = cipher.decodeString(encrypted);
      expect(data).toEqual(decrypted);
      expect(data).not.toEqual(encrypted);
      expect(decrypted).not.toEqual(encrypted);
    });

    it('should return the same string after encoding and decoding with specific encodings', () => {
      const encrypted = cipher.encodeString(data, 'utf16le', 'hex');
      const decrypted = cipher.decodeString(encrypted, 'hex', 'utf16le');
      expect(data).toEqual(decrypted);
      expect(data).not.toEqual(encrypted);
      expect(decrypted).not.toEqual(encrypted);
    });

    it('should behave differently with changed key', () => {
      const encrypted = cipher.encodeString(data);
      cipher.change('pluto');
      const decrypted = cipher.decodeString(encrypted);
      expect(data).not.toEqual(decrypted);
      expect(data).not.toEqual(encrypted);
      expect(decrypted).not.toEqual(encrypted);
    });
  });
});
