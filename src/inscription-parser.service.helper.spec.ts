import { OP_FALSE, OP_IF, OP_PUSHBYTES_3, calculateDataSize, encodeToBase64, getNextInscriptionMark, hexStringToUint8Array, readBytes, uint8ArrayToSingleByteChars, utf8BytesToUtf16String } from './inscription-parser.service.helper';

/**
 * Converts a UTF-16 encoded JavaScript string to a Uint8Array representing UTF-8 encoded bytes.
 *
 * @param str - The UTF-16 encoded string to convert.
 * @returns A Uint8Array containing the UTF-8 encoded bytes of the input string.
 */
function utf16StringToUint8Array(str: string) {
  const utf8 = [];

  for (let i = 0; i < str.length; i++) {
      let charcode = str.charCodeAt(i);

      // Handle single-byte characters (U+0000 to U+007F)
      if (charcode < 0x80) utf8.push(charcode);
      // Handle two-byte characters (U+0080 to U+07FF)
      else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
                    0x80 | (charcode & 0x3f));
      }
      // Handle three-byte characters (U+0800 to U+FFFF, excluding surrogate pairs U+D800 to U+DFFF)
      else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
                    0x80 | ((charcode >> 6) & 0x3f),
                    0x80 | (charcode & 0x3f));
      }
      // Handle surrogate pairs (U+10000 to U+10FFFF)
      else {
          i++;
          // Combine surrogate pair components into a single code point
          // UTF-16 encodes 0x10000-0x10FFFF by subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
          utf8.push(0xf0 | (charcode >> 18),
                    0x80 | ((charcode >> 12) & 0x3f),
                    0x80 | ((charcode >> 6) & 0x3f),
                    0x80 | (charcode & 0x3f));
      }
  }

  return new Uint8Array(utf8);
}

describe('Base64 encoding and decoding', () => {

  it('encodeToBase64 should correctly encode a basic ASCII string', () => {
    const input = 'Hello World';
    const expectedOutput = 'SGVsbG8gV29ybGQ='; // Base64 encoded string of 'Hello World'
    expect(encodeToBase64(input)).toEqual(expectedOutput);
  });

  it('encodeToBase64 should correctly encode an UTF-8 encoded string containing special characters', () => {
    const utf8String = 'obð¤cpfp';
    const expectedOutput = 'b2Lwn6SdY3BmcA==';
    expect(encodeToBase64(utf8String)).toEqual(expectedOutput);
  });

});

describe('Conversions between UTF-8 encoded data and UTF-16 encoded strings', () => {

  it('uint8ArrayToSingleByteChars should return the expected UTF-8 encoded string', () => {

    // UTF-8 Encoding: UTF-8 is a variable-length encoding system for Unicode,
    // capable of representing every character in the Unicode character set.
    // It uses one to four 8-bit bytes.
    const utf8EncodedBytes = new Uint8Array([111, 98, 240, 159, 164, 157, 99, 112, 102, 112]); //  'ob🤝cpfp';

    // Convert Uint8Array to a 'binary' string
    const utf8String: string = uint8ArrayToSingleByteChars(utf8EncodedBytes);

    expect(utf8String).toEqual('obð¤cpfp');
  });

  it('a conversion from UTF-16 to UTF-8 is really what I think it is', () => {

    // UTF-16 Encoding: JavaScript strings are internally represented in UTF-16,
    // where each character can be either 1 or 2 code units (16 bits each).
    const input = 'ob🤝cpfp';

    // UTF-8 Encoding: UTF-8 is a variable-length encoding system for Unicode,
    // capable of representing every character in the Unicode character set.
    // It uses one to four 8-bit bytes.
    const binaryData = utf16StringToUint8Array(input);
    expect(binaryData).toEqual(new Uint8Array([111, 98, 240, 159, 164, 157, 99, 112, 102, 112]));
  });

  it('utf8BytesToUtf16String decodes back to UTF-16', () => {

    // UTF-8 Encoding: UTF-8 is a variable-length encoding system for Unicode,
    // capable of representing every character in the Unicode character set.
    // It uses one to four 8-bit bytes.
    const binaryData = new Uint8Array([111, 98, 240, 159, 164, 157, 99, 112, 102, 112]);

    // Convert Uint8Array to a binary string
    const normalUtf16String = utf8BytesToUtf16String(binaryData);

    expect(normalUtf16String).toEqual('ob🤝cpfp');
  });
});

describe('hexStringToUint8Array', () => {

  it('should convert a simple hex string to an Uint8Array', () => {
    const orangeColorFromBitcoinLogo = 'ff9900';
    const result = hexStringToUint8Array(orangeColorFromBitcoinLogo);
    expect(result).toEqual(new Uint8Array([255, 153, 0])); // RGB (255, 153, 0)
  });

  it('should convert the inscriptionMark 0063036f7264 hex string to an Uint8Array', () => {
    const hexString = '0063036f7264';
    const result = hexStringToUint8Array(hexString);
    expect(result).toEqual(new Uint8Array([OP_FALSE, OP_IF, OP_PUSHBYTES_3, 0x6f, 0x72, 0x64]));
  });

  it('should throw an error for an empty string', () => {
    const hexString = '';
    expect(() => hexStringToUint8Array(hexString)).toThrow('Input string is empty. Hex string expected.');
  });
});

describe('readBytes', () => {

  it('should correctly read specified number of bytes from Uint8Array', () => {

    const rawData = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);

    // Define the pointer position and number of bytes to read
    const pointer = 2; // Starting from index 2
    const numberOfBytes = 3; // Read 3 bytes

    // Expected results
    const expectedSlice = new Uint8Array([30, 40, 50]);
    const expectedPointer = 5; // Original pointer (2) + number of bytes read (3)

    const [slice, newPointer] = readBytes(rawData, pointer, numberOfBytes);

    expect(slice).toEqual(expectedSlice);
    expect(newPointer).toEqual(expectedPointer);
  });
});

describe('getNextInscriptionMark', () => {

  it('should find the inscription mark (00 63 03 6f 72 64) and return the position after it', () => {
    const raw = new Uint8Array([0, 1, 2, 0x00, 0x63, 0x03, 0x6f, 0x72, 0x64, 10, 20]);
    const startPosition = 0;
    const expectedPosition = 9;
    expect(getNextInscriptionMark(raw, startPosition)).toEqual(expectedPosition);
  });

  it('should return -1 if the inscription mark is not found', () => {
    const raw = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const startPosition = 0;
    expect(getNextInscriptionMark(raw, startPosition)).toEqual(-1);
  });

  it('should correctly handle an empty array', () => {
    const raw = new Uint8Array([]);
    const startPosition = 0;
    expect(getNextInscriptionMark(raw, startPosition)).toEqual(-1);
  });

  it('should find the inscription mark even if it starts next to the end of the array', () => {
    const raw = new Uint8Array([0, 1, 2, 0x00, 0x63, 0x03, 0x6f, 0x72, 0x64]);
    const startPosition = 3;
    const expectedPosition = 9;
    expect(getNextInscriptionMark(raw, startPosition)).toEqual(expectedPosition);
  });

  it('should find the inscription mark starting exactly at the startPosition', () => {
    const raw = new Uint8Array([0x00, 0x63, 0x03, 0x6f, 0x72, 0x64, 10, 20, 30]);
    const startPosition = 0;
    const expectedPosition = 6;
    expect(getNextInscriptionMark(raw, startPosition)).toEqual(expectedPosition);
  });
});

// calculateDataSize is essentially reading a binary representation of a number
// (in little-endian format) from a Uint8Array and converting it into a JavaScript number.
describe('calculateDataSize', () => {

  it('should calculate size for single byte correctly', () => {
    const dataSizeArray = new Uint8Array([0x12]); // 18 in decimal
    const size = calculateDataSize(dataSizeArray);
    expect(size).toEqual(0x12);
    expect(size).toEqual(18);
  });

  it('should calculate size for two bytes correctly in little-endian format', () => {
    const dataSizeArray = new Uint8Array([0x34, 0x12]); // 0x1234 in hexadecimal
    const size = calculateDataSize(dataSizeArray);
    expect(size).toEqual(0x1234);
    expect(size).toEqual(4660);
  });

  it('should calculate size for four bytes correctly in little-endian format', () => {
    const dataSizeArray = new Uint8Array([0x78, 0x56, 0x34, 0x12]); // 0x12345678 in hexadecimal
    const size = calculateDataSize(dataSizeArray);
    expect(size).toEqual(0x12345678);
    expect(size).toEqual(305419896);
  });

  it('should handle an empty array', () => {
    const dataSizeArray = new Uint8Array([]);
    expect(calculateDataSize(dataSizeArray)).toEqual(0);
  });
});