import { bytesToHex, hexToBytes } from "./lib/conversions";
import { createHash } from './lib/sha256-uint8array';

/**
 * Hashes data using the SHA-256 algorithm.
 * Takes a Uint8Array as input and returns a Uint8Array of the hash.
 *
 * Does not use the SubtleCrypto API because this one is returning Promises
 * ... and then all the code would have async/await everywhere
 *
 * @param inputData - The data to be hashed, in Uint8Array format.
 * @returns hash of the input data, as a Uint8Array.
 */
export function sha256Hash(inputData: Uint8Array): Uint8Array {
  return createHash().update(inputData).digest();
}

/**
 * Creates a CAT-21 hash using the SHA-256 algorithm.
 * Both transactionId and blockId must be in hexadecimal format.
 * The function concatenates transactionId and blockId, hashes the result,
 * and returns a 64-character hexadecimal string.
 *
 * @param transactionId - The transaction ID in hexadecimal format.
 * @param blockId - The block ID in hexadecimal format.
 * @returns A 64-character hexadecimal hash string.
 * @throws If transactionId or blockId are not valid hexadecimal strings of the correct length.
 */
export function createCatHash(transactionId: string, blockId: string): string {

  // Validate input lengths (typically, a Bitcoin transaction ID and block ID are 64 hex characters)
  if (transactionId.length !== 64 || blockId.length !== 64) {
    throw new Error('Invalid input: transactionId and blockId must be 64-character hexadecimal strings');
  }

  // Validate input format (hexadecimal)
  if (!/^[a-fA-F0-9]+$/.test(transactionId) || !/^[a-fA-F0-9]+$/.test(blockId)) {
    throw new Error('Invalid input: transactionId and blockId must be hexadecimal strings');
  }

  // Concatenated transactionId and blockId
  const concatenateHex = transactionId + blockId;
  const concatenateBytes = hexToBytes(concatenateHex);

  const hashedResult = sha256Hash(concatenateBytes);
  return bytesToHex(hashedResult);
}
