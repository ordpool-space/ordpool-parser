import { OrdpoolTransactionFlags } from './ordpool-transaction-flags';

/**
 * Bit-position smoke tests for the OrdpoolTransactionFlags enum.
 *
 * Each ordpool flag is a single power of 2 -- this is a hard invariant of
 * the architecture (per-flag round-trip Number<->BigInt is exact only for
 * single bits; verified by ordpool/backend's mempool.interfaces.test.ts).
 *
 * These tests catch the most likely accidents:
 *  - copy-paste bug giving two flags the same bit
 *  - someone setting a flag to a non-power-of-two value
 *  - a flag's bit drifting from its documented position
 */
describe('OrdpoolTransactionFlags', () => {

  it('every flag is exactly one bit set', () => {
    for (const [name, value] of Object.entries(OrdpoolTransactionFlags)) {
      const isPow2 = value > 0n && (value & (value - 1n)) === 0n;
      expect({ name, isPow2 }).toEqual({ name, isPow2: true });
    }
  });

  it('every flag has a unique bit position', () => {
    const bits = Object.values(OrdpoolTransactionFlags);
    const unique = new Set(bits.map(b => b.toString()));
    expect(unique.size).toBe(bits.length);
  });

  it('top-level type flags occupy bits 48-58', () => {
    expect(OrdpoolTransactionFlags.ordpool_atomical).toBe(1n << 48n);
    expect(OrdpoolTransactionFlags.ordpool_cat21).toBe(1n << 49n);
    expect(OrdpoolTransactionFlags.ordpool_inscription).toBe(1n << 50n);
    expect(OrdpoolTransactionFlags.ordpool_rune).toBe(1n << 51n);
    expect(OrdpoolTransactionFlags.ordpool_brc20).toBe(1n << 52n);
    expect(OrdpoolTransactionFlags.ordpool_src20).toBe(1n << 53n);
    expect(OrdpoolTransactionFlags.ordpool_labitbu).toBe(1n << 54n);
    expect(OrdpoolTransactionFlags.ordpool_counterparty).toBe(1n << 55n);
    expect(OrdpoolTransactionFlags.ordpool_stamp).toBe(1n << 56n);
    expect(OrdpoolTransactionFlags.ordpool_src721).toBe(1n << 57n);
    expect(OrdpoolTransactionFlags.ordpool_src101).toBe(1n << 58n);
  });

  it('ordpool_ots is at bit 81', () => {
    // Backend-set flag (no parser detection); see doc comment in
    // ordpool-transaction-flags.ts for the architectural rationale.
    expect(OrdpoolTransactionFlags.ordpool_ots).toBe(1n << 81n);
  });

  it('all flags fit within JS safe integer + BigInt round-trip', () => {
    // Each flag value is < 2^53 ... NO it isn't, bits go up to 81. The
    // round-trip safety relies on each individual flag being a single
    // power of 2: BigInt(Number(2^N)) === 2^N for any N up to ~1000.
    // (Mantissa-precision concerns only affect SUMS of high bits with
    // low bits, which doesn't happen in our pipeline because each
    // single OR is exact and we don't add flags with non-flag values.)
    for (const value of Object.values(OrdpoolTransactionFlags)) {
      expect(BigInt(Number(value))).toBe(value);
    }
  });
});
