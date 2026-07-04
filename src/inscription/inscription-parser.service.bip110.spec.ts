import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';

/**
 * BIP-110 compatible envelope (ordinals/ord#4545). Payload identical to
 * the classic ord envelope; only the outer wrapper differs.
 *
 * SYNTHETIC DATA: no BIP-110 shape inscription exists on chain yet.
 * The fixture uses a "deadbeef"-repeat txid. GOLDEN RULE waived so the
 * wire-format parsing is pinned ahead of the first real tx.
 */
describe('BIP-110 compatible inscription envelope', () => {

  it('parses a "Hello, world!" inscription wrapped in the BIP-110 envelope', async () => {

    const txid = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const inscription = InscriptionParserService.parse(readTransaction(txid))[0];

    expect(inscription.inscriptionId).toBe(`${txid}i0`);
    expect(inscription.contentType).toBe('text/plain');
    expect(await inscription.getContent()).toBe('Hello, world!');
    // 4-byte "ord" marker + 5 pushes (32 bytes) + 3 drops.
    expect(inscription.envelopeSize).toBe(35);
  });
});
