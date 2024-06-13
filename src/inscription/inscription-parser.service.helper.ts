import { MAX_DECOMPRESSED_SIZE_MESSAGE, brotliDecode } from "../lib/brotli-decode";
import { isStringInArrayOfStrings, littleEndianBytesToNumber } from "../lib/conversions";
import { bytesToHex } from "../lib/conversions";
import { OP_FALSE, OP_IF, OP_PUSHBYTES_3 } from "../lib/op-codes";


/**
 * Inscriptions may include fields before an optional body. Each field consists of two data pushes, a tag and a value.
 * Currently, there are six defined fields:
 */
export const knownFields = {
  // content_type, with a tag of 1, whose value is the MIME type of the body.
  content_type: 0x01,

  // pointer, with a tag of 2, see pointer docs: https://docs.ordinals.com/inscriptions/pointer.html
  pointer: 0x02,

  // parent, with a tag of 3, see provenance docs: https://docs.ordinals.com/inscriptions/provenance.html
  parent: 0x03,

  // metadata, with a tag of 5, see metadata docs: https://docs.ordinals.com/inscriptions/metadata.html
  metadata: 0x05,

  // metaprotocol, with a tag of 7, whose value is the metaprotocol identifier.
  metaprotocol: 0x07,

  // content_encoding, with a tag of 9, whose value is the encoding of the body.
  content_encoding: 0x09,

  // delegate, with a tag of 11, see delegate docs: https://docs.ordinals.com/inscriptions/delegate.html
  delegate: 0xb
}

/**
 * Retrieves the value for a given field from an array of field objects.
 * It returns the value of the first object where the tag matches the specified field.
 *
 * @param fields - An array of objects containing tag and value properties.
 * @param field - The field number to search for.
 * @returns The value associated with the first matching field, or undefined if no match is found.
 */
export function getKnownFieldValue(fields: { tag: number; value: Uint8Array }[], field: number): Uint8Array | undefined {
  const knownField = fields.find(x =>
    x.tag === field);

  if (knownField === undefined) {
    return undefined;
  }

  return knownField.value;
}

/**
 * Retrieves the values for a given field from an array of field objects.
 * It returns the values of all objects where the tag matches the specified field.
 *
 * @param fields - An array of objects containing tag and value properties.
 * @param field - The field number to search for.
 * @returns An array of Uint8Array values associated with the matching fields. If no matches are found, an empty array is returned.
 */
export function getKnownFieldValues(fields: { tag: number; value: Uint8Array }[], field: number): Uint8Array[] {
  const knownFields = fields.filter(x =>
    x.tag === field
  );

  return knownFields.map(field => field.value);
}

/**
 * Searches for the next position of the ordinal inscription mark (0063036f7264)
 * within the raw transaction data, starting from a given position.
 *
 * This function looks for a specific sequence of 6 bytes that represents the start of an ordinal inscription.
 * If the sequence is found, the function returns the index immediately following the inscription mark.
 * If the sequence is not found, the function returns -1, indicating no inscription mark was found.
 *
 * Note: This function uses a simple hardcoded approach based on the fixed length of the inscription mark.
 *
 * @returns The position immediately after the inscription mark, or -1 if not found.
 */
export function getNextInscriptionMark(raw: Uint8Array, startPosition: number): number {

  // OP_FALSE
  // OP_IF
  // OP_PUSHBYTES_3: This pushes the next 3 bytes onto the stack.
  // 0x6f, 0x72, 0x64: These bytes translate to the ASCII string "ord"
  const inscriptionMark = new Uint8Array([OP_FALSE, OP_IF, OP_PUSHBYTES_3, 0x6f, 0x72, 0x64]);

  for (let index = startPosition; index <= raw.length - 6; index++) {
    if (raw[index]     === inscriptionMark[0] &&
        raw[index + 1] === inscriptionMark[1] &&
        raw[index + 2] === inscriptionMark[2] &&
        raw[index + 3] === inscriptionMark[3] &&
        raw[index + 4] === inscriptionMark[4] &&
        raw[index + 5] === inscriptionMark[5]) {
        return index + 6;
    }
  }

  return -1;
}

/**
 * Checks if an inscription mark is found within a witness array.
 * The Inscription mark hex corresponds to OP_FALSE, OP_IF, OP_PUSHBYTES_3, 'o', 'r', 'd'.

 * This code can potentially return false positive matches!
 *
 * @param witness - Array of strings, each representing a hexadecimal encoded witness element.
 * @returns True if an inscription mark is found, false otherwise.
 */
export function hasInscription(witness: string[]): boolean {

  // OP_FALSE (0x00), OP_IF (0x63), OP_PUSHBYTES_3 (0x03), 'o', 'r', 'd' (0x6f, 0x72, 0x64)
  // --> nothing more!! no check for OP_ENDIF
  const inscriptionMarkHex = '0063036f7264';

  // note from Johannes: I'm not sure if this is a realistic case.
  // witness: string[] could be potentially splitted at a super unlucky position?!
  // if someone is smarter than me, please tell me that I can change this! :-)
  // --> so is it save to do this?
  // return witness.some((entry) => entry.includes(inscriptionMarkHex));

  // this would also work, but would join the string, which could result in a lot of memory consumption!
  // imagine a 4MB inscription! 💀
  // const witnessJoined = witness.join('');
  // return witnessJoined.includes(inscriptionMarkHex);

  return isStringInArrayOfStrings(inscriptionMarkHex, witness);
}

/**
 * Extracts the pointer value from a given field in an inscription.
 * The pointer value is a little-endian encoded integer specifying the sat position in the outputs.
 *
 * @param pointerField - The field containing the pointer data.
 * @returns The pointer value as a number, or undefined if the pointer field is not provided.
 */
export function extractPointer(value: Uint8Array | undefined): number | undefined {

  if (value === undefined || value.length > 8) {
    return undefined;
  }

  // Interpret the pointerField value as a little-endian integer
  return littleEndianBytesToNumber(value);
}

/**
 * Decompresses a Uint8Array using the Brotli algorithm.
 *
 * This function first converts the Uint8Array to an Int8Array (since Brotli decoding expects an Int8Array)
 * and then performs the Brotli decompression. The decompressed data is then returned as a Uint8Array.
 *
 * Note: The conversion between Uint8Array and Int8Array does not copy the data but creates a new view over the same memory.
 *
 * If decompression succeeds, returns the decompressed data as Uint8Array.
 * If decompression fails due to size exceeding the allowed limit, returns
 * 'Decompressed size exceeds allowed limit' as Uint8Array.
 *
 * @param bytes - The Uint8Array containing compressed data.
 * @returns A Uint8Array containing the decompressed data or an error message as Uint8Array.
 */
export function brotliDecodeUint8Array(bytes: Uint8Array): Uint8Array {

  // Creating an Int8Array view over the same buffer as the original Uint8Array.
  // The Int8Array view is necessary because brotliDecode expects data in Int8Array format.
  const int8View = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  try {
    // Perform Brotli decompression using the Int8Array view.
    // The brotliDecode function returns decompressed data as an Int8Array.
    const decompressedInt8Array = brotliDecode(int8View);

    // Creating a Uint8Array view over the buffer of the decompressed data.
    // This conversion is required to return the data in the original Uint8Array format.
    return new Uint8Array(decompressedInt8Array.buffer, decompressedInt8Array.byteOffset, decompressedInt8Array.byteLength);

  } catch (error) {
    if (error instanceof Error && error.message === MAX_DECOMPRESSED_SIZE_MESSAGE) {
      return new TextEncoder().encode(MAX_DECOMPRESSED_SIZE_MESSAGE);
    }
    throw error;
  }
}

/**
 * Extracts an inscription ID from a field in an inscription.
 * (used for parent instriptions and for delegate inscriptions)
 * The value consists of a 32-byte transaction ID (TXID) followed by a four-byte little-endian index.
 * The TXID part is reversed in order, and trailing zeroes are omitted.
 *
 * @param parentField - The field containing the parent inscription data.
 * @returns The inscription ID as a string.
 */
export function extractInscriptionId(value: Uint8Array): string {

  // Reverse the TXID part and convert it to hexadecimal
  const txId = value.slice(0, 32).reverse();
  const txIdHex = bytesToHex(txId);

  // Convert the 4-byte little-endian index to a decimal number
  const indexBytes = value.slice(32, 36); // Get the index part
  const index = littleEndianBytesToNumber(indexBytes);

  // Combine TXID and index to form the parent inscription ID
  return txIdHex + 'i' + index;
}

