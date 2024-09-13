import { u128 } from './integer';

export class Rune {

  constructor(readonly value: u128) {}

  toString() {
    let n = this.value;

    if (n === u128.MAX) {
      return 'BCGDENLQRQWDSLRUGSNLBTMFIJAV';
    }

    n = u128(n + 1n); // Increment the value before encoding to string!
    let symbol = '';
    while (n > 0) {
      symbol = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Number((n - 1n) % 26n)] + symbol;
      n = u128((n - 1n) / 26n); // Use base-26 arithmetic
    }

    return symbol;
  }

  static fromString(s: string) {
    let x = u128(0);
    for (const i of [...Array(s.length).keys()]) {
      const c = s[i];

      if (i > 0) {
        x = u128(x + 1n); // Increment the value for each character!
      }
      x = u128.checkedMultiply(x, u128(26)).unwrap(); // Base-26 multiplication
      if ('A' <= c && c <= 'Z') {
        x = u128.checkedAdd(x, u128(c.charCodeAt(0) - 'A'.charCodeAt(0))).unwrap();
      } else {
        throw new Error(`invalid character in rune name: ${c}`);
      }
    }

    return new Rune(x);
  }

  get commitment(): Uint8Array {

    //const bytes = Buffer.alloc(16);
    // Create a 16-byte Uint8Array
    const bytes = new Uint8Array(16);
    const view = new DataView(bytes.buffer);

    // Write the 64-bit lower part of the BigInt in little-endian
    view.setBigUint64(0, 0xffffffff_ffffffffn & this.value, true);

    // Write the 64-bit upper part of the BigInt in little-endian
    view.setBigUint64(8, this.value >> 64n, true);

    // Remove trailing zero bytes
    let end = bytes.length;
    while (end > 0 && bytes.at(end - 1) === 0) {
      end--;
    }

    return bytes.subarray(0, end); // Return trimmed bytes (no trailing zeroes)
  }
}
