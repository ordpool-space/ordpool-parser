import { createCatHash } from './cat21-parser.service.helper';
import { MooncatParser } from './mooncat-parser';
import { DigitalArtifactType } from '../types/digital-artifact';
import { CatTraits, ParsedCat21 } from '../types/parsed-cat21';

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
    weight: number,
    fee: number,
    status: {
      block_hash?: string, // undefined, if unconfirmed txn!
    }
  }): ParsedCat21 | null {

    try {

      if (!Cat21ParserService.hasCat21(transaction)) {
        return null;
      }

      const vsize = transaction.weight / 4;
      const feeRate = transaction.fee / vsize;

      const type = DigitalArtifactType.Cat21;
      const transactionId = transaction.txid;
      const blockId = transaction.status.block_hash || null;
      const uniqueId = `${DigitalArtifactType.Cat21}-${transaction.txid}-${ blockId || 'unconfirmed' }`;
      const catHash = blockId ? createCatHash(transactionId, blockId) : null;

      let svgAndTraits: { svg: string; traits: CatTraits | null; } | null = null;

      return {
        type,
        transactionId,
        blockId,
        uniqueId,

        getImage: () => {
          if (!svgAndTraits) {
            svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash, feeRate);
          }
          return svgAndTraits.svg
        },
        getTraits: () => {
          if (!svgAndTraits) {
            svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash, feeRate);
          }
          return svgAndTraits.traits
        }
      };

    } catch (ex) {
      // console.error(ex);
      return null;
    }

  }

  /**
   * Validates if a transaction meets all the CAT-21 protocol rules.
   *
   * @param transaction - The transaction to validate.
   * @returns True if the transaction is a valid CAT-21 transaction, false otherwise.
   */
  static hasCat21(transaction: {
    locktime: number
  }): boolean {

    // nLockTime must be 21
    // ...that's it! 😹
    if (transaction.locktime == 21) {
      return true;
    }

    return false;
  }
}
