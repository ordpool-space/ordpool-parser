import { Cenotaph, RunestoneSpec, isRunestone, tryDecodeRunestone } from '.';
import { DigitalArtifactType } from '../types/digital-artifact';
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
    txid: string,
    vout: {
      scriptpubkey: string,
      scriptpubkey_type: string
    }[];
  }): ParsedRunestone | null {

    try {

      // early exit
      if (!RuneParserService.hasRunestone(transaction)) {
        return null;
      }

      const artifact = tryDecodeRunestone(transaction);

      if (!artifact) {
        return null;
      }

      if (isRunestone(artifact)) {
        const runestone: RunestoneSpec = artifact;

        return {
          type: DigitalArtifactType.Runestone,
          uniqueId: `${DigitalArtifactType.Runestone}-${transaction.txid}`,
          transactionId: transaction.txid,
          runestone,
          cenotaph: null
        };

      } else {
        const cenotaph: Cenotaph = artifact;
        return {
          type: DigitalArtifactType.Runestone,
          uniqueId: `${DigitalArtifactType.Runestone}-${transaction.txid}`,
          transactionId: transaction.txid,
          runestone: null,
          cenotaph
        };
      }

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
