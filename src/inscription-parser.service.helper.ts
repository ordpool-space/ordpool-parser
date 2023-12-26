import { MAX_DECOMPRESSED_SIZE_MESSAGE, brotliDecode } from "./brotli-decode";

/**
 * Bitcoin Script Opcodes
 * see https://en.bitcoin.it/wiki/Script
 */
export const OP_FALSE = 0x00;
export const OP_IF = 0x63;
export const OP_0 = 0x00;

export const OP_PUSHBYTES_3 = 0x03; // not an actual opcode, but used in documentation --> pushes the next 3 bytes onto the stack.
export const OP_PUSHDATA1 = 0x4c; // The next byte contains the number of bytes to be pushed onto the stack.
export const OP_PUSHDATA2 = 0x4d; // The next two bytes contain the number of bytes to be pushed onto the stack in little endian order.
export const OP_PUSHDATA4 = 0x4e; // The next four bytes contain the number of bytes to be pushed onto the stack in little endian order.
export const OP_ENDIF = 0x68; // Ends an if/else block.

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
  content_encoding: 0x09
}

export function getKnownFieldValue(fields: { tag: Uint8Array; value: Uint8Array }[], field: number) {
  const knownField = fields.find(x =>
    x.tag.length === 1 &&
    x.tag[0] === field);

  if (knownField === undefined) {
    return undefined;
  }

  return knownField.value;
}

/**
 * Encodes a string to Base64.
 *
 * This function is designed to encode strings that represent binary data, including both actual binary
 * data (like images) and text that has been encoded to a binary format (e.g., UTF-8 encoded text).
 *
 * It checks for the environment and uses the appropriate method for Base64 encoding.
 * In a browser environment, it uses `window.btoa`. In a Node.js environment, it uses `Buffer`.
 *
 * Note: The input string should represent binary data, where each character corresponds to a byte.
 *
 * @param dataStr - The string representing binary data to be encoded.
 * @returns The Base64 encoded string.
 */
export function encodeToBase64(binaryStr: string) {
  if (typeof window !== 'undefined' && window.btoa) {
    // Browser environment
    return window.btoa(binaryStr);
  } else if (typeof Buffer !== 'undefined') {
    // Node.js environment
    return Buffer.from(binaryStr, 'binary').toString('base64');
  } else {
    throw new Error('No suitable environment found for Base64 encoding!');
  }
}

/**
 * Converts a hex string to a Uint8Array.
 *
 * @param hexStr - The hex string to be converted.
 * @returns The resulting Uint8Array.
 */
export function hexStringToUint8Array(hex: string): Uint8Array {
  if (hex.length === 0) {
    throw new Error('Input string is empty. Hex string expected.');
  }
  return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
}

/**
 * Converts a Uint8Array containing UTF-8 encoded data to a normal a UTF-16 encoded string.
 *
 * @param bytes - The Uint8Array containing UTF-8 encoded data.
 * @returns The corresponding UTF-16 encoded JavaScript string.
 */
export function utf8BytesToUtf16String(bytes: Uint8Array | undefined): string | undefined {

  if (bytes === undefined) {
    return undefined;
  }

  const decoder = new TextDecoder('utf-8');
  return decoder.decode(bytes);
}

/**
 * Convert a Uint8Array to a string by treating each byte as a character code.
 * It avoids interpreting bytes as UTF-8 encoded sequences.
 * --> Again: it ignores UTF-8 encoding, which is necessary for binary content!
 *
 * Note: This method is different from using `String.fromCharCode(...combinedData)` which can
 * cause a "Maximum call stack size exceeded" error for large arrays due to the limitation of
 * the spread operator in JavaScript. (previously the parser broke here, because of large content)
 *
 * @param bytes - The byte array to convert.
 * @returns The resulting string where each byte value is treated as a direct character code.
 */
export function uint8ArrayToSingleByteChars(bytes: Uint8Array): string {
  let resultStr = '';
  for (let i = 0; i < bytes.length; i++) {
    resultStr += String.fromCharCode(bytes[i]);
  }
  return resultStr;
}

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
 * Converts a little-endian byte array to a JavaScript number.
 *
 * This function interprets the provided bytes in little-endian format, where the least significant byte comes first.
 * It constructs an integer value representing the number encoded by the bytes.
 *
 * @param byteArray - An array containing the bytes in little-endian format.
 * @returns The number represented by the byte array.
 */
export function littleEndianBytesToNumber(byteArray: Uint8Array): number {
  let number = 0;
  for (let i = 0; i < byteArray.length; i++) {
    // Extract each byte from byteArray, shift it to the left by 8 * i bits, and combine it with number.
    // The shifting accounts for the little-endian format where the least significant byte comes first.
    number |= byteArray[i] << (8 * i);
  }
  return number;
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
  if (0x01 <= opcode && opcode <= 0x4b) {
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

/**
 * Super quick check, that returns true if an inscriptionMark is found.
 * @param witness - witness data from vin[0].
 * @returns True if an inscriptionMark is found.
 */
export function hasInscription(witness: string[]): boolean {
  const inscriptionMarkHex = '0063036f7264';
  const witnessJoined = witness.join('');
  return witnessJoined.includes(inscriptionMarkHex);
}

/**
 * Converts a byte array to a hexadecimal string.
 *
 * @param byteArray - The array of bytes to convert.
 * @returns The hexadecimal string representation of the byte array.
 */
export function byteArrayToHex(byteArray: Uint8Array): string {
  return Array.from(byteArray)
              .map(byte => byte.toString(16).padStart(2, '0'))
              .join('');
}

/**
 * Extracts the parent inscription ID from a field in an inscription.
 * The parent field value consists of a 32-byte transaction ID (TXID) followed by a four-byte little-endian index.
 * The TXID part is reversed in order, and trailing zeroes are omitted.
 *
 * @param parentField - The field containing the parent inscription data.
 * @returns The parent inscription ID as a string, or undefined if the parent field is not provided.
 */
export function extractParent(value: Uint8Array | undefined): string | undefined {

  if (value === undefined) {
    return undefined;
  }

  // Reverse the TXID part and convert it to hexadecimal
  const txId = value.slice(0, 32).reverse();
  const txIdHex = byteArrayToHex(txId);

  // Convert the 4-byte little-endian index to a decimal number
  const indexBytes = value.slice(32, 36); // Get the index part
  const index = littleEndianBytesToNumber(indexBytes);

  // Combine TXID and index to form the parent inscription ID
  return txIdHex + 'i' + index;
}

/**
 * Extracts the pointer value from a given field in an inscription.
 * The pointer value is a little-endian encoded integer specifying the sat position in the outputs.
 *
 * @param pointerField - The field containing the pointer data.
 * @returns The pointer value as a number, or undefined if the pointer field is not provided.
 */
export function extractPointer(value: Uint8Array | undefined): number | undefined {

  if (value === undefined) {
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
 * @param bytes - The Uint8Array containing compressed data.
 * @returns A Uint8Array containing the decompressed data.
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
