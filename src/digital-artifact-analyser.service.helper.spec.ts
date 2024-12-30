import { brc20DeployAttemptsToCompact, compactToBrc20DeployAttempts, compactToMintActivity, compactToRuneEtchAttempts, compactToSrc20DeployAttempts, convertToActivities, createRuneEtchAttempt, isFlagSetOnTransaction, mintActivityToCompact, parseJsonObject, runeEtchAttemptsToCompact, src20DeployAttemptsToCompact } from "./digital-artifact-analyser.service.helper";
import { RuneEtchingSpec } from "./rune/src/etching";
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

describe('Mint Activity Converter', () => {
  const activities: [string, number][] = [
    ['840686:2338', 1],
    ['876937:1691', 3113],
    ['1:0', 1],
    ['840000:200', 1],
    ['840000:496', 1],
  ];

  it('should convert to compact format', () => {
    const result = mintActivityToCompact(activities);
    expect(result).toBe('840686:2338,1,876937:1691,3113,1:0,1,840000:200,1,840000:496,1');
  });

  it('should parse from compact format', () => {
    const compact = '840686:2338,1,876937:1691,3113,1:0,1,840000:200,1,840000:496,1';
    const result = compactToMintActivity(compact);
    expect(result).toEqual(activities);
  });

  it('should handle empty input for compactToMintActivity', () => {
    const result = compactToMintActivity('');
    expect(result).toEqual([]);
  });

  it('should handle empty input for mintActivityToCompact', () => {
    const result = mintActivityToCompact([]);
    expect(result).toBe('');
  });
});

describe("createRuneEtchAttempt", () => {

  const mockEtchingSpec: RuneEtchingSpec = {
    runeName: "EXAMPLE",
    divisibility: 8,
    premine: BigInt(100000000),
    symbol: "SYM",
    terms: {
      cap: BigInt(1000000),
      amount: BigInt(100),
      offset: {
        start: BigInt(10),
        end: BigInt(20),
      },
      height: {
        start: BigInt(1000),
        end: BigInt(2000),
      },
    },
    turbo: true,
  };

  it("should create a valid RuneEtchAttempt object", () => {
    const result = createRuneEtchAttempt("abc123", 100, 1, mockEtchingSpec);

    expect(result).toEqual({
      txId: "abc123",
      runeId: "100:1",
      runeName: "EXAMPLE",
      divisibility: 8,
      premine: "100000000",
      symbol: "SYM",
      cap: "1000000",
      amount: "100",
      offsetStart: "10",
      offsetEnd: "20",
      heightStart: "1000",
      heightEnd: "2000",
      turbo: true,
    });
  });

  it("should handle missing optional fields in the etching spec", () => {
    const minimalSpec: RuneEtchingSpec = {
      runeName: "MINIMAL",
    };

    const result = createRuneEtchAttempt("tx123", 200, 2, minimalSpec);

    expect(result).toEqual({
      txId: "tx123",
      runeId: "200:2",
      runeName: "MINIMAL"
    });
  });

  it("should handle bigint fields correctly as strings", () => {
    const result = createRuneEtchAttempt("tx456", 300, 3, {
      ...mockEtchingSpec,
      premine: BigInt(500),
      terms: {
        cap: BigInt(50),
        offset: { start: BigInt(5) },
      },
    });

    expect(result?.premine).toBe("500");
    expect(result?.cap).toBe("50");
    expect(result?.offsetStart).toBe("5");
  });
});

describe('RuneEtchAttempt Converters', () => {
  const attempts = [
    {
      txId: 'tx1',
      runeId: '100:1',
      runeName: 'RUNE1',
      divisibility: 8,
      premine: '100000000',
      symbol: 'SYM',
      cap: '1000000',
      amount: '100',
      offsetStart: '10',
      offsetEnd: '20',
      heightStart: '1000',
      heightEnd: '2000',
      turbo: true,
    },
    {
      txId: 'tx2',
      runeId: '101:1',
      turbo: false,
    },
  ];

  it('should correctly convert RuneEtchAttempt to compact format', () => {
    const result = runeEtchAttemptsToCompact(attempts);
    expect(result).toBe(
      'tx1|100:1|RUNE1|8|100000000|SYM|1000000|100|10|20|1000|2000|1,tx2|101:1|||||||||||'
    );
  });

  it('should correctly parse compact format back to RuneEtchAttempt', () => {
    const compact =
      'tx1|100:1|RUNE1|8|100000000|SYM|1000000|100|10|20|1000|2000|1,tx2|101:1|||||||||||';
    const result = compactToRuneEtchAttempts(compact);

    expect(result).toEqual([
      {
        txId: 'tx1',
        runeId: '100:1',
        runeName: 'RUNE1',
        divisibility: 8,
        premine: '100000000',
        symbol: 'SYM',
        cap: '1000000',
        amount: '100',
        offsetStart: '10',
        offsetEnd: '20',
        heightStart: '1000',
        heightEnd: '2000',
        turbo: true,
      },
      {
        txId: 'tx2',
        runeId: '101:1',
        turbo: false,
      },
    ]);
  });

  it('should handle empty input', () => {
    expect(runeEtchAttemptsToCompact([])).toBe('');
    expect(compactToRuneEtchAttempts('')).toEqual([]);
  });
});

describe('BRC-20 Deploy Attempts Converter', () => {
  const attempts = [
    { txId: 'tx1', ticker: 'SYMM', maxSupply: '21000000', mintLimit: '1000', decimals: '8' },
    { txId: 'tx2', ticker: 'TEST', maxSupply: '1000000' },
  ];

  it('should convert to compact format', () => {
    const result = brc20DeployAttemptsToCompact(attempts);
    expect(result).toBe('tx1|SYMM|21000000|1000|8,tx2|TEST|1000000||');
  });

  it('should parse from compact format', () => {
    const compact = 'tx1|SYMM|21000000|1000|8,tx2|TEST|1000000||';
    const result = compactToBrc20DeployAttempts(compact);
    expect(result).toEqual(attempts);
  });
});

describe('SRC-20 Deploy Attempts Converter', () => {
  const attempts = [
    { txId: 'tx1', ticker: 'STAMP', maxSupply: '100000', mintLimit: '100', decimals: '18' },
    { txId: 'tx2', ticker: 'TEST', maxSupply: '50000', mintLimit: '50' },
  ];

  it('should convert to compact format', () => {
    const result = src20DeployAttemptsToCompact(attempts);
    expect(result).toBe('tx1|STAMP|100000|100|18,tx2|TEST|50000|50|');
  });

  it('should parse from compact format', () => {
    const compact = 'tx1|STAMP|100000|100|18,tx2|TEST|50000|50|';
    const result = compactToSrc20DeployAttempts(compact);
    expect(result).toEqual(attempts);
  });
});
