import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';
import { getTapscriptElement } from './inscription-parser.service.helper';

/**
 * ord reads exactly ONE witness element per input: the leaf script of a
 * script-path spend. It takes the second-to-last element, or the third-to-last
 * when the last one is an annex (first byte 0x50, per BIP341), and nothing at
 * all for a key-path spend. See `unversioned_leaf_script_from_witness` in
 * cat21-ord/src/lib.rs, which calls rust-bitcoin's `Witness::tapscript()`.
 *
 * An envelope in any other element (a signature, a P2WSH witness script, the
 * control block) is not an inscription for ord, so it must not be one for us.
 *
 * The transactions below all carry envelope bytes in an element ord never
 * reads, and ord reports no inscription for any of them.
 */
describe('Inscription parser: only the element ord reads', () => {

  it('should ignore an envelope in the witness script of a 2 element witness', () => {

    const txn = readTransaction('082701bc48bef2a03b0bc36016bfb5765d2147b3e1d43455b245adf1c21bf372');

    // [signature (72 bytes), witness script (102 bytes)]: ord reads the signature
    expect(txn.vin[0].witness!.length).toBe(2);
    expect(InscriptionParserService.parse(txn)).toEqual([]);
  });

  it('should ignore an envelope in the last element of a 3 element witness', () => {

    const txn = readTransaction('ab521166d587d09d2ce4983472db394c429f59dd5e4ea30469a3708418cf3998');

    // [33 bytes, signature (72 bytes), witness script (85 bytes)]
    expect(txn.vin[0].witness!.length).toBe(3);
    expect(InscriptionParserService.parse(txn)).toEqual([]);
  });

  it('should ignore an envelope in the witness script behind a single byte element', () => {

    const txn = readTransaction('60ea585b064ea891125ba6116c1834d3d8c49c924bb124b1d3ec1f8c01da94ca');

    // [1 byte, witness script (593 bytes)]
    expect(txn.vin[0].witness!.length).toBe(2);
    expect(InscriptionParserService.parse(txn)).toEqual([]);
  });

  describe('getTapscriptElement', () => {

    it('should read nothing from a key-path spend', () => {
      expect(getTapscriptElement([])).toBeUndefined();
      expect(getTapscriptElement(['aa'])).toBeUndefined();
      // two elements where the last one is an annex (0x50) is a key-path spend too
      expect(getTapscriptElement(['aa', '5001'])).toBeUndefined();
    });

    it('should read the second-to-last element of a script-path spend', () => {
      expect(getTapscriptElement(['script', 'controlblock'])).toBe('script');
      expect(getTapscriptElement(['signature', 'script', 'controlblock'])).toBe('script');
    });

    it('should skip the annex and read the third-to-last element', () => {
      // the annex is the last element and starts with 0x50
      expect(getTapscriptElement(['script', 'controlblock', '5001'])).toBe('script');
    });
  });
});
