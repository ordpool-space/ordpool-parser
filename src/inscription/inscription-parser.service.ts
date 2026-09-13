import { CBOR } from '../lib/cbor';
import {
  binaryStringToBase64,
  bytesToBinaryString,
  bytesToStrictUnicodeString,
  bytesToUnicodeString,
  concatUint8Arrays,
  hexToBytes,
  littleEndianBytesToNumber,
} from '../lib/conversions';
import { OP_0, OP_ENDIF } from '../lib/op-codes';
import { readPushdata } from '../lib/reader';
import { assertEsploraShape } from '../lib/transaction-shape';
import { DigitalArtifactType } from '../types/digital-artifact';
import { ParsedInscription } from '../types/parsed-inscription';
import { OnParseError } from '../types/parser-options';
import {
  InscriptionMark,
  PROTOCOL_ID_HEX,
  extractInscriptionId,
  extractPointer,
  findEnvelopeMarks,
  getDecodedContent,
  getKnownFieldValue,
  getKnownFieldValues,
  getTapscriptElement,
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

    // Outside the try/catch on purpose — the parser's catch silences any
    // error so consumers see []. We want a definite "wrong shape" error
    // to surface as a stack trace, not a silent empty array.
    assertEsploraShape(transaction, 'InscriptionParserService.parse');

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

    // ord reads the leaf script and nothing else, so envelope bytes in a
    // signature, a P2WSH witness script or the control block are not an
    // inscription. This also keeps hexToBytes off those elements, which
    // matters for large inscriptions (up to 4MB).
    const element = getTapscriptElement(witness);

    if (element && element.includes(PROTOCOL_ID_HEX)) {

      const raw = hexToBytes(element);

      // A script ord cannot decode has no envelopes at all for ord, not even
      // the ones before the bad instruction, so we keep no partial results.
      let marks: InscriptionMark[];
      try {
        marks = findEnvelopeMarks(raw);
      } catch {
        return null;
      }

      for (const mark of marks) {
        const inscription = InscriptionParserService.extractInscriptionData(raw, mark);
        if (inscription) {
          inscriptions.push(inscription);
        }
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
      // delegate - inscription has no further content and ends directly here
      (raw[newPointer] !== OP_ENDIF)
    ) {

      // tags are encoded by ord as single-byte data pushes, but are accepted by ord as either single-byte pushes, or as OP_NUM data pushes.
      // tags greater than or equal to 256 should be encoded as little endian integers with trailing zeros omitted.
      // see: https://github.com/ordinals/ord/issues/2505
      [slice, newPointer] = readPushdata(raw, newPointer);

      // An EMPTY push where a tag would be is the separator between the fields
      // and the body (BODY_TAG in ord). ord compares the pushed bytes, not the
      // opcode, so OP_0 and OP_PUSHDATA1/2/4 with length 0 all separate.
      // The separator is consumed here, so the body starts at newPointer.
      if (slice.length === 0) {
        break;
      }

      const tag = slice.length === 1 ? slice[0] : littleEndianBytesToNumber(slice);

      // A dangling tag: the envelope ends before the value push. ord keeps such
      // an inscription and only flags it as `incomplete_field`, which makes it
      // cursed, so the fields read so far stay and the tag itself is dropped.
      if (newPointer >= raw.length || raw[newPointer] === OP_ENDIF) {
        break;
      }

      [slice, newPointer] = readPushdata(raw, newPointer);
      const value = slice;

      fields.push({ tag, value });
    }

    return [fields, newPointer];
  }

  /**
   * Extracts inscription data (starting from the located mark) and calculates the envelope size.
   *
   * @param raw - The raw data to read.
   * @param mark - The inscription mark where the envelope starts.
   * @returns The parsed inscription or nullx
   */
  private static extractInscriptionData(raw: Uint8Array, mark: InscriptionMark): ParsedInscription | null {

    try {

      let fields: { tag: number; value: Uint8Array }[];
      let newPointer: number;
      let slice: Uint8Array;

      // Store the starting pointer (this is where the fields start)
      const initialPointer = mark.contentStart;

      // extractFields consumes the field/body separator, so we are now at the
      // beginning of the body (or at the OP_ENDIF if there is no body)
      [fields, newPointer] = InscriptionParserService.extractFields(raw, initialPointer);

      // Collect body data until OP_ENDIF
      const data: Uint8Array[] = [];
      while (newPointer < raw.length && raw[newPointer] !== OP_ENDIF) {
        [slice, newPointer] = readPushdata(raw, newPointer);
        data.push(slice);
      }

      // From the OP_FALSE that opens the envelope to the OP_ENDIF that closes
      // it, both included
      const envelopeSize = mark.envelopeEnd - mark.envelopeStart + 1;

      let combinedData = concatUint8Arrays(data);

      const contentTypeRaw = getKnownFieldValue(fields, knownFields.content_type);
      let contentType: string | undefined = undefined;

      // an inscriptions with no contentType is most probably a delegate
      if (contentTypeRaw) {
        // strings are (always) UTF-8, according to https://github.com/ordinals/ord/issues/2505,
        // and ord has no content type at all when the bytes are not valid UTF-8
        contentType = bytesToStrictUnicodeString(contentTypeRaw);
      }

      // figure out if the body is encoded via brotli or gzip
      const contentEncodingRaw = getKnownFieldValue(fields, knownFields.content_encoding);
      let contentEncoding: string | undefined = undefined;

      if (contentEncodingRaw) {
        // invalid UTF-8 means no content encoding for ord, which then serves
        // the body as is instead of trying to decompress it
        contentEncoding = bytesToStrictUnicodeString(contentEncodingRaw);
      }

      let cachedProperties: ReturnType<typeof parseProperties> | undefined;

      // Memoize the decompressed bytes. getContent / getData / getDataUri are
      // all called separately by different consumers (analyser, /content/,
      // /preview/), and brotli/gzip decode is the most expensive step in the
      // hot path. Cache the Promise itself so concurrent callers also share
      // the decode.
      let decodedDataPromise: Promise<Uint8Array> | undefined;
      const getDecoded = (): Promise<Uint8Array> => {
        if (!decodedDataPromise) {
          decodedDataPromise = getDecodedContent(contentEncoding, combinedData);
        }
        return decodedDataPromise;
      };

      return {

        type: DigitalArtifactType.Inscription,

        inscriptionId: 'REPLACE_THIS', // must be overridden in the calling method
        transactionId: 'REPLACE_THIS', // must be overridden in the calling method
        uniqueId:      'REPLACE_THIS', // must be overridden in the calling method

        contentType,

        fields,

        getContent: async (): Promise<string> => {
          const decodedData = await getDecoded();
          return bytesToUnicodeString(decodedData) + ''; // never return undefined here
        },

        getData: async (): Promise<string> => {
          const decodedData = await getDecoded();
          const content = bytesToBinaryString(decodedData);
          return binaryStringToBase64(content);
        },

        getDataUri: async(): Promise<string> => {
          const decodedData = await getDecoded();
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
          // ord uses filter_map over parents -- malformed ones are silently
          // dropped, same approach we mirror here. See
          // src/inscriptions/inscription.rs:283.
          return parentsRaw
            .map(parentRaw => extractInscriptionId(parentRaw))
            .filter((id): id is string => id !== null);
        },

        getMetadata: (): unknown => {
          const metadataChunks = getKnownFieldValues(fields, knownFields.metadata);

          if (metadataChunks.length === 0) {
            return undefined;
          }

          // ord decodes with ciborium::from_reader, which reads exactly ONE
          // CBOR item and ignores whatever follows, so metadata with trailing
          // bytes still has a value. decodeFirst does the same.
          //
          // Malformed metadata exists on chain, so degrade to undefined like
          // the sibling CBOR-from-witness paths (parseProperties, atomical
          // decodePayload) instead of throwing into the consumer.
          try {
            const raw = metadataChunks.length === 1
              ? metadataChunks[0]
              : concatUint8Arrays(metadataChunks);
            return CBOR.decodeFirst(raw);
          } catch {
            return undefined;
          }
        },

        getMetaprotocol: (): string | undefined => {
          const metaprotocolRaw = getKnownFieldValue(fields, knownFields.metaprotocol);
          if (!metaprotocolRaw) {
            return undefined;
          }

          return bytesToStrictUnicodeString(metaprotocolRaw);
        },

        getNote: (): string | undefined => {
          const noteRaw = getKnownFieldValue(fields, knownFields.note);
          if (!noteRaw) {
            return undefined;
          }
          return bytesToUnicodeString(noteRaw);
        },

        getContentEncoding: (): string | undefined => {
          return contentEncoding;
        },

        getDelegates: (): string[] => {
          const delegatesRaw = getKnownFieldValues(fields, knownFields.delegate);
          return delegatesRaw
            .map(parentRaw => extractInscriptionId(parentRaw))
            .filter((id): id is string => id !== null);
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

    } catch {
      return null;
    }
  }
}
