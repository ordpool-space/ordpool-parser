/**
 * @file arc4 normal
 * @module arc4
 * @subpackage normal
 * @version 3.0.0
 * @author hex7c0 <hex7c0@gmail.com>
 * @copyright hex7c0 2014
 * @license GPLv3
 *  --> core functionality extracted and modified to TypeScript by Johannes
 */


// creates an array from 0 to 255
const box = [...Array(256).keys()];


/**
 * Arc4 class / Simplified TypeScript version
 */
export class Arc4 {

  private key: number[] | null;
  private ksa: number[] | null;

  /**
   * @param {String|Array|Buffer} key - user key
   */
  constructor(key: string | number[] | Buffer) {
    this.key = null;
    this.ksa = null;
    this.change(key);
  }

  /**
   * generate ksa
   *
   * @function gKsa
   * @param {Array} key - user key
   * @return {Array}
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
   * change user key
   *
   * @param {String|Array|Buffer} key - user key
   */
  public change(key: string | number[] | Buffer): void {
    if (typeof key === 'string') {
      this.key = Array.from(Buffer.from(key)).map(byte => byte);
    } else if (Array.isArray(key) || Buffer.isBuffer(key)) {
      this.key = Array.from(key);
    } else {
      throw new Error('Invalid data');
    }
    this.ksa = this.gKsa(this.key);
  }

  /**
   * body cipher
   *
   * @function body
   * @param {Array|Buffer} inp - input
   * @param {Array} gksa - ksa box
   * @param {Array|Buffer} container - out container
   * @param {Integer} length - limit
   * @return {Array|Buffer}
   */
  private body(inp: number[] | Buffer, gksa: number[], container: number[] | Buffer, length: number): number[] | Buffer {
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
   * Arc4 string encode
   *
   * @param {String} str - data
   * @param {String} [input_encoding] - input
   * @param {String} [output_encoding] - output
   * @return {String}
   */
  encodeString(str: string, input_encoding: BufferEncoding = 'utf8', output_encoding: BufferEncoding = 'hex'): string {
    const out = Buffer.from(str, input_encoding);
    const l = out.length;
    return Buffer.from(this.body(out, this.ksa!, Buffer.alloc(l), l))
      .toString(output_encoding);
  }

  /**
   * Arc4 string decode
   *
   * @param {String} str - data
   * @param {String} [input_encoding] - input
   * @param {String} [output_encoding] - output
   * @return {String}
   */
  decodeString(str: string, input_encoding: BufferEncoding = 'hex', output_encoding: BufferEncoding = 'utf8'): string {
    const out = Buffer.from(str, input_encoding);
    const l = out.length;
    return Buffer.from(this.body(out, this.ksa!, Buffer.alloc(l), l))
      .toString(output_encoding);
  }
}
