/**
 * @file arc4 normal
 * @module arc4
 * @subpackage normal
 * @version 3.0.0
 * @author hex7c0 <hex7c0@gmail.com>
 * @copyright hex7c0 2014
 * @license GPLv3
 *
 * Original: https://github.com/hex7c0/arc4
 * --> core functionality extracted and modified to TypeScript by Johannes
 * --> Buffer replaced with Uint8Array for Browser compatibility
 */

import { bytesToHex, bytesToUnicodeString, hexToBytes, unicodeStringToBytes } from "./conversions";


// creates an array from 0 to 255
const box = [...Array(256).keys()];


/**
 * Arc4 class / Simplified TypeScript version
 * with contains the bare minimum to work with the Src20ParserService
 */
export class Arc4 {

  private key: number[] | null;
  private ksa: number[] | null;

  /**
   * @param key - user key
   */
  constructor(key: string | Uint8Array) {
    this.key = null;
    this.ksa = null;
    this.change(key);
  }

  /**
   * Generate Key-Scheduling Algorithm (KSA)
   *
   * @param key - user key
   */
  private gKsa(key: number[]): number[] {
    let j = 0;
    const s = box.slice();
    const len = key.length;
    for (let i = 0; i < 256; ++i) {
      j = (j + s[i] + key[i % len]) % 256;
      [s[i], s[j]] = [s[j], s[i]]; // swap elements
    }
    return s;
  }

  /**
   * Change user key
   *
   * @param key - user key
   */
  public change(key: Uint8Array |string): void {
    if (typeof key === 'string') {
      const encoder = new TextEncoder();
      this.key = Array.from(encoder.encode(key));
    } else if (key instanceof Uint8Array) {
      this.key = Array.from(key);
    } else {
      throw new Error('Invalid key');
    }
    this.ksa = this.gKsa(this.key);
  }

  /**
   * Body cipher
   *
   * @param inp - input
   * @param gksa - ksa box
   * @param container - out container
   * @param length - limit
   */
  private body(inp: Uint8Array, gksa: number[], container: Uint8Array, length: number): Uint8Array {
    let i = 0, j = 0;
    const out = container;
    const ksa = gksa.slice();
    for (let y = 0; y < length; ++y) {
      i = (i + 1) % 256;
      j = (j + ksa[i]) % 256;
      [ksa[i], ksa[j]] = [ksa[j], ksa[i]]; // swap elements
      out[y] = inp[y] ^ ksa[(ksa[i] + ksa[j]) % 256];
    }
    return out;
  }

  /**
   * Applies the core RC4 encryption or decryption logic.
   *
   * @param bytes - The byte array to be processed.
   * @return The processed byte array.
   */
  private processBytes(bytes: Uint8Array): Uint8Array {
    return this.body(bytes, this.ksa!, new Uint8Array(bytes.length), bytes.length);
  }

  /**
   * Encrypts a UTF-8 string and returns the result as a hex string.
   *
   * @param {String} str - UTF-8 string to encrypt.
   * @return {String} - Encrypted data as a hex string.
   */
  encodeString(str: string): string {
    const encoded = unicodeStringToBytes(str);
    const encrypted = this.processBytes(encoded);
    return bytesToHex(encrypted);
  }

  /**
   * Decrypts a hex string and returns the result as a UTF-8 string.
   *
   * @param hexStr - Hex string to decrypt.
   * @return Decrypted data as a UTF-8 string.
   */
  decodeString(hexStr: string): string {
    const bytes = hexToBytes(hexStr);
    const decryptedBytes = this.processBytes(bytes);
    return bytesToUnicodeString(decryptedBytes);
  }
}
