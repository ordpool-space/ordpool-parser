
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
export function unicodeStringToBytes(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Converts a Uint8Array containing UTF-8 encoded data to a normal a UTF-16 encoded string.
 *
 * @param bytes - The Uint8Array containing UTF-8 encoded data.
 * @returns The corresponding UTF-16 encoded JavaScript string.
 */
export function bytesToUnicodeString(bytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(bytes);
}

/**
 * Convert a Uint8Array to a string by treating each byte as a character code.
 * It avoids interpreting bytes as UTF-8 encoded sequences.
 * --> Again: it ignores UTF-8 encoding, which is necessary for binary content!
 *
 * Note: This method is different from just using `String.fromCharCode(...combinedData)` which can
 * cause a "Maximum call stack size exceeded" error for large arrays due to the limitation of
 * the spread operator in JavaScript. (previously the parser broke here, because of large content)
 *
 * @param bytes - The byte array to convert.
 * @returns The resulting string where each byte value is treated as a direct character code.
 */
export function bytesToBinaryString(bytes: Uint8Array): string {
  let resultStr = '';
  for (let i = 0; i < bytes.length; i++) {
    resultStr += String.fromCharCode(bytes[i]);
  }
  return resultStr;
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 *
 * @param hex - A string of hexadecimal characters.
 * @returns A Uint8Array representing the hex string.
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0, j = 0; i < hex.length; i += 2, j++) {
    bytes[j] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a hexadecimal string.
 *
 * @param bytes - A Uint8Array to convert.
 * @returns A string of hexadecimal characters representing the byte array.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts a little-endian byte array to a JavaScript number.
 *
 * This function interprets the provided bytes in little-endian format, where the least significant byte comes first.
 * It constructs an integer value representing the number encoded by the bytes.
 *
 * @param byteArray - An array containing the bytes in little-endian format.
 * @returns The number represented by the byte array.
 */
export function littleEndianBytesToNumber(byteArray: Uint8Array): number {
  let number = 0;
  for (let i = 0; i < byteArray.length; i++) {
    // Extract each byte from byteArray, shift it to the left by 8 * i bits, and combine it with number.
    // The shifting accounts for the little-endian format where the least significant byte comes first.
    number |= byteArray[i] << (8 * i);
  }
  return number;
}

/**
 * Converts a big-endian byte array to a number.
 *
 * In big-endian format, the most significant byte (MSB) comes first. This function
 * reads each byte from the array and combines them to form a number, with the first
 * byte in the array being the MSB.
 *
 * @param byteArray - The byte array in big-endian format.
 * @returns The number represented by the byte array.
 */
export function bigEndianBytesToNumber(byteArray: Uint8Array): number {
  let number = 0;
  for (let i = 0; i < byteArray.length; i++) {
    // Shift the current total to the left by 8 bits to make room for the next byte,
    // and add the next byte to the total.
    number = (number << 8) | byteArray[i];
  }
  return number;
}
