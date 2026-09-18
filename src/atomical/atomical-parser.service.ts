import { CBOR } from '../lib/cbor';
import { bytesToBase64, bytesToDataUri, bytesToUnicodeString } from '../lib/conversions';
import { assertEsploraShape } from '../lib/transaction-shape';
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
    getData: () => bytesToBase64(data),
    getDataUri: () => bytesToDataUri(data, contentType),
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

    // Outside try/catch — see InscriptionParserService.parse for rationale.
    assertEsploraShape(transaction, 'AtomicalParserService.parse');

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
          // strictUtf8: atomicals-electrumx decodes with cbor2, which raises
          // CBORDecodeError on invalid UTF-8; its caller catches with a bare
          // `except` and SKIPS the tx input (util_atomicals.py:1308).
          const raw: unknown = CBOR.decodeFirst(payloadRaw, undefined, undefined, true);
          // The atomical envelope MUST decode to a CBOR map. Anything else
          // (array, primitive, raw bytes) is malformed and we treat as no payload.
          if (raw && typeof raw === 'object' && !Array.isArray(raw) && !ArrayBuffer.isView(raw)) {
            decodedPayload = raw as Record<string, unknown>;
          } else {
            decodedPayload = null;
          }
          return decodedPayload;
        } catch (e) {
          onError?.(e);
          decodedPayload = null;
          return null;
        }
      }

      // A non-empty payload that does not CBOR-decode, or does not decode to a
      // map, makes the reference indexer `continue` past this input, so NO
      // atomical is recorded for it at all (atomicals-electrumx,
      // `parse_protocols_operations_from_witness_array`, util_atomicals.py:1306
      // to 1317). Reporting one here would count an artifact the reference does
      // not, and those counts reach ordpool_stats.
      //
      // An EMPTY payload is not an error there: the decode is skipped entirely
      // and the operation still stands, so it still stands here.
      //
      // The reference ALSO rejects a payload whose `meta`, `args`, `ctx` or
      // `init` is not a whitelisted dict (`is_sanitized_dict_whitelist_only`).
      // That rule is not replicated yet and is tracked separately; it needs its
      // own on-chain evidence, and the helper has a quirk worth matching
      // deliberately rather than by accident (it returns on the FIRST nested
      // dict instead of checking every key).
      if (payloadRaw.length > 0 && decodePayload() === null) {
        return null;
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
          if (!payload) return null;
          const args = payload['args'];
          // 'args' must itself be a CBOR map -- reject arrays/primitives/binary
          if (args && typeof args === 'object' && !Array.isArray(args) && !ArrayBuffer.isView(args)) {
            return args as Record<string, unknown>;
          }
          return null;
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
            const entry: unknown = payload[key];

            // Format 1: {$ct: "image/png", $b: <binary>} — used by prepareFilesData (old path)
            if (entry && typeof entry === 'object' && !ArrayBuffer.isView(entry) && !Array.isArray(entry)) {
              const wrapper = entry as Record<string, unknown>;
              const ct = wrapper.$ct;
              const b = wrapper.$b;
              if (typeof ct === 'string' && ArrayBuffer.isView(b)) {
                files.push(buildFile(
                  key,
                  ct,
                  new Uint8Array(b.buffer, b.byteOffset, b.byteLength),
                ));
                continue;
              }
            }

            // Format 2: raw binary directly — used by prepareFilesDataAsObject (newer path)
            if (ArrayBuffer.isView(entry)) {
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
