import { RuneEtchingSpec } from "./rune/src/etching";
import { Brc20DeployAttempt, Src20DeployAttempt, MintActivities, RuneEtchAttempt, Cat21Mint, MinimalCat21Mint } from "./types/ordpool-stats";
import { OrdpoolTransactionFlag } from "./types/ordpool-transaction-flags";
import { CatTraits, ParsedCat21 } from "./types/parsed-cat21";
import { TransactionSimplePlus } from "./types/transaction-simple";

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
export function parseJsonObject(content: string): Record<string, unknown> | null {

  if (typeof content !== 'string' || !content) {
    return null;
  }

  content = content.trim();

  // Quick check to ensure the content is likely a JSON object (starts with '{' and ends with '}')
  if (content.startsWith('{') && content.endsWith('}')) {

    try {
      const parsed: unknown = JSON.parse(content);
      // Reject arrays and primitives -- the function name promises an OBJECT
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
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
export function contructRuneEtchAttempt(
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
    premine: etchingSpec.premine?.toString(),
    symbol: etchingSpec.symbol,
    cap: etchingSpec.terms?.cap?.toString(),
    amount: etchingSpec.terms?.amount?.toString(),
    offsetStart: etchingSpec.terms?.offset?.start?.toString(),
    offsetEnd: etchingSpec.terms?.offset?.end?.toString(),
    heightStart: etchingSpec.terms?.height?.start?.toString(),
    heightEnd: etchingSpec.terms?.height?.end?.toString(),
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
        a.runeName || '',
        a.divisibility ?? '',
        a.premine ?? '',
        a.symbol || '',
        a.cap ?? '',
        a.amount ?? '',
        a.offsetStart ?? '',
        a.offsetEnd ?? '',
        a.heightStart ?? '',
        a.heightEnd ?? '',
        a.turbo ? '1' : '' // Turbo is represented as '1' for true and empty for false.
      ].join('|')
    )
    .join(',');
}

/**
 * Converts a compact string format back to an array of RuneEtchAttempt objects.
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
      divisibility: divisibility ? Number(divisibility) : undefined,
      premine: premine || undefined,
      symbol: symbol || undefined,
      cap: cap || undefined,
      amount: amount || undefined,
      offsetStart: offsetStart || undefined,
      offsetEnd: offsetEnd || undefined,
      heightStart: heightStart || undefined,
      heightEnd: heightEnd || undefined,
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

/**
 * Converts CatTraits into a compact format with all colors suitable for storage in the database.
 *
 * @param traits The CatTraits object to convert.
 * @returns Compact representation of the cat colors.
 */
export function traitsToCompactColors(traits: CatTraits): {
  catColors: string;
  backgroundColors: string;
  glassesColors: string;
} {
  return {
    catColors: traits.catColors.join(';').replace(/#/g, ''),
    backgroundColors: traits.backgroundColors.join(';').replace(/#/g, ''),
    glassesColors: traits.glassesColors.join(';').replace(/#/g, ''),
  };
}

/**
 * Converts compact database fields back into a CatTraits object.
 *
 * @param catColors Compact cat colors.
 * @param backgroundColors Compact background colors.
 * @param glassesColors Compact glasses colors.
 * @returns The full CatTraits object.
 */
export function compactColorsToTraits(
  catColors: string,
  backgroundColors: string,
  glassesColors: string
): Partial<CatTraits> {
  return {
    catColors: catColors.split(';').map(color => `#${color}`),
    backgroundColors: backgroundColors.split(';').map(color => `#${color}`),
    glassesColors: glassesColors.split(';').map(color => `#${color}`)
  };
}

/**
 * Constructs a `Cat21Mint` object from a parsed CAT-21 object and its associated transaction details.
 *
 * @param cat - The parsed CAT-21 object containing the traits of the CAT-21 mint.
 * @param txIndex - The index of the transaction within the block.
 * @param tx - The detailed transaction object containing status, outputs, and other metadata.
 * @returns A `Cat21Mint` object if traits are present; otherwise, `null`.
 *
 * @remarks
 * - The `number` field will be populated later based on the ordering of transactions.
 * - The `sat` field requires an external query to determine the number of the first satoshi in the transaction.
 * - Uses 'ERROR' as a fallback for missing or invalid `blockId` and `firstOwner`. These cases should never happen in practice.
 * - Returns `null` if the CAT-21 traits are unavailable (should never happen in practice).
 */
export function constructCat21Mint(
  cat: ParsedCat21,
  txIndex: number,
  tx: TransactionSimplePlus): Cat21Mint | null {

    const traits = cat.getTraits();

    if (!traits) {
      return null;
    }

    const catMint: Cat21Mint = {
      transactionId: tx.txid,
      blockId: tx.status.block_hash || 'ERROR', // 'ERROR' should never happen
      txIndex,
      number: undefined, // Numbering will be done later
      feeRate: tx.fee / (tx.weight / 4),
      blockHeight: tx.status.block_height || -1, // -1 should never happen
      blockTime: tx.status.block_time || -1, // -1 should never happen
      fee: tx.fee,
      size: tx.size,
      weight: tx.weight,
      value: tx.vout[0]?.value ?? -1, // -1 should never happen
      sat: undefined, // must be added later -- requires external query for sat number
      firstOwner: tx.vout[0]?.scriptpubkey_address ?? 'ERROR', // 'ERROR' should never happen
      traits,
    };

    return catMint;
}

/**
 * Converts a compact string to an array of MinimalCat21Mint objects.
 *
 * @param compact - A string in the format: "transactionId|fee|weight,transactionId2|fee2|weight2,...".
 * @returns An array of MinimalCat21Mint objects.
 * @throws An error if the compact format is invalid or missing required fields.
 */
export function compactToMinimalCat21Mints(compact: string): MinimalCat21Mint[] {
  if (!compact) {
    return [];
  }

  return compact.split(',').map((entry) => {
    const [transactionId, fee, weight] = entry.split('|', 3);

    return {
      transactionId,
      fee: parseInt(fee, 10),
      weight: parseInt(weight, 10),
    };
  });
}

/**
 * Converts an array of MinimalCat21Mint objects to a compact string.
 *
 * @param mints - An array of MinimalCat21Mint objects.
 * @returns A string in the format: "transactionId|fee|weight,transactionId2|fee2|weight2,...".
 */
export function minimalCat21MintsToCompact(mints: MinimalCat21Mint[]): string {
  return mints
    .map((mint) => `${mint.transactionId}|${mint.fee}|${mint.weight}`)
    .join(',');
}
