import { OP_0, OP_ENDIF, brotliDecodeUint8Array, extractPointer, getKnownFieldValue, getNextInscriptionMark, knownFields, readPushdata } from "./inscription-parser.service.helper";
import { extractParent } from "./inscription-parser.service.helper";
import { binaryStringToBase64, hexToUint8Array, uint8ArrayToSingleByteChars, utf8BytesToUtf16String } from "./lib/conversions";
import { ParsedInscription } from "./parsed-inscription";
import { CBOR } from "./cbor";

/**
 * Extracts all Ordinal inscriptions from a Bitcoin transaction.
 */
export class InscriptionParserService {

  /**
   * Main function that parses all inscription in a transaction.
   * @returns The parsed inscriptions or an empty array
   */
  static parseInscriptions(transaction: {
    txid: string;
    vin: { witness?: string[] }[]
  }): ParsedInscription[] {

    const inscriptions: ParsedInscription[] = [];
    let counter = 0;

    for (let i = 0; i < transaction.vin.length; i++) {
      const vin = transaction.vin[i];
      if (vin.witness) {
        const vinInscriptions = InscriptionParserService.parseInscriptionsWithinWitness(vin.witness);
        if (vinInscriptions) {
          for (let n = 0; n < vinInscriptions.length; n++) {
            const inscription = vinInscriptions[n];
            inscription.inscriptionId = `${transaction.txid}i${counter}`;
            inscriptions.push(inscription);
            counter++;
          }
        }
      }
    }
    return inscriptions;
  }

  /**
   * Parses all inscriptions within a given witness.
   * @param witness - The witness data from a vin[i].
   * @returns An array of parsed inscriptions, or null if no valid inscriptions are found.
   */
  private static parseInscriptionsWithinWitness(witness: string[]): ParsedInscription[] | null {

    const inscriptions: ParsedInscription[] = [];
    const raw = hexToUint8Array(witness.join(''));
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
   * Extracts inscription data starting from the current pointer.
   * @param raw - The raw data to read.
   * @param pointer - The current pointer where the reading starts.
   * @returns The parsed inscription or null
   */
  private static extractInscriptionData(raw: Uint8Array, pointer: number): ParsedInscription | null {

    try {

      // Process fields until OP_0 is encountered
      const fields: { tag: Uint8Array; value: Uint8Array }[] = [];
      let newPointer = pointer;
      let slice;

      while (newPointer < raw.length && raw[newPointer] !== OP_0) {
        [slice, newPointer] = readPushdata(raw, newPointer);
        const tag = slice;

        [slice, newPointer] = readPushdata(raw, newPointer);
        const value = slice;

        fields.push({ tag, value });
      }

      // Now we are at the beginning of the body
      // (or at the end of the raw data if there's no body)
      // --> Question: should we also allow empty inscriptions? (where the next byte is OP_ENDIF)
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

      // Let's ignore inscriptions without a contentType, because there is no good way to display them
      // we could change this later on, if there are really inscriptions with no contentType but meaningful metadata
      if (!contentTypeRaw) {
        return null;
      }

      // it would make no sense to add UTF-8 to content-type, so assuming no UTF-8 here
      const contentType = uint8ArrayToSingleByteChars(contentTypeRaw);

      // figure out if the body is encoded via brotli
      const contentEncodingRaw = getKnownFieldValue(fields, knownFields.content_encoding);

      let contentEncoding: string | undefined = undefined;
      if (contentEncodingRaw) {
        contentEncoding = uint8ArrayToSingleByteChars(contentEncodingRaw);
      }

      if (contentEncoding === 'br') {
        combinedData = brotliDecodeUint8Array(combinedData);
      }

      return {
        inscriptionId: 'ERROR', // will be overridden

        contentType,

        fields,

        getContentString() {
          return utf8BytesToUtf16String(combinedData) + ''; // never return undefined here
        },

        getData: (): string => {
          const content = uint8ArrayToSingleByteChars(combinedData);
          return binaryStringToBase64(content);
        },

        getDataUri: (): string => {
          const content = uint8ArrayToSingleByteChars(combinedData);
          const fullBase64Data = binaryStringToBase64(content);
          return `data:${contentType};base64,${fullBase64Data}`;
        },

        getPointer: (): number | undefined => {
          const pointerRaw = getKnownFieldValue(fields, knownFields.pointer)
          return extractPointer(pointerRaw);
        },

        getParent: (): string | undefined => {
          const parentRaw = getKnownFieldValue(fields, knownFields.parent)
          return extractParent(parentRaw);
        },

        getMetadata: (): string | undefined => {
          const metadataRaw = getKnownFieldValue(fields, knownFields.metadata)

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

          return utf8BytesToUtf16String(metaprotocolRaw);
        },

        getContentEncoding: (): string | undefined => {
          return contentEncoding;
        }
      };

    } catch (ex) {
      console.error(ex);
      return null;
    }
  }
}
