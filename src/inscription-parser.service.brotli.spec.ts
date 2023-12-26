import { InscriptionParserService } from './inscription-parser.service';
import { readInscriptionAsBase64, readTransaction } from './test.helper';

describe('Inscription parser', () => {

  it('should parse content with brotli encryption', () => {

    const txn = readTransaction('6dc2c16a74dedcae46300b2058ebadc7ca78aea78236459662375c8d7d9804db');

    const inscription = InscriptionParserService.parseInscriptions(txn)[0];

    const actualFileData = inscription.getData();
    const expectedFileData = readInscriptionAsBase64('6dc2c16a74dedcae46300b2058ebadc7ca78aea78236459662375c8d7d9804dbi0', 'js');

    expect(inscription.getContentEncoding()).toEqual('br');
    expect(actualFileData).toEqual(expectedFileData);
  });
});
