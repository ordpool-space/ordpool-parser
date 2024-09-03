import { OrdpoolTransactionFlag, OrdpoolTransactionFlags } from "../types/ordpool-transaction-flags";

/**
 * Checks if a specific flag is set on a transaction.
 *
 * @param tx - The transaction to check.
 * @param flag - The flag to check for.
 * @returns True if the flag is set, false otherwise.
 */
export function isFlagSet(tx: { flags?: number | null }, flag: OrdpoolTransactionFlag): boolean {

  if (!tx.flags) {
    return false;
  }

  return (BigInt(tx.flags) & flag) === flag;
}

/**
 * Checks for all ordpool flags.
 */
export function hasDigitalArtifactFlagSet(tx: { flags?: number | null }): boolean {

  if (!tx.flags) {
    return false;
  }

  return isFlagSet(tx, OrdpoolTransactionFlags.ordpool_atomical) ||
    isFlagSet(tx, OrdpoolTransactionFlags.ordpool_cat21) ||
    isFlagSet(tx, OrdpoolTransactionFlags.ordpool_inscription) ||
    isFlagSet(tx, OrdpoolTransactionFlags.ordpool_rune) ||
    isFlagSet(tx, OrdpoolTransactionFlags.ordpool_src20)
    // || isFlagSet(tx, OrdpoolFlags.test_large_numbers);
}
