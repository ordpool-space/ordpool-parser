import { ParsedRunestone } from '../types/parsed-runestone';

/**
 * Decodes a runestone within a transaction.
 */
export class RuneParserService {

  /**
   * Main function that parses a runestone in a transaction.
   * @returns The parsed runestone or null
   */
  static parse(transaction: any): ParsedRunestone | null {

    try {

      // TODOs
      return null;

    } catch (ex) {
      // console.error(ex);
      return null;
    }
  }

  // just checks for OP_RETURN (0x6a) OP_PUSHNUM_13 (0x5d) at the moment
  static hasRunestone(transaction: {
    vout: {
      scriptpubkey: string,
      scriptpubkey_type: string
    }[];
  }) {

    for (const vout of transaction.vout) {
      if (vout.scriptpubkey_type === 'op_return' &&
          vout.scriptpubkey.startsWith('6a5d')) {
        return true;
      }
    }

    return false;
  }
}
