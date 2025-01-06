import { Cenotaph, isRunestone, RunestoneSpec, tryDecodeRunestone } from '.';
import { DigitalArtifactType } from '../types/digital-artifact';
import { IEsploraApi } from '../types/mempool';
import { ParsedRunestone } from '../types/parsed-runestone';
import {
  commitmentHasAtLeast6Confirmations,
  isReservedRuneName,
  isRuneNameUnlocked,
  isValidRuneName,
  removeSpacers,
  RuneFlaw,
  validateRuneEtchingSpec,
} from './rune-parser.service.helper';
import { findCommitment } from './rune-parser.service.helper.findCommitment';
import { RuneEtchingSpec } from './src/etching';
import { Network } from './src/network';

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

      // artifact is completely empty
      // example: 28baf9374797230174803b0c3f63fd39e22bb1972a25cc2af4e791ca8fc89dae
      if (!Object.keys(artifact).length) {
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

  /**
   * Validates the rune according to the rules specified:
   *
   * 1. falsy data provided
   * 2. One or more properties are out of range
   * 3. The rune name is valid
   * 4. The name is not reserved (equal or larger than AAAAAAAAAAAAAAAAAAAAAAAAAAA))
   * 5. The rune name is already unlocked at the given block height
   * 6. The transaction has a commitment
   * 7. The input being spent was a Taproot output
   * 8. The commitment has 6 confirmations (COMMIT_CONFIRMATIONS)
   *
   * @param transaction - The transaction to validate
   * @param vinTransactions - The transactions of the inputs
   * @param network - The network (Bitcoin, Testnet, etc.)
   * @param runeName - The rune name to validate
   * @returns The specific flaw if any, or null if valid
   */
  static validateRune(
    transaction: {
      vin: IEsploraApi.Vin[],
      status: IEsploraApi.Status
    },
    vinTransactions: {
      txid: string;
      status: IEsploraApi.Status
    }[],
    network: Network,
    runeEtchingSpec: RuneEtchingSpec | undefined,
  ): RuneFlaw | null {

    // 1. no etching provided??
    if (!runeEtchingSpec) {
      return RuneFlaw.NO_RUNE_ETCHING_PROVIDED;
    }

    // 2. Someone sneaked in too large data
    const hasValidSpec = validateRuneEtchingSpec(runeEtchingSpec);
    if (!hasValidSpec.valid) {
      return RuneFlaw.INVALID_RUNE_ETCHING_SPEC;
    }

    const runeName = runeEtchingSpec.runeName || '';
    const cleanedRuneName = removeSpacers(runeName);

    // 3. Check if the rune name is valid
    if (!isValidRuneName(cleanedRuneName)) {
      return RuneFlaw.INVALID_RUNE_NAME;
    }

    // 4. Check if rune name is reserved
    if (isReservedRuneName(cleanedRuneName)) {
      return RuneFlaw.RESERVED_RUNE_NAME;
    }

    const txnBlockHeight = transaction.status.block_height;

    // 5. Check if the rune name is unlocked at the current block height
    if (txnBlockHeight && !isRuneNameUnlocked(cleanedRuneName, txnBlockHeight, network)) {
      return RuneFlaw.RUNE_NOT_UNLOCKED;
    }

    // 6. Check for a commitment
    const commitmentVin = findCommitment(transaction, runeName)
    if (!commitmentVin) {
      return RuneFlaw.COMMITMENT_NOT_FOUND;
    }

    // 7. Check if the input being spent was a Taproot output
    const isTaprootOutput = commitmentVin.prevout?.scriptpubkey_type === 'v1_p2tr' ||
      commitmentVin.prevout?.scriptpubkey_type === 'unknown';

    if (!isTaprootOutput) {
      return RuneFlaw.INPUT_NOT_TAPROOT;
    }

    // 8. Check if the commitment has 6 confirmations
    const commitmentTransaction = vinTransactions.find(x => x.txid === commitmentVin.txid);
    const commitmentBlockHeight = commitmentTransaction?.status?.block_height;
    if (!commitmentHasAtLeast6Confirmations(txnBlockHeight, commitmentBlockHeight)) {
      return RuneFlaw.COMMITMENT_TOO_RECENT;
    }

    // If all checks pass, the rune is valid
    return null;
  }
}
