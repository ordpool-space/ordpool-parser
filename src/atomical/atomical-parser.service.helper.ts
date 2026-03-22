import { hexToBytes, isStringInArrayOfStrings } from '../lib/conversions';

// OP_FALSE (0x00), OP_IF (0x63), OP_PUSHBYTES_4 (0x04), 'a', 't', 'o', 'm' (0x61, 0x74, 0x6f, 0x6d)
const ATOMICAL_MARK = new Uint8Array([0x00, 0x63, 0x04, 0x61, 0x74, 0x6f, 0x6d]);
const ATOMICAL_MARK_HEX = '00630461746f6d';

/**
 * Checks if an atomical mark is found within a witness array.
 *
 * This code can potentially return false positive matches!
 *
 * @param witness - Array of hex-encoded witness elements.
 * @returns True if an atomical mark is found, false otherwise.
 */
export function hasAtomical(witness: string[]): boolean {
  return isStringInArrayOfStrings(ATOMICAL_MARK_HEX, witness);
}

/**
 * Known Atomicals operation types.
 * Only types with verified mainnet test data are listed here.
 * 'unknown' is returned for any unrecognized operation string.
 *
 * Verified: 'dft' (tx 1d2f39f5...), 'nft' (tx d8c96e39...)
 * Unverified but known to exist: 'ft', 'mod', 'evt', 'dat', 'sl'
 * Add types here ONLY after adding a real mainnet transaction to testdata/.
 */
export type AtomicalOperation = 'dft' | 'nft' | 'ft' | 'mod' | 'evt' | 'dat' | 'sl' | 'unknown';

/**
 * Finds the atomical mark in raw witness bytes and extracts the operation type.
 *
 * After the 7-byte mark, the next pushdata contains the operation identifier.
 * Common operations use single-byte ASCII: 'm' (0x6d), 'u' (0x75), 'x' (0x78), etc.
 * Some use multi-byte strings like 'nft', 'ft', 'dft', 'mod', 'evt', 'dat', 'sl'.
 *
 * @param raw - The raw witness bytes.
 * @returns The operation string, or null if no atomical mark found.
 */
export function extractAtomicalOperation(raw: Uint8Array): AtomicalOperation | null {
  // Find the atomical mark
  for (let i = 0; i <= raw.length - ATOMICAL_MARK.length; i++) {
    let match = true;
    for (let j = 0; j < ATOMICAL_MARK.length; j++) {
      if (raw[i + j] !== ATOMICAL_MARK[j]) {
        match = false;
        break;
      }
    }

    if (match) {
      const afterMark = i + ATOMICAL_MARK.length;
      if (afterMark >= raw.length) {
        return 'unknown';
      }

      // Next byte is a pushdata opcode indicating the length of the operation string
      const pushLen = raw[afterMark];

      // OP_PUSHBYTES_1 through OP_PUSHBYTES_75 push that many bytes
      if (pushLen >= 1 && pushLen <= 75 && afterMark + pushLen < raw.length) {
        const opBytes = raw.slice(afterMark + 1, afterMark + 1 + pushLen);
        const opString = String.fromCharCode(...opBytes);

        // Map known single-char and multi-char operations
        switch (opString) {
          case 'nft': return 'nft';
          case 'ft': return 'ft';
          case 'dft': return 'dft';
          case 'mod': return 'mod';
          case 'evt': return 'evt';
          case 'dat': return 'dat';
          case 'sl': return 'sl';
          default: return 'unknown';
        }
      }

      return 'unknown';
    }
  }

  return null; // no atomical mark found
}

/**
 * Extracts the atomical operation from a witness array.
 *
 * @param witness - Array of hex-encoded witness elements.
 * @returns The operation, or null if no atomical found.
 */
export function extractAtomicalOperationFromWitness(witness: string[]): AtomicalOperation | null {
  for (const element of witness) {
    if (element.includes(ATOMICAL_MARK_HEX)) {
      const raw = hexToBytes(element);
      const op = extractAtomicalOperation(raw);
      if (op !== null) {
        return op;
      }
    }
  }
  return null;
}
