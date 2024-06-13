import { hasAtomical } from "./atomical-parser.service.helper";

/**
 * Extracts all Atomicals from a Bitcoin transaction.
 */
export class AtomicalParserService {

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
