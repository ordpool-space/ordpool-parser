import { OP_0, OP_ENDIF, encodeToBase64, getKnownField, getNextInscriptionMark, hexStringToUint8Array, knownFields, readPushdata, uint8ArrayToSingleByteChars, utf8BytesToUtf16String } from "./inscription-parser.service.helper";
import { ParsedInscription } from "./parsed-inscription";
import { CBOR } from "./cbor";

/**
 * Extracts the first inscription from a Bitcoin transaction.
 * Advanced envelopes with extra data (eg Quadkey inscriptions) are supported, but the extra data is ignored.
 */
export class InscriptionParserService {

  /**
   * Main function that parses all inscription in a transaction.
   * @returns The parsed inscriptions or an empty array
   */
  static parseInscriptions(transaction: { vin: { witness?: string[] }[] }): ParsedInscription[] {

    const inscriptions: ParsedInscription[] = [];
    for (let i = 0; i < transaction.vin.length; i++) {
      const vin = transaction.vin[i];
      if (vin.witness) {
        const vinInscriptions = InscriptionParserService.parseInscriptionsWithinWitness(vin.witness);
        if (vinInscriptions) {
          inscriptions.push(...vinInscriptions);
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
    const raw = hexStringToUint8Array(witness.join(''));
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
      // --> Question: should we allow empty inscriptions? (where the next byte is OP_ENDIF)
      // --> TODO: Research what is ord doing in this edge case!
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
      const combinedData = new Uint8Array(combinedLengthOfAllArrays);

      // Copy all segments from data into combinedData, forming a single contiguous Uint8Array
      let idx = 0;
      for (const segment of data) {
        combinedData.set(segment, idx);
        idx += segment.length;
      }

      const contentTypeField = getKnownField(fields, knownFields.content_type);

      // Let's ignore inscriptions without a contentType, because there is no good way to display them
      // we could change this later on, if there are really inscriptions with no contentType but meaningful metadata
      if (!contentTypeField) {
        return null;
      }

      // it would make no sense to add UTF-8 to content-type, so assuming no UTF-8 here
      const contentType = uint8ArrayToSingleByteChars(contentTypeField.value);

      return {
        contentType,

        fields,

        getContentString() {
          return utf8BytesToUtf16String(combinedData);
        },

        getData: (): string => {
          const content = uint8ArrayToSingleByteChars(combinedData);
          return encodeToBase64(content);
        },

        getDataUri: (): string => {
          const content = uint8ArrayToSingleByteChars(combinedData);
          const fullBase64Data = encodeToBase64(content);
          return `data:${contentType};base64,${fullBase64Data}`;
        },

        getMetadata: (): string | undefined => {
          const metadata = getKnownField(fields, knownFields.metadata)

          if (!metadata) {
            return undefined;
          }

          const value = CBOR.decode(metadata.value);
          return value;
        },

        getMetaprotocol: (): string | undefined => {
          const metaprotocol = getKnownField(fields, knownFields.metaprotocol)

          if (!metaprotocol) {
            return undefined;
          }
          return utf8BytesToUtf16String(metaprotocol.value);
        }


      };

    } catch (ex) {
      console.error(ex);
      return null;
    }
  }
}
