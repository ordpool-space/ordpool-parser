import { MooncatParser } from "./lib/mooncat-parser";
import { ParsedCat } from "./parsed-cat";

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
    locktime: number,
    vout: { scriptpubkey_address: string }[]
  }): ParsedCat | null {
    if (this.isValidCat21Transaction(transaction)) {
      return {
        catId: transaction.txid,
        getImage: () => MooncatParser.generateMoonCatSvg(transaction.txid)
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
    locktime: number,
    vout: { scriptpubkey_address: string }[]
  }): boolean {

    // nLockTime must be 21
    if (transaction.locktime !== 21) {
      return false;
    }

    return this.isPaymentToTaprootAddress(transaction);
  }

  /**
   * Checks if a transaction is a payment to a pay-to-taproot (P2TR) address.
   *
   * @param transaction - The transaction to check.
   * @returns True if the transaction is a Taproot transaction, false otherwise.
   */
  private static isPaymentToTaprootAddress(transaction: {
    vout: { scriptpubkey_address: string }[]
  }): boolean {

    // Check if first vout address is a Taproot (P2TR) address
    const taprootAddressPrefixes = ['bc1p', 'bcrt', 'tb1'];
    const address = transaction.vout[0].scriptpubkey_address;
    return taprootAddressPrefixes.some(prefix => address.startsWith(prefix));
  }
}
