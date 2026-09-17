import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';

/**
 * ord decodes tag 17 with `minicbor::decode::<Properties>(cbor)` followed by
 * `.unwrap_or_default()` (`properties.rs`, `Properties::from_cbor`). minicbor
 * stops at the FIRST fault and returns an error, so `unwrap_or_default` then
 * yields an empty Properties: no gallery, no title, no traits. It never keeps
 * the parts that decoded before the fault.
 *
 * Parsing each piece independently and keeping whatever succeeded shows
 * galleries ord does not show. Found by comparing every inscription carrying
 * tag 17 in blocks 481824 to 966814 against a port of ord's decoder.
 */
describe('Inscription parser: properties decode all-or-nothing, like ord', () => {

  /**
   * `Properties` is a minicbor-derive `#[cbor(map)]` struct, and the generated
   * decoder reads EVERY key with `i64()?` before matching it against the field
   * indices (minicbor-derive-0.19.3, `src/decode.rs`, `Encoding::Map`). A text
   * key is therefore a decode error, not an unknown field to skip.
   *
   * Both transactions below carry `{0: [one gallery item], "version": "Gen1"}`.
   * That single text key costs them their whole gallery on ord.
   */
  describe('a non-integer key in the properties map', () => {

    it('should discard the gallery of 57f869cc..b8e4 (block 929894)', () => {
      const txn = readTransaction('57f869ccb60fafd5434efcb904c8f2c0fd0b0187164ac0a3ba0fbcac0337b8e4');
      const inscriptions = InscriptionParserService.parse(txn);

      expect(inscriptions.length).toBe(1);
      // the gallery item the lenient decode used to return
      return expect(inscriptions[0].getProperties()).resolves.toBeUndefined();
    });

    it('should discard the gallery of eaac2164..461e (block 929761)', () => {
      const txn = readTransaction('eaac21645c2ad060c730425ab115881aa985028c98614c8d409400738a6b461e');
      const inscriptions = InscriptionParserService.parse(txn);

      expect(inscriptions.length).toBe(1);
      return expect(inscriptions[0].getProperties()).resolves.toBeUndefined();
    });
  });

  /**
   * Two of the three top-level fields hold the wrong type here, and either one
   * alone is fatal to the whole structure:
   *
   *   key 1 `attributes`, typed `Attributes` (a struct), holds the STRING
   *         "Ordinal Rabbits"
   *   key 2 `txids`, typed `Vec<u8>`, is not a byte string
   *
   * minicbor decodes entries in the order they appear, so ord fails on key 1;
   * this decoder checks key 2 first. Same outcome either way, which is the
   * point: one wrong field discards everything.
   *
   * The gallery lost is not a corner case: 45 chunks of tag 17, 23,095 stored
   * bytes, 66,262 bytes after brotli, holding 500 titled gallery items.
   */
  describe('a known field of the wrong type', () => {

    it('should discard all 500 gallery items of 71e953e1..c588 (block 938113)', async () => {
      const txn = readTransaction('71e953e10e5a9938f8ec8c3694f6c8597b602eb2f48f13676b8c293faf4bc588');
      const inscriptions = InscriptionParserService.parse(txn);

      expect(inscriptions.length).toBe(1);
      expect(inscriptions[0].contentType).toBe('image/avif');

      // the properties field really is there and really does decode to 500
      // items: this is a strictness decision, not a failure to read the bytes
      const propertyChunks = inscriptions[0].fields.filter(field => field.tag === 17);
      expect(propertyChunks.length).toBe(45);

      await expect(inscriptions[0].getProperties()).resolves.toBeUndefined();
    });
  });

  /**
   * CBOR text strings are decoded as Rust `String`s on ord's side, which keeps
   * a leading U+FEFF. `new TextDecoder()` strips one by default, so a title
   * that begins with a byte order mark used to render as if the mark were not
   * there, and compared equal to the unmarked text.
   *
   * Gallery item 129 of this inscription is titled "﻿t Shroom".
   */
  describe('a byte order mark inside a properties string', () => {

    it('should keep the leading U+FEFF of a gallery title in 2e22a58a..d23a', async () => {
      const txn = readTransaction('2e22a58a9accec6fae4925f35bad5bb84d005343a0aff1d3350dc923281fd23a');
      const properties = (await InscriptionParserService.parse(txn)[0].getProperties())!;

      expect(properties.gallery.length).toBe(224);

      const item = properties.gallery[129];
      expect(item.inscriptionId).toBe('9163af650dcdeeeb9a7e1f47f693b51921dce3bdf2475e69360ec83d9956f5d7i0');
      expect(item.title).toBe('﻿t Shroom');
      // the distinction the stripped decode destroyed
      expect(item.title).not.toBe('t Shroom');
      expect(item.title!.charCodeAt(0)).toBe(0xFEFF);

      // strings without a mark are untouched
      expect(properties.title).toBe('Bitcoin Shrooms');
    });
  });

  /**
   * The strictness must not swallow a gallery that is actually well formed,
   * which is what makes the two cases above evidence rather than a blanket
   * refusal to parse properties.
   */
  describe('a well formed properties field', () => {

    // Ordillas, 2230 items in the PACKED encoding (txids concatenated in
    // Properties[2], index in Item[2]), which is the branch the strict decode
    // touches most.
    it('should still return all 2230 items of 9936fce2..c6db', async () => {
      const txn = readTransaction('9936fce243d5242a33afc913588ee88a2d3025af722e80d61442f5a1127bc6db');
      const inscriptions = InscriptionParserService.parse(txn);
      const properties = await inscriptions[0].getProperties();

      expect(properties?.gallery.length).toBe(2230);
    });
  });
});
