import { symbolFromCodePoint } from './runestone';

/**
 * A rune's SYMBOL tag is a single Unicode code point. ord decodes it with
 * `char::from_u32`, which rejects the UTF-16 surrogate range and anything above
 * U+10FFFF. `symbolFromCodePoint` reproduces that so our symbol agrees with ord.
 */
describe('symbolFromCodePoint', () => {
  it('decodes a BMP code point to its character', () => {
    expect(symbolFromCodePoint(0x24).unwrap()).toBe('$'); // U+0024 DOLLAR SIGN
  });

  it('decodes an astral (multi-byte) code point', () => {
    expect(symbolFromCodePoint(0x1f536).unwrap()).toBe(String.fromCodePoint(0x1f536)); // U+1F536
  });

  it('rejects the UTF-16 surrogate range, matching ord char::from_u32', () => {
    expect(symbolFromCodePoint(0xd800).isNone()).toBe(true); // lone leading surrogate
    expect(symbolFromCodePoint(0xdbff).isNone()).toBe(true); // last high surrogate
    expect(symbolFromCodePoint(0xdc00).isNone()).toBe(true); // first low surrogate
    expect(symbolFromCodePoint(0xdfff).isNone()).toBe(true); // last trailing surrogate
  });

  it('accepts the code points immediately outside the surrogate range', () => {
    expect(symbolFromCodePoint(0xd7ff).unwrap()).toBe('퟿'); // U+D7FF, just below
    expect(symbolFromCodePoint(0xe000).unwrap()).toBe(''); // U+E000, just above
  });

  it('rejects a code point above U+10FFFF (String.fromCodePoint throws)', () => {
    expect(symbolFromCodePoint(0x110000).isNone()).toBe(true);
  });
});
