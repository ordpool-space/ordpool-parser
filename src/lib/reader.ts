import { OP_PUSHDATA1, OP_PUSHDATA2, OP_PUSHDATA4 } from "../inscription-parser.service.helper";

import { littleEndianBytesToNumber } from "./conversions";

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
 *
 * This function handles different opcodes (OP_PUSHDATA1, OP_PUSHDATA2, OP_PUSHDATA4)
 * and the direct push (where the opcode itself signifies the number of bytes to push).
 *
 * @param raw - The raw transaction data as a Uint8Array.
 * @param pointer - The current position in the raw data array.
 * @returns A tuple containing the read data as Uint8Array and the updated pointer position.
 */
export function readPushdata(raw: Uint8Array, pointer: number): [Uint8Array, number] {

  let [opcodeSlice, newPointer] = readBytes(raw, pointer, 1);
  const opcode = opcodeSlice[0];

  // Opcodes from 0x01 to 0x4b (decimal values 1 to 75) are special opcodes that indicate a data push is happening.
  // Specifically, they indicate the number of bytes to be pushed onto the stack.
  // This checks if the current opcode represents a direct data push of 1 to 75 bytes.
  // If this condition is true, then read the next opcode number of bytes and treat them as data
  if (1 <= opcode && opcode <= 75) {
    return readBytes(raw, newPointer, opcode);
  }

  let numBytes: number;
  switch (opcode) {
    case OP_PUSHDATA1: numBytes = 1; break;
    case OP_PUSHDATA2: numBytes = 2; break;
    case OP_PUSHDATA4: numBytes = 4; break;
    default:
      throw new Error(`Invalid push opcode ${opcode.toString(16)} at position ${pointer}`);
  }

  let [dataSizeArray, nextPointer] = readBytes(raw, newPointer, numBytes);
  let dataSize = littleEndianBytesToNumber(dataSizeArray);
  return readBytes(raw, nextPointer, dataSize);
}
