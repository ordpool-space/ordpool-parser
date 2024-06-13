import {
  brotliDecodeUint8Array,
  extractInscriptionId,
  extractPointer,
  getKnownFieldValue,
  getKnownFieldValues,
  getNextInscriptionMark,
  hasInscription,
  knownFields
} from './inscription-parser.service.helper';
import { CBOR } from '../lib/cbor';
import { binaryStringToBase64, bytesToBinaryString, bytesToUnicodeString, hexToBytes, littleEndianBytesToNumber } from '../lib/conversions';
import { readPushdata } from '../lib/reader';
import { DigitalArtifactType } from '../types/digital-artifact';
import { ParsedInscription } from '../types/parsed-inscription';
import { OP_0, OP_ENDIF } from '../lib/op-codes';

/**
 * Extracts all Ordinal inscriptions from a Bitcoin transaction.
 */
export class InscriptionParserService {

  /**
   * Main function that parses all inscription in a transaction.
   * @returns The parsed inscriptions or an empty array
   */
  static parse(transaction: {
    txid: string;
    vin: { witness?: string[] }[]
  }): ParsedInscription[] {

    try {

      // early exit
      if (!InscriptionParserService.hasInscription(transaction)) {
        return [];
      }

      const inscriptions: ParsedInscription[] = [];
      let counter = 0;

      for (let i = 0; i < transaction.vin.length; i++) {
        const vin = transaction.vin[i];
        if (vin.witness) {
          const vinInscriptions = InscriptionParserService.parseInscriptionsWithinWitness(vin.witness);
          if (vinInscriptions) {
            for (let n = 0; n < vinInscriptions.length; n++) {
              const inscription = vinInscriptions[n];

              // overrides the 'REPLACE_THIS' placeholders
              inscription.inscriptionId = `${transaction.txid}i${counter}`;
              inscription.transactionId = transaction.txid;
              inscription.uniqueId = `${DigitalArtifactType.Inscription}-${inscription.inscriptionId}`

              inscriptions.push(inscription);
              counter++;
            }
          }
        }
      }
      return inscriptions;

    } catch (ex) {
      // console.error(ex);
      return [];
    }
  }

  /**
   * Super quick check, that returns true if an inscriptionMark is found.
   * @param transaction any bitcoin transaction
   * @returns True if an inscriptionMark is found.
   */
  static hasInscription(transaction: {
    vin: { witness?: string[] }[]
  }): boolean {

    try {

      for (let i = 0; i < transaction.vin.length; i++) {
        const vin = transaction.vin[i];
        if (vin.witness && hasInscription(vin.witness)) {
          return true;
        }
      }
      return false;

    } catch (ex) {
      return false;
    }
  }

  /**
   * Parses all inscriptions within a given witness.
   * @param witness - The witness data from a vin[i].
   * @returns An array of parsed inscriptions, or null if no valid inscriptions are found.
   */
  private static parseInscriptionsWithinWitness(witness: string[]): ParsedInscription[] | null {

    const inscriptions: ParsedInscription[] = [];
    const raw = hexToBytes(witness.join(''));
    let startPosition = 0;

    while (true) {
      const pointer = getNextInscriptionMark(raw, startPosition);
      if (pointer === -1) break; // No more inscriptions found

      // Parse the inscription at the current position
      const inscription = InscriptionParserService.extractInscriptionData(raw, pointer);
      if (inscription) {
        inscriptions.push(inscription);
      }

      // Update startPosition for the next iteration
      startPosition = pointer;
    }

    return inscriptions.length > 0 ? inscriptions : null;
  }

  /**
   * Extracts fields from the raw data until OP_0 is encountered.
   *
   * @param raw - The raw data to read.
   * @param pointer - The current pointer where the reading starts.
   * @returns An array of fields and the updated pointer position.
   */
  private static extractFields(raw: Uint8Array, pointer: number): [{ tag: number; value: Uint8Array }[], number] {

    const fields: { tag: number; value: Uint8Array }[] = [];
    let newPointer = pointer;
    let slice: Uint8Array;

    while (newPointer < raw.length &&
      // normal inscription - content follows now
      (raw[newPointer] !== OP_0) &&
      // delegate - inscription has no further content and ends directly here
      (raw[newPointer] !== OP_ENDIF)
    ) {

      // tags are encoded by ord as single-byte data pushes, but are accepted by ord as either single-byte pushes, or as OP_NUM data pushes.
      // tags greater than or equal to 256 should be encoded as little endian integers with trailing zeros omitted.
      // see: https://github.com/ordinals/ord/issues/2505
      [slice, newPointer] = readPushdata(raw, newPointer);
      const tag = slice.length === 1 ? slice[0] : littleEndianBytesToNumber(slice);

      [slice, newPointer] = readPushdata(raw, newPointer);
      const value = slice;

      fields.push({ tag, value });
    }

    return [fields, newPointer];
  }

  /**
   * Extracts inscription data starting from the current pointer.
   * @param raw - The raw data to read.
   * @param pointer - The current pointer where the reading starts.
   * @returns The parsed inscription or nullx
   */
  private static extractInscriptionData(raw: Uint8Array, pointer: number): ParsedInscription | null {

    try {

      let fields: { tag: number; value: Uint8Array }[];
      let newPointer: number;
      let slice: Uint8Array;

      [fields, newPointer] = InscriptionParserService.extractFields(raw, pointer);

      // Now we are at the beginning of the body
      // (or at the end of the raw data if there's no body)
      if (newPointer < raw.length && raw[newPointer] === OP_0) {
        newPointer++; // Skip OP_0
      }

      // Collect body data until OP_ENDIF
      const data: Uint8Array[] = [];
      while (newPointer < raw.length && raw[newPointer] !== OP_ENDIF) {
        [slice, newPointer] = readPushdata(raw, newPointer);
        data.push(slice);
      }

      const combinedLengthOfAllArrays = data.reduce((acc, curr) => acc + curr.length, 0);
      let combinedData = new Uint8Array(combinedLengthOfAllArrays);

      // Copy all segments from data into combinedData, forming a single contiguous Uint8Array
      let idx = 0;
      for (const segment of data) {
        combinedData.set(segment, idx);
        idx += segment.length;
      }

      const contentTypeRaw = getKnownFieldValue(fields, knownFields.content_type);
      let contentType: string;
      let contentEncoding: string | undefined = undefined;

      // an inscriptions without a contentType, probably a delegate
      if (!contentTypeRaw) {

        contentType = 'undefined';

      } else {

        // strings are (always) UTF-8, according to https://github.com/ordinals/ord/issues/2505
        contentType = bytesToUnicodeString(contentTypeRaw);

        // figure out if the body is encoded via brotli
        const contentEncodingRaw = getKnownFieldValue(fields, knownFields.content_encoding);
        if (contentEncodingRaw) {
          contentEncoding = bytesToUnicodeString(contentEncodingRaw);
        }

        if (contentEncoding === 'br') {
          combinedData = brotliDecodeUint8Array(combinedData);
        }

        // TODO: add support for gzip
      }

      return {

        type: DigitalArtifactType.Inscription,

        inscriptionId: 'REPLACE_THIS', // must be overridden in the calling method
        transactionId: 'REPLACE_THIS', // must be overridden in the calling method
        uniqueId:      'REPLACE_THIS', // must be overridden in the calling method

        contentType,

        fields,

        getContent() {
          return bytesToUnicodeString(combinedData) + ''; // never return undefined here
        },

        getData: (): string => {
          const content = bytesToBinaryString(combinedData);
          return binaryStringToBase64(content);
        },

        getDataUri: (): string => {
          const content = bytesToBinaryString(combinedData);
          const fullBase64Data = binaryStringToBase64(content);
          return `data:${contentType};base64,${fullBase64Data}`;
        },

        getPointer: (): number | undefined => {
          const pointerRaw = getKnownFieldValue(fields, knownFields.pointer);
          return extractPointer(pointerRaw);
        },

        getParents: (): string[] => {
          const parentsRaw = getKnownFieldValues(fields, knownFields.parent);
          return parentsRaw.map(parentRaw => extractInscriptionId(parentRaw));
        },

        getMetadata: (): string | undefined => {
          const metadataRaw = getKnownFieldValue(fields, knownFields.metadata);

          if (!metadataRaw) {
            return undefined;
          }

          return CBOR.decode(metadataRaw);
        },

        getMetaprotocol: (): string | undefined => {
          const metaprotocolRaw = getKnownFieldValue(fields, knownFields.metaprotocol);
          if (!metaprotocolRaw) {
            return undefined;
          }

          return bytesToUnicodeString(metaprotocolRaw);
        },

        getContentEncoding: (): string | undefined => {
          return contentEncoding;
        },

        getDelegates: (): string[] => {
          const delegatesRaw = getKnownFieldValues(fields, knownFields.delegate);
          return delegatesRaw.map(parentRaw => extractInscriptionId(parentRaw));
        },
      };

    } catch (ex) {
      // console.error(ex);
      return null;
    }
  }
}
