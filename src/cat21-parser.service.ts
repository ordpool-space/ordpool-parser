import { CatTraits, MooncatParser } from "./lib/mooncat-parser";
import { DigitalArtifactType } from "./types/digital-artifact";
import { ParsedCat21 } from "./types/parsed-cat21";

/**
 * Service to parse CAT-21 transactions.
 */
export class Cat21ParserService {

  /**
   * Parses a transaction to determine if it is a valid CAT-21 mint transaction.
   *
   * @param transaction - The transaction to parse.
   * @returns A ParsedCat object if the transaction is a valid CAT-21 transaction, otherwise null.
   */
  static parseCat(transaction: {
    txid: string,
    locktime: number
  }): ParsedCat21 | null {
    if (this.isValidCat21Transaction(transaction)) {

      let svgAndTraits: { svg: string; traits: CatTraits; } | null = null;

      return {

        type: DigitalArtifactType.Cat21,
        transactionId: transaction.txid,

        getImage: () => {

          if (!svgAndTraits) {
            svgAndTraits = MooncatParser.generateMoonCatSvg(transaction.txid);
          }

          return svgAndTraits.svg
        },

        getTraits: () => {

          if (!svgAndTraits) {
            svgAndTraits = MooncatParser.generateMoonCatSvg(transaction.txid);
          }

          return svgAndTraits.traits
        }
      };
    }
    return null;
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
