import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';

/**
 * A field is two data pushes, a tag and a value. When the envelope ends right
 * after a tag, ord keeps the inscription and only marks it
 * `incomplete_field`, which makes it cursed (`Curse::IncompleteField` in
 * src/index/updater/inscription_updater.rs). The fields before the dangling
 * tag are read normally.
 *
 * The inscription still gets an id, so dropping it does not only lose that
 * inscription: every later inscription of the same transaction shifts down by
 * one, and `/content/<txid>iN` then serves the wrong inscription.
 *
 * All three transactions below are mainnet inscriptions that ord indexes.
 */
describe('Inscription parser: envelope with an incomplete field', () => {

  /*
   * Two 3D models, both without a body. The FIRST envelope ends on a dangling
   * tag, so it is the one that shifts the ids: ord's i1 is the envelope that
   * carries the pointer 546.
   */
  it('should keep an incomplete-field inscription and not shift the ids of the later ones', () => {

    const txn = readTransaction('60d10f6b7b6f76ed74b4862c81391d2111a732c93e625439ae19243bb392492a');

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(2);

    // ord: inscription 70786783, incomplete field, no body
    expect(inscriptions[0].inscriptionId).toBe('60d10f6b7b6f76ed74b4862c81391d2111a732c93e625439ae19243bb392492ai0');
    expect(inscriptions[0].contentType).toBe('model/gltf-binary');
    expect(inscriptions[0].contentSize).toBe(0);
    expect(inscriptions[0].getPointer()).toBeUndefined();

    // ord: inscription 70786784, the one that carries the pointer
    expect(inscriptions[1].inscriptionId).toBe('60d10f6b7b6f76ed74b4862c81391d2111a732c93e625439ae19243bb392492ai1');
    expect(inscriptions[1].contentType).toBe('model/gltf-binary');
    expect(inscriptions[1].getPointer()).toBe(546);
  });

  /*
   * Here the dangling tag sits in the LAST envelope, so nothing shifts and the
   * second inscription is simply missing. ord: 70916101 and 70916102, the
   * second one a reinscription on the same sat.
   */
  it('should keep an incomplete-field inscription that follows a complete one', async () => {

    const txn = readTransaction('cd3391b51b6937c807c2b3dde52dd541ef14c9a9aa4d1dff58b85b3ea93c901f');

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(2);

    expect(inscriptions[0].inscriptionId).toBe('cd3391b51b6937c807c2b3dde52dd541ef14c9a9aa4d1dff58b85b3ea93c901fi0');
    expect(inscriptions[0].contentType).toBe('text/html');
    expect(inscriptions[0].contentSize).toBe(5);
    expect(await inscriptions[0].getContent()).toBe('tttt1');

    expect(inscriptions[1].inscriptionId).toBe('cd3391b51b6937c807c2b3dde52dd541ef14c9a9aa4d1dff58b85b3ea93c901fi1');
    expect(inscriptions[1].contentType).toBe('text/html');
    expect(inscriptions[1].contentSize).toBe(0);
  });

  /*
   * 19 envelopes in one transaction, every one of them ending on a dangling
   * tag and carrying no content type at all. ord indexes all 19, starting at
   * inscription 62486249.
   */
  it('should keep a batch of inscriptions that all have an incomplete field', () => {

    const txn = readTransaction('16a230cb02bb325b6c0ead55a05a35bac8ac316aa1a959b9edbe8b41998de448');

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(19);

    expect(inscriptions.map(i => i.inscriptionId)).toEqual(
      Array.from({ length: 19 }, (_, i) => `16a230cb02bb325b6c0ead55a05a35bac8ac316aa1a959b9edbe8b41998de448i${i}`)
    );
    expect(inscriptions.every(i => i.contentType === undefined)).toBe(true);
    expect(inscriptions.every(i => i.contentSize === 0)).toBe(true);
  });
});
