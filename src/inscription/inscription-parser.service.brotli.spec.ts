import { MAX_DECOMPRESSED_SIZE_MESSAGE } from '../lib/brotli-decode';
import { InscriptionParserService } from './inscription-parser.service';
import { brotliDecodeUint8Array } from './inscription-parser.service.helper';
import { bytesToBinaryString } from '../lib/conversions';
import { readBinaryFileAsUint8Array, readInscriptionAsBase64, readTransaction } from '../../testdata/test.helper';

describe('Inscription parser', () => {

  it('should parse content with brotli encryption', () => {

    const txn = readTransaction('6dc2c16a74dedcae46300b2058ebadc7ca78aea78236459662375c8d7d9804db');

    const inscription = InscriptionParserService.parse(txn)[0];

    const actualFileData = inscription.getData();
    const expectedFileData = readInscriptionAsBase64('6dc2c16a74dedcae46300b2058ebadc7ca78aea78236459662375c8d7d9804dbi0', 'js');

    expect(inscription.getContentEncoding()).toEqual('br');
    expect(actualFileData).toEqual(expectedFileData);
  });

  it('should survive a decompression bomb', () => {
    const bomb = readBinaryFileAsUint8Array('brotli-decompression-bomb.txt.br');
    const contentRaw = brotliDecodeUint8Array(bomb);
    const content = bytesToBinaryString(contentRaw);
    expect(content).toEqual(MAX_DECOMPRESSED_SIZE_MESSAGE);
  });
});
