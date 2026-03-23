import { hexToBytes, isStringInArrayOfStrings } from '../lib/conversions';
import { OP_ENDIF } from '../lib/op-codes';
import { readPushdata } from '../lib/reader';

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
 * Unverified but known to exist: 'ft', 'dmt', 'mod', 'evt', 'dat', 'sl'
 * Add types here ONLY after adding a real mainnet transaction to testdata/.
 */
export type AtomicalOperation = 'dft' | 'nft' | 'ft' | 'dmt' | 'mod' | 'evt' | 'dat' | 'sl' | 'unknown';

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
          case 'dmt': return 'dmt';
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

/**
 * The full extracted atomical envelope: operation + raw CBOR payload.
 */
export interface AtomicalEnvelope {
  operation: AtomicalOperation;
  payload: Uint8Array;
}

/**
 * Searches for the atomical mark in raw bytes and returns the position
 * immediately after the mark (i.e., where the operation pushdata starts).
 * Returns -1 if no mark is found.
 *
 * Modeled after getNextInscriptionMark() in the inscription parser.
 */
export function getNextAtomicalMark(raw: Uint8Array, startPosition: number): number {
  for (let i = startPosition; i <= raw.length - ATOMICAL_MARK.length; i++) {
    let match = true;
    for (let j = 0; j < ATOMICAL_MARK.length; j++) {
      if (raw[i + j] !== ATOMICAL_MARK[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i + ATOMICAL_MARK.length;
    }
  }
  return -1;
}

/**
 * Extracts the full atomical envelope from raw witness bytes:
 * operation string + concatenated CBOR payload chunks.
 *
 * Uses readPushdata() to correctly handle multi-chunk payloads (>520 bytes),
 * same approach as the inscription parser's body extraction.
 *
 * Envelope layout after the 7-byte mark:
 *   <pushdata: operation string>    e.g., 03 "dft"
 *   <pushdata: CBOR chunk 1>       up to 520 bytes each
 *   <pushdata: CBOR chunk 2>
 *   ...
 *   OP_ENDIF (0x68)
 */
export function extractAtomicalEnvelope(raw: Uint8Array): AtomicalEnvelope | null {
  const afterMark = getNextAtomicalMark(raw, 0);
  if (afterMark === -1) {
    return null;
  }

  let pointer = afterMark;

  // Read the operation string
  let slice: Uint8Array;
  [slice, pointer] = readPushdata(raw, pointer);
  const opString = String.fromCharCode(...slice);
  const operation = mapOperationString(opString);

  // Collect CBOR payload chunks until OP_ENDIF (same pattern as inscription body)
  const chunks: Uint8Array[] = [];
  while (pointer < raw.length && raw[pointer] !== OP_ENDIF) {
    [slice, pointer] = readPushdata(raw, pointer);
    chunks.push(slice);
  }

  // Concatenate all chunks into a single buffer
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const payload = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.length;
  }

  return { operation, payload };
}

/**
 * Extracts the full atomical envelope from a witness array.
 */
export function extractAtomicalEnvelopeFromWitness(witness: string[]): AtomicalEnvelope | null {
  for (const element of witness) {
    if (element.includes(ATOMICAL_MARK_HEX)) {
      const raw = hexToBytes(element);
      const envelope = extractAtomicalEnvelope(raw);
      if (envelope !== null) {
        return envelope;
      }
    }
  }
  return null;
}

/**
 * Maps an operation string to the AtomicalOperation type.
 */
function mapOperationString(opString: string): AtomicalOperation {
  switch (opString) {
    case 'nft': return 'nft';
    case 'ft': return 'ft';
    case 'dft': return 'dft';
    case 'dmt': return 'dmt';
    case 'mod': return 'mod';
    case 'evt': return 'evt';
    case 'dat': return 'dat';
    case 'sl': return 'sl';
    default: return 'unknown';
  }
}
