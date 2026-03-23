import { readBytes, readPushdata } from "./reader";
import { OP_0, OP_1NEGATE, OP_PUSHNUM_1, OP_PUSHNUM_16, OP_RESERVED, OP_PUSHDATA1, OP_PUSHDATA2, OP_PUSHDATA4 } from './op-codes';

describe('readBytes', () => {

  it('should correctly read specified number of bytes from Uint8Array', () => {

    const rawData = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);

    // Define the pointer position and number of bytes to read
    const pointer = 2; // Starting from index 2
    const numberOfBytes = 3; // Read 3 bytes

    // Expected results
    const expectedSlice = new Uint8Array([30, 40, 50]);
    const expectedPointer = 5; // Original pointer (2) + number of bytes read (3)

    const [slice, newPointer] = readBytes(rawData, pointer, numberOfBytes);

    expect(slice).toEqual(expectedSlice);
    expect(newPointer).toEqual(expectedPointer);
  });
});


describe('readPushdata', () => {

  it('should handle OP_0 (empty push)', () => {
    const raw = new Uint8Array([OP_0]);
    const [result, pointer] = readPushdata(raw, 0);
    expect(result).toEqual(new Uint8Array([])); // Empty push
    expect(pointer).toBe(1); // Pointer should move by 1
  });

  it('should handle invalid push opcode', () => {
    const raw = new Uint8Array([OP_RESERVED]);
    expect(() => readPushdata(raw, 0)).toThrow(`Invalid push opcode ${OP_RESERVED} at position 0`);
  });

  it('should handle OP_1NEGATE correctly', () => {
    const raw = new Uint8Array([OP_1NEGATE]);
    const [result, pointer] = readPushdata(raw, 0);
    expect(result).toEqual(new Uint8Array([0x81])); // 0x81 represents -1
    expect(pointer).toBe(1);
  });

  it('should handle OP_PUSHNUM_1 to OP_PUSHNUM_16 correctly', () => {
    for (let opcode = OP_PUSHNUM_1; opcode <= OP_PUSHNUM_16; opcode++) {
      const raw = new Uint8Array([opcode]);
      const [result, pointer] = readPushdata(raw, 0);
      expect(result).toEqual(new Uint8Array([opcode - OP_RESERVED]));
      expect(pointer).toBe(1);
    }
  });

  it('should handle direct push of 1-75 bytes correctly', () => {
    const raw = new Uint8Array([0x05, 0x01, 0x02, 0x03, 0x04, 0x05]); // Push 5 bytes directly
    const [result, pointer] = readPushdata(raw, 0);
    expect(result).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]));
    expect(pointer).toBe(6); // Move pointer by 6 (1 byte for opcode, 5 bytes for the data)
  });

  it('should handle OP_PUSHDATA1 correctly', () => {
    const raw = new Uint8Array([OP_PUSHDATA1, 0x04, 0x01, 0x02, 0x03, 0x04]); // PUSHDATA1 with 4 bytes
    const [result, pointer] = readPushdata(raw, 0);
    expect(result).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
    expect(pointer).toBe(6); // 1 for OP_PUSHDATA1, 1 for length, 4 for data
  });

  it('should handle OP_PUSHDATA2 correctly', () => {
    const raw = new Uint8Array([OP_PUSHDATA2, 0x04, 0x00, 0x01, 0x02, 0x03, 0x04]); // PUSHDATA2 with 4 bytes (little-endian length)
    const [result, pointer] = readPushdata(raw, 0);
    expect(result).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
    expect(pointer).toBe(7); // 1 for OP_PUSHDATA2, 2 for length, 4 for data
  });

  it('should handle OP_PUSHDATA4 correctly', () => {
    const raw = new Uint8Array([OP_PUSHDATA4, 0x04, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04]); // PUSHDATA4 with 4 bytes (little-endian length)
    const [result, pointer] = readPushdata(raw, 0);
    expect(result).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
    expect(pointer).toBe(9); // 1 for OP_PUSHDATA4, 4 for length, 4 for data
  });

  it('should throw error for invalid opcode', () => {
    const raw = new Uint8Array([0xff]); // Invalid opcode
    expect(() => readPushdata(raw, 0)).toThrow('Invalid push opcode 255 at position 0');
  });

  it('should handle mixed opcodes', () => {

    const raw = new Uint8Array([
      OP_1NEGATE, // Push -1
      0x03, 0x01, 0x02, 0x03, // Push 3 bytes (direct push)
      OP_PUSHNUM_1, // Push number 1
      OP_PUSHDATA1, 0x02, 0x04, 0x05 // PUSHDATA1 with 2 bytes
    ]);

    const [result1, pointer1] = readPushdata(raw, 0);
    expect(result1).toEqual(new Uint8Array([0x81])); // -1
    expect(pointer1).toBe(1);

    const [result2, pointer2] = readPushdata(raw, pointer1);
    expect(result2).toEqual(new Uint8Array([0x01, 0x02, 0x03])); // 3 bytes
    expect(pointer2).toBe(5);

    const [result3, pointer3] = readPushdata(raw, pointer2);
    expect(result3).toEqual(new Uint8Array([0x01])); // Push number 1
    expect(pointer3).toBe(6);

    const [result4, pointer4] = readPushdata(raw, pointer3);
    expect(result4).toEqual(new Uint8Array([0x04, 0x05])); // 2 bytes via PUSHDATA1
    expect(pointer4).toBe(10);
  });
});
