import { DigitalArtifactType } from "../types/digital-artifact";
import { ParsedAtomical } from "../types/parsed-atomical";
import { OnParseError } from '../types/parser-options';
import { AtomicalOperation, extractAtomicalOperationFromWitness, hasAtomical } from "./atomical-parser.service.helper";

/**
 * Extracts Atomicals from a Bitcoin transaction.
 * Detects the atomical envelope marker and extracts the operation type.
 */
export class AtomicalParserService {

  /**
   * Parses a transaction and returns a ParsedAtomical if an atomical envelope is found.
   * Currently extracts the operation type (nft, ft, dft, mod, evt, dat, sl).
   * CBOR payload decoding is not yet implemented.
   */
  static parse(transaction: {
    txid: string,
    vin: { witness?: string[] }[]
  }, onError?: OnParseError): ParsedAtomical | null {

    try {
      if (!AtomicalParserService.hasAtomical(transaction)) {
        return null;
      }

      // Extract operation type from the first matching witness
      let operation: AtomicalOperation = 'unknown';
      for (const vin of transaction.vin) {
        if (vin.witness) {
          const op = extractAtomicalOperationFromWitness(vin.witness);
          if (op !== null) {
            operation = op;
            break;
          }
        }
      }

      return {
        type: DigitalArtifactType.Atomical,
        uniqueId: `${DigitalArtifactType.Atomical}-${transaction.txid}`,
        transactionId: transaction.txid,
        operation,
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
