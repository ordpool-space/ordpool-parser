import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';

/**
 * ord decodes metadata with `ciborium::from_reader` (src/inscriptions/
 * inscription.rs), which reads exactly ONE CBOR item and ignores whatever
 * follows it. Our decoder rejected trailing bytes, so an inscription whose
 * metadata field carries anything after the first item lost its metadata
 * entirely, while ord shows it (templates/inscription.html renders metadata
 * whenever `metadata()` returns Some).
 *
 * The chain scan over blocks 481824 to 966701 found 60 mainnet transactions
 * whose metadata decodes this way and did not for us.
 */
describe('Inscription parser: metadata followed by trailing bytes', () => {

  it('should read the first CBOR item when a second one follows', () => {

    const txn = readTransaction('e8483d847012057b2a8efcebbcb443bf99c9a06c7a2e123ef5909d90df5b0417');

    // 78 bytes holding TWO complete CBOR maps, a BRC-20 deploy for MONK
    // followed by one for BOND. ord keeps the first and ignores the rest.
    expect(InscriptionParserService.parse(txn)[0].getMetadata()).toEqual({
      tick: 'MONK',
      max: '21000000',
      lim: '1000',
      dec: '8',
    });
  });

  it('should read a single byte item followed by one trailing byte', () => {

    const txn = readTransaction('6ef97dc803f3fca428ad4341c650eb41557a0cb364197c1e3fc754d05d7a7e26');

    // metadata is 0x01 0x10: the integer 1, then a trailing byte
    expect(InscriptionParserService.parse(txn)[0].getMetadata()).toBe(1);
  });

  it('should read an item followed by 32 trailing bytes', () => {

    const txn = readTransaction('6b4c9d1264c2e5ecfb9236fecac565612c5be328b2cf31fed8943d6c24172313');

    // metadata starts with 0x03, the integer 3, and carries 32 bytes after it
    expect(InscriptionParserService.parse(txn)[0].getMetadata()).toBe(3);
  });
});
