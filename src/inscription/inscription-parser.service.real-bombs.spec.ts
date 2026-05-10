import { MAX_DECOMPRESSED_SIZE_MESSAGE } from '../lib/brotli-decode';
import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';

/**
 * Real on-chain decompression-bomb regression tests.
 *
 * Both inscriptions were inscribed by the same wallet
 * (bc1p85ra9kv6a48yvk4mq4hx08wxk6t32tdjw9ylahergexkymsc3uwsdrx6sh) in
 * block 825859 (Bitcoin mainnet), sequential inscription numbers
 * 55445370 and 55445371. Both carry the 💣 metaprotocol tag, both are
 * 790 bytes on chain, both expand to ~794 MB under brotli decompression.
 *
 * They were placed *on purpose* to force any inscription indexer to
 * implement a decompression-size cap. ordpool-parser has had the
 * MAX_DECOMPRESSED_SIZE = 1 MB cap in brotli-decode.ts for a while;
 * these tests assert that the cap survives end-to-end through
 * InscriptionParserService.parse + inscription.getContent() against
 * the real witness data, not just a synthetic fixture.
 *
 * If either of these tests starts failing, ordpool-parser will OOM
 * the moment it touches the offending transaction. Treat any failure
 * as a P0.
 */
describe('Inscription parser - real on-chain decompression bombs', () => {

  it('survives bomb #1 (cat #27 mint, tx 08770f28...0bd480, inscription #55445370)', async () => {
    const tx = readTransaction('08770f28ab15ec0acf1103ce6af34c57c05ba7db5df783b3b75058725e0bd480');
    const inscription = InscriptionParserService.parse(tx)![0];

    expect(inscription).toBeTruthy();
    expect(inscription.contentType).toEqual('text/plain;charset=utf-8');
    expect(inscription.getContentEncoding()).toEqual('br');
    expect(inscription.getMetaprotocol()).toEqual('💣');

    const content = await inscription.getContent();
    expect(content).toEqual(MAX_DECOMPRESSED_SIZE_MESSAGE);
  });

  it('survives bomb #2 (standalone, tx bd7d4631...3d278, inscription #55445371)', async () => {
    const tx = readTransaction('bd7d46310b3354b35b4362e9efdc5966d64e5d2cc228f568dc6d5eea79c3d278');
    const inscription = InscriptionParserService.parse(tx)![0];

    expect(inscription).toBeTruthy();
    expect(inscription.contentType).toEqual('text/plain;charset=utf-8');
    expect(inscription.getContentEncoding()).toEqual('br');
    expect(inscription.getMetaprotocol()).toEqual('💣');

    const content = await inscription.getContent();
    expect(content).toEqual(MAX_DECOMPRESSED_SIZE_MESSAGE);
  });
});
