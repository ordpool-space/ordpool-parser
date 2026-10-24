import { readTransaction } from '../../testdata/test.helper';
import { Src20ParserService } from '../src20/src20-parser.service';
import { StampParserService } from './stamp-parser.service';

/**
 * The ARC4 payload must be decrypted in bytes. Running it through a string
 * (UTF-8 decode, then UTF-8 encode) replaces every byte that cannot start a
 * UTF-8 sequence with U+FFFD, written back as EF BF BD, so one byte becomes
 * three and the two-byte big-endian length prefix read from those same bytes
 * moves.
 *
 * This is the parser-level guard. `src/lib/arc4-lossless.spec.ts` pins the
 * byte-level mechanism, but only a transaction whose length prefix carries a
 * byte >= 0x80 makes a parser visibly disagree with itself, and until this
 * fixture there was none in testdata: reverting the fix left the whole suite
 * green.
 *
 * Fixture: real mainnet SRC-101 mint, block 871152, captured from
 * https://api.ordpool.space/api/tx/c18be47b3dc5c7a74487dd8baec7c1c4c5ff664235b757260864cc7b34250ef8
 * on 2026-10-24. Its payload is 435 bytes, so the prefix is 01 b3.
 *
 * Found by scanning blocks 871120 to 871400 for a stamp whose length prefix has
 * a high byte: 551 of 1544 stamps there qualify. The earlier window 871000 to
 * 871120 has none, because those 133 stamps are templated SRC-20 JSON of 60 to
 * 90 bytes, structurally below 128. The reachable case is a STAMP image, whose
 * size varies freely.
 */
describe('STAMP and SRC-20 decrypt in bytes: real fixture with a high-byte length prefix', () => {

  const TXID = 'c18be47b3dc5c7a74487dd8baec7c1c4c5ff664235b757260864cc7b34250ef8';

  /**
   * Under the string round trip this prefix 01 b3 (435) read back as 01 ef
   * (495), and two U+FFFD landed in front of the payload, so `startsWith`
   * failed and the stamp was not recognised at all.
   */
  it('recognises the SRC-101 mint, which the string round trip hid entirely', () => {
    const stamp = StampParserService.parse(readTransaction(TXID));

    expect(stamp).not.toBeNull();
    expect(stamp!.type).toBe('Src101');
    expect(stamp!.uniqueId).toBe(`Src101-${TXID}`);
  });

  it('returns the exact payload, 429 bytes, with no replacement characters', () => {
    const content = StampParserService.parse(readTransaction(TXID))!.getContent();

    expect(content.length).toBe(429);
    // U+FFFD is what the corrupted path produced; its absence is the fix
    expect(content).not.toContain('�');
    expect(content.startsWith('{"p":"src-101","op":"mint","hash":"')).toBe(true);
    expect(content).toContain('"hash":"2f14fec59e464059523ca87b244066ff8f1cb4b39a61b2ffc69bddfc9a43b672"');
    expect(content).toContain('"toaddress":"bc1q5jh7yjer6ruftaagctzs2vcm6qz5qr0k6hxvzx"');
  });

  it('gives SRC-20 the same undamaged payload, since both share the decode', () => {
    const src20 = Src20ParserService.parse(readTransaction(TXID));

    expect(src20).not.toBeNull();
    expect(src20!.getContent()).not.toContain('�');
    expect(src20!.getContent().startsWith('{"p":"src-101","op":"mint"')).toBe(true);
  });
});
