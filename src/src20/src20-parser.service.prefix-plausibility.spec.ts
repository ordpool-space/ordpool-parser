import { readTransaction } from '../../testdata/test.helper';
import { StampParserService } from '../stamp/stamp-parser.service';
import { Src20ParserService } from './src20-parser.service';

/**
 * The ARC4 multisig payload starts with a two-byte big-endian content length.
 * Both this parser and the STAMP one read it, slice by it, and then look for
 * the `stamp:` marker. Two things have to hold for that to be sound:
 *
 * 1. The declared length must fit the payload. `Uint8Array.slice` clamps past
 *    the end, so an absurd length does not throw, it silently yields the rest
 *    of the buffer and the marker test still runs against it.
 * 2. The marker has to sit at the START. A Counterparty message carries
 *    `stamp:<base64>` somewhere inside it, so a substring test matches any
 *    Counterparty-encoded stamp and stores its raw message as SRC-20 content.
 *
 * Without both, a Counterparty issuance is reported as an SRC-20 artifact whose
 * content is the undecoded message. The Counterparty parser already handles
 * those transactions correctly; this path only needs to stay out of the way.
 *
 * Fixtures are real mainnet transactions, captured from
 * https://api.ordpool.space/api/tx/<txid> on 2026-10-27.
 */
describe('ARC4 multisig: the length prefix must be plausible and the marker must lead', () => {

  /**
   * Counterparty issuance, block 793069. ARC4 decrypts to a `CNTRPRTY` message,
   * and the two prefix bytes are `3d 43` ('=' and 'C'), so the prefix eats the
   * `C` of `CNTRPRTY` and declares a length of 15683 for a 124-byte payload.
   * The leftover text contains `stamp:eyJwIjoic3JjLTIwIi...` further in, which
   * a substring test used to accept, storing `NTRPRTY\x14Q...` as SRC-20.
   */
  const COUNTERPARTY_OVERGRAB = 'd90721e3e232f94877d6baac4ee93f8d496895bccbbafb41496389a380783958';

  /** Earliest ARC4 multisig stamp on mainnet, block 793487. Prefix 00 45 = 69. */
  const CLEAN_EARLY = '50aeb77245a9483a5b077e4e7506c331dc2f628c22046e7d2b4c6ad6c6236ae1';

  /** SRC-101 mint, block 871152. Prefix 01 b3 = 435, a high byte in the prefix. */
  const CLEAN_SRC101 = 'c18be47b3dc5c7a74487dd8baec7c1c4c5ff664235b757260864cc7b34250ef8';

  describe('a Counterparty message is not an SRC-20 artifact', () => {

    it('rejects it instead of storing the raw CNTRPRTY message as content', () => {
      expect(Src20ParserService.parse(readTransaction(COUNTERPARTY_OVERGRAB))).toBeNull();
    });

    it('rejects it in the STAMP path too', () => {
      expect(StampParserService.parse(readTransaction(COUNTERPARTY_OVERGRAB))).toBeNull();
    });
  });

  /**
   * Real SRC-20 mint, block 852131. Prefix 00 3e declares 62 content bytes
   * while the whole payload is 62 bytes, so only 60 are available and the
   * trailing `"}` of the JSON is not on chain. The truncation is the
   * transaction's own: its single multisig output carries three pubkeys, and
   * reading the third adds `wy` rather than the missing characters, so the
   * two-pubkey extraction is right and the data is simply short.
   *
   * `slice` clamps, so the parser reports what the bytes say. A bounds check
   * on the declared length would reject this transaction outright, which is
   * why neither path has one.
   */
  const UNPADDED_OVERRUN = '0e1c4d6fcf195d2f46d166455a6766f43523487b261da4be0dc6b14df2e759c7';

  describe('real stamps keep working', () => {

    it('reports a real mint whose declared length overruns the payload', () => {
      const src20 = Src20ParserService.parse(readTransaction(UNPADDED_OVERRUN));

      expect(src20).not.toBeNull();
      expect(src20!.getContent()).toBe('{"p":"src-20","op":"mint","tick":"abcde","amt":"100000');
    });

    it('parses the earliest ARC4 multisig stamp', () => {
      const src20 = Src20ParserService.parse(readTransaction(CLEAN_EARLY));

      expect(src20).not.toBeNull();
      expect(src20!.getContent()).toBe('{"p":"src-20","op":"transfer","tick":"STEVE","amt":"100000000"}');
    });

    it('parses the SRC-101 mint whose prefix carries a high byte', () => {
      const stamp = StampParserService.parse(readTransaction(CLEAN_SRC101));

      expect(stamp).not.toBeNull();
      expect(stamp!.type).toBe('Src101');
      expect(stamp!.getContent().startsWith('{"p":"src-101","op":"mint","hash":"')).toBe(true);
    });

    it('gives SRC-20 the same undamaged SRC-101 payload', () => {
      const src20 = Src20ParserService.parse(readTransaction(CLEAN_SRC101));

      expect(src20).not.toBeNull();
      expect(src20!.getContent().length).toBe(429);
      expect(src20!.getContent()).not.toContain('NTRPRTY');
    });
  });
});
