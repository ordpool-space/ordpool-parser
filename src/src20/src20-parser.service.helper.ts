import { OP_PUSHDATA1, OP_PUSHDATA2, OP_PUSHDATA4 } from '../lib/op-codes';
import { bytesToHex, hexToBytes } from '../lib/conversions';
import { readPushdata } from '../lib/reader';

// big question: are these really all used burners??
export const knownKeyBurnAddresses = [
  '022222222222222222222222222222222222222222222222222222222222222222',
  '033333333333333333333333333333333333333333333333333333333333333333',
  '020202020202020202020202020202020202020202020202020202020202020202',
  '030303030303030303030303030303030303030303030303030303030303030303',
];

/**
 * Checks if a given transaction contains any known stamps key burn addresses
 * see https://github.com/mikeinspace/stamps/blob/main/Key-Burn.md
 *
 * This method doesn't extract public keys, but searches the scriptpubkey strings for known burn addresses.
 * There could be potential false positives if the scriptpubkey includes the same strings in an unrelated context.
 *
 * @param transaction - The Bitcoin transaction to check.
 * @returns Returns true if any multisig output contains a known key burn address, otherwise false.
 */
export function hasKeyBurn(transaction: {
  vout: {
    scriptpubkey: string,
    scriptpubkey_type: string
  }[];
}) {

  for (const vout of transaction.vout) {
    if (vout.scriptpubkey_type === 'multisig' || vout.scriptpubkey_type === 'unknown') {
      for (const keyBurn of knownKeyBurnAddresses) {
        if (vout.scriptpubkey.includes(keyBurn)) {
          return true;
        }
      }
    }
  }

  return false;
}


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
 * This implementation originated here:
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


