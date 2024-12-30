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

/**
 * Adds a transaction ID to the list of entries for a given key in the target object.
 * If the key does not exist in the target, it initializes a new array for the key.
 *
 * @param target - The target object where entries are stored. Each key maps to an array of strings.
 * @param key - The key to associate the entry with. If undefined, the function does nothing.
 * @param entry - The string entry (e.g., a transaction ID) to add to the list for the given key.
 */
export function addEntry(target: { [key: string]: string[] }, key: string | undefined, entry: string): void {

  if (!key) {
    return;
  }

  // Initialize the array for the key if it doesn't exist
  if (!target[key]) {
    target[key] = [];
  }

  // Add the entry to the list
  target[key].push(entry);
}

/**
 * Converts a key-value object into Activities format.
 *
 * @param data - An object where the keys represent identifiers and the values represent counts.
 * @returns A multi-dimensional array of Activities, where each entry is [identifier, count].
 *
 * @example
 * const data = { 'id1': 10, 'id2': 20 };
 * const result = convertToActivities(data);
 * // result: [['id1', 10], ['id2', 20]]
 */
export function convertToActivities(data: { [key: string]: number }): [string, number][] {
  return Object.entries(data);
}

/**
 * Converts a key-value object into Attempts format.
 *
 * @param data - An object where the keys represent identifiers and the values are arrays of transaction IDs.
 * @returns A multi-dimensional array of Attempts, where each entry is [identifier, [txId1, txId2, ...]].
 *
 * @example
 * const data = { 'id1': ['tx1', 'tx2'], 'id2': ['tx3'] };
 * const result = convertToAttempts(data);
 * // result: [['id1', ['tx1', 'tx2']], ['id2', ['tx3']]]
 */
export function convertToAttempts(data: { [identifier: string]: string[] }): [string, string[]][] {
  return Object.entries(data);
}
  