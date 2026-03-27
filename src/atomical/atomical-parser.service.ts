import { CBOR } from '../lib/cbor';
import { binaryStringToBase64, bytesToBinaryString, bytesToUnicodeString } from '../lib/conversions';
import { DigitalArtifactType } from "../types/digital-artifact";
import { AtomicalFile, ParsedAtomical } from "../types/parsed-atomical";
import { OnParseError } from '../types/parser-options';
import { AtomicalEnvelope, extractAtomicalEnvelopeFromWitness, hasAtomical } from "./atomical-parser.service.helper";

/**
 * Guess content type from a filename. Used when the CBOR payload stores raw
 * binary data directly (no $ct wrapper).
 */
function guessContentType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'webp': return 'image/webp';
    case 'json': return 'application/json';
    case 'txt': return 'text/plain';
    case 'html': return 'text/html';
    default: return 'application/octet-stream';
  }
}

/**
 * Builds an AtomicalFile with content access methods.
 */
function buildFile(name: string, contentType: string, data: Uint8Array): AtomicalFile {
  return {
    name,
    contentType,
    data,
    getContent: () => bytesToUnicodeString(data),
    getData: () => binaryStringToBase64(bytesToBinaryString(data)),
    getDataUri: () => `data:${contentType};base64,${binaryStringToBase64(bytesToBinaryString(data))}`,
  };
}

/**
 * Extracts Atomicals from a Bitcoin transaction.
 * Detects the atomical envelope marker, extracts the operation type,
 * and provides lazy access to the CBOR payload.
 */
export class AtomicalParserService {

  /**
   * Parses a transaction and returns a ParsedAtomical if an atomical envelope is found.
   * Extracts the operation type immediately. CBOR payload decoding is deferred
   * to getArgs()/getFiles() — same lazy pattern as the inscription parser.
   */
  static parse(transaction: {
    txid: string,
    vin: { witness?: string[] }[]
  }, onError?: OnParseError): ParsedAtomical | null {

    try {
      // Extract the full envelope (operation + CBOR payload) from the first matching witness
      // No need for a separate hasAtomical() guard — envelope extraction returns null if no mark
      let envelope: AtomicalEnvelope | null = null;
      for (const vin of transaction.vin) {
        if (vin.witness) {
          envelope = extractAtomicalEnvelopeFromWitness(vin.witness);
          if (envelope !== null) {
            break;
          }
        }
      }

      if (!envelope) {
        return null;
      }

      const payloadRaw = envelope.payload;

      let decoded = false;
      let decodedPayload: Record<string, unknown> | null = null;
      let cachedFiles: AtomicalFile[] | null = null;
      function decodePayload(): Record<string, unknown> | null {
        if (decoded) {
          return decodedPayload;
        }
        decoded = true;
        if (payloadRaw.length === 0) {
          decodedPayload = null;
          return null;
        }
        try {
          decodedPayload = CBOR.decodeFirst(payloadRaw);
          return decodedPayload;
        } catch (e) {
          onError?.(e);
          decodedPayload = null;
          return null;
        }
      }

      return {
        type: DigitalArtifactType.Atomical,
        uniqueId: `${DigitalArtifactType.Atomical}-${transaction.txid}`,
        transactionId: transaction.txid,
        operation: envelope.operation,

        getPayloadRaw: (): Uint8Array => {
          return payloadRaw;
        },

        getArgs: (): Record<string, unknown> | null => {
          const payload = decodePayload();
          return (payload as any)?.args ?? null;
        },

        getFiles: (): AtomicalFile[] => {
          if (cachedFiles) {
            return cachedFiles;
          }

          const payload = decodePayload();
          if (!payload) {
            cachedFiles = [];
            return cachedFiles;
          }

          const files: AtomicalFile[] = [];
          for (const key of Object.keys(payload)) {
            if (key === 'args') {
              continue;
            }
            const entry = payload[key] as any;

            // Format 1: {$ct: "image/png", $b: <binary>} — used by prepareFilesData (old path)
            if (entry && entry.$ct && ArrayBuffer.isView(entry.$b)) {
              files.push(buildFile(
                key,
                entry.$ct,
                new Uint8Array(entry.$b.buffer, entry.$b.byteOffset, entry.$b.byteLength),
              ));

            // Format 2: raw binary directly — used by prepareFilesDataAsObject (newer path)
            } else if (ArrayBuffer.isView(entry)) {
              files.push(buildFile(
                key,
                guessContentType(key),
                new Uint8Array(entry.buffer, entry.byteOffset, entry.byteLength),
              ));
            }
          }
          cachedFiles = files;
          return files;
        },
      };
    } catch (ex) {
      onError?.(ex);
      return null;
    }
  }

  /**
   * Super quick check, that returns true if an atomicalMark is found.
   * @param transaction any bitcoin transaction
   * @returns True if an atomicalMark is found.
   */
  static hasAtomical(transaction: {
    vin: { witness?: string[] }[]
  }): boolean {

    try {

      for (let i = 0; i < transaction.vin.length; i++) {
        const vin = transaction.vin[i];
        if (vin.witness && hasAtomical(vin.witness)) {
          return true;
        }
      }
      return false;

    } catch (ex) {
      return false;
    }
  }
}
