import { INVALID_COMPRESSED_DATA_MESSAGE, MAX_DECOMPRESSED_SIZE, MAX_DECOMPRESSED_SIZE_MESSAGE, brotliDecode } from "../lib/brotli-decode";
import { hexToBytes, isStringInArrayOfStrings, littleEndianBytesToNumber } from "../lib/conversions";
import { bytesToHex } from "../lib/conversions";
import { OP_ENDIF, OP_FALSE, OP_IF, OP_PUSHBYTES_3 } from "../lib/op-codes";


/**
 * Inscriptions may include fields before an optional body. Each field consists of two data pushes, a tag and a value.
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
  delegate: 0x0b,

  // rune, with a tag of 13 — rune etching commitment.
  //
  // When etching a new rune, the rune name must be "committed to" in an inscription
  // before the etching transaction. This prevents front-running (someone seeing your
  // etching in the mempool and stealing the rune name).
  //
  // The commitment is the rune's u128 value encoded as little-endian bytes with trailing
  // zeros stripped. For example, rune "UNCOMMON•GOODS" (u128 value) becomes a few bytes.
  // This commitment is stored as tag 13 in the inscription envelope.
  //
  // The etching transaction then spends the inscription's UTXO as an input. ord's indexer
  // verifies: (1) the commitment bytes match the rune being etched, (2) the committed
  // inscription was in a taproot output, and (3) at least 6 blocks have passed since the
  // commitment (COMMIT_CONFIRMATIONS = 6).
  //
  // Our rune parser already handles commitment validation — see findCommitment() in
  // rune-parser.service.helper.findCommitment.ts and Rune.commitment in rune/src/rune.ts.
  rune: 0x0d,

  // note, with a tag of 15 — `Tag::Note` in ord, similar to BitTorrent's
  // `created_by`. The history is reverse: chisel.xyz (an inscribe service)
  // started writing their URL "https://chisel.xyz" into tag 15 first, and
  // then Casey reserved the tag in ord PR #3256 (March 2024) "to ensure we
  // don't accidentally use it in the future." ord stores the value in the
  // Inscription struct but, per Casey: "this field will probably never be
  // displayed, since users probably don't want the tool which created the
  // inscription to display on /inscription". So: officially reserved as Note,
  // de facto used as inscriber-tool watermark, never user-facing in ord itself.
  // see https://github.com/ordinals/ord/pull/3256
  note: 0x0f,

  // properties, with a tag of 17 — CBOR-encoded gallery items + attributes (chunked like metadata)
  // see https://docs.ordinals.com/inscriptions/properties.html
  properties: 0x11,

  // property_encoding, with a tag of 19 — "br" for brotli compression of properties.
  // ord only supports brotli. Our parser additionally supports "gzip" for completeness.
  property_encoding: 0x13,
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
  const inscriptionMarkHex = '0063036f7264';

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

export async function getDecodedContent(contentEncoding: string | undefined, combinedData: Uint8Array): Promise<Uint8Array> {

  if (!contentEncoding) {
    return combinedData;
  }

  if (contentEncoding === 'br') {
    return brotliDecodeUint8Array(combinedData);
  }
  if (contentEncoding === 'gzip') {
    return await gzipDecode(combinedData);
  }

  return new TextEncoder().encode('Error: unknown content encoding!');
}


/**
 * Decompresses brotli-compressed bytes. Returns one of:
 * - decompressed bytes on success
 * - MAX_DECOMPRESSED_SIZE_MESSAGE (UTF-8) if the result would exceed the cap
 * - INVALID_COMPRESSED_DATA_MESSAGE (UTF-8) on any other decode failure
 *
 * Never throws -- malformed inscriptions exist on chain and must be tolerated.
 * Callers can use isDecodeFailureSentinel() to detect either sentinel.
 *
 * The Int8Array view is required by the inline brotli decoder; it shares the
 * underlying buffer with the input Uint8Array, no copy.
 */
export function brotliDecodeUint8Array(bytes: Uint8Array): Uint8Array {

  const int8View = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  try {
    const decompressed = brotliDecode(int8View);
    return new Uint8Array(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
  } catch (error) {
    if (error instanceof Error && error.message === MAX_DECOMPRESSED_SIZE_MESSAGE) {
      return new TextEncoder().encode(MAX_DECOMPRESSED_SIZE_MESSAGE);
    }
    return new TextEncoder().encode(INVALID_COMPRESSED_DATA_MESSAGE);
  }
}

/**
 * Decompresses gzip-encoded bytes via DecompressionStream. Returns:
 * - the decompressed bytes on success
 * - MAX_DECOMPRESSED_SIZE_MESSAGE (UTF-8) if the result would exceed the cap
 * - INVALID_COMPRESSED_DATA_MESSAGE (UTF-8) on any other decode failure
 *
 * Mirrors brotliDecodeUint8Array's behaviour. Decompression-bomb safety: a
 * malicious gzip payload that expands to gigabytes is aborted as soon as the
 * streamed output crosses MAX_DECOMPRESSED_SIZE -- we never allocate the full
 * pathological output.
 *
 * Throws only when DecompressionStream itself is unavailable (host
 * environment, not a data problem).
 */
export async function gzipDecode(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'gzip decoding is not supported in this environment. For Node.js, upgrade to version 18 or higher.'
    );
  }

  try {
    const ds = new DecompressionStream('gzip');

    // Write the input bytes to the stream. We swallow the per-call rejections
    // so that cancelling the reader on a bomb doesn't surface as an
    // unhandled "ABORT_ERR" from the still-in-flight writer.
    const writer = ds.writable.getWriter();
    writer.write(bytes).catch(() => { /* aborted on bomb cancel */ });
    writer.close().catch(() => { /* aborted on bomb cancel */ });

    // Read and concatenate the output bytes, aborting if the running total
    // would exceed MAX_DECOMPRESSED_SIZE (decompression-bomb mitigation).
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        chunks.push(value);
        totalSize += value.byteLength;
        if (totalSize > MAX_DECOMPRESSED_SIZE) {
          // Cancel the stream so the underlying DecompressionStream stops
          // pulling more input -- we don't want to keep decompressing a bomb.
          await reader.cancel();
          throw new Error(MAX_DECOMPRESSED_SIZE_MESSAGE);
        }
      }
    }

    // Combine chunks into a single Uint8Array
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.message === MAX_DECOMPRESSED_SIZE_MESSAGE) {
      return new TextEncoder().encode(MAX_DECOMPRESSED_SIZE_MESSAGE);
    }
    return new TextEncoder().encode(INVALID_COMPRESSED_DATA_MESSAGE);
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

/**
 * Measures the size of the inscription in witness data (used for testing only!).
 * Starts at the inscription mark and stops at the last OP_ENDIF.
 *
 * This only works for simple scenarios, this won't work for multiple inscriptions in one witness.
 * Or for some additional data with an OP_ENDIF after the envelope.
 *
 * @param witness - The witness data as an array of strings.
 * @returns The size of the inscription (including the envelope) or null if OP_ENDIF is not found.
 */
export function measureInscriptionSize(witness: string[]): number | null {

  if (!witness) {
    return null;
  }

  // Find the witness element that contains the inscription (the tapscript)
  // OP_FALSE (0x00), OP_IF (0x63), OP_PUSHBYTES_3 (0x03), 'o', 'r', 'd' (0x6f, 0x72, 0x64)
  const inscriptionMarkHex = '0063036f7264';
  const element = witness.find(e => e.includes(inscriptionMarkHex));
  if (!element) {
    return null;
  }

  const raw = hexToBytes(element);

  // Find the start of the inscription using the inscription mark
  const startPosition = getNextInscriptionMark(raw, 0);

  if (startPosition === -1) {
    return null; // Inscription mark not found
  }

  // Find the position of last OP_ENDIF (0x68)
  const opEndIfIndex = raw.lastIndexOf(OP_ENDIF, raw.length);

  if (opEndIfIndex === -1) {
    return null; // OP_ENDIF not found
  }

  // The size of the inscription is from the start position to the last OP_ENDIF
  const inscriptionSize = opEndIfIndex - startPosition;

  // Add the size of the inscription mark (6 bytes) + OP_ENDIF (1 byte)
  return inscriptionSize + 7;
}

/**
 * Validates whether a given string is a valid inscription ID.
 *
 * Inscription IDs are of the form TXIDiN, where TXID is the transaction ID of the reveal transaction,
 * and N is the index of the inscription in the reveal transaction.
 *
 * @param id - The string to validate as an inscription ID.
 * @returns `true` if the input is a valid inscription ID, otherwise `false`.
 */
export function isValidInscriptionId(id: string): boolean {
  return /^[a-f0-9]{64}i\d{1,}$/.test(id);
}

/**
 * Validates whether a given string is a bare transaction ID — 64 hex characters,
 * no `iN` inscription-index suffix.
 *
 * Used by `/stamp-content/`, `/atomical-content/`, and the `/content/<txid>`
 * "first image-bearing inscription" shortcut to distinguish a bare txid from a
 * full inscription ID.
 */
export function isValidTxid(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

/**
 * Returns true if the given content type names an image MIME type.
 *
 * Centralised so the rule "what counts as an image we'll render server-side"
 * lives in one place — extending this (e.g. blocking image/svg+xml for security
 * reasons, or adding image/heic) takes one edit, not a search across callers.
 */
export function isImageContentType(contentType: string | undefined | null): boolean {
  return !!contentType && contentType.startsWith('image/');
}
