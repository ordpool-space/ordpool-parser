import { MAX_DECOMPRESSED_SIZE_MESSAGE } from './brotli-decode';
import { InscriptionParserService } from './inscription-parser.service';
import { brotliDecodeUint8Array, uint8ArrayToSingleByteChars } from './inscription-parser.service.helper';
import { readBinaryFileAsUint8Array, readInscriptionAsBase64, readTransaction } from './test.helper';

describe('Inscription parser', () => {

  it('should parse content with brotli encryption', () => {

    const txn = readTransaction('6dc2c16a74dedcae46300b2058ebadc7ca78aea78236459662375c8d7d9804db');

    const inscription = InscriptionParserService.parseInscriptions(txn)[0];

    const actualFileData = inscription.getData();
    const expectedFileData = readInscriptionAsBase64('6dc2c16a74dedcae46300b2058ebadc7ca78aea78236459662375c8d7d9804dbi0', 'js');

    expect(inscription.getContentEncoding()).toEqual('br');
    expect(actualFileData).toEqual(expectedFileData);
  });

  it('should survive a decompression bomb', () => {
    const bomb = readBinaryFileAsUint8Array('brotli-decompression-bomb.txt.br');
    const contentRaw = brotliDecodeUint8Array(bomb);
    const content = uint8ArrayToSingleByteChars(contentRaw);
    expect(content).toEqual(MAX_DECOMPRESSED_SIZE_MESSAGE);
  });
});
