
/**
 * Encodes a string to Base64.
 *
 * This function is designed to encode strings that represent binary data, including both actual binary
 * data (like images) and text that has been encoded to a binary format (e.g., UTF-8 encoded text).
 *
 * It checks for the environment and uses the appropriate method for Base64 encoding.
 * In a browser environment, it uses `window.btoa`. In a Node.js environment, it uses `Buffer`.
 *
 * Note: The input string should represent binary data, where each character corresponds to a byte.
 *
 * @param dataStr - The string representing binary data to be encoded.
 * @returns The Base64 encoded string.
 */
export function binaryStringToBase64(binaryStr: string) {
  if (typeof window !== 'undefined' && window.btoa) {
    // Browser environment
    return window.btoa(binaryStr);
  } else if (typeof Buffer !== 'undefined') {
    // Node.js environment
    return Buffer.from(binaryStr, 'binary').toString('base64');
  } else {
    throw new Error('No suitable environment found for Base64 encoding!');
  }
}

/**
 * Converts a UTF-16 encoded JavaScript string to a Uint8Array representing UTF-8 encoded bytes.
 *
 * @param str - The UTF-16 encoded string to convert.
 * @returns A Uint8Array containing the UTF-8 encoded bytes of the input string.
 */
export function utf16StringToUint8Array(str: string) {
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

/**
 * Converts a Uint8Array containing UTF-8 encoded data to a normal a UTF-16 encoded string.
 *
 * @param bytes - The Uint8Array containing UTF-8 encoded data.
 * @returns The corresponding UTF-16 encoded JavaScript string.
 */
export function utf8BytesToUtf16String(bytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(bytes);
}

/**
 * Convert a Uint8Array to a string by treating each byte as a character code.
 * It avoids interpreting bytes as UTF-8 encoded sequences.
 * --> Again: it ignores UTF-8 encoding, which is necessary for binary content!
 *
 * Note: This method is different from using `String.fromCharCode(...combinedData)` which can
 * cause a "Maximum call stack size exceeded" error for large arrays due to the limitation of
 * the spread operator in JavaScript. (previously the parser broke here, because of large content)
 *
 * @param bytes - The byte array to convert.
 * @returns The resulting string where each byte value is treated as a direct character code.
 */
export function uint8ArrayToSingleByteChars(bytes: Uint8Array): string {
  let resultStr = '';
  for (let i = 0; i < bytes.length; i++) {
    resultStr += String.fromCharCode(bytes[i]);
  }
  return resultStr;
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 *
 * @param {string} hexStr - A string of hexadecimal characters.
 * @returns {Uint8Array} A Uint8Array representing the hex string.
 */
export function hexToBytes(hexStr: string): Uint8Array {
  const bytes = new Uint8Array(hexStr.length / 2);
  for (let i = 0, j = 0; i < hexStr.length; i += 2, j++) {
    bytes[j] = parseInt(hexStr.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a hexadecimal string.
 *
 * @param {Uint8Array} byteArray - A Uint8Array to convert.
 * @returns {string} A string of hexadecimal characters representing the byte array.
 */
export function bytesToHex(byteArray: Uint8Array): string {
  return Array.from(byteArray, byte => byte.toString(16).padStart(2, '0')).join('');
}
