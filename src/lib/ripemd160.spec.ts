import { ripemd160 } from './ripemd160';

const enc = new TextEncoder();
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

/**
 * Test vectors from the original RIPEMD-160 paper
 * (Dobbertin / Bosselaers / Preneel, "RIPEMD-160: A Strengthened Version
 * of RIPEMD", 1996). Every implementation in the wild uses these.
 */
describe('ripemd160', () => {

  it('hashes the empty string', () => {
    expect(hex(ripemd160(new Uint8Array()))).toBe('9c1185a5c5e9fc54612808977ee8f548b2258d31');
  });

  it('hashes "a"', () => {
    expect(hex(ripemd160(enc.encode('a')))).toBe('0bdc9d2d256b3ee9daae347be6f4dc835a467ffe');
  });

  it('hashes "abc"', () => {
    expect(hex(ripemd160(enc.encode('abc')))).toBe('8eb208f7e05d987a9b044a8e98c6b087f15a0bfc');
  });

  it('hashes "message digest"', () => {
    expect(hex(ripemd160(enc.encode('message digest')))).toBe('5d0689ef49d2fae572b881b123a85ffa21595f36');
  });

  it('hashes the lowercase alphabet', () => {
    expect(hex(ripemd160(enc.encode('abcdefghijklmnopqrstuvwxyz')))).toBe('f71c27109c692c1b56bbdceb5b9d2865b3708dbc');
  });

  it('hashes 56 bytes (boundary near the 64-byte block size)', () => {
    expect(hex(ripemd160(enc.encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))))
      .toBe('12a053384a9c0c88e405a06c27dcf49ada62eb2b');
  });

  it('hashes a long input (alphanumeric mix)', () => {
    const input = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    expect(hex(ripemd160(enc.encode(input)))).toBe('b0e20b6e3116640286ed3a87a5713079b21f5189');
  });

  it('hashes 8 × "1234567890" = 80 bytes (multi-block)', () => {
    expect(hex(ripemd160(enc.encode('1234567890'.repeat(8)))))
      .toBe('9b752e45573d4b39f4dbd3323cab82bf63326bfb');
  });

  it('hashes 1,000,000 × "a"', () => {
    const big = new Uint8Array(1_000_000).fill('a'.charCodeAt(0));
    expect(hex(ripemd160(big))).toBe('52783243c1697bdbe16d37f97f68f08325dc1528');
  });
});
