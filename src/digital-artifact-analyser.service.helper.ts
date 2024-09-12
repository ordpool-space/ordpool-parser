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
 * Parses the content and returns the parsed object or null if invalid.
 *
 * Efficiently checks if a string is valid JSON object first, to avoid exceptions.
 *
 * @param content - The content to validate and parse.
 * @returns The parsed JSON object if valid, or null if invalid.
 */
export function parseJsonObject(content: string): any | null {

  if (typeof content !== 'string' || !content) {
    return null;
  }

  content = content.trim();

  // Quick check to ensure the content is likely a JSON object (starts with '{' and ends with '}')
  if (content.startsWith('{') && content.endsWith('}')) {

    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  return null;
}
