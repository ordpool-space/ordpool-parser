import { InscriptionParserService } from './inscription-parser.service';
import { readInscriptionAsBase64, readTransaction } from '../../testdata/test.helper';

describe('Inscription parser', () => {

  /*
   * These are inscriptions, where multiples inputs were used
   * see https://ordinals.com/inscription/49cbc5cbac92cf917dd4539d62720a3e528d17e22ef5fc47070a17ec0d3cf307i0
   */
  it('should parse metadata using the metadata field', () => {

    const txn = readTransaction('49cbc5cbac92cf917dd4539d62720a3e528d17e22ef5fc47070a17ec0d3cf307');

    const inscriptions = InscriptionParserService.parse(txn);

    const actualFileData = inscriptions[0].getData();
    const metaprotocol = inscriptions[0].getMetaprotocol();
    const metadata = inscriptions[0].getMetadata();
    const expectedFileData = readInscriptionAsBase64('49cbc5cbac92cf917dd4539d62720a3e528d17e22ef5fc47070a17ec0d3cf307i0', 'txt');

    expect(inscriptions.length).toBe(1);
    expect(actualFileData).toEqual(expectedFileData);

    expect(metaprotocol).toEqual("cbrc-20:deploy");
    expect(metadata).toEqual({
      tick: 'SYMM',
      max: '21000000',
      lim: '1000',
      dec: '8',
      metadata: {
        name: 'Symmetry',
        desc: 'First symmetrical BRC20 & CBRC20 token, deployed on the same sat/inscription. Redefines efficiency by merging BRC20 & CBRC20 actions, saving fees.',
        purpose: "Experimental, Inception-like 'token in token' design, allowing simultaneous deploy, mint, transfer of both token forms in a single inscription. Goodbye fees, hello MOTO."
      }
    });
  });

  /*
   * What's interesting about this inscription is that the metadata field exceeds 520 bytes.
   * The solution involves concatenating all fields with ID 5 and interpreting the product as CBOR.
   * Note that the chunks do not need to be consecutive!
   * That is, you can have a chunk "5" of metadata, then a "3"-parent, then the next chunk "5" of metadata, and then another parent.
   *
   * fixes #8
   */
  it('should parse medatada > 520 Bytes', () => {

    const txn = readTransaction('c50ed012bcfd8f890269b2802c7c20308c5a6a0a99499d65db1fcae71c3ab707');

    const inscription = InscriptionParserService.parse(txn)[0];
    const metadata = inscription.getMetadata();

    expect(metadata).toEqual({
      name: 'Silence In Heaven',
      createdBy: 'Israel Riqueros',
      producedBy: 'Art Pleb',
      yearCreated: '2024',
      description: 'SILENCE IN HEAVEN is a prelude to LONG LIVE THE KING, and the first edition for the series. The court awaits the young king’s arrival, where he will descend into sin and debauchery in Chapter VII.',
      seriesDescription: '“Uneasy lies the head that wears a crown.” William Shakespeare, Henry IV /nLONG LIVE THE KING is a story of a father’s legacy and his son’s fate. Bringing the heaviness of the crown and the same end to those who are destined to wear it. /nLONG LIVE THE KING is a photo narrative series told across 10 core images. Using actors and full sets, Riqueros captures the power and drama of the chiaroscuro, neo-classical, and baroque painters like Caravaggio and Rembrandt on photography to retell these timeless stories.',
      hiResImage: 'QmZbPCPUAtmo2o1BBCKyTZWT8WNn2nqwjaKNi8YBBjMUpn'
    });
  });

  it('should return `undefined` if there is no metadata', () => {

    // the `Hello, world!` inscription
    const txn = readTransaction('c1e013bdd1434450c6e1155417c81eb888e20cbde2e0cde37ec238d91cf37045');

    const inscription = InscriptionParserService.parse(txn)[0];
    expect(inscription.getMetadata()).toEqual(undefined);
  });
});
