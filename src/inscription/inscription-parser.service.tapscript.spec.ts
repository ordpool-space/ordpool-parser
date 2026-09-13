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
      // mainnet: input 1 of this transaction is a key-path spend, one signature
      const keyPath = readTransaction('37b10b5186bb9349e6beb036d608d93bedd342b31dab97cea9fc49ca3f7e3363');
      expect(keyPath.vin[1].witness!.length).toBe(1);
      expect(getTapscriptElement(keyPath.vin[1].witness!)).toBeUndefined();

      expect(getTapscriptElement([])).toBeUndefined();
    });

    it('should read the second-to-last element of a script-path spend', () => {
      // mainnet: [signature, leaf script, control block]
      const txn = readTransaction('37b10b5186bb9349e6beb036d608d93bedd342b31dab97cea9fc49ca3f7e3363');
      const witness = txn.vin[0].witness!;

      expect(witness.length).toBe(3);
      expect(getTapscriptElement(witness)).toBe(witness[1]);
      // the leaf script is the one that carries the envelope
      expect(getTapscriptElement(witness)).toContain('6f7264');
    });

    it('should skip the annex and read the third-to-last element', () => {
      // mainnet: [signature, leaf script, control block, annex]. The annex is
      // the single byte 0x50, so ord drops it and reads the leaf script before
      // the control block.
      const txn = readTransaction('1b400b080e8d492db80e49c5bcf5f965ef27c32e44bbfc29375878e037e0b5b2');
      const witness = txn.vin[0].witness!;

      expect(witness.length).toBe(4);
      expect(witness[3]).toBe('50');
      expect(getTapscriptElement(witness)).toBe(witness[1]);

      // and the envelopes in it are read: ord has 113019853 and 113019854 here
      const inscriptions = InscriptionParserService.parse(txn);
      expect(inscriptions.length).toBe(2);
      expect(inscriptions[0].contentSize).toBe(13);
      expect(inscriptions[1].contentSize).toBe(13);
    });

    it('should read the second-to-last element of a two element witness', () => {
      // mainnet: [leaf script, control block], the P2WSH-shaped case
      const txn = readTransaction('082701bc48bef2a03b0bc36016bfb5765d2147b3e1d43455b245adf1c21bf372');
      const witness = txn.vin[0].witness!;

      expect(witness.length).toBe(2);
      expect(getTapscriptElement(witness)).toBe(witness[0]);
    });
  });
});
