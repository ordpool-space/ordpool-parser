import { OP_FALSE, OP_IF, OP_PUSHBYTES_3 } from '../inscription-parser.service.helper';
import {
  binaryStringToBase64,
  bytesToHex,
  hexToBytes,
  bytesToBinaryString,
  unicodeStringToBytes,
  bytesToUnicodeString,
  littleEndianBytesToNumber,
  bigEndianBytesToNumber,
} from './conversions';

describe('Base64 encoding and decoding', () => {

  it('binaryStringToBase64 should correctly encode a basic ASCII string', () => {
    const input = 'Hello World';
    const expectedOutput = 'SGVsbG8gV29ybGQ='; // Base64 encoded string of 'Hello World'
    expect(binaryStringToBase64(input)).toEqual(expectedOutput);
  });

  it('binaryStringToBase64 should correctly encode an UTF-8 encoded string containing special characters', () => {
    const utf8String = 'obð¤cpfp';
    const expectedOutput = 'b2Lwn6SdY3BmcA==';
    expect(binaryStringToBase64(utf8String)).toEqual(expectedOutput);
  });

});

describe('Conversions between UTF-8 encoded data and UTF-16 encoded strings', () => {

  it('bytesToBinaryString should return the expected UTF-8 encoded string', () => {

    // UTF-8 Encoding: UTF-8 is a variable-length encoding system for Unicode,
    // capable of representing every character in the Unicode character set.
    // It uses one to four 8-bit bytes.
    const utf8EncodedBytes = new Uint8Array([111, 98, 240, 159, 164, 157, 99, 112, 102, 112]); //  'ob🤝cpfp';

    // Convert Uint8Array to a 'binary' string
    const utf8String: string = bytesToBinaryString(utf8EncodedBytes);

    expect(utf8String).toEqual('obð¤cpfp');
  });

  it('a conversion from UTF-16 to UTF-8 is really what I think it is', () => {

    // UTF-16 Encoding: JavaScript strings are internally represented in UTF-16,
    // where each character can be either 1 or 2 code units (16 bits each).
    const input = 'ob🤝cpfp';

    // UTF-8 Encoding: UTF-8 is a variable-length encoding system for Unicode,
    // capable of representing every character in the Unicode character set.
    // It uses one to four 8-bit bytes.
    const binaryData = unicodeStringToBytes(input);

    // this gives me a strange `serializes to the same string` error - but only when emulating a browser!?
    // expect(binaryData).toEqual(new Uint8Array([111, 98, 240, 159, 164, 157, 99, 112, 102, 112]));
    // workaround:
    expect(JSON.stringify(binaryData)).toEqual(JSON.stringify(new Uint8Array([111, 98, 240, 159, 164, 157, 99, 112, 102, 112])));
  });

  it('bytesToUnicodeString decodes back to UTF-16', () => {

    // UTF-8 Encoding: UTF-8 is a variable-length encoding system for Unicode,
    // capable of representing every character in the Unicode character set.
    // It uses one to four 8-bit bytes.
    const binaryData = new Uint8Array([111, 98, 240, 159, 164, 157, 99, 112, 102, 112]);

    // Convert Uint8Array to a binary string
    const normalUtf16String = bytesToUnicodeString(binaryData);

    expect(normalUtf16String).toEqual('ob🤝cpfp');
  });
});

describe('hexToBytes', () => {

  it('should convert a hex string (ff9900) to an byte array', () => {
    const orangeColorFromBitcoinLogo = 'ff9900';
    const result = hexToBytes(orangeColorFromBitcoinLogo);
    expect(result).toEqual(new Uint8Array([255, 153, 0])); // RGB (255, 153, 0)
  });

  it('should convert the inscriptionMark hex string (0063036f7264) to an byte array', () => {
    const hexString = '0063036f7264';
    const result = hexToBytes(hexString);
    expect(result).toEqual(new Uint8Array([OP_FALSE, OP_IF, OP_PUSHBYTES_3, 0x6f, 0x72, 0x64]));
  });

  it('should handle an empty string', () => {
    const hexString = '';
    const result = hexToBytes(hexString);
    expect(result).toEqual(new Uint8Array([]));
  });
});

describe('bytesToHex', () => {

  it('should correctly convert a byte array to a hex string (ff9900)', () => {
    const byteArray = new Uint8Array([255, 153, 0]);
    const orangeColorFromBitcoinLogo = 'ff9900';
    expect(bytesToHex(byteArray)).toEqual(orangeColorFromBitcoinLogo);
  });

  it('should correctly convert a byte array with the inscription mark to a hexadecimal string', () => {
    const byteArray = new Uint8Array([OP_FALSE, OP_IF, OP_PUSHBYTES_3, 0x6f, 0x72, 0x64]);
    const expectedHex = '0063036f7264';
    expect(bytesToHex(byteArray)).toEqual(expectedHex);
  });

  it('should handle an empty byte array', () => {
    const byteArray = new Uint8Array([]);
    const expectedHex = '';
    expect(bytesToHex(byteArray)).toEqual(expectedHex);
  });

  it('should handle a single byte correctly', () => {
    const byteArray = new Uint8Array([0x00]);
    const expectedHex = '00';
    expect(bytesToHex(byteArray)).toEqual(expectedHex);
  });

  it('should pad single digit hex values with a leading zero', () => {
    const byteArray = new Uint8Array([0x1, 0x2, 0xA]);
    const expectedHex = '01020a';
    expect(bytesToHex(byteArray)).toEqual(expectedHex);
  });
});

// littleEndianBytesToNumber is essentially reading a binary representation of a number
// (in little-endian format) from a Uint8Array and converting it into a JavaScript number.
describe('littleEndianBytesToNumber', () => {

  it('should calculate size for single byte correctly', () => {
    const dataSizeArray = new Uint8Array([0x12]); // 18 in decimal
    const size = littleEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x12);
    expect(size).toEqual(18);
  });

  it('should calculate size for two bytes correctly in little-endian format', () => {
    const dataSizeArray = new Uint8Array([0x34, 0x12]); // 0x1234 in hexadecimal
    const size = littleEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x1234);
    expect(size).toEqual(4660);
  });

  it('should calculate size for four bytes correctly in little-endian format', () => {
    const dataSizeArray = new Uint8Array([0x78, 0x56, 0x34, 0x12]); // 0x12345678 in hexadecimal
    const size = littleEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x12345678);
    expect(size).toEqual(305419896);
  });

  it('should handle an empty array', () => {
    const dataSizeArray = new Uint8Array([]);
    expect(littleEndianBytesToNumber(dataSizeArray)).toEqual(0);
  });
});

// bigEndianBytesToNumber is essentially reading a binary representation of a number
// (in big-endian format) from a Uint8Array and converting it into a JavaScript number.
describe('bigEndianBytesToNumber', () => {

  it('should calculate size for single byte correctly', () => {
    const dataSizeArray = new Uint8Array([0x12]); // 18 in decimal
    const size = bigEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x12);
    expect(size).toEqual(18);
  });

  it('should calculate size for two bytes correctly in big-endian format', () => {
    const dataSizeArray = new Uint8Array([0x12, 0x34]); // 0x1234 in hexadecimal
    const size = bigEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x1234);
    expect(size).toEqual(4660);
  });

  it('should calculate size for four bytes correctly in big-endian format', () => {
    const dataSizeArray = new Uint8Array([0x12, 0x34, 0x56, 0x78]); // 0x12345678 in hexadecimal
    const size = bigEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x12345678);
    expect(size).toEqual(305419896);
  });

  it('should handle an empty array', () => {
    const dataSizeArray = new Uint8Array([]);
    expect(bigEndianBytesToNumber(dataSizeArray)).toEqual(0);
  });
});
