import { convertToActivities, convertToAttempts, isFlagSetOnTransaction, parseJsonObject } from "./digital-artifact-analyser.service.helper";
import { OrdpoolTransactionFlags } from "./types/ordpool-transaction-flags";


export const TransactionFlags = {
  rbf: 0b00000001n
}

describe('isFlagSetOnTransaction', () => {

  it('should return true if ordpool_inscription flag is set', () => {
    const exampleTransaction = { flags: Number(0b00000100_00000000_00000000_00000000_00000000_00000000_00000000n) };
    expect(isFlagSetOnTransaction(exampleTransaction, OrdpoolTransactionFlags.ordpool_inscription)).toBe(true);
  });

  it('should return false if ordpool_inscription flag is not set', () => {
    const exampleTransaction = { flags: Number(0b00000000_00000000_00000000_00000000_00000000_00000000_00000000n) };
    expect(isFlagSetOnTransaction(exampleTransaction, OrdpoolTransactionFlags.ordpool_inscription)).toBe(false);
  });

  it('should return true if multiple flags including ordpool_inscription are set', () => {
    const exampleTransaction = { flags:  Number(0b00000100_00000000_00000000_00000000_00000000_00000000_00000001n) };
    expect(isFlagSetOnTransaction(exampleTransaction, OrdpoolTransactionFlags.ordpool_inscription)).toBe(true);
    expect(isFlagSetOnTransaction(exampleTransaction, TransactionFlags.rbf)).toBe(true);
  });

  it('should return false if other flags are set but not ordpool_inscription', () => {
    const exampleTransaction = { flags:  Number(0b00000000_00000000_00000000_00000000_00000000_00000000_00000001n) };
    expect(isFlagSetOnTransaction(exampleTransaction, OrdpoolTransactionFlags.ordpool_inscription)).toBe(false);
    expect(isFlagSetOnTransaction(exampleTransaction, TransactionFlags.rbf)).toBe(true);
  });
});


describe('OrdpoolTransactionFlags conversion tests', () => {

  /*
   * If the BigInt is too large, it can't be represented by a normal number anymore.
   * The purpose of this test is to be sure that we can still do the conversion correctly.
   */
  it('should convert all flags to Number and back to BigInt without error', () => {
    for (const flagName in OrdpoolTransactionFlags) {
      if (Object.prototype.hasOwnProperty.call(OrdpoolTransactionFlags, flagName)) {
        const flagValue = OrdpoolTransactionFlags[flagName as keyof typeof OrdpoolTransactionFlags];
        const flagNumber = Number(flagValue);
        const flagBigInt = BigInt(flagNumber);
        expect(flagBigInt).toBe(flagValue);
      }
    }
  });
});


describe('parseJsonObject', () => {
  it('should parse a valid JSON object', () => {
    const json = '{ "key": "value" }';
    const result = parseJsonObject(json);
    expect(result).toEqual({ key: 'value' });
  });

  it('should parse a nested JSON object', () => {
    const json = '{ "key": { "nestedKey": "nestedValue" } }';
    const result = parseJsonObject(json);
    expect(result).toEqual({ key: { nestedKey: 'nestedValue' } });
  });

  it('should return null for an empty string', () => {
    const result = parseJsonObject('');
    expect(result).toBeNull();
  });

  it('should return null for non-object JSON (e.g., array)', () => {
    const json = '[1, 2, 3]';
    const result = parseJsonObject(json);
    expect(result).toBeNull();
  });

  it('should return null for non-object JSON (e.g., number)', () => {
    const json = '12345';
    const result = parseJsonObject(json);
    expect(result).toBeNull();
  });

  it('should return null for non-object JSON (e.g., string)', () => {
    const json = '"This is a string"';
    const result = parseJsonObject(json);
    expect(result).toBeNull();
  });

  it('should return null for invalid JSON (keys and values must be quoted)', () => {
    const json = '{ key: value }';
    const result = parseJsonObject(json);
    expect(result).toBeNull();
  });

  it('should parse a JSON object with leading and trailing spaces', () => {
    const json = '    { "key": "value" }    ';
    const result = parseJsonObject(json);
    expect(result).toEqual({ key: 'value' });
  });

  it('should return null for a string that looks like an object but is not valid JSON (Missing quotes around "key")', () => {
    const json = '{ key: "value" }';
    const result = parseJsonObject(json);
    expect(result).toBeNull();
  });

  it('should return null for malformed JSON with extra characters', () => {
    const json = '{ "key": "value" some extra text }';
    const result = parseJsonObject(json);
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    const result = parseJsonObject(null as unknown as string);
    expect(result).toBeNull();
  });

  it('should return null for non-string input (e.g., number)', () => {
    const result = parseJsonObject(12345 as unknown as string);
    expect(result).toBeNull();
  });

  it('should return null for non-string input (e.g., object)', () => {
    const result = parseJsonObject({ key: 'value' } as unknown as string);
    expect(result).toBeNull();
  });
});

describe('convertToActivities', () => {
  it('should convert an object to Activities format', () => {
    const data = { id1: 10, id2: 20, id3: 30 };
    const result = convertToActivities(data);
    expect(result).toEqual([
      ['id1', 10],
      ['id2', 20],
      ['id3', 30],
    ]);
  });

  it('should return an empty array for an empty object', () => {
    const data = {};
    const result = convertToActivities(data);
    expect(result).toEqual([]);
  });
});

describe('convertToAttempts', () => {
  it('should convert an object to Attempts format', () => {
    const data = { id1: ['tx1', 'tx2'], id2: ['tx3'], id3: ['tx4', 'tx5', 'tx6'] };
    const result = convertToAttempts(data);
    expect(result).toEqual([
      ['id1', ['tx1', 'tx2']],
      ['id2', ['tx3']],
      ['id3', ['tx4', 'tx5', 'tx6']],
    ]);
  });

  it('should return an empty array for an empty object', () => {
    const data = {};
    const result = convertToAttempts(data);
    expect(result).toEqual([]);
  });
});
