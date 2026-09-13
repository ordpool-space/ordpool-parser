import { MAX_DECOMPRESSED_SIZE_MESSAGE } from '../lib/brotli-decode';
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
   * The cap, through the real parse path, on a real inscription.
   *
   * There is no gzip bomb on Bitcoin: blocks 767430 to 966803 hold 190 gzip
   * encoded inscriptions and the largest expansion among them is 33x, which is
   * ordinary text compression. This one is simply BIG: 345,600 stored bytes of
   * HTML that expand to 1,279,580, a ratio of 4, so it crosses the 1 MB cap
   * without being an attack.
   *
   * That is enough to guard the cap. The protection does not care whether the
   * payload grew by a factor of 4 or a factor of a million: it stops at the
   * same byte either way, which is why this replaces the constructed bomb file
   * that used to stand in here. The brotli side has two REAL on-chain bombs
   * (inscriptions 55445370 and 55445371) in real-bombs.spec.ts.
   *
   * Note what the cap does and does not do: getContent() stops, while the
   * backend's /content route ships getDataRaw() with the Content-Encoding
   * header, so a reader still receives the whole inscription.
   */
  it('should stop decoding a gzip body that crosses the size cap', async () => {

    const txn = readTransaction('ecfb6ba537c830d62d30ae4f6e99a332944a36d28f3d04ea19a4600a1c027131');

    const inscription = InscriptionParserService.parse(txn)[0];

    expect(inscription.contentType).toBe('text/html;charset=utf-8');
    expect(inscription.getContentEncoding()).toBe('gzip');
    expect(inscription.contentSize).toBe(345600);
    expect(await inscription.getContent()).toEqual(MAX_DECOMPRESSED_SIZE_MESSAGE);
  });

});
