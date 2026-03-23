import { CBOR } from '../lib/cbor';
import {
  binaryStringToBase64,
  bytesToBinaryString,
  bytesToUnicodeString,
  concatUint8Arrays,
  hexToBytes,
  littleEndianBytesToNumber,
} from '../lib/conversions';
import { OP_0, OP_ENDIF } from '../lib/op-codes';
import { readPushdata } from '../lib/reader';
import { DigitalArtifactType } from '../types/digital-artifact';
import { ParsedInscription } from '../types/parsed-inscription';
import { OnParseError } from '../types/parser-options';
import {
  extractInscriptionId,
  extractPointer,
  getDecodedContent,
  getKnownFieldValue,
  getKnownFieldValues,
  getNextInscriptionMark,
  hasInscription,
  knownFields,
} from './inscription-parser.service.helper';
import { parseProperties } from './inscription-parser.service.properties.helper';

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
  }, onError?: OnParseError): ParsedInscription[] {

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
      onError?.(ex);
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
    // OP_FALSE (0x00), OP_IF (0x63), OP_PUSHBYTES_3 (0x03), 'o', 'r', 'd' (0x6f, 0x72, 0x64)
    const inscriptionMarkHex = '0063036f7264';

    // Only convert witness elements that contain the inscription mark.
    // This avoids hexToBytes on the signature and control block elements,
    // which is significant for large inscriptions (up to 4MB).
    for (const element of witness) {
      if (!element.includes(inscriptionMarkHex)) {
        continue;
      }

      const raw = hexToBytes(element);
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
   * Extracts inscription data (starting from the current pointer) and calculates the envelope size.
   *
   * @param raw - The raw data to read.
   * @param pointer - The current pointer where the reading starts.
   * @returns The parsed inscription or nullx
   */
  private static extractInscriptionData(raw: Uint8Array, pointer: number): ParsedInscription | null {

    try {

      let fields: { tag: number; value: Uint8Array }[];
      let newPointer: number;
      let slice: Uint8Array;

      // Store the starting pointer (this is where the envelope starts)
      const initialPointer = pointer;

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

      // +6 for OP_FALSE (1 byte) + OP_IF (1 byte) + OP_PUSH (1 byte) + "ord" (3 bytes)
      // +1 for the OP_ENDIF
      const envelopeSize = newPointer - initialPointer + 7;

      let combinedData = concatUint8Arrays(data);

      const contentTypeRaw = getKnownFieldValue(fields, knownFields.content_type);
      let contentType: string | undefined = undefined;

      // an inscriptions with no contentType is most probably a delegate
      if (contentTypeRaw) {
        // strings are (always) UTF-8, according to https://github.com/ordinals/ord/issues/2505
        contentType = bytesToUnicodeString(contentTypeRaw);
      }

      // figure out if the body is encoded via brotli or gzip
      const contentEncodingRaw = getKnownFieldValue(fields, knownFields.content_encoding);
      let contentEncoding: string | undefined = undefined;

      if (contentEncodingRaw) {
        contentEncoding = bytesToUnicodeString(contentEncodingRaw);
      }

      let cachedProperties: ReturnType<typeof parseProperties> | undefined;

      return {

        type: DigitalArtifactType.Inscription,

        inscriptionId: 'REPLACE_THIS', // must be overridden in the calling method
        transactionId: 'REPLACE_THIS', // must be overridden in the calling method
        uniqueId:      'REPLACE_THIS', // must be overridden in the calling method

        contentType,

        fields,

        getContent: async (): Promise<string> => {
          const decodedData = await getDecodedContent(contentEncoding, combinedData);
          return bytesToUnicodeString(decodedData) + ''; // never return undefined here
        },

        getData: async (): Promise<string> => {
          const decodedData = await getDecodedContent(contentEncoding, combinedData);
          const content = bytesToBinaryString(decodedData);
          return binaryStringToBase64(content);
        },

        getDataUri: async(): Promise<string> => {
          const decodedData = await getDecodedContent(contentEncoding, combinedData);
          const content = bytesToBinaryString(decodedData);
          const fullBase64Data = binaryStringToBase64(content);
          return `data:${contentType};base64,${fullBase64Data}`;
        },

        getDataRaw: (): Uint8Array => {
          return combinedData;
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
          const metadataChunks = getKnownFieldValues(fields, knownFields.metadata);

          if (metadataChunks.length === 0) {
            return undefined;
          }

          if (metadataChunks.length === 1) {
            return CBOR.decode(metadataChunks[0]);
          }

          return CBOR.decode(concatUint8Arrays(metadataChunks));
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

        getRune: (): Uint8Array | undefined => {
          return getKnownFieldValue(fields, knownFields.rune);
        },

        getProperties: () => {
          if (!cachedProperties) {
            cachedProperties = parseProperties(fields);
          }
          return cachedProperties;
        },

        envelopeSize, // The size of the envelope including the entire script
        contentSize: combinedData.length // The size of the content (the body of the inscription)
      };

    } catch (ex) {
      // console.error(ex);
      return null;
    }
  }
}
