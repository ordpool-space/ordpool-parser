import { readTransaction } from '../../testdata/test.helper';
import { hexToBytes } from '../lib/conversions';
import { InscriptionParserService } from './inscription-parser.service';
import { findEnvelopeMarks, getTapscriptElement } from './inscription-parser.service.helper';

/**
 * ord does not search the script for marker BYTES, it decodes the script
 * instruction by instruction (`RawEnvelope::from_tapscript`). Two consequences
 * that a byte search gets wrong:
 *
 * 1. Marker bytes inside the DATA of a push are not an envelope. They are
 *    content that happens to look like `OP_FALSE OP_IF "ord"`.
 *
 * 2. A failed envelope CONSUMES the instructions it looked at. ord accepts
 *    OP_IF and the "ord" push, then reads the payload until OP_ENDIF; any
 *    other opcode in between aborts that envelope, and the scan continues
 *    AFTER the instructions already consumed. So a later marker inside the
 *    aborted region never starts an envelope of its own.
 *
 * All three transactions below are mainnet, and what ord indexes for them is
 * pinned here.
 */
describe('Inscription parser: envelopes are found by decoding, not by scanning bytes', () => {

  /*
   * A 3D model whose body contains the bytes 00 63 03 "ord" at byte 97 of the
   * script, in the middle of a push. ord indexes exactly one inscription.
   */
  it('should not turn marker bytes inside a body push into a second inscription', () => {

    const txn = readTransaction('77d65876e2e3a9a2efda8fbe6b73a95faa9cf36e0c400e7ac44fb35d4f673e55');

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(1);

    // ord: inscription 52158241
    expect(inscriptions[0].inscriptionId).toBe('77d65876e2e3a9a2efda8fbe6b73a95faa9cf36e0c400e7ac44fb35d4f673e55i0');
    expect(inscriptions[0].contentType).toBe('model/gltf-binary');
    expect(inscriptions[0].contentSize).toBe(138);
  });

  /*
   * One text inscription of 1674 bytes whose own content carries ten further
   * occurrences of the marker bytes, all inside push data. ord indexes one
   * inscription, and ...i1 does not exist.
   */
  it('should not turn ten marker occurrences inside the content into ten inscriptions', () => {

    const txn = readTransaction('511260af1f9c9cd3118c1e210f18b94da65706901ccb6ff5650be889cf7f3f64');

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(1);

    // ord: inscription 71727156
    expect(inscriptions[0].inscriptionId).toBe('511260af1f9c9cd3118c1e210f18b94da65706901ccb6ff5650be889cf7f3f64i0');
    expect(inscriptions[0].contentType).toBe('text/plain');
    expect(inscriptions[0].contentSize).toBe(1674);
  });

  /*
   * Eight envelope starts back to back, each one immediately followed by
   * another OP_FALSE OP_IF "ord". OP_IF is not a data push, so ord aborts the
   * envelope there and continues after the instructions it already consumed,
   * which swallows the following starts. ord indexes nothing here.
   */
  it('should index nothing when a non-push opcode aborts the envelope', () => {

    const txn = readTransaction('2ac475f9d9aed038be2328f5b5717572f8fad83609a7896bfd811180667c18a4');

    // Assert on the scan itself, not only on parse(). extractInscriptionData
    // rejects this envelope for its own reasons, so a parse() that returns []
    // does not prove that the scan refused to produce a mark.
    const leafScript = getTapscriptElement(txn.vin[1].witness!);
    expect(findEnvelopeMarks(hexToBytes(leafScript!))).toEqual([]);

    expect(InscriptionParserService.parse(txn)).toEqual([]);
  });
});
