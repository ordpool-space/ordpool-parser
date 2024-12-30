import { brc20DeployAttemptsToCompact, compactToBrc20DeployAttempts, compactToMintActivity, compactToRuneEtchAttempts, compactToSrc20DeployAttempts, convertToActivities, createRuneEtchAttempt, isFlagSetOnTransaction, mintActivityToCompact, parseJsonObject, runeEtchAttemptsToCompact, src20DeployAttemptsToCompact } from "./digital-artifact-analyser.service.helper";
import { RuneEtchingSpec } from "./rune/src/etching";
import { RuneEtchAttempt } from "./types/ordpool-stats";
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

describe('createRuneEtchAttempt', () => {
  it('should create a valid RuneEtchAttempt object', () => {
    const etchingSpec: RuneEtchingSpec = {
      runeName: 'MyRune',
      divisibility: 10,
      premine: BigInt(1000),
      symbol: 'MR',
      terms: {
        cap: BigInt(21000000),
        amount: BigInt(500),
        offset: { start: BigInt(1), end: BigInt(100) },
        height: { start: BigInt(10), end: BigInt(20) },
      },
      turbo: true,
    };

    const result = createRuneEtchAttempt('tx123', 1000, 1, etchingSpec);

    expect(result).toEqual<RuneEtchAttempt>({
      txId: 'tx123',
      runeId: '1000:1',
      runeName: 'MyRune',
      divisibility: 10,
      premine: BigInt(1000),
      symbol: 'MR',
      cap: BigInt(21000000),
      amount: BigInt(500),
      offsetStart: BigInt(1),
      offsetEnd: BigInt(100),
      heightStart: BigInt(10),
      heightEnd: BigInt(20),
      turbo: true,
    });
  });

  it('should return null if etchingSpec is undefined', () => {
    const result = createRuneEtchAttempt('tx456', 2000, 3, undefined);
    expect(result).toBeNull();
  });

  it('should handle partial EtchingSpec', () => {
    const etchingSpec: RuneEtchingSpec = {
      runeName: 'PartialRune',
      symbol: 'PR',
    };

    const result = createRuneEtchAttempt('tx789', 3000, 4, etchingSpec);

    expect(result).toEqual<RuneEtchAttempt>({
      txId: 'tx789',
      runeId: '3000:4',
      runeName: 'PartialRune',
      divisibility: undefined,
      premine: undefined,
      symbol: 'PR',
      cap: undefined,
      amount: undefined,
      offsetStart: undefined,
      offsetEnd: undefined,
      heightStart: undefined,
      heightEnd: undefined,
      turbo: undefined,
    });
  });
});

describe('RuneEtchAttempt Converters', () => {
  const sampleData: RuneEtchAttempt[] = [
    {
      txId: 'tx123',
      runeId: '12345:1',
      runeName: 'MyRune',
      divisibility: 8,
      premine: BigInt(1000),
      symbol: 'MR',
      cap: BigInt(21000000),
      amount: BigInt(1000),
      offsetStart: BigInt(1),
      offsetEnd: BigInt(100),
      heightStart: BigInt(1000),
      heightEnd: BigInt(2000),
      turbo: true,
    },
    {
      txId: 'tx456',
      runeId: '12346:2',
      turbo: false,
    },
  ];

  it('should convert RuneEtchAttempt to compact string', () => {
    const result = runeEtchAttemptsToCompact(sampleData);
    expect(result).toEqual(
      'tx123|12345:1|MyRune|8|1000|MR|21000000|1000|1|100|1000|2000|1,tx456|12346:2|||||||||||'
    );
  });

  it('should convert compact string back to RuneEtchAttempt', () => {
    const compact = 'tx123|12345:1|MyRune|8|1000|MR|21000000|1000|1|100|1000|2000|1,tx456|12346:2|||||||||||';
    const result = compactToRuneEtchAttempts(compact);
    expect(result).toEqual(sampleData);
  });

  it('should handle empty input for compactToRuneEtchAttempts', () => {
    const result = compactToRuneEtchAttempts('');
    expect(result).toEqual([]);
  });

  it('should handle partially populated data', () => {
    const partialCompact = 'tx789|12347:3|PartialRune|||||||||1|';
    const result = compactToRuneEtchAttempts(partialCompact);
    expect(result).toEqual([
      {
        txId: 'tx789',
        runeId: '12347:3',
        runeName: 'PartialRune',
        divisibility: undefined,
        premine: undefined,
        symbol: undefined,
        cap: undefined,
        amount: undefined,
        offsetStart: undefined,
        offsetEnd: undefined,
        heightStart: undefined,
        heightEnd: BigInt(1),
        turbo: false,
      },
    ]);
  });

  it('should handle empty compact string', () => {
    const result = runeEtchAttemptsToCompact([]);
    expect(result).toEqual('');
  });
});


describe('BRC-20 Deploy Attempts Converter', () => {
  const attempts = [
    { txId: 'tx1', ticker: 'SYMM', maxSupply: '21000000', mintLimit: '1000', decimals: '8' },
    { txId: 'tx2', ticker: 'TEST', maxSupply: '1000000', mintLimit: undefined, decimals: undefined },
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
    { txId: 'tx2', ticker: 'TEST', maxSupply: '50000', mintLimit: '50', decimals: undefined },
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
