import { CBOR } from '../lib/cbor';
import { DigitalArtifactType } from "../types/digital-artifact";
import { ParsedAtomical } from "../types/parsed-atomical";
import { OnParseError } from '../types/parser-options';
import { AtomicalEnvelope, extractAtomicalEnvelopeFromWitness, hasAtomical } from "./atomical-parser.service.helper";

/**
 * Extracts Atomicals from a Bitcoin transaction.
 * Detects the atomical envelope marker, extracts the operation type,
 * and provides lazy access to the CBOR payload.
 */
export class AtomicalParserService {

  /**
   * Parses a transaction and returns a ParsedAtomical if an atomical envelope is found.
   * Extracts the operation type immediately. CBOR payload decoding is deferred
   * to getPayload() — same lazy pattern as the inscription parser.
   */
  static parse(transaction: {
    txid: string,
    vin: { witness?: string[] }[]
  }, onError?: OnParseError): ParsedAtomical | null {

    try {
      if (!AtomicalParserService.hasAtomical(transaction)) {
        return null;
      }

      // Extract the full envelope (operation + CBOR payload) from the first matching witness
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

      return {
        type: DigitalArtifactType.Atomical,
        uniqueId: `${DigitalArtifactType.Atomical}-${transaction.txid}`,
        transactionId: transaction.txid,
        operation: envelope.operation,

        getPayloadRaw: (): Uint8Array => {
          return payloadRaw;
        },

        getPayload: (): Record<string, unknown> | null => {
          if (payloadRaw.length === 0) {
            return null;
          }
          try {
            return CBOR.decodeFirst(payloadRaw);
          } catch (e) {
            onError?.(e);
            return null;
          }
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
