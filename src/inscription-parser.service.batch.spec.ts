import { InscriptionParserService } from './inscription-parser.service';
import { readBinaryInscriptionAsBase64, readInscriptionAsBase64, readTransaction } from './test.helper';

describe('Inscription parser', () => {

  /*
   * These are inscriptions, where multiples inputs were used
   * see https://github.com/ordinals/ord/discussions/2015#discussioncomment-5626874
   * see https://github.com/ordinals/ord/issues/2045
   * --> Inscriptions on inputs after the first, which is useful for collections
   *
   * --> 092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cc --> has 116 inputs 🤯
   * --> this txn has a lot of inscriptions vin[x]
   */
  it('should parse inscriptions on multiple inputs', () => {

    const txn = readTransaction('092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cc');

    const inscriptions = InscriptionParserService.parseInscriptions(txn);

    const actualFileData0 = inscriptions[0].getData();
    const actualFileData1 = inscriptions[1].getData();
    const actualFileData2 = inscriptions[2].getData();

    const expectedFileData0 = readBinaryInscriptionAsBase64('092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cci0', 'png');
    const expectedFileData1 = readBinaryInscriptionAsBase64('092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cci1', 'png');
    const expectedFileData2 = readBinaryInscriptionAsBase64('092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cci2', 'png');

    expect(actualFileData0).toEqual(expectedFileData0);
    expect(actualFileData1).toEqual(expectedFileData1);
    expect(actualFileData2).toEqual(expectedFileData2);

    expect(inscriptions[0].inscriptionId).toEqual('092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cci0');
    expect(inscriptions[1].inscriptionId).toEqual('092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cci1');
    expect(inscriptions[2].inscriptionId).toEqual('092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cci2');
  })

  /*
   * Pointers: In order to make an inscription on a sat other than the first of its input, a
   * zero-based integer, called the "pointer", can be provided with tag `2`, causing
   * the inscription to be made on the sat at the given position in the outputs.
   * fixes https://github.com/haushoppe/ordpool/issues/2
   * see https://github.com/ordinals/ord/pull/2504/files
   *
   * --> this txn has all inscriptions in vin[1]
   */
  it('should parse batch inscriptions using pointers', () => {

    const txn = readTransaction('11d3f4b39e8ab97995bab1eacf7dcbf1345ec59c07261c0197e18bf29b88d8da');

    const inscriptions = InscriptionParserService.parseInscriptions(txn);

    // according to ordinals.com the number 665 is the last inscription
    // https://ordinals.com/inscription/11d3f4b39e8ab97995bab1eacf7dcbf1345ec59c07261c0197e18bf29b88d8dai665
    expect(inscriptions.length).toEqual(666);


    const actualFileData0 = inscriptions[0].getData();
    const actualFileData1 = inscriptions[1].getData();
    const actualFileData2 = inscriptions[2].getData();

    const expectedFileData0 = readInscriptionAsBase64('11d3f4b39e8ab97995bab1eacf7dcbf1345ec59c07261c0197e18bf29b88d8dai0', 'html');
    const expectedFileData1 = readInscriptionAsBase64('11d3f4b39e8ab97995bab1eacf7dcbf1345ec59c07261c0197e18bf29b88d8dai1', 'html');
    const expectedFileData2 = readInscriptionAsBase64('11d3f4b39e8ab97995bab1eacf7dcbf1345ec59c07261c0197e18bf29b88d8dai2', 'html');

    expect(actualFileData0).toEqual(expectedFileData0);
    expect(actualFileData1).toEqual(expectedFileData1);
    expect(actualFileData2).toEqual(expectedFileData2);

    // let's also check the metadata
    expect(inscriptions[0].getMetadata()).toEqual({ id: 1, pattern: 'Mempool', mode: 'Dark' });
    expect(inscriptions[1].getMetadata()).toEqual({ id: 2, pattern: 'Riley',   mode: 'Light' });
    expect(inscriptions[2].getMetadata()).toEqual({ id: 3, pattern: 'Fractal', mode: 'Dark' });

    // and also check the parent inscription
    expect(inscriptions[0].getParents()).toEqual(['2593027c930e08446af96cb3e94be579024d35ed0d381e83789bfc6aca5e3550i0']);
    expect(inscriptions[1].getParents()).toEqual(['2593027c930e08446af96cb3e94be579024d35ed0d381e83789bfc6aca5e3550i0']);
    expect(inscriptions[2].getParents()).toEqual(['2593027c930e08446af96cb3e94be579024d35ed0d381e83789bfc6aca5e3550i0']);

    // and also check the pointer
    // TODO: The pointer is not displayed anywhere on ordinals.com,
    // so I have no indication of whether these numbers are really correct
    expect(inscriptions[0].getPointer()).toEqual(697);
    expect(inscriptions[1].getPointer()).toEqual(1363);
    expect(inscriptions[2].getPointer()).toEqual(2029);

    expect(inscriptions[0].inscriptionId).toEqual('11d3f4b39e8ab97995bab1eacf7dcbf1345ec59c07261c0197e18bf29b88d8dai0');
    expect(inscriptions[1].inscriptionId).toEqual('11d3f4b39e8ab97995bab1eacf7dcbf1345ec59c07261c0197e18bf29b88d8dai1');
    expect(inscriptions[2].inscriptionId).toEqual('11d3f4b39e8ab97995bab1eacf7dcbf1345ec59c07261c0197e18bf29b88d8dai2');
  });
});
