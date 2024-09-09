import { AtomicalParserService } from "../atomical/atomical-parser.service";
import { Cat21ParserService } from "../cat21/cat21-parser.service";
import { InscriptionParserService } from "../inscription/inscription-parser.service";
import { RuneParserService } from "../rune/rune-parser.service";
import { Src20ParserService } from "../src20/src20-parser.service";
import { OrdpoolTransactionFlag, OrdpoolTransactionFlags } from "../types/ordpool-transaction-flags";
import { TransactionSimple } from "../types/transaction-simple";


/**
 * Checks if a specific flag is set on the provided flags number.
 *
 * @param flags - The flags value to check (can be null or undefined).
 * @param flag - The specific flag to check for.
 * @returns True if the flag is set, false otherwise.
 */
export function isFlagSet(flags: number, flag: OrdpoolTransactionFlag): boolean {
  return (BigInt(flags) & flag) === flag;
}

/**
 * Checks if a specific flag is set on a transaction (which may or may not have the flags property).
 *
 * @param tx - The transaction to check.
 * @param flag - The flag to check for.
 * @returns True if the flag is set, false otherwise.
 */
export function isFlagSetOnTransaction(tx: { flags?: number | null }, flag: OrdpoolTransactionFlag): boolean {

  if (!tx.flags) {
    return false;
  }

  return (BigInt(tx.flags) & flag) === flag;
}

/**
 * Checks for all ordpool flags on a transaction (which may or may not have the flags property).
 *
 * @param tx - The transaction to check.
 * @returns True if one or more of our ordpool flags are set, false otherwise.
 */
export function hasDigitalArtifactFlagSetOnTransaction(tx: { flags?: number | null }): boolean {

  if (!tx.flags) {
    return false;
  }

  return isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_atomical) ||
    isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_cat21) ||
    isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_inscription) ||
    isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_rune) ||
    isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_src20)
    // || isFlagSetOnTransaction(tx, OrdpoolFlags.test_large_numbers);
}

/**
 * Computes and returns the transaction flags for the given transaction.
 * This function only does a quick check for the general protocol and tries to early exit.
 * It does not analyse the artifacts in detail. (good enough for the mempool overview page)
 *
 * This function checks if specific digital artifacts (e.g., Atomical, CAT-21, Inscriptions, Rune, SRC-20)
 * are present in the transaction and sets the corresponding flag(s) in the `flags` variable.
 * Only our own `OrdpoolTransactionFlags` are set (not the `TransactionFlags`).
 *
 * Used in:
 * - ordpool: backend/src/api/common.ts
 * - ordpool: frontend/src/app/shared/transaction.utils.ts
 *
 * @param tx - The transaction to be evaluated for digital artifacts.
 * @param flags - The existing flags to which new flags will be added.
 * @return The updated flags with the appropriate ordpool transaction flags set.
 */
export function getOrdpoolTransactionFlags(tx: TransactionSimple, flags: bigint): bigint {

  if (AtomicalParserService.hasAtomical(tx)) {
    flags |= OrdpoolTransactionFlags.ordpool_atomical;
  }

  if (Cat21ParserService.hasCat21(tx)) {
    flags |= OrdpoolTransactionFlags.ordpool_cat21;
  }

  if (InscriptionParserService.hasInscription(tx)) {
    flags |= OrdpoolTransactionFlags.ordpool_inscription;
  }

  if (RuneParserService.hasRunestone(tx)) {
    flags |= OrdpoolTransactionFlags.ordpool_rune;
  }

  if (Src20ParserService.hasSrc20(tx)) {
    flags |= OrdpoolTransactionFlags.ordpool_src20;
  }

  // Test to make sure that large numbers don't cause issues when sent to frontend
  // --> seems to work fine so far! :-)
  // flags |= TransactionFlags.test_large_numbers;

  return flags;
}
