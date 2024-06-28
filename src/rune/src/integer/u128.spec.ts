import { None, Some } from '../monads';
import { SeekArray } from '../seekarray';
import { u128, U128_MAX_BIGINT } from './u128';

describe('u128', () => {

  describe('constructor and type checks', () => {
    it('should throw error for numbers out of range', () => {
      const outOfRangeBigInt = BigInt('340282366920938463463374607431768211456'); // U128_MAX_BIGINT + 1
      expect(() => u128(outOfRangeBigInt)).toThrow('num is out of range');

      const negativeBigInt = -1n;
      expect(() => u128(negativeBigInt)).toThrow('num is out of range');
    });

    it('should throw error for non-safe integers', () => {
      const nonSafeInteger = 1.5;
      expect(() => u128(nonSafeInteger)).toThrow('num is not a valid integer');

      const largeNumber = Number.MAX_SAFE_INTEGER + 1;
      expect(() => u128(largeNumber)).toThrow('num is not a valid integer');
    });

    // Additional tests for very large BigInts
    it('should handle large BigInts correctly', () => {
      const largeBigInt = BigInt('340282366920938463463374607431768211455'); // U128_MAX
      expect(() => u128(largeBigInt)).not.toThrow();

      const tooLargeBigInt = largeBigInt + 1n;
      expect(() => u128(tooLargeBigInt)).toThrow('num is out of range');
    });
  });

  describe('arithmetic operations', () => {
    test('should add two u128 values correctly', () => {
      const a = u128(50);
      const b = u128(70);
      expect(u128.checkedAdd(a, b)).toEqual(Some(u128(120)));
    });

    test('should return None for overflow in addition', () => {
      const a = u128(U128_MAX_BIGINT);
      const b = u128(1);
      expect(u128.checkedAdd(a, b)).toEqual(None);
    });

    test('should subtract two u128 values correctly', () => {
      const a = u128(100);
      const b = u128(50);
      expect(u128.checkedSub(a, b)).toEqual(Some(u128(50)));
    });

    test('should return None for underflow in subtraction', () => {
      const a = u128(50);
      const b = u128(100);
      expect(u128.checkedSub(a, b)).toEqual(None);
    });

    test('should multiply two u128 values correctly', () => {
      const a = u128(20);
      const b = u128(5);
      expect(u128.checkedMultiply(a, b)).toEqual(Some(u128(100)));
    });

    test('should return None for overflow in multiplication', () => {
      const a = u128(U128_MAX_BIGINT / 2n);
      const b = u128(3);
      expect(u128.checkedMultiply(a, b)).toEqual(None);
    });
  });

  describe('variable length integer encoding', () => {
    test('should encode a u128 value to a variable length integer', () => {
      const value = u128(300);
      const expectedBytes = new Uint8Array([0xAC, 0x02]);
      expect(u128.encodeVarInt(value)).toEqual(expectedBytes);
    });

    test('should decode a variable length integer to a u128', () => {
      const bytes = new Uint8Array([0xAC, 0x02]);
      const seekArray = new SeekArray(bytes);
      expect(u128.decodeVarInt(seekArray)).toEqual(Some(u128(300)));
    });
  });
});
