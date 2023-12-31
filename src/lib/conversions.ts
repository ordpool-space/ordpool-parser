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
