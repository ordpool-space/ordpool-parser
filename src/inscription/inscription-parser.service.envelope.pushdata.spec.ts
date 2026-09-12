import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';

/**
 * ord decodes a tapscript instruction by instruction and accepts non-minimal
 * data pushes, so the protocol identifier "ord" counts as the envelope marker
 * no matter which push opcode carries it:
 *
 *   OP_PUSHBYTES_3 "ord"  ---> 03 6f7264
 *   OP_PUSHDATA1 3 "ord"  ---> 4c 03 6f7264
 *   OP_PUSHDATA2 3 "ord"  ---> 4d 0300 6f7264
 *   OP_PUSHDATA4 3 "ord"  ---> 4e 03000000 6f7264
 *
 * See ord's `RawEnvelope::from_instructions` (src/inscriptions/envelope.rs),
 * which compares the pushed BYTES, and `Script::instructions()` in
 * rust-bitcoin, which does not enforce minimal pushes.
 *
 * All three transactions below are mainnet inscriptions that ord indexes.
 */
describe('Inscription parser: envelope marker with non-minimal pushes', () => {

  /*
   * OP_FALSE OP_IF OP_PUSHDATA1 3 "ord" ...  ---> 00 63 4c03 6f7264
   * Cursed inscription -782, a BRC-20 mint. The content type tag is pushed as
   * OP_PUSHNUM_1 (0x51) and its value via OP_PUSHDATA1 (4c 18).
   */
  it('should parse an envelope whose "ord" marker uses OP_PUSHDATA1', async () => {

    const txn = readTransaction('fd1f01dc91580ebeb75fd8ecb3ee4efa9f9d3e94c726139cbd706192ad0edb03');

    expect(InscriptionParserService.hasInscription(txn)).toBe(true);

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(1);

    const inscription = inscriptions[0];
    expect(inscription.inscriptionId).toBe('fd1f01dc91580ebeb75fd8ecb3ee4efa9f9d3e94c726139cbd706192ad0edb03i0');
    expect(inscription.contentType).toBe('text/plain;charset=utf-8');
    expect(inscription.contentSize).toBe(50);
    expect(await inscription.getContent()).toBe('{"p":"brc-20","op":"mint","tick":"meme","amt":"1"}');
  });

  /*
   * OP_FALSE OP_IF OP_PUSHDATA2 3 "ord" ...  ---> 00 63 4d0300 6f7264
   * Inscription 60654030, a bitmap claim with a metaprotocol (tag 7).
   */
  it('should parse an envelope whose "ord" marker uses OP_PUSHDATA2', async () => {

    const txn = readTransaction('127c8ab7583a17ba2f6629f364f39585e841a04e8eb1e685b00fb5fa80419de6');

    expect(InscriptionParserService.hasInscription(txn)).toBe(true);

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(1);

    const inscription = inscriptions[0];
    expect(inscription.inscriptionId).toBe('127c8ab7583a17ba2f6629f364f39585e841a04e8eb1e685b00fb5fa80419de6i0');
    expect(inscription.contentType).toBe('text/plain;charset=utf-8');
    expect(inscription.contentSize).toBe(5);
    expect(await inscription.getContent()).toBe('test\n');
    expect(inscription.getMetaprotocol()).toBe('830174.bitmap');
  });

  /*
   * OP_FALSE OP_IF OP_PUSHDATA4 3 "ord" ...  ---> 00 63 4e03000000 6f7264
   * Inscription 117420871. Body is brotli compressed (tag 9 = "br"), so the
   * stored size is 17 bytes and the decoded text is 13 bytes.
   */
  it('should parse an envelope whose "ord" marker uses OP_PUSHDATA4', async () => {

    const txn = readTransaction('37b10b5186bb9349e6beb036d608d93bedd342b31dab97cea9fc49ca3f7e3363');

    expect(InscriptionParserService.hasInscription(txn)).toBe(true);

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(1);

    const inscription = inscriptions[0];
    expect(inscription.inscriptionId).toBe('37b10b5186bb9349e6beb036d608d93bedd342b31dab97cea9fc49ca3f7e3363i0');
    expect(inscription.contentType).toBe('text/plain');
    expect(inscription.getContentEncoding()).toBe('br');
    expect(inscription.contentSize).toBe(17);
    expect(await inscription.getContent()).toBe('933404.bitmap');
  });
});
