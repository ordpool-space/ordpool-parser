import { encodeToBase64, uint8ArrayToSingleByteChars } from './inscription-parser.service.helper';

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

describe('encodeToBase64', () => {

  it('should correctly encode a basic ASCII string', () => {
    const input = 'Hello World';
    const expectedOutput = 'SGVsbG8gV29ybGQ='; // Base64 encoded string of 'Hello World'
    expect(encodeToBase64(input)).toEqual(expectedOutput);
  });

  it('should correctly encode a \'binary\' string containing special characters', () => {
    const binaryString = 'obð¤cpfp';
    const expectedOutput = 'b2Lwn6SdY3BmcA==';
    expect(encodeToBase64(binaryString)).toEqual(expectedOutput);
  });

  it('uint8ArrayToSingleByteChars should return the same \'binary\' string', () => {

    // UTF-16 Encoding: JavaScript strings are internally represented in UTF-16,
    // where each character can be either 1 or 2 code units (16 bits each).
    const input = 'ob🤝cpfp';

    // UTF-8 Encoding: UTF-8 is a variable-length encoding system for Unicode,
    // capable of representing every character in the Unicode character set.
    // It uses one to four 8-bit bytes.
    const binaryData = utf16StringToUint8Array(input);
    expect(binaryData).toEqual(new Uint8Array([111, 98, 240, 159, 164, 157, 99, 112, 102, 112]));

    // Convert Uint8Array to a binary string
    const binaryString = uint8ArrayToSingleByteChars(binaryData);

    expect(binaryString).toEqual('obð¤cpfp');
  });


});
