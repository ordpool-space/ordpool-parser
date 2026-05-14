import { bytesToBase64, bytesToDataUri, bytesToUnicodeString } from '../lib/conversions';
import { assertEsploraShape } from '../lib/transaction-shape';
import { DigitalArtifactType } from '../types/digital-artifact';
import { ParsedLabitbu } from '../types/parsed-labitbu';
import { OnParseError } from '../types/parser-options';
import {
  extractLabitbuImage,
  hasLabitbu,
  isLabitbuRange,
} from './labitbu-parser.service.helper';

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
   *
   * Detection is gated by block height to the historical Labitbu mint window
   * (see `isLabitbuRange`). The minting is complete; only blocks inside the
   * window can carry a Labitbu image. Passing a height outside the window, or
   * omitting the height (which means the tx isn't confirmed yet — mempool txs
   * can't be inside an already-mined window by definition), short-circuits
   * to null without scanning witnesses.
   */
  static parse(transaction: {
    txid: string,
    vin: { witness?: string[] }[]
  }, onError?: OnParseError, blockHeight?: number): ParsedLabitbu | null {

    // Outside try/catch — see InscriptionParserService.parse for rationale.
    assertEsploraShape(transaction, 'LabitbuParserService.parse');

    if (!isLabitbuRange(blockHeight)) {
      return null;
    }

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

        getContent: (): string => {
          return bytesToUnicodeString(data);
        },

        getData: (): string => {
          return bytesToBase64(data);
        },

        getDataUri: (): string => {
          return bytesToDataUri(data, 'image/webp');
        },
      };
    } catch (ex) {
      onError?.(ex);
      return null;
    }
  }

  /**
   * Quick check: returns true if a Labitbu image is found in any witness.
   * Same height-gate as `parse()` — out-of-range or missing height returns false.
   */
  static hasLabitbu(transaction: {
    vin: { witness?: string[] }[]
  }, blockHeight?: number): boolean {

    if (!isLabitbuRange(blockHeight)) {
      return false;
    }

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
