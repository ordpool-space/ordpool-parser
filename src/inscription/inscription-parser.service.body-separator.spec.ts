import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';

/**
 * Fields come first, then an EMPTY data push separates them from the body
 * (`BODY_TAG` in ord's src/inscriptions/envelope.rs). ord finds that separator
 * by looking for an empty push in key position, whatever opcode produced it,
 * because it compares pushed bytes and not opcodes.
 *
 * An empty push is usually OP_0 (0x00), but OP_PUSHDATA1/2/4 with length 0
 * push an empty value just as well:
 *
 *   OP_0            ---> 00
 *   OP_PUSHDATA1 0  ---> 4c 00
 *   OP_PUSHDATA2 0  ---> 4d 0000
 *   OP_PUSHDATA4 0  ---> 4e 00000000
 *
 * The transactions below are mainnet bitmap claims that write every push
 * non-minimally, the separator included, and their body is assembled from
 * several pushes. ord reads 13 bytes of text/plain from each.
 */
describe('Inscription parser: body separator written as a non-minimal empty push', () => {

  it('should find the body behind an OP_PUSHDATA4 separator', async () => {

    const txn = readTransaction('f4f96458a16cd6734bb3d4dfd227633c7181b5307e1fd9202cd5af22454dcba0');

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(1);

    // ord: inscription 117773414
    expect(inscriptions[0].contentType).toBe('text/plain');
    expect(inscriptions[0].contentSize).toBe(13);
    expect(await inscriptions[0].getContent()).toBe('934324.bitmap');
  });

  it('should find the body of the second bitmap claim of the same kind', async () => {

    const txn = readTransaction('ca482fcbfc490f56c4010923512bd7a9baa22c671ec45f53248e76c31009535e');

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(1);

    // ord: inscription 117773795
    expect(inscriptions[0].contentType).toBe('text/plain');
    expect(inscriptions[0].contentSize).toBe(13);
    expect(await inscriptions[0].getContent()).toBe('934327.bitmap');
  });

  it('should find the body of the same shape a year later', async () => {

    const txn = readTransaction('bbb196939d7d11182c197da1285af64376c374580f891e6acb177735ed97fe10');

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(1);

    // ord: inscription 119060707
    expect(inscriptions[0].contentType).toBe('text/plain');
    expect(inscriptions[0].contentSize).toBe(13);
    expect(await inscriptions[0].getContent()).toBe('936033.bitmap');
  });
});
