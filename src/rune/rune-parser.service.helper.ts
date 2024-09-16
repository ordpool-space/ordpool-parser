import { u128 } from './src/integer';
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
  INVALID_RUNE_NAME = 'InvalidRuneName',
  RESERVED_RUNE_NAME = 'ReservedRuneName',
  RUNE_NOT_UNLOCKED = 'RuneNotUnlocked',
  COMMITMENT_NOT_FOUND = 'CommitmentNotFound',
  INPUT_NOT_TAPROOT = 'InputNotTaproot',
  COMMITMENT_TOO_RECENT = 'CommitmentTooRecent',
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
