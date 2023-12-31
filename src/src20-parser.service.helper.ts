import { OP_PUSHDATA1, OP_PUSHDATA2, OP_PUSHDATA4, readPushdata } from "./inscription-parser.service.helper";

/**
 * Converts a hexadecimal string to an array of numbers.
 *
 * Each pair of hexadecimal characters (00 through FF) is converted to its
 * corresponding byte value, which is represented as a number (0 through 255).
 * The function iterates through the hexadecimal string two characters at a time,
 * parsing each pair into a byte and adding it to the resulting array.
 *
 * @param hexStr - A string of hexadecimal characters.
 * @returns An array of numbers, where each number is a byte value (0-255) corresponding to a pair of hex characters.
 */
export function hexToBytes(hexStr: string): number[] {
  const bytes = [];
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes.push(parseInt(hexStr.substr(i, 2), 16));
  }
  return bytes;
}

/**
 * Converts an array of byte values (numbers) to a hexadecimal string.
 *
 * Each number in the array is assumed to be a byte (0 through 255) and is
 * converted to its corresponding two-character hexadecimal representation.
 * The function iterates over each number in the array, converts it to
 * hexadecimal, and concatenates the result into a single string.
 *
 * @param byteArray - An array of numbers, each representing a byte.
 * @returns A string of hexadecimal characters representing the byte array.
 */
export function bytesToHex(byteArray: number[]): string {
  const hexArray = [];
  for (let i = 0; i < byteArray.length; i++) {
    hexArray.push((byteArray[i] >>> 4).toString(16));
    hexArray.push((byteArray[i] & 0xF).toString(16));
  }
  return hexArray.join('');
}

/**
 * Determines if an opcode represents a data push operation.
 *
 * @param {number} opcode - The opcode to evaluate.
 * @returns {boolean} True if the opcode represents a data push.
 */
function isDataPushOpcode(opcode: number): boolean {
  // Opcodes from 0x01 to 0x4b (decimal values 1 to 75) are special opcodes that indicate a data push is happening.
  return (0x01 <= opcode && opcode <= 0x4b) ||
         (opcode === OP_PUSHDATA1 ||
          opcode === OP_PUSHDATA2 ||
          opcode === OP_PUSHDATA4);
}

/**
 * Parses a Bitcoin script and extracts its components (opcodes and data).
 *
 * @param {number[]} buffer - An array of numbers representing the script in bytes.
 * @returns {Array<number | number[]>} An array where each element is either an opcode or an array of data bytes.
 */
export function parseScript(buffer: number[]): Array<number | number[]> {
  const chunks: Array<number | number[]> = [];
  let i = 0;

  while (i < buffer.length) {
    const opcode = buffer[i];

    if (isDataPushOpcode(opcode)) {
      // Use readPushdata for handling data push opcodes
      const [data, newPointer] = readPushdata(new Uint8Array(buffer), i);
      chunks.push(Array.from(data)); // Convert Uint8Array back to number[]
      i = newPointer;
    } else {
      // Handle non-push opcodes
      chunks.push(opcode);
      i++;
    }
  }

  return chunks;
}


/**
 * decodes some parts of the redeemscript of a multisignature transaction
 * but only for OP_CHECKMULTISIG
 * see: https://github.com/OutCast3k/coinbin/blob/cda4559cfd5948dbb18dc078c48a3e62121218e5/js/coin.js#L868
 */
export function extractPubkeys(redeemScriptHex: string) {

  // Split the redeem script into chunks
  const bytes = hexToBytes(redeemScriptHex);
  const chunks = parseScript(bytes);

  var pubkeys = [];
  for(var i=1;i < chunks.length-2; i++){
    pubkeys.push(bytesToHex(chunks[i] as number[]));
  }

  return pubkeys;
}

export function toHex(data: Uint8Array | Buffer | number[]): string {
  const buffer = Buffer.from(data)
  return buffer.toString("hex")
}

/**
 * Converts a string to a Uint8Array.
 *
 * @param str - The string to convert.
 * @returns The Uint8Array representation of the string.
 */
export function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}
