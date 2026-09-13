import { hexToBytes } from '../lib/conversions';
import { InscriptionParserService } from './inscription-parser.service';

/**
 * SYNTHETIC INPUT. The envelopes below are constructed.
 *
 * Why there is no fixture: ord keys its field map by the raw tag BYTES
 * (`BTreeMap<&[u8], Vec<&[u8]>>` in envelope.rs), so `[1, 0]` is not the
 * content type and `[2, 0]` is not the pointer. Folding a multi-byte key into
 * a number, which this parser used to do, reads fields ord never reads. Such a
 * key WOULD have shown up in the full chain comparison of blocks 481824 to
 * 966718 as a content type or pointer difference, and that scan reported zero
 * of both, so no mainnet inscription carries one.
 *
 * Why the test stays: the shape is standard and relayable, and the value lands
 * in the Content-Type header of the backend's /content route, so it is worth
 * pinning against a future crafted transaction rather than trusting that
 * nobody bothers.
 */
describe('Inscription parser: tag keys are compared as bytes (SYNTHETIC INPUT)', () => {

  // OP_FALSE OP_IF OP_PUSHBYTES_3 'ord'
  const mark = '0063036f7264';
  // OP_0 separator, then OP_PUSHBYTES_2 'hi'
  const body = '00' + '02' + '6869';
  const endif = '68';
  const tx = (envelope: string) => ({
    txid: 'c'.repeat(64),
    vin: [{ witness: [envelope, 'c0' + '11'.repeat(32)] }],
  });

  it('should read a single byte content type tag', () => {
    // tag [1], the real content type key
    const envelope = mark + '01' + '01' + '0a' + hexToText('text/plain') + body + endif;
    const inscription = InscriptionParserService.parse(tx(envelope))[0];

    expect(inscription.contentType).toBe('text/plain');
    expect(inscription.fields[0].tag).toBe(1);
  });

  it('should NOT read a two byte key as the content type', () => {
    // tag [1, 0]: a different key for ord, whose least significant byte is odd,
    // so ord ignores the field entirely
    const envelope = mark + '02' + '0100' + '0a' + hexToText('text/plain') + body + endif;
    const inscription = InscriptionParserService.parse(tx(envelope))[0];

    expect(inscription.contentType).toBeUndefined();
    expect(inscription.fields[0].tag).toBe(-1);
    expect([...inscription.fields[0].tagBytes]).toEqual([1, 0]);
  });

  it('should NOT read a two byte key as the pointer', () => {
    // tag [2, 0] with the value 546: ord files this under unrecognized even
    // fields, which makes the inscription unbound, and reads no pointer
    const envelope = mark + '02' + '0200' + '02' + '2202' + body + endif;
    const inscription = InscriptionParserService.parse(tx(envelope))[0];

    expect(inscription.getPointer()).toBeUndefined();
    expect(inscription.fields[0].tag).toBe(-1);
  });
});

function hexToText(value: string): string {
  return Buffer.from(value, 'utf8').toString('hex');
}
