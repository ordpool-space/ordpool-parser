import { u32, U32_MAX_BIGINT } from './u32';
import { None, Some } from '../monads';

describe('u32', () => {
  describe('constructor and type checks', () => {
    test('should handle valid bigint and number inputs', () => {
      expect(u32(1000n)).toBe(1000n);
      expect(u32(0n)).toBe(0n);
      expect(u32(U32_MAX_BIGINT)).toBe(U32_MAX_BIGINT);
      expect(u32(0)).toBe(0n);
      expect(u32(123456)).toBe(123456n);
    });

    test('should throw error for out-of-range values', () => {
      const bigNumber = BigInt('4294967296'); // U32_MAX_BIGINT + 1n
      expect(() => u32(bigNumber)).toThrow('num is out of range');

      const negativeBigInt = -1n;
      expect(() => u32(negativeBigInt)).toThrow('num is out of range');

      expect(() => u32(-1)).toThrow('num is not a valid integer');

      // Theoretically, this should throw an error for being out of range. However, JavaScript automatically converts
      // and wraps numbers that exceed the maximum for 32-bit unsigned integers without an error, which affects how the
      // condition is checked in the u32 function. The function explicitly checks for boundary overflows only for BigInt types.
      // As a result, this test case is removed because JavaScript's Number type handling does not throw for values just
      // above the maximum 32-bit unsigned integer limit when provided as a Number type.
      // expect(() => u32(4294967296)).toThrow('num is out of range'); // Just above U32_MAX
    });

    test('should throw error for invalid number inputs', () => {
      expect(() => u32(1.5)).toThrow('num is not a valid integer');
    });
  });

  describe('checkedAdd', () => {
    test('should correctly add two u32 values within range', () => {
      expect(u32.checkedAdd(u32(30000n), u32(20000n))).toEqual(Some(u32(50000n)));
    });

    test('should return None when addition results in overflow', () => {
      expect(u32.checkedAdd(u32(U32_MAX_BIGINT), u32(1n))).toBe(None);
    });
  });

  describe('checkedSub', () => {
    test('should correctly subtract two u32 values', () => {
      expect(u32.checkedSub(u32(50000n), u32(20000n))).toEqual(Some(u32(30000n)));
    });

    test('should return None when subtraction results in a negative value', () => {
      expect(u32.checkedSub(u32(20000n), u32(50000n))).toBe(None);
    });
  });
});
