/**
 * @file arc4 normal
 * @module arc4
 * @subpackage normal
 * @version 3.0.0
 * @author hex7c0 <hex7c0@gmail.com>
 * @copyright hex7c0 2014
 * @license GPLv3
 *  --> core functionality extracted abd modified to TypeScript by Johannes
 */


// creates an array from 0 to 255
const box = [...Array(256).keys()];


/**
 * generate ksa
 *
 * @function gKsa
 * @param {Array} key - user key
 * @return {Array}
 */
function gKsa(key: number[]): number[] {

  var j = 0;
  var s = box.slice();
  var len = key.length;
  for (var i = 0; i < 256; ++i) {
    j = (j + s[i] + key[i % len]) % 256;
    s[j] = [ s[i], s[i] = s[j] ][0];
  }
  return s;
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
function body(inp: number[] | Buffer, gksa: number[], container: number[] | Buffer, length: number): number[] | Buffer {

  var i = 0, j = 0;
  var out = container;
  var ksa = gksa.slice();
  for (var y = 0; y < length; ++y) {
    i = (i + 1) % 256;
    j = (j + ksa[i]) % 256;
    ksa[j] = [ ksa[i], ksa[i] = ksa[j] ][0];
    out[y] = inp[y] ^ ksa[(ksa[i] + ksa[j]) % 256];
  }
  return out;
}

/**
 * Arc4 class / TypeScript version
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
   * change user key
   *
   * @param {String|Array|Buffer} key - user key
   */
  change(key: string | number[] | Buffer): void {

    if (Array.isArray(key)) {
      this.key = key;
    } else if (typeof (key) === 'string' || Buffer.isBuffer(key)) {
      this.key = new Array(key.length);
      var keys = new Buffer(key as string);
      for (var i = 0, ii = keys.length; i < ii; ++i) {
        this.key[i] = keys[i];
      }
    } else {
      throw new Error('Invalid data');
    }
    this.ksa = gKsa(this.key);
    return;
  };

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
    return Buffer.from(body(out, this.ksa!, Buffer.alloc(l), l))
      .toString(output_encoding);
  };

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
    return Buffer.from(body(out, this.ksa!, Buffer.alloc(l), l))
      .toString(output_encoding);
  };
}
