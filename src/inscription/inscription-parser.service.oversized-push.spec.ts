import { hexToBytes } from '../lib/conversions';
import { readInstruction } from '../lib/reader';
import { InscriptionParserService } from './inscription-parser.service';
import { findEnvelopeMarks } from './inscription-parser.service.helper';

/**
 * OP_PUSHDATA4 takes a 4 byte little endian length. With the high bit set the
 * length exceeds 2^31, which must never turn into a negative pointer: a
 * negative pointer walks the script scan backwards and it then crawls forward
 * one byte at a time from about minus two billion.
 *
 * Such an element is cheap to build and relayable: eight bytes inside a
 * witness stack item are never executed, so the transaction is standard. The
 * backend parses every mempool transaction, so this must stay a decode error.
 *
 * ord reaches the same conclusion by a different route: the push runs past the
 * end of the script, its script decoding fails, and it then ignores every
 * envelope of that input.
 */
describe('Inscription parser: oversized data push', () => {

  // OP_PUSHDATA4 (0x4e), length 0x80000000 little endian
  const oversizedPush = '4e00000080';

  it('should reject a push whose length has the high bit set', () => {
    expect(() => readInstruction(hexToBytes(oversizedPush), 0)).toThrow();
  });

  it('should treat a script with such a push as undecodable', () => {
    // "ord" bytes first, so the cheap pre-check lets this element through
    expect(() => findEnvelopeMarks(hexToBytes('6f7264' + oversizedPush))).toThrow();
  });

  it('should return no inscriptions, without walking the script backwards', () => {

    const transaction = {
      txid: 'a'.repeat(64),
      vin: [{ witness: ['6f7264' + oversizedPush, 'c0' + '11'.repeat(32)] }],
    };

    const startedAt = Date.now();
    expect(InscriptionParserService.parse(transaction)).toEqual([]);

    // A negative pointer makes the scan step through about two billion
    // positions, which takes tens of seconds instead of no measurable time.
    // The assertion is generous on purpose; the two cases are orders of
    // magnitude apart.
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});
