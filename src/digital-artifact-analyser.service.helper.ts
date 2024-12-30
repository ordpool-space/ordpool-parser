import { RuneEtchingSpec } from "./rune/src/etching";
import { Brc20DeployAttempt, Src20DeployAttempt, MintActivities, RuneEtchAttempt } from "./types/ordpool-stats";
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
export function convertToActivities(data: { [key: string]: number }): MintActivities {
  return Object.entries(data);
}

/**
 * Converts an array of mint activities into a compact comma-separated string format.
 * Each activity is represented as `identifier,count`.
 *
 * @param data - The array of mint activities to compact.
 * @returns A comma-separated string where each activity is represented as `identifier,count`.
 */
export function mintActivityToCompact(data: MintActivities): string {
  return data.map(([identifier, count]) => `${identifier},${count}`).join(',');
}

/**
 * Converts a compact comma-separated string of mint activities into an array of mint activities.
 * Each activity in the string is represented as `identifier,count`.
 *
 * @param data - A comma-separated string where each activity is represented as `identifier,count`.
 * @returns An array of mint activities as tuples `[identifier, count]`.
 */
export function compactToMintActivity(data: string): MintActivities {
  if (!data) {
    return [];
  }

  return data.split(',').reduce<MintActivities>((acc, entry, index, array) => {
    if (index % 2 === 0) {
      const identifier = entry;
      const count = Number(array[index + 1]);
      acc.push([identifier, count]);
    }
    return acc;
  }, []);
}

/**
 * Constructs a flat RuneEtchAttempt object from the given parameters.
 *
 * @param txId - The transaction ID of the etching attempt.
 * @param blockHeight - The block height where the transaction occurred.
 * @param txIndex - The index of the transaction within the block.
 * @param etchingSpec - The complete specification of the rune etching.
 * @returns A flat RuneEtchAttempt object or null if the etchingSpec is undefined.
 */
export function createRuneEtchAttempt(
  txId: string,
  blockHeight: number,
  txIndex: number,
  etchingSpec: RuneEtchingSpec | undefined
): RuneEtchAttempt | null {
  if (!etchingSpec) {
    return null;
  }

  return {
    txId,
    runeId: `${blockHeight}:${txIndex}`,
    runeName: etchingSpec.runeName,
    divisibility: etchingSpec.divisibility,
    premine: etchingSpec.premine,
    symbol: etchingSpec.symbol,
    cap: etchingSpec.terms?.cap,
    amount: etchingSpec.terms?.amount,
    offsetStart: etchingSpec.terms?.offset?.start,
    offsetEnd: etchingSpec.terms?.offset?.end,
    heightStart: etchingSpec.terms?.height?.start,
    heightEnd: etchingSpec.terms?.height?.end,
    turbo: etchingSpec.turbo,
  };
}

/**
 * Converts an array of RuneEtchAttempt objects to a compact string format.
 * Each property is separated by a pipe (`|`), and each attempt is separated by a comma (`,`).
 * Undefined values are replaced with empty strings.
 *
 * @param attempts - Array of RuneEtchAttempt objects to be converted.
 * @returns A compact string representing the array of RuneEtchAttempt objects.
 */
export function runeEtchAttemptsToCompact(attempts: RuneEtchAttempt[]): string {
  return attempts
    .map(a =>
      [
        a.txId,
        a.runeId,
        a.runeName ?? '',
        a.divisibility ?? '',
        a.premine?.toString() ?? '',
        a.symbol ?? '',
        a.cap?.toString() ?? '',
        a.amount?.toString() ?? '',
        a.offsetStart?.toString() ?? '',
        a.offsetEnd?.toString() ?? '',
        a.heightStart?.toString() ?? '',
        a.heightEnd?.toString() ?? '',
        a.turbo ? '1' : '' // Turbo is represented as '1' for true and empty for false.
      ].join('|')
    )
    .join(',');
}

/**
 * Converts a compact string format back to an array of RuneEtchAttempt objects.
 * Parses each property from the compact string.
 *
 * @param data - Compact string representing RuneEtchAttempt objects.
 * @returns An array of parsed RuneEtchAttempt objects.
 */
export function compactToRuneEtchAttempts(data: string): RuneEtchAttempt[] {
  if (!data) {
    return [];
  }

  return data.split(',').map(entry => {
    const [
      txId,
      runeId,
      runeName,
      divisibility,
      premine,
      symbol,
      cap,
      amount,
      offsetStart,
      offsetEnd,
      heightStart,
      heightEnd,
      turbo
    ] = entry.split('|', 13);

    return {
      txId,
      runeId,
      runeName: runeName || undefined,
      divisibility: divisibility ? parseInt(divisibility, 10) : undefined,
      premine: premine ? BigInt(premine) : undefined,
      symbol: symbol || undefined,
      cap: cap ? BigInt(cap) : undefined,
      amount: amount ? BigInt(amount) : undefined,
      offsetStart: offsetStart ? BigInt(offsetStart) : undefined,
      offsetEnd: offsetEnd ? BigInt(offsetEnd) : undefined,
      heightStart: heightStart ? BigInt(heightStart) : undefined,
      heightEnd: heightEnd ? BigInt(heightEnd) : undefined,
      turbo: turbo === '1',
    };
  });
}

/**
 * Converts an array of BRC-20 deploy attempts into a compact comma-separated string format.
 * Each attempt's values are separated by pipes (|).
 *
 * @param data - The array of BRC-20 deploy attempts to compact.
 * @returns A comma-separated string where each attempt is represented as `txId|ticker|maxSupply|mintLimit|decimals`.
 */
export function brc20DeployAttemptsToCompact(data: Brc20DeployAttempt[]): string {
  return data
    .map(a => `${a.txId}|${a.ticker}|${a.maxSupply}|${a.mintLimit ?? ''}|${a.decimals ?? ''}`)
    .join(',');
}

/**
 * Converts a compact comma-separated string of BRC-20 deploy attempts into an array of BRC-20 deploy attempts.
 *
 * @param data - A comma-separated string where each attempt is represented as `txId|ticker|maxSupply|mintLimit|decimals`.
 * @returns An array of BRC-20 deploy attempts.
 */
export function compactToBrc20DeployAttempts(data: string): Brc20DeployAttempt[] {
  if (!data) {
    return [];
  }

  return data.split(',').map((entry) => {
    const [txId, ticker, maxSupply, mintLimit, decimals] = entry.split('|', 5);
    return {
      txId,
      ticker,
      maxSupply,
      mintLimit: mintLimit || undefined,
      decimals: decimals || undefined
    };
  });
}

/**
 * Converts an array of SRC-20 deploy attempts into a compact comma-separated string format.
 * Each attempt's values are separated by pipes (|).
 *
 * @param data - The array of SRC-20 deploy attempts to compact.
 * @returns A comma-separated string where each attempt is represented as `txId|ticker|maxSupply|mintLimit|decimals`.
 */
export function src20DeployAttemptsToCompact(data: Src20DeployAttempt[]): string {
  return data
    .map(a => `${a.txId}|${a.ticker}|${a.maxSupply}|${a.mintLimit}|${a.decimals ?? ''}`)
    .join(',');
}

/**
 * Converts a compact comma-separated string of SRC-20 deploy attempts into an array of SRC-20 deploy attempts.
 *
 * @param data - A comma-separated string where each attempt is represented as `txId|ticker|maxSupply|mintLimit|decimals`.
 * @returns An array of SRC-20 deploy attempts.
 */
export function compactToSrc20DeployAttempts(data: string): Src20DeployAttempt[] {
  if (!data) {
    return [];
  }

  return data.split(',').map((entry) => {
    const [txId, ticker, maxSupply, mintLimit, decimals] = entry.split('|', 5);
    return {
      txId,
      ticker,
      maxSupply,
      mintLimit,
      decimals: decimals || undefined
    };
  });
}
