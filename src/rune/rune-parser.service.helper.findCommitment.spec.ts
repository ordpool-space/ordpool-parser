import { bytesToHex } from '../lib/conversions';
import { IEsploraApi } from '../types/mempool';
import { removeSpacers } from './rune-parser.service.helper';
import { findCommitment } from './rune-parser.service.helper.findCommitment';
import { Rune } from './src/rune';

/**
 * Real on-chain-shape tests for findCommitment.
 *
 * No mocks: removeSpacers, Rune.fromString, bytesToHex, and
 * isStringInArrayOfStrings all run for real. A mock-heavy version of these
 * tests would happily pass even if Rune.fromString returned the wrong
 * commitment bytes -- the whole point of the function is to derive the
 * right commitment from a rune name and find it inside a witness, so the
 * derivation has to be exercised.
 *
 * The test rune `Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z` collapses to `ZZZZZFEHUZZZZZ`
 * whose Rune.commitment hex is `b530368c74df10a303`. That literal value is
 * pinned below so any change to Rune's encoding logic surfaces here as well.
 */

const RUNE_NAME = 'Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z';
const COMMITMENT_HEX = 'b530368c74df10a303';

describe('findCommitment', () => {

  it('derives the same commitment hex our test data assumes', () => {
    // Pin the upstream encoding: if Rune.fromString or removeSpacers ever
    // changes shape, this fires before the other tests start lying.
    const cleaned = removeSpacers(RUNE_NAME);
    expect(cleaned).toBe('ZZZZZFEHUZZZZZ');
    const commitment = Rune.fromString(cleaned).commitment;
    expect(bytesToHex(commitment)).toBe(COMMITMENT_HEX);
  });

  it('returns the first vin whose witness contains the commitment', () => {
    const tx: { vin: IEsploraApi.Vin[] } = {
      vin: [
        { witness: ['deadbeef', COMMITMENT_HEX, '99'] } as IEsploraApi.Vin,
        { witness: ['ffff'] } as IEsploraApi.Vin,
      ],
    };
    const result = findCommitment(tx, RUNE_NAME);
    expect(result).toBe(tx.vin[0]);
  });

  it('skips vins until it finds the witness with the commitment', () => {
    const tx: { vin: IEsploraApi.Vin[] } = {
      vin: [
        { witness: ['deadbeef'] } as IEsploraApi.Vin,
        { witness: ['cafebabe'] } as IEsploraApi.Vin,
        { witness: [COMMITMENT_HEX] } as IEsploraApi.Vin,
      ],
    };
    expect(findCommitment(tx, RUNE_NAME)).toBe(tx.vin[2]);
  });

  it('skips vins with null or undefined witness', () => {
    const tx: { vin: IEsploraApi.Vin[] } = {
      vin: [
        { witness: null as unknown as string[] } as IEsploraApi.Vin,
        { witness: undefined as unknown as string[] } as IEsploraApi.Vin,
        { witness: [COMMITMENT_HEX] } as IEsploraApi.Vin,
      ],
    };
    expect(findCommitment(tx, RUNE_NAME)).toBe(tx.vin[2]);
  });

  it('returns null when no vin witness contains the commitment', () => {
    const tx: { vin: IEsploraApi.Vin[] } = {
      vin: [
        { witness: ['deadbeef'] } as IEsploraApi.Vin,
        { witness: ['cafebabe'] } as IEsploraApi.Vin,
      ],
    };
    expect(findCommitment(tx, RUNE_NAME)).toBeNull();
  });

  it('returns null when the tx has no vin', () => {
    expect(findCommitment({ vin: [] }, RUNE_NAME)).toBeNull();
  });

  it('matches the commitment as a substring inside a larger witness blob', () => {
    // The function uses isStringInArrayOfStrings (which calls
    // String.prototype.includes), so the commitment can appear inside a
    // larger hex string. This is what the ord rune updater does in
    // practice: the commitment is one push inside a Tapscript blob like
    // <pushdata><commitment><opdrop>, and we search the assembled hex.
    const tx: { vin: IEsploraApi.Vin[] } = {
      vin: [
        { witness: ['00' + COMMITMENT_HEX + '75'] } as IEsploraApi.Vin,   // <something> commitment OP_DROP
      ],
    };
    expect(findCommitment(tx, RUNE_NAME)).toBe(tx.vin[0]);
  });
});
