import { ParsedCat } from "./parsed-cat";

/**
 * Service to parse CAT-21 transactions.
 */
export class Cat21ParserService {

  // Placeholder block activation height. This will change in the future!
  static readonly activationBlockHeight = 1000;

  /**
   * Parses a transaction to determine if it is a valid CAT-21 mint transaction.
   * @param transaction - The transaction to parse.
   * @returns A ParsedCat object if the transaction is a valid CAT-21 transaction, otherwise null.
   */
  static parseCat(transaction: {
    txid: string,
    locktime: number,
    vin: any[],
    vout: { scriptpubkey_address: string }[],
    status: {
      block_height: number
    }
  }): ParsedCat | null {
    if (this.isValidCat21Transaction(transaction)) {
      return {
        catId: transaction.txid,
        getImage: () => this.placeholderImage(),
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
    vin: any[],
    vout: { scriptpubkey_address: string }[],
    status: {
      block_height: number
    }
  }): boolean {

    // Checks for CAT-21 protocol activation block height
    if (transaction.status.block_height < this.activationBlockHeight) {
      return false;
    }

    // nLockTime must be 21, and there should be exactly one input and one output
    if (transaction.locktime !== 21 ||
        transaction.vin.length !== 1 ||
        transaction.vout.length !== 1) {
      return false;
    }

    return this.isTaprootTransaction(transaction);
  }

  /**
   * Checks if a transaction is a Taproot transaction.
   *
   * @param transaction - The transaction to check.
   * @returns True if the transaction is a Taproot transaction, false otherwise.
   */
  private static isTaprootTransaction(transaction: {
    vout: { scriptpubkey_address: string }[]
  }): boolean {

    // Check if vout address is a Taproot (P2TR) address
    const taprootAddressPrefixes = ['bc1p', 'bcrt', 'tb1'];
    const address = transaction.vout[0].scriptpubkey_address;
    return taprootAddressPrefixes.some(prefix => address.startsWith(prefix));
  }

  /**
   * Placeholder image as a base64 encoded data URI.
   *
   * @returns The placeholder image data URI.
   */
  private static placeholderImage(): string {
    return "data:image/png;base64,..."; // Replace with actual base64 encoded image
  }
}
