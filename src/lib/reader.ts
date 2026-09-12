import { OP_0, OP_1NEGATE, OP_PUSHDATA1, OP_PUSHDATA2, OP_PUSHDATA4, OP_PUSHNUM_1, OP_PUSHNUM_16, OP_RESERVED } from '../lib/op-codes';

import { littleEndianBytesToBigInt, littleEndianBytesToNumber } from './conversions';

/**
 * Reads a specified number of bytes from a Uint8Array starting from a given pointer.
 *
 * @param raw - The Uint8Array from which bytes are to be read.
 * @param pointer - The position in the array from where to start reading.
 * @param n - The number of bytes to read.
 * @returns A tuple containing the read bytes as Uint8Array and the updated pointer position.
 */
export function readBytes(raw: Uint8Array, pointer: number, n: number): [Uint8Array, number] {
  return [raw.subarray(pointer, pointer + n), pointer + n];
}

/**
 * One decoded script instruction.
 */
export interface ScriptInstruction {
  /** The opcode byte. */
  opcode: number;
  /** The pushed bytes, or null for an opcode that pushes nothing (OP_IF, OP_ENDIF, ...). */
  data: Uint8Array | null;
  /** Position right after this instruction. */
  next: number;
}

/**
 * Reads the next script instruction, the way ord walks a script
 * (`Script::instructions()` in rust-bitcoin, which does NOT enforce minimal
 * pushes). Data pushes report their bytes, every other opcode reports none.
 *
 * OP_1NEGATE and OP_PUSHNUM_1 to OP_PUSHNUM_16 count as data pushes here,
 * because ord puts their numeric value into the envelope payload.
 *
 * @throws When a push runs past the end of the script. ord treats such a
 *         script as undecodable and then ignores every envelope of that input.
 */
export function readInstruction(raw: Uint8Array, pointer: number): ScriptInstruction {

  const opcode = raw[pointer];

  if (opcode === OP_0 ||
    (1 <= opcode && opcode <= 75) ||
    opcode === OP_PUSHDATA1 || opcode === OP_PUSHDATA2 || opcode === OP_PUSHDATA4 ||
    opcode === OP_1NEGATE ||
    (opcode >= OP_PUSHNUM_1 && opcode <= OP_PUSHNUM_16)) {

    const [data, next] = readPushdata(raw, pointer);

    // readPushdata reads via subarray, which silently shortens a push that runs
    // past the end of the script. ord errors out on that, so we do too.
    //
    // A push always advances at least one byte, so a pointer that does not move
    // forward means the length was not decodable as a real size. Callers walk
    // scripts with this, and a non-advancing pointer would loop forever.
    if (next > raw.length || next <= pointer) {
      throw new Error(`Push at position ${pointer} runs past the end of the script`);
    }

    return { opcode, data, next };
  }

  return { opcode, data: null, next: pointer + 1 };
}

/**
 * Reads data based on the Bitcoin script push opcode starting from a specified pointer in the raw data.
 * Handles different opcodes and direct push (where the opcode itself signifies the number of bytes to push).
 *
 * Hint: ord can read minimal data-pushes, but does NOT create inscriptions with them.
 * But chisel.xyz already supports this feature!
 *
 * see https://github.com/ordpool-space/ordpool-parser/pull/2
 * see https://github.com/ordinals/ord/issues/1403 (Use minimal data-pushes)
 * see https://github.com/ordinals/ord/issues/2505 (Make docs more precise)
 * see https://github.com/ordinals/ord/pull/1769 (Correctly parse inscriptions when using minimal opcodes)
 *
 * @param raw - The raw transaction data as a Uint8Array.
 * @param pointer - The current position in the raw data array.
 * @returns A tuple containing the read data as Uint8Array and the updated pointer position.
 */
export function readPushdata(raw: Uint8Array, pointer: number): [Uint8Array, number] {

  let [opcodeSlice, newPointer] = readBytes(raw, pointer, 1);
  const opcode = opcodeSlice[0];

  // Handle the special case of OP_0 (0x00) which pushes an empty array (interpreted as zero)
  // fixes #18
  if (opcode === OP_0) {
    return [new Uint8Array(), newPointer];
  }

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

  // Decode via bigint: OP_PUSHDATA4 carries a 4 byte length, and
  // littleEndianBytesToNumber builds its value with 32-bit signed bit ops, so
  // a length with the high bit set comes back NEGATIVE and yields a pointer
  // that walks backwards through the script. u32 max is well within Number.
  let dataSize = Number(littleEndianBytesToBigInt(dataSizeArray));
  return readBytes(raw, nextPointer, dataSize);
}
