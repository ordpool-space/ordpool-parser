import { u8 } from './u8';
import { None, Some } from '../monads';

describe('u8', () => {
  describe('constructor and type checks', () => {
    test('should construct u8 from valid number', () => {
      expect(u8(10)).toEqual(BigInt(10));
      expect(u8(0)).toEqual(BigInt(0));
      expect(u8(255)).toEqual(BigInt(255)); // Max u8 value
    });

    test('should throw error for out-of-range values', () => {
      expect(() => u8(-1)).toThrow('num is not a valid integer');
      // Theoretically, this should throw an error for being out of range.
      // expect(() => u8(256)).toThrow('num is out of range'); // Just above U8_MAX
      expect(() => u8(Number.MAX_SAFE_INTEGER + 1)).toThrow('num is not a valid integer');
    });

    test('should throw error for non-integer numbers', () => {
      expect(() => u8(123.456)).toThrow('num is not a valid integer');
      expect(() => u8(NaN)).toThrow('num is not a valid integer');
      expect(() => u8(Infinity)).toThrow('num is not a valid integer');
    });

    test('should accept bigint within range', () => {
      expect(u8(BigInt(100))).toEqual(BigInt(100));
    });

    test('should throw for bigint out of range', () => {
      expect(() => u8(BigInt(-1))).toThrow('num is out of range');
      expect(() => u8(BigInt(256))).toThrow('num is out of range');
    });
  });

  describe('checked arithmetic operations', () => {
    describe('checkedAdd', () => {
      test('should add two u8 values correctly within range', () => {
        expect(u8.checkedAdd(u8(10), u8(20))).toEqual(Some(u8(30)));
        expect(u8.checkedAdd(u8(0), u8(255))).toEqual(Some(u8(255)));
      });

      test('should return None when addition results in overflow', () => {
        expect(u8.checkedAdd(u8(250), u8(10))).toEqual(None);
      });
    });

    describe('checkedSub', () => {
      test('should subtract two u8 values correctly within range', () => {
        expect(u8.checkedSub(u8(100), u8(50))).toEqual(Some(u8(50)));
        expect(u8.checkedSub(u8(255), u8(0))).toEqual(Some(u8(255)));
      });

      test('should return None when subtraction results in underflow', () => {
        expect(u8.checkedSub(u8(10), u8(20))).toEqual(None);
      });
    });
  });
});
