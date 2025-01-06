import { getUnlockedRuneNameRange, isReservedRuneName, isRuneNameUnlocked, isValidRuneName, removeSpacers, validateRuneEtchingSpec } from "./rune-parser.service.helper";
import { U128_MAX_BIGINT } from "./src/integer/u128";
import { U64_MAX_BIGINT } from "./src/integer/u64";
import { Network } from "./src/network";

describe('removeSpacers', () => {
  it('should remove all spacers (•) from the rune name', () => {
    const runeNameWithSpacers = 'Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z';
    const expectedOutput = 'ZZZZZFEHUZZZZZ';
    expect(removeSpacers(runeNameWithSpacers)).toBe(expectedOutput);
  });

  it('should return the same string if there are no spacers', () => {
    const runeNameWithoutSpacers = 'ZZZZZFEHUZZZZZ';
    expect(removeSpacers(runeNameWithoutSpacers)).toBe(runeNameWithoutSpacers);
  });

  it('should return an empty string if the input is an empty string', () => {
    expect(removeSpacers('')).toBe('');
  });
});

describe('isValidRuneName', () => {

  it('should return true for a valid rune name', () => {
    const result = isValidRuneName('VALIDRUNE');
    expect(result).toBe(true);
  });

  it('should return false for a rune name with invalid characters', () => {
    const result = isValidRuneName('INVALID•RUNE');
    expect(result).toBe(false);
  });

  it('should return false for a rune name with lower-case letters', () => {
    const result = isValidRuneName('invalidrune');
    expect(result).toBe(false);
  });

  it('should return false for a rune name with numbers or special characters', () => {
    const result = isValidRuneName('RUNE123');
    expect(result).toBe(false);
  });

  it('should return true for a rune name that is reserved', () => {
    const result = isValidRuneName('DOGDOGDOGDOGDOGDOGDOGDOGDOG');
    expect(result).toBe(true);
  });

  it('should return false for a rune name name that is too long', () => {
    // error: Trying to unwrap None
    const result = isValidRuneName('DOGDOGDOGDOGDOGDOGDOGDOGDOGDOGDOGDOGDOGDOGDOGDOGDOGDOG');
    expect(result).toBe(false);
  });
});


describe('isReservedRuneName', () => {

  it('should return false for a non-reserved rune name', () => {
    const result = isReservedRuneName('VALIDRUNE');
    expect(result).toBe(false);
  });

  it('should return true for a rune name that is reserved', () => {
    const result = isReservedRuneName('DOGDOGDOGDOGDOGDOGDOGDOGDOG');
    expect(result).toBe(true);
  });
});


describe('isRuneNameUnlocked', () => {

  it('should return false if etching hasn\'t started', () => {
    const runeName = 'ZZZZZFEHUZZZZZ';
    const blockHeight = 840_000 - 1;
    const network = Network.MAINNET;

    const result = isRuneNameUnlocked(runeName, blockHeight, network);
    expect(result).toBe(false);
  });


  it('should return true if the rune is longer than required', () => {
    const runeName = 'ZZZZZFEHUZZZZZ';
    const blockHeight = 840_000;
    const network = Network.MAINNET;

    const result = isRuneNameUnlocked(runeName, blockHeight, network);
    expect(result).toBe(true);
  });

  /*
   * Rune names unlocked in 840000: from ZZZZZZZZZZZZ to ZZYZXBRKWXVA
   */
  it('should return true if the rune is unlocked at the given block height', () => {
    const runeName = 'ZZZZZZZZZZZZ';
    const blockHeight = 840_000;
    const network = Network.MAINNET;

    const result = isRuneNameUnlocked(runeName, blockHeight, network);
    expect(result).toBe(true);
  });

  /*
   * Rune names unlocked in 840000: from ZZZZZZZZZZZZ to ZZYZXBRKWXVA
   * Rune names unlocked in 840001: from ZZYZXBRKWXUZ to ZZXZUDIVTVQA
   */
  it('should return false if the rune is not yet unlocked at the given block height', () => {
    const runeName = 'ZZYZXBRKWXUZ'; // would unlock next block
    const blockHeight = 840_000;
    const network = Network.MAINNET;

    const result = isRuneNameUnlocked(runeName, blockHeight, network);
    expect(result).toBe(false);
  });

  it('should return true for a reserved rune name, because this is already handled by isReservedRuneName', () => {
    const runeName = 'AAAAAAAAAAAAAAAAAAAAAAAAAAA'; // Reserved rune name
    const blockHeight = 840_000;
    const network = Network.MAINNET;

    const result = isRuneNameUnlocked(runeName, blockHeight, network);
    expect(result).toBe(true);
  });

  /*
   * B unlocks at block 1,049,326
   */
  it('should return true for rune name B at block 1,049,326 - 1', () => {
    const runeName = 'B';
    const blockHeight = 1_049_326 - 1;
    const network = Network.MAINNET;

    const result = isRuneNameUnlocked(runeName, blockHeight, network);
    expect(result).toBe(false);
  });

  /*
   * B unlocks at block 1,049,326
   */
  it('should return true for rune name B at block 1,049,326', () => {
    const runeName = 'B';
    const blockHeight = 1_049_326;
    const network = Network.MAINNET;

    const result = isRuneNameUnlocked(runeName, blockHeight, network);
    expect(result).toBe(true);
  });

  /*
   * A unlocks at block 1,049,999
   */
  it('should return true for the minimum rune name A', () => {
    const runeName = 'A'; // Smallest possible rune name
    const blockHeight = 1_049_999;
    const network = Network.MAINNET;

    const result = isRuneNameUnlocked(runeName, blockHeight, network);
    expect(result).toBe(true);
  });

  /*
   * A unlocks at block 1,049,999
   */
  it('should return true for all blocks after 1_049_999', () => {
    const runeName = 'ZZ';
    const blockHeight = 1_049_999 + 1;
    const network = Network.MAINNET;

    const result = isRuneNameUnlocked(runeName, blockHeight, network);
    expect(result).toBe(true);
  });
});


describe('getUnlockedRuneNameRange', () => {

  it('should return no range for block 840,000 - 10,000, because etching hasn\'t started', () => {
    const blockHeight = 840_000 - 10_000;
    const network = Network.MAINNET;

    const range = getUnlockedRuneNameRange(blockHeight, network);

    expect(range.from).toBeNull();
    expect(range.to).toBeNull();
  });

  it('should return no range for block 839,999, because etching hasn\'t started', () => {
    const blockHeight = 839_999;
    const network = Network.MAINNET;

    const range = getUnlockedRuneNameRange(blockHeight, network);

    expect(range.from).toBeNull();
    expect(range.to).toBeNull();
  });

  it('should return the correct range for block 840,000', () => {
    const blockHeight = 840_000;
    const network = Network.MAINNET;

    const range = getUnlockedRuneNameRange(blockHeight, network);

    expect(range.from).toBe('ZZZZZZZZZZZZ');
    expect(range.to).toBe('ZZYZXBRKWXVA');
  });

  it('should return the correct range for block 840,001', () => {
    const blockHeight = 840_001;
    const network = Network.MAINNET;

    const range = getUnlockedRuneNameRange(blockHeight, network);

    expect(range.from).toBe('ZZYZXBRKWXUZ');
    expect(range.to).toBe('ZZXZUDIVTVQA');
  });

  it('should return the correct range for block 860,879', () => {
    const blockHeight = 860_879;
    const network = Network.MAINNET;

    const range = getUnlockedRuneNameRange(blockHeight, network);

    expect(range.from).toBe('UZMIMATEEAD');
    expect(range.to).toBe('UZLIJCKPAXZ');
  });

  it('should return a range for block 1,049,326, because B is unlocked', () => {
    const blockHeight = 1_049_326;
    const network = Network.MAINNET;

    const range = getUnlockedRuneNameRange(blockHeight, network);

    expect(range.from).toBe('B');
    expect(range.to).toBe('B');
  });

  it('should return no range for block 1,049,327, because there is no unlock', () => {
    const blockHeight = 1_049_327; // one block after B
    const network = Network.MAINNET;

    const range = getUnlockedRuneNameRange(blockHeight, network);

    expect(range.from).toBeNull();
    expect(range.to).toBeNull();
  });

  it('should return no range for block 1,049,329, because there is no unlock', () => {
    const blockHeight = 1_049_329;
    const network = Network.MAINNET;

    const range = getUnlockedRuneNameRange(blockHeight, network);

    expect(range.from).toBeNull();
    expect(range.to).toBeNull();
  });

  it('should return no range for block 1,050,000, because there are no unlocks anymore', () => {
    const blockHeight = 1_050_000;
    const network = Network.MAINNET;

    const range = getUnlockedRuneNameRange(blockHeight, network);

    expect(range.from).toBeNull();
    expect(range.to).toBeNull();
  });

  it('should return no range for block 1,050,000 + 10,000, because there are no unlocks anymore', () => {
    const blockHeight = 1_050_000 + 10_000;
    const network = Network.MAINNET;

    const range = getUnlockedRuneNameRange(blockHeight, network);

    expect(range.from).toBeNull();
    expect(range.to).toBeNull();
  });

});

describe('validateRuneEtchingSpec', () => {
  it('should accept a valid premine within the u128 range', () => {
    const validSpec = { premine: 1000000000000000000000000000n };
    const result = validateRuneEtchingSpec(validSpec);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should reject a premine value exceeding u128 max value', () => {
    const invalidSpec = { premine: U128_MAX_BIGINT + 1n };
    const result = validateRuneEtchingSpec(invalidSpec);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`Invalid premine: Must be a bigint between 0 and ${U128_MAX_BIGINT}.`);
  });

  it('should reject offset and height values exceeding u64 max value', () => {
    const invalidSpec = {
      terms: {
        offset: { start: U64_MAX_BIGINT + 1n },
        height: { end: U64_MAX_BIGINT + 1n },
      },
    };
    const result = validateRuneEtchingSpec(invalidSpec);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`Invalid offset.start: Must be a bigint between 0 and ${U64_MAX_BIGINT}.`);
    expect(result.errors).toContain(`Invalid height.end: Must be a bigint between 0 and ${U64_MAX_BIGINT}.`);
  });

  it('should reject negative offset and height values', () => {
    const invalidSpec = {
      terms: {
        offset: { start: -1n },
        height: { end: -1n },
      },
    };
    const result = validateRuneEtchingSpec(invalidSpec);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`Invalid offset.start: Must be a bigint between 0 and ${U64_MAX_BIGINT}.`);
    expect(result.errors).toContain(`Invalid height.end: Must be a bigint between 0 and ${U64_MAX_BIGINT}.`);
  });

  it('should accept valid offset and height values within the u64 range', () => {
    const validSpec = {
      terms: {
        offset: { start: 0n, end: U64_MAX_BIGINT },
        height: { start: 1n, end: U64_MAX_BIGINT },
      },
    };
    const result = validateRuneEtchingSpec(validSpec);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should accept valid symbols, including multi-byte Unicode characters', () => {
    const validSpec = { symbol: '🔶' }; // Multi-byte Unicode character
    const result = validateRuneEtchingSpec(validSpec);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should reject invalid symbols', () => {
    const invalidSpec = { symbol: 'AB' }; // More than one character
    const result = validateRuneEtchingSpec(invalidSpec);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid symbol: Must be a single Unicode character.');
  });
});
