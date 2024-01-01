import { InscriptionParserService } from './inscription-parser.service';
import { readInscriptionAsBase64, readTransaction } from './test.helper';

describe('Inscription parser', () => {

  /*
   * These are inscriptions, where multiples inputs were used
   * see https://ordinals.com/inscription/49cbc5cbac92cf917dd4539d62720a3e528d17e22ef5fc47070a17ec0d3cf307i0
   */
  it('should parse metadata using the metadata field', () => {

    const txn = readTransaction('49cbc5cbac92cf917dd4539d62720a3e528d17e22ef5fc47070a17ec0d3cf307');

    const inscriptions = InscriptionParserService.parseInscriptions(txn);

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
  })
});
