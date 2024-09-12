import { OrdpoolTransactionFlag } from "./types/ordpool-transaction-flags";

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
 * Parses the content and checks if it's valid JSON.
 * Returns the parsed object or null if invalid.
 *
 * @param content - The content to parse.
 * @returns Parsed JSON object or null.
 */
export function parseJsonContent(content: string): any | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
