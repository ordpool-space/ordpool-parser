import { ParsedRunestone } from '../types/parsed-runestone';

/**
 * Decodes a runestone within a transaction.
 */
export class RuneParserService {

  /**
   * Main function that parses a runestone in a transaction.
   * @returns The parsed runestone or null
   */
  static parse(transaction: {
    txid: string;
    vin: { witness?: string[] }[]
  }): ParsedRunestone | null {

    try {


      return null;

    } catch (ex) {
      // console.error(ex);
      return null;
    }
  }
}
