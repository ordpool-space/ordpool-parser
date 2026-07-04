import { CBOR } from '../lib/cbor';
import {
  binaryStringToBase64,
  bytesToBinaryString,
  bytesToUnicodeString,
  concatUint8Arrays,
  hexToBytes,
  littleEndianBytesToNumber,
} from '../lib/conversions';
import { OP_0, OP_2DROP, OP_DROP, OP_ENDIF } from '../lib/op-codes';
import { readPushdata } from '../lib/reader';
import { assertEsploraShape } from '../lib/transaction-shape';
import { DigitalArtifactType } from '../types/digital-artifact';
import { ParsedInscription } from '../types/parsed-inscription';
import { OnParseError } from '../types/parser-options';
import {
  BIP110_INSCRIPTION_MARK_HEX,
  extractInscriptionId,
  extractPointer,
  getDecodedContent,
  getKnownFieldValue,
  getKnownFieldValues,
  getNextInscriptionMark,
  hasInscription,
  INSCRIPTION_MARK_HEX,
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

    // Only convert witness elements that contain one of the two
    // inscription marker patterns. This avoids hexToBytes on the
    // signature and control block elements, which is significant for
    // large inscriptions (up to 4MB).
    for (const element of witness) {
      if (!element.includes(INSCRIPTION_MARK_HEX) && !element.includes(BIP110_INSCRIPTION_MARK_HEX)) {
        continue;
      }

      const raw = hexToBytes(element);
      let startPosition = 0;
      while (true) {
        const mark = getNextInscriptionMark(raw, startPosition);
        if (!mark) break;

        const inscription = InscriptionParserService.extractInscriptionData(raw, mark.pointer, mark.isClassic);
        if (inscription) {
          inscriptions.push(inscription);
        }

        startPosition = mark.pointer;
      }
    }

    return inscriptions.length > 0 ? inscriptions : null;
  }

  /**
   * Extract an inscription starting one past the four-byte "ord" push.
   * Both envelope shapes (classic + BIP-110 per ordinals/ord#4545)
   * carry identical payloads -- tag/value fields, optional OP_0 body
   * separator, body chunks -- and differ only in the terminator:
   *
   *   classic:  OP_FALSE OP_IF <"ord"> ... OP_ENDIF
   *   BIP-110:  <"ord"> ... {OP_DROP | OP_2DROP}+  (balances every push)
   */
  private static extractInscriptionData(raw: Uint8Array, pointer: number, isClassic: boolean): ParsedInscription | null {

    try {
      const fields: { tag: number; value: Uint8Array }[] = [];
      const body: Uint8Array[] = [];
      let p = pointer;
      let pushes = 0;  // total pushes in the payload, BIP-110 uses it to size the drop walk

      const isTerminator = isClassic
        ? (op: number) => op === OP_ENDIF
        : (op: number) => op === OP_DROP || op === OP_2DROP;

      // Fields until OP_0 body separator or terminator.
      let slice: Uint8Array;
      while (p < raw.length && raw[p] !== OP_0 && !isTerminator(raw[p])) {
        // tags are encoded by ord as single-byte data pushes, but are accepted by ord as either single-byte pushes, or as OP_NUM data pushes.
        // tags greater than or equal to 256 should be encoded as little endian integers with trailing zeros omitted.
        // see: https://github.com/ordinals/ord/issues/2505
        [slice, p] = readPushdata(raw, p);
        const tag = slice.length === 1 ? slice[0] : littleEndianBytesToNumber(slice);
        [slice, p] = readPushdata(raw, p);
        fields.push({ tag, value: slice });
        pushes += 2;
      }

      // Optional OP_0 body separator (also a push).
      if (p < raw.length && raw[p] === OP_0) {
        p++;
        pushes++;
      }

      // Body chunks until terminator.
      while (p < raw.length && !isTerminator(raw[p])) {
        [slice, p] = readPushdata(raw, p);
        body.push(slice);
        pushes++;
      }

      // Terminator: single OP_ENDIF (classic) or drop sequence balancing
      // every push including the "ord" push (BIP-110).
      let envelopeEnd: number;
      if (isClassic) {
        envelopeEnd = p + 1; // past OP_ENDIF
      } else {
        let depth = pushes + 1; // +1 for the "ord" push itself
        while (p < raw.length && depth > 0) {
          if (raw[p] === OP_DROP) depth -= 1;
          else if (raw[p] === OP_2DROP) depth -= 2;
          else return null;
          if (depth < 0) return null;
          p++;
        }
        if (depth !== 0) return null;
        envelopeEnd = p;
      }

      // Envelope covers the marker plus the classic wrapper's OP_FALSE OP_IF.
      const envelopeStart = pointer - 4 - (isClassic ? 2 : 0);
      return InscriptionParserService.buildParsedInscription(fields, body, envelopeEnd - envelopeStart);
    } catch {
      return null;
    }
  }

  /**
   * Build the ParsedInscription with its lazy accessors from parsed
   * fields, body chunks, and envelope size.
   */
  private static buildParsedInscription(
    fields: { tag: number; value: Uint8Array }[],
    data: Uint8Array[],
    envelopeSize: number,
  ): ParsedInscription {

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
  }
}
