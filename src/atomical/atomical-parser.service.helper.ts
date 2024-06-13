import { isStringInArrayOfStrings } from '../lib/conversions';

/**
 * Checks if an atomical mark is found within a witness array.
 * The Atomical mark hex corresponds to OP_FALSE, OP_IF, OP_PUSHBYTES_4, 'a', 't', 'o', 'm'.
 *
 * This code can potentially return false positive matches!
 *
 * @see hasInscription + tests!
 * @param witness - Array of strings, each representing a hexadecimal encoded witness element.
 * @returns True if an atomical mark is found, false otherwise.
 */
export function hasAtomical(witness: string[]): boolean {

  // OP_FALSE (0x00), OP_IF (0x63), OP_PUSHBYTES_4 (0x04), 'a', 't', 'o', 'm' (0x61, 0x74, 0x6f, 0x6d)
  // --> nothing more!! no check for OP_ENDIF
  const atomicalMarkHex = '00630461746f6d';

  return isStringInArrayOfStrings(atomicalMarkHex, witness);
}
