import { InscriptionParserService } from './inscription-parser.service';
import { readBinaryInscriptionAsBase64, readInscriptionAsBase64, readTransaction } from './test.helper';

describe('Inscription parser', () => {

  /*
   * These are inscriptions, where multiples inputs were used
   * see https://ordinals.com/inscription/49cbc5cbac92cf917dd4539d62720a3e528d17e22ef5fc47070a17ec0d3cf307i0
   */
  it('should parse metadata using the metadata field', () => {

    const txn = readTransaction('49cbc5cbac92cf917dd4539d62720a3e528d17e22ef5fc47070a17ec0d3cf307');

    const inscriptions = InscriptionParserService.parseInscriptions(txn);

    const actualFileData = inscriptions[0].getData();
    const metadata = inscriptions[0].getMetadata();
    console.log(metadata);

    const metadataprotocol = inscriptions[0].getMetaprotocol();
    console.log(metadataprotocol);

    const expectedFileData = readInscriptionAsBase64('49cbc5cbac92cf917dd4539d62720a3e528d17e22ef5fc47070a17ec0d3cf307i0', 'txt');

    expect(inscriptions.length).toBe(1);
    expect(actualFileData).toEqual(expectedFileData);

    expect(metadataprotocol).toEqual("cbrc-20:deploy");
  })
});
