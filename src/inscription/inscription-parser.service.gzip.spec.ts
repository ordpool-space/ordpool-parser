import { readInscriptionAsBase64, readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';

describe('Inscription parser', () => {

  it('should parse content with gzip encryption', async () => {

    const txn = readTransaction('4c83f2e1d12d6f71e9f69159aff48f7946ce04c5ffcc3a3feee4080bac343722');

    const inscription = InscriptionParserService.parse(txn)[0];

    const actualFileData = await inscription.getData();
    const expectedFileData = readInscriptionAsBase64('4c83f2e1d12d6f71e9f69159aff48f7946ce04c5ffcc3a3feee4080bac343722i0', 'svg');

    expect(inscription.getContentEncoding()).toEqual('gzip');
    expect(actualFileData).toEqual(expectedFileData);
  });

  /*
  it('should survive a decompression bomb', () => {
    // TODO! add mitigations!
  });
  */
});
