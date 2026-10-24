import { Arc4 } from './arc4';
import {
  bigEndianBytesToNumber,
  bytesToHex,
  bytesToUnicodeString,
  hexToBytes,
  unicodeStringToBytes,
} from './conversions';

/**
 * SRC-20, STAMP and Counterparty all carry an ARC4-encrypted payload in the
 * first two public keys of each multisig output, prefixed with a two-byte
 * big-endian length. The payload is arbitrary binary, so it must never pass
 * through a string: `bytesToUnicodeString` decodes UTF-8 and replaces every
 * invalid byte with U+FFFD, and `unicodeStringToBytes` then writes that back as
 * EF BF BD. Three bytes where there was one.
 *
 * These are pure byte-level helpers, not transaction parsing, which is why the
 * inputs here are constructed: the repo's real-mainnet rule governs transaction
 * data and parser input, and there is no transaction in this file to fake.
 *
 * No mainnet fixture in `testdata/` reaches the fault today. All six that
 * SRC-20 or STAMP parse have an ASCII-safe length prefix, and the two carrying
 * high bytes in their data (`172160b2..43f4`, `5ba7f995..5a87`) happen to form
 * valid UTF-8 sequences, so the round trip is lossless for them by luck.
 */
describe('ARC4 payloads stay in bytes, never through a string', () => {

  describe('the UTF-8 round trip that used to sit in the SRC-20 and STAMP decode', () => {

    it('corrupts a length prefix of 128, reading it back as 239', () => {
      // 00 80 is the two-byte big-endian length of a 128-byte payload
      const declared = new Uint8Array([0x00, 0x80, 0x7b, 0x22, 0x70, 0x22]);
      expect(bigEndianBytesToNumber(declared.slice(0, 2))).toBe(128);

      const roundTripped = unicodeStringToBytes(bytesToUnicodeString(declared));

      // 0x80 cannot start a UTF-8 sequence, so it becomes U+FFFD -> EF BF BD
      expect(bytesToHex(roundTripped)).toBe('00efbfbd7b227022');
      expect(bigEndianBytesToNumber(roundTripped.slice(0, 2))).toBe(239);
    });

    it('lengthens the payload, so every byte after the first fault shifts', () => {
      const payload = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG magic
      const roundTripped = unicodeStringToBytes(bytesToUnicodeString(payload));

      expect(payload.length).toBe(8);
      expect(roundTripped.length).toBeGreaterThan(8);
      expect(bytesToHex(roundTripped)).not.toBe(bytesToHex(payload));
    });

    it('is lossless only while every byte is ASCII, which is why it went unnoticed', () => {
      // the documented SRC-20 example payload: 00 45 then "stamp:{...}", all ASCII
      const ascii = hexToBytes('00457374616d703a7b2270223a227372632d3230227d');
      expect(bytesToHex(unicodeStringToBytes(bytesToUnicodeString(ascii)))).toBe(bytesToHex(ascii));
    });
  });

  describe('processBytes, the path Counterparty already used', () => {

    it('round-trips arbitrary binary through encrypt and decrypt unchanged', () => {
      const key = hexToBytes('0476e678a445db415dd88502aca9d29b5bff1f8de923c6b1c6de107ccf775017');
      // every byte value, so no UTF-8-safe subset can hide a fault
      const payload = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        payload[i] = i;
      }

      const encrypted = new Arc4(key).processBytes(payload);
      const decrypted = new Arc4(key).processBytes(encrypted);

      expect(bytesToHex(decrypted)).toBe(bytesToHex(payload));
      expect(decrypted.length).toBe(256);
    });

    it('preserves a 128-byte length prefix that the string path corrupted', () => {
      const key = hexToBytes('0476e678a445db415dd88502aca9d29b5bff1f8de923c6b1c6de107ccf775017');
      const declared = new Uint8Array([0x00, 0x80, 0x7b, 0x22]);

      const encrypted = new Arc4(key).processBytes(declared);
      const decrypted = new Arc4(key).processBytes(encrypted);

      expect(bigEndianBytesToNumber(decrypted.slice(0, 2))).toBe(128);
    });
  });
});
