import { RunestoneSpec } from '.';
import { RuneEtchingSpec } from './src/etching';
import { u128 } from './src/integer';
import { U128_MAX_BIGINT } from './src/integer/u128';
import { U64_MAX_BIGINT } from './src/integer/u64';
import { U8_MAX_BIGINT } from './src/integer/u8';
import { Network } from './src/network';
import { Rune } from './src/rune';

/**
 * For runes the spacers (•) are not part of the actual rune name or its numerical representation.
 * They are used for visual separation of characters in the rune name but do not have any effect on the underlying value or commitment.
 * Thus, when we want to extract the commitment from the rune name, we should first remove all the spacers (•) from the string.
 *
 * @param runeName (with spacers)
 * @returns runeName (without spacers)
 */
export function removeSpacers(runeName: string): string {
  return runeName.replace(/•/g, '');
}

/**
 * Enum to represent possible flaws when validating a rune
 */
export enum RuneFlaw {
  NO_RUNE_ETCHING_PROVIDED = 'NoRuneEtchingProvided',
  INVALID_RUNE_ETCHING_SPEC = 'InvalidRuneEtchingSpec',
  INVALID_RUNE_NAME = 'InvalidRuneName',
  RESERVED_RUNE_NAME = 'ReservedRuneName',
  RUNE_NOT_UNLOCKED = 'RuneNotUnlocked',
  COMMITMENT_NOT_FOUND = 'CommitmentNotFound',
  INPUT_NOT_TAPROOT = 'InputNotTaproot',
  COMMITMENT_TOO_RECENT = 'CommitmentTooRecent'
}

/**
 * Validates if a rune name is valid (i.e. properly formatted).
 * @param cleanedRuneName - The rune name to validate (without spacers).
 * @returns boolean - True if the rune name is valid, false otherwise.
 */
export function isValidRuneName(cleanedRuneName: string): boolean {

  // Try to convert to rune number
  let rune;
  try {
    rune = Rune.fromString(cleanedRuneName);
  } catch (error) {
    return false; // Invalid characters or structure or Trying to unwrap None.
  }

  return true; // Rune name is valid
}

/**
 * Validates if a rune name is reserved
 * (equal or larger than 6402364363415443603228541259936211926n / AAAAAAAAAAAAAAAAAAAAAAAAAAA).
 *
 * @param cleanedRuneName - The rune name to validate (without spacers).
 * @returns boolean - True if the rune name is reserved, false otherwise.
 */
export function isReservedRuneName(cleanedRuneName: string): boolean {
  const rune = Rune.fromString(cleanedRuneName);
  return rune.reserved;
}

/**
 * Checks if a rune name is unlocked at the given block height.
 *
 * @param cleanedRuneName - The rune name to validate (without spacers).
 * @param blockHeight - The current block height.
 * @param network - The network (Bitcoin, Testnet, etc.).
 * @returns boolean - True if the rune name is unlocked, false otherwise.
 */
export function isRuneNameUnlocked(cleanedRuneName: string, blockHeight: number, network: Network): boolean {

  const firstRuneHeight = Network.getFirstRuneHeight(network);
  if (blockHeight < firstRuneHeight) {
    return false;
  }

  const rune = Rune.fromString(cleanedRuneName);

  // not required here
  // if (rune.reserved) {
  //   return false;
  // }

  // Get the minimum unlocked rune at the given block height
  const minimumRune = Rune.getMinimumAtHeight(network, u128(BigInt(blockHeight)));

  // Check if the rune is unlocked at the current block height
  return rune.value >= minimumRune.value;
}

/**
 * Returns the range of unlocked rune names for a given block height.
 *
 * @param blockHeight - The block height to calculate the range of unlocked rune names.
 * @param network - The network (Bitcoin, Testnet, etc.).
 * @returns An object containing the minimum and maximum rune names unlocked for the given block height.
 */
export function getUnlockedRuneNameRange(blockHeight: number, network: Network): { from: string | null, to: string | null } {

  // Get the minimum rune name unlocked at the previous block height
  const minRuneAtPreviousBlock = Rune.getMinimumAtHeight(network, u128(BigInt(blockHeight - 1)));

  // all runes have been unlocked
  if (minRuneAtPreviousBlock.value === 0n) {
    return { from: null, to: null };
  }

  // Directly subtract 1 from the u128 value (not using an Option<u128>, since we're sure it won't underflow)
  const fromRune = new Rune(u128(minRuneAtPreviousBlock.value - 1n));

  // Get the minimum rune name unlocked at the current block height
  const minRuneAtBlock = Rune.getMinimumAtHeight(network, u128(BigInt(blockHeight)));

  // Check if the current and previous minimum runes are the same, indicating no unlock.
  if (minRuneAtBlock.value === minRuneAtPreviousBlock.value) {
    // No new rune is unlocked in this block
    return { from: null, to: null };
  }

  return {
    from: fromRune.toString(),
    to: minRuneAtBlock.toString()
  };
}

/**
 * A commitment [...] present in an input witness tapscript where the output being spent
 * has at least SIX CONFIRMATIONS.
 *
 * See etched MEME•ECONOMICS
 * https://ordinals.com/tx/35a7bd239cf0809889a9a32aab20464cde07804f786c5d179bc0f336dd872915
 * where 840,000 - 839,995 == 5
 */
export function commitmentHasAtLeast6Confirmations(transactionBlockHeight: number | undefined, commitmentBlockHeight: number | undefined) {

  // transactions haven't confirmed, let's assume everything will be fine when confirmed
  if (!transactionBlockHeight || !commitmentBlockHeight) {
    return true;
  }

  // we also count the own confirmation, so it's a 5 (FIVE) here
  // jep, that's confusing, but this is how ord handles this :D
  const hasAtLeast6Confirmations = (transactionBlockHeight - commitmentBlockHeight) >= 5;

  return hasAtLeast6Confirmations;
}

/**
 * Returns true, if the given runestone is a mint for the only hardcoded rune UNCOMMON•GOODS, false otherwise
 */
export function isUncommonGoodsMint(runestone: RunestoneSpec) {
  return runestone?.mint?.block === 1n && runestone?.mint?.tx === 0;
}

/**
 * Validates a RuneEtchingSpec object to ensure its properties are within the allowed ranges.
 * The validation is based on the Rust data types provided for Runestones:
 *
 * struct Etching {
 *   divisibility: Option<u8>,
 *   premine: Option<u128>,
 *   rune: Option<Rune>,
 *   spacers: Option<u32>,
 *   symbol: Option<char>,
 *   terms: Option<Terms>,
 * }
 *
 * Which may contain mint terms:
 *
 * struct Terms {
 *   amount: Option<u128>,
 *   cap: Option<u128>,
 *   height: (Option<u64>, Option<u64>),
 *   offset: (Option<u64>, Option<u64>),
 * }
 *
 * Note: This check might be not required at all.
 *
 * @param spec - The RuneEtchingSpec object to validate.
 * @returns An object containing a `valid` flag and an array of validation error messages.
 */
export function validateRuneEtchingSpec(spec: RuneEtchingSpec): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate premine (u128: 0-340282366920938463463374607431768211455n)
  if (spec.premine !== undefined) {
    if (typeof spec.premine !== 'bigint' || spec.premine < 0n || spec.premine > U128_MAX_BIGINT) {
      errors.push(`Invalid premine: Must be a bigint between 0 and ${U128_MAX_BIGINT}.`);
    }
  }

  // Validate divisibility (u8: 0-255)
  if (spec.divisibility !== undefined) {
    if (!Number.isInteger(spec.divisibility) || spec.divisibility < 0 || spec.divisibility > 255) {
      errors.push('Invalid divisibility: Must be an integer between 0 and 255.');
    }
  }

  // Validate terms
  if (spec.terms) {
    const { cap, amount, offset, height } = spec.terms;

    if (cap !== undefined && (typeof cap !== 'bigint' || cap < 0n || cap > U128_MAX_BIGINT)) {
      errors.push(`Invalid cap: Must be a bigint between 0 and ${U128_MAX_BIGINT}.`);
    }

    if (amount !== undefined && (typeof amount !== 'bigint' || amount < 0n || amount > U128_MAX_BIGINT)) {
      errors.push(`Invalid amount: Must be a bigint between 0 and ${U128_MAX_BIGINT}.`);
    }

    if (offset) {
      const { start, end } = offset;
      if (start !== undefined && (typeof start !== 'bigint' || start < 0n || start > U64_MAX_BIGINT)) {
        errors.push(`Invalid offset.start: Must be a bigint between 0 and ${U64_MAX_BIGINT}.`);
      }
      if (end !== undefined && (typeof end !== 'bigint' || end < 0n || end > U64_MAX_BIGINT)) {
        errors.push(`Invalid offset.end: Must be a bigint between 0 and ${U64_MAX_BIGINT}.`);
      }
    }

    if (height) {
      const { start, end } = height;
      if (start !== undefined && (typeof start !== 'bigint' || start < 0n || start > U64_MAX_BIGINT)) {
        errors.push(`Invalid height.start: Must be a bigint between 0 and ${U64_MAX_BIGINT}.`);
      }
      if (end !== undefined && (typeof end !== 'bigint' || end < 0n || end > U64_MAX_BIGINT)) {
        errors.push(`Invalid height.end: Must be a bigint between 0 and ${U64_MAX_BIGINT}.`);
      }
    }
  }

  // Validate symbol (must be a valid single Unicode character)
  if (spec.symbol !== undefined) {
    if (typeof spec.symbol !== 'string' || [...spec.symbol].length !== 1) {
      errors.push('Invalid symbol: Must be a single Unicode character.');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitizes a value to ensure it falls within the range of an unsigned 8-bit integer (0 to 255).
 * Returns `null` for invalid, out-of-range, or `undefined` values.
 *
 * @param value - The input value to sanitize.
 * @returns A number between 0 and 255, or `null` for invalid, out-of-range, or `undefined` values.
 */
export function sanitizeU8(value: number | undefined): number | null {
  if (value === undefined || !Number.isInteger(value) || value < 0 || value > Number(U8_MAX_BIGINT)) {
    return null;
  }
  return value;
}

/**
 * Sanitizes a value to ensure it falls within the range of an unsigned 64-bit integer (0 to 2^64 - 1).
 * Returns `null` for invalid, out-of-range, or `undefined` values.
 *
 * @param value - The input value to sanitize (number or bigint).
 * @returns A bigint between 0n and 2^64 - 1, or `null` for invalid, out-of-range, or `undefined` values.
 */
export function sanitizeU64(value: number | bigint | undefined): bigint | null {
  if (value === undefined) {
    return null;
  }
  try {
    const bigValue = BigInt(value);
    if (bigValue < 0n || bigValue > U64_MAX_BIGINT) return null;
    return bigValue;
  } catch {
    return null; // Non-convertible values are invalid
  }
}

/**
 * Sanitizes a value to ensure it falls within the range of an unsigned 128-bit integer (0 to 2^128 - 1).
 * Returns `null` for invalid, out-of-range, or `undefined` values.
 *
 * @param value - The input value to sanitize (number or bigint).
 * @returns A bigint between 0n and 2^128 - 1, or `null` for invalid, out-of-range, or `undefined` values.
 */
export function sanitizeU128(value: number | bigint | undefined): bigint | null {
  if (value === undefined) {
    return null;
  }
  try {
    const bigValue = BigInt(value);
    if (bigValue < 0n || bigValue > U128_MAX_BIGINT) return null;
    return bigValue;
  } catch {
    return null; // Non-convertible values are invalid
  }
}

