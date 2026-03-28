import { OP_PUSHDATA1, OP_PUSHDATA2, OP_PUSHDATA4 } from './op-codes';
import { bytesToHex, hexToBytes } from './conversions';
import { readPushdata } from './reader';

/**
 * Determines if an opcode represents a data push operation.
 *
 * @param opcode - The opcode to evaluate.
 * @returns True if the opcode represents a data push.
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
 * Returns a flat array where each element is either:
 * - A number (opcode, e.g. OP_FALSE=0x00, OP_IF=0x63, OP_CHECKSIG=0xac)
 * - A Uint8Array (push data bytes)
 *
 * Used by both the SRC-20 and Counterparty parsers for multisig pubkey extraction
 * and P2TR witness envelope parsing.
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
 * Extracts public keys from a multisig script as raw byte arrays.
 *
 * Skips the first element (OP_N required signatures) and last two elements
 * (OP_N total keys + OP_CHECKMULTISIG), returning only the embedded pubkeys.
 *
 * Used by the Counterparty parser to avoid the hex round-trip overhead.
 *
 * @param scriptpubkey - The scriptpubkey in hex format
 * @returns An array of public keys as Uint8Array (typically 33 bytes each).
 */
export function extractPubkeysRaw(scriptpubkey: string): Uint8Array[] {

  const bytes = hexToBytes(scriptpubkey);
  const chunks = parseScript(bytes);

  const pubkeys: Uint8Array[] = [];
  for (let i = 1; i < chunks.length - 2; i++) {
    if (typeof chunks[i] !== 'number') {
      pubkeys.push(chunks[i] as Uint8Array);
    }
  }

  return pubkeys;
}

/**
 * Extracts public keys from a multisig script as hex strings.
 *
 * Convenience wrapper around extractPubkeysRaw for callers that need hex strings
 * (e.g. SRC-20 parser which concatenates hex strings for ARC4 decryption).
 *
 * @param hex - The redeem script in hex format
 * @returns An array of public keys as hex strings.
 */
export function extractPubkeys(hex: string): string[] {
  return extractPubkeysRaw(hex).map(bytesToHex);
}
