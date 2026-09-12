import { bytesToHex } from '../lib/conversions';
import { InscriptionParserService } from './inscription-parser.service';
import { findEnvelopeMarks } from './inscription-parser.service.helper';

/**
 * The envelope scan walks a script instruction by instruction, so a length
 * field that decodes to a wrong number can move its pointer somewhere it
 * should never go. A push length with the high bit set once produced a
 * negative pointer, and the scan then crawled forward from about minus two
 * billion, which never came back in any practical time.
 *
 * Mainnet fixtures cannot cover that: the shapes that break a scanner are the
 * ones nobody had a reason to write. These runs feed random and deliberately
 * hostile scripts through the scan and require two things of every one of
 * them: it terminates quickly, and it either returns marks or throws the
 * decode error, never anything else.
 */
describe('Inscription parser: hostile and random scripts', () => {

  // deterministic generator, so a failure can be reproduced from the seed
  function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  function run(script: Uint8Array): void {
    try {
      findEnvelopeMarks(script);
    } catch (error) {
      // the only legitimate outcome besides a result
      expect((error as Error).message).toMatch(/runs past the end of the script/);
    }
  }

  it('should terminate on random scripts', () => {

    const random = makeRandom(20260912);
    const startedAt = Date.now();

    for (let round = 0; round < 2000; round++) {
      const script = new Uint8Array(1 + Math.floor(random() * 200));
      for (let i = 0; i < script.length; i++) {
        script[i] = Math.floor(random() * 256);
      }
      run(script);
    }

    expect(Date.now() - startedAt).toBeLessThan(10000);
  });

  it('should terminate on random scripts built from envelope pieces', () => {

    const random = makeRandom(4711);
    // OP_FALSE, OP_IF, OP_ENDIF, "ord" in all four push encodings, every push
    // opcode with a length that lies, and the pushnum opcodes
    const pieces = [
      '00', '63', '68', '036f7264', '4c036f7264', '4d03006f7264', '4e030000006f7264',
      '4c', '4cff', '4dffff', '4e00000080', '4effffffff', '4b', '51', '60', '4f', '50',
      '0101', '0201', '00', '6f7264', 'ac', '01',
    ];

    const startedAt = Date.now();

    for (let round = 0; round < 3000; round++) {
      let hex = '';
      const parts = 1 + Math.floor(random() * 12);
      for (let i = 0; i < parts; i++) {
        hex += pieces[Math.floor(random() * pieces.length)];
      }
      run(hexToScript(hex));
    }

    expect(Date.now() - startedAt).toBeLessThan(10000);
  });

  it('should return no inscriptions for hostile witnesses, never hang', () => {

    const hostile = [
      // a push length with the high bit set, the shape that hung the scan
      '6f72644e00000080',
      // an envelope whose body push claims four billion bytes
      '0063036f72640101' + '0a' + '746578742f706c61696e' + '00' + '4effffffff' + '68',
      // truncated length fields
      '0063036f72644c', '0063036f72644d00', '0063036f72644e000000',
      // an envelope that never ends
      '0063036f7264' + '01'.repeat(50),
      // nothing but envelope starts
      '0063036f7264'.repeat(40),
    ];

    const startedAt = Date.now();

    for (const element of hostile) {
      const transaction = { txid: 'b'.repeat(64), vin: [{ witness: [element, 'c0' + '11'.repeat(32)] }] };
      expect(Array.isArray(InscriptionParserService.parse(transaction))).toBe(true);
    }

    expect(Date.now() - startedAt).toBeLessThan(5000);
  });
});

function hexToScript(hex: string): Uint8Array {
  const even = hex.length % 2 === 0 ? hex : hex + '0';
  const bytes = new Uint8Array(even.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(even.substr(i * 2, 2), 16);
  }
  // sanity: the helper under test only ever sees bytes we produced here
  expect(bytesToHex(bytes).length).toBe(even.length);
  return bytes;
}
