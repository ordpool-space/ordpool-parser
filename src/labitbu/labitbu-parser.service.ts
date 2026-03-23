import { DigitalArtifactType } from '../types/digital-artifact';
import { ParsedLabitbu } from '../types/parsed-labitbu';
import { OnParseError } from '../types/parser-options';
import { extractLabitbuImage, hasLabitbu } from './labitbu-parser.service.helper';

/**
 * Extracts Labitbu digital artifacts from a Bitcoin transaction.
 *
 * Labitbu stores WebP images in Taproot witness control blocks,
 * identified by a NUMS key (SHA-256 of "Labitbu").
 * See https://github.com/labitbu/pathologies
 */
export class LabitbuParserService {

  /**
   * Parses a transaction and returns a ParsedLabitbu if a Labitbu image is found.
   */
  static parse(transaction: {
    txid: string,
    vin: { witness?: string[] }[]
  }, onError?: OnParseError): ParsedLabitbu | null {

    try {
      let imageData: Uint8Array | null = null;

      for (const vin of transaction.vin) {
        if (vin.witness) {
          imageData = extractLabitbuImage(vin.witness);
          if (imageData) {
            break;
          }
        }
      }

      if (!imageData) {
        return null;
      }

      // Capture for closure
      const data = imageData;

      return {
        type: DigitalArtifactType.Labitbu,
        uniqueId: `${DigitalArtifactType.Labitbu}-${transaction.txid}`,
        transactionId: transaction.txid,
        contentType: 'image/webp',

        getDataRaw: (): Uint8Array => {
          return data;
        },
      };
    } catch (ex) {
      onError?.(ex);
      return null;
    }
  }

  /**
   * Quick check: returns true if a Labitbu image is found in any witness.
   */
  static hasLabitbu(transaction: {
    vin: { witness?: string[] }[]
  }): boolean {

    try {
      for (const vin of transaction.vin) {
        if (vin.witness && hasLabitbu(vin.witness)) {
          return true;
        }
      }
      return false;
    } catch (ex) {
      return false;
    }
  }
}
