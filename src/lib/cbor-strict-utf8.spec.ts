import { readTransaction } from '../../testdata/test.helper';
import { AtomicalParserService } from '../atomical/atomical-parser.service';
import { extractAtomicalEnvelopeFromWitness } from '../atomical/atomical-parser.service.helper';
import { CBOR } from './cbor';

/** Pull the raw atomicals payload straight from the witness, bypassing parse(). */
function extractPayload(txn: { vin: { witness?: string[] }[] }): Uint8Array {
  for (const vin of txn.vin) {
    if (!vin.witness) continue;
    const envelope = extractAtomicalEnvelopeFromWitness(vin.witness);
    if (envelope) return envelope.payload;
  }
  throw new Error('no atomicals envelope in this fixture');
}


/**
 * A CBOR text string (major type 3) must be valid UTF-8. Every reference
 * implementation that reads these payloads builds a native string from the
 * bytes and fails when they are not:
 *
 *   metadata (tag 5)    ord       ciborium    Rust String, `.ok()` -> None
 *   properties (tag 17) ord       minicbor    Rust String, unwrap_or_default()
 *   atomicals           electrumx cbor2       raises CBORDecodeError; the caller's
 *                                             bare `except` skips the tx input
 *                                             (util_atomicals.py:1308)
 *   counterparty        core      serde_cbor  Value::Text(String), Err branch
 *
 * Decoding leniently yields U+FFFD and reports content all four of them drop.
 *
 * cbor2's behaviour was measured rather than assumed: 6.1.4 raises
 * "error decoding text string" on a1 61 61 62 ff fe.
 */
describe('CBOR: strict UTF-8 for text strings, as every reference does', () => {

  // map(1) { "a": text(2) <ff fe> } -- 0xff 0xfe cannot start a UTF-8 sequence
  const badText = new Uint8Array([0xa1, 0x61, 0x61, 0x62, 0xff, 0xfe]);
  // the same shape with valid text, so the rejection is about the bytes
  const goodText = new Uint8Array([0xa1, 0x61, 0x61, 0x62, 0x68, 0x69]);

  it('should substitute U+FFFD when lenient, which is the old behaviour', () => {
    expect(CBOR.decode(badText)).toEqual({ a: '��' });
  });

  it('should throw when strict', () => {
    expect(() => CBOR.decode(badText, undefined, undefined, false, false, true)).toThrow();
  });

  it('should still decode valid text when strict', () => {
    expect(CBOR.decode(goodText, undefined, undefined, false, false, true)).toEqual({ a: 'hi' });
  });

  /**
   * Only major type 3 carries the UTF-8 requirement. A byte string (major
   * type 2) holding the same bytes is well formed and must survive, or the
   * flag would reject every binary payload on chain.
   */
  it('should NOT reject the same bytes inside a byte string', () => {
    // map(1) { "a": bytes(2) <ff fe> }
    const bytes = new Uint8Array([0xa1, 0x61, 0x61, 0x42, 0xff, 0xfe]);
    const decoded = CBOR.decode(bytes, undefined, undefined, false, false, true) as { a: Uint8Array };
    expect(Array.from(decoded.a)).toEqual([0xff, 0xfe]);
  });

  /**
   * Real mainnet Atomicals payload whose CBOR carries a PNG file written as a
   * TEXT string instead of a byte string, so the text bytes begin with the PNG
   * magic 89 50 4e 47 0d 0a 1a 0a. atomicals-electrumx raises on it and skips
   * the input; this parser used to hand back replacement characters, which
   * reach the satellite `ticker` column and the image/text bucket flags.
   */
  describe('a real Atomicals payload with a PNG written as CBOR text', () => {

    const TXID = 'ddad7ef2931146579fdbbffa12595f2194107b1ce67081115679dcb2a07713b7';

    /**
     * The reference `continue`s past an input whose non-empty payload does not
     * decode, so it records NO atomical. Counting one here would inflate
     * ordpool_stats by an artifact the reference does not have.
     */
    it('should report NO atomical at all, because the reference skips the input', () => {
      expect(AtomicalParserService.parse(readTransaction(TXID))).toBeNull();
    });

    it('should be a payload a lenient decode WOULD have accepted', () => {
      // the envelope is really there and really carries 1454 bytes; this is a
      // validity decision, not a failure to find the payload
      const raw = extractPayload(readTransaction(TXID));
      expect(raw.length).toBe(1454);

      // lenient: decodes, with the PNG bytes mangled into U+FFFD
      expect(typeof CBOR.decode(raw, undefined, undefined, true)).toBe('object');

      // strict: refuses, which is what every reference does
      expect(() => CBOR.decode(raw, undefined, undefined, true, false, true)).toThrow();
    });
  });
});
