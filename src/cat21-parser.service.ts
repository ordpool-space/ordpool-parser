import { createCatHash } from './cat21-parser.service.helper';
import { MooncatParser } from './lib/mooncat-parser';
import { DigitalArtifactType } from './types/digital-artifact';
import { CatTraits, ParsedCat21 } from './types/parsed-cat21';

/**
 * Service to parse CAT-21 transactions.
 */
export class Cat21ParserService {

  /**
   * Parses a transaction to determine if it is a valid CAT-21 mint transaction.
   *
   * @param transaction - The transaction to parse.
   * @returns A ParsedCat object if the transaction is a valid CAT-21 transaction, otherwise null.
   *          For unconfirmed transactions the SVG is a placeholder image and the traits are null
   */
  static parse(transaction: {
    txid: string,
    locktime: number,
    status: {
      block_hash?: string, // undefined, if unconfirmed txn!
    }
  }): ParsedCat21 | null {

    try {

      if (!this.isValidCat21Transaction(transaction)) {
        return null;
      }

      const type = DigitalArtifactType.Cat21;
      const transactionId = transaction.txid;
      const blockId = transaction.status.block_hash || null;
      const uniqueId = `${DigitalArtifactType.Cat21}-${transaction.txid}`;

      if (blockId) {

        let svgAndTraits: { svg: string; traits: CatTraits; } | null = null;
        const catHash = createCatHash(transactionId, blockId);

        // final cat
        return {
          type,
          transactionId,
          blockId,
          uniqueId,

          getImage: () => {
            if (!svgAndTraits) {
              svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash);
            }
            return svgAndTraits.svg
          },
          getTraits: () => {
            if (!svgAndTraits) {
              svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash);
            }
            return svgAndTraits.traits
          }
        };
      } else {

        // placeholder cat
        return {
          type,
          transactionId,
          blockId,
          uniqueId,
          getImage: () => '<svg></svg>',
          getTraits: () => null
        };
      }

    } catch (ex) {
      // console.error(ex);
      return null;
    }

  }

  /**
   * Validates if a transaction meets CAT-21 protocol rules.
   *
   * @param transaction - The transaction to validate.
   * @returns True if the transaction is a valid CAT-21 transaction, false otherwise.
   */
  private static isValidCat21Transaction(transaction: {
    locktime: number
  }): boolean {

    // nLockTime must be 21
    if (transaction.locktime !== 21) {
      return false;
    }

    return true;
  }
}
