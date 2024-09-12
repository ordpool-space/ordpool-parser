import { isFlagSetOnTransaction } from "./digital-artifact-analyser.service.helper";
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
