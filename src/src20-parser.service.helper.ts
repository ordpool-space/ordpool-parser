import { OP_PUSHDATA1, OP_PUSHDATA2, OP_PUSHDATA4 } from "./inscription-parser.service.helper";
import { bytesToHex, hexToBytes } from "./lib/conversions";
import { readPushdata } from "./lib/reader";

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
 * @param bytes - A Uint8Array representing the script in bytes.
 * @returns An array where each element is either an opcode or a Uint8Array of data bytes.
 */
export function parseScript(bytes: Uint8Array): Array<number | Uint8Array> {
  const chunks: Array<number | Uint8Array> = [];
  let i = 0;

  while (i < bytes.length) {
    const opcode = bytes[i];

    if (isDataPushOpcode(opcode)) {
      // Use readPushdata for handling data push opcodes
      const [data, newPointer] = readPushdata(bytes, i);
      chunks.push(data);
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
 * Extracts public keys from a redeem script of a multisignature transaction.
 *
 * Notes:
 * Only tested and developed for OP_CHECKMULTISIG
 * The original implementation originated here:
 * https://github.com/OutCast3k/coinbin/blob/cda4559cfd5948dbb18dc078c48a3e62121218e5/js/coin.js#L868
 *
 * @param hex - The redeem script in hex format
 * @returns An array of public keys extracted from the script.
 */
export function extractPubkeys(hex: string): string[] {

  const bytes = hexToBytes(hex);
  const chunks = parseScript(bytes);

  const pubkeys: string[] = [];
  for (let i = 1; i < chunks.length - 2; i++) {
    if (typeof chunks[i] !== 'number') {
      pubkeys.push(bytesToHex(chunks[i] as Uint8Array));
    }
  }

  return pubkeys;
}


