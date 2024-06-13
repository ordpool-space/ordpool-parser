import { OP_1NEGATE, OP_PUSHDATA1, OP_PUSHDATA2, OP_PUSHDATA4, OP_PUSHNUM_1, OP_PUSHNUM_16, OP_RESERVED } from '../lib/op-codes';

import { littleEndianBytesToNumber } from './conversions';

/**
 * Reads a specified number of bytes from a Uint8Array starting from a given pointer.
 *
 * @param raw - The Uint8Array from which bytes are to be read.
 * @param pointer - The position in the array from where to start reading.
 * @param n - The number of bytes to read.
 * @returns A tuple containing the read bytes as Uint8Array and the updated pointer position.
 */
export function readBytes(raw: Uint8Array, pointer: number, n: number): [Uint8Array, number] {
  const slice = raw.slice(pointer, pointer + n);
  return [slice, pointer + n];
}

/**
 * Reads data based on the Bitcoin script push opcode starting from a specified pointer in the raw data.
 * Handles different opcodes and direct push (where the opcode itself signifies the number of bytes to push).
 *
 * @param raw - The raw transaction data as a Uint8Array.
 * @param pointer - The current position in the raw data array.
 * @returns A tuple containing the read data as Uint8Array and the updated pointer position.
 */
export function readPushdata(raw: Uint8Array, pointer: number): [Uint8Array, number] {

  let [opcodeSlice, newPointer] = readBytes(raw, pointer, 1);
  const opcode = opcodeSlice[0];

  // Handle the special case of OP_1NEGATE (-1)
  if (opcode === OP_1NEGATE) {
    // OP_1NEGATE pushes the value -1 onto the stack, represented as 0x81 in Bitcoin Script
    return [new Uint8Array([0x81]), newPointer];
  }

  // Handle minimal push numbers OP_PUSHNUM_1 (0x51) to OP_PUSHNUM_16 (0x60)
  // which are used to push the values 0x01 (decimal 1) through 0x10 (decimal 16) onto the stack.
  // To get the value, we can subtract OP_RESERVED (0x50) from the opcode to get the value to be pushed.
  if (opcode >= OP_PUSHNUM_1 && opcode <= OP_PUSHNUM_16) {
    // Convert opcode to corresponding byte value
    const byteValue = opcode - OP_RESERVED;
    return [Uint8Array.from([byteValue]), newPointer];
  }

  // Handle direct push of 1 to 75 bytes (OP_PUSHBYTES_1 to OP_PUSHBYTES_75)
  if (1 <= opcode && opcode <= 75) {
    return readBytes(raw, newPointer, opcode);
  }

  let numBytes: number;
  switch (opcode) {
    case OP_PUSHDATA1: numBytes = 1; break;
    case OP_PUSHDATA2: numBytes = 2; break;
    case OP_PUSHDATA4: numBytes = 4; break;
    default:
      throw new Error(`Invalid push opcode ${ opcode } at position ${pointer}`);
  }

  let [dataSizeArray, nextPointer] = readBytes(raw, newPointer, numBytes);
  let dataSize = littleEndianBytesToNumber(dataSizeArray);
  return readBytes(raw, nextPointer, dataSize);
}
