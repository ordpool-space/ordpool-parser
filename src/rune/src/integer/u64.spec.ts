import { u64, U64_MAX_BIGINT } from './u64';
import { None, Some } from '../monads';

describe('u64', () => {
  describe('constructor and type checks', () => {
    it('should correctly handle valid bigint numbers', () => {
      expect(u64(1000n)).toBe(1000n);
      expect(u64(0n)).toBe(0n);
      expect(u64(U64_MAX_BIGINT)).toBe(U64_MAX_BIGINT);
    });

    it('should throw error for numbers out of range', () => {
      const bigNumber = U64_MAX_BIGINT + 1n;
      expect(() => u64(bigNumber)).toThrow('num is out of range');

      const negativeBigInt = -1n;
      expect(() => u64(negativeBigInt)).toThrow('num is out of range');
    });

    it('should handle edge cases for number inputs', () => {
      expect(u64(0)).toBe(0n);
      expect(u64(10)).toBe(10n);
      expect(() => u64(1.5)).toThrow('num is not a valid integer');
      expect(() => u64(-1)).toThrow('num is not a valid integer');
    });
  });

  describe('checkedAdd', () => {
    it('should add two u64 values correctly', () => {
      expect(u64.checkedAdd(u64(10n), u64(20n))).toEqual(Some(u64(30n)));
    });

    it('should return None when addition overflows', () => {
      expect(u64.checkedAdd(u64(U64_MAX_BIGINT), u64(1n))).toBe(None);
    });
  });

  describe('checkedSub', () => {
    it('should subtract two u64 values correctly', () => {
      expect(u64.checkedSub(u64(50n), u64(20n))).toEqual(Some(u64(30n)));
    });

    it('should return None when subtraction results in a negative value', () => {
      expect(u64.checkedSub(u64(20n), u64(50n))).toBe(None);
    });
  });
});
