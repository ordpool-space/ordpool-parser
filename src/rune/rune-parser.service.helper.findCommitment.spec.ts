import { IEsploraApi } from '../types/mempool';
import { findCommitment } from './rune-parser.service.helper.findCommitment';
import { removeSpacers } from './rune-parser.service.helper';
import { Rune } from './src/rune';
import { bytesToHex } from '../lib/conversions';

jest.mock('./rune-parser.service.helper', () => ({
  removeSpacers: jest.fn(),
}));

jest.mock('./src/rune', () => ({
  Rune: { fromString: jest.fn() }
}));

describe('findCommitment', () => {
  const runeName = 'Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z';

  beforeEach(() => {
    jest.resetAllMocks();
    (removeSpacers as jest.Mock).mockReturnValue('ZZZZZFEHUZZZZZ');
    (Rune.fromString as jest.Mock).mockReturnValue({
      commitment: new Uint8Array([0x12, 0x34, 0x56]),
    });
  });

  it('should return the correct vin if commitment is found', () => {
    // The commitment hex '123456' must appear in the witness element
    const mockTransaction = {
      vin: [
        { witness: ['abcdef', '00123456ff'] },
        { witness: ['987654', 'fedcba'] },
      ]
    } as { vin: IEsploraApi.Vin[] };

    const result = findCommitment(mockTransaction, runeName);

    expect(removeSpacers).toHaveBeenCalledWith(runeName);
    expect(Rune.fromString).toHaveBeenCalledWith('ZZZZZFEHUZZZZZ');
    expect(result).toEqual(mockTransaction.vin[0]);
  });

  it('should return null if no commitment is found in any vin', () => {
    // No witness element contains '123456'
    const mockTransaction = {
      vin: [
        { witness: ['abcdef', 'ffffff'] },
        { witness: ['987654', 'fedcba'] },
      ]
    } as { vin: IEsploraApi.Vin[] };

    const result = findCommitment(mockTransaction, runeName);
    expect(result).toBeNull();
  });

  it('should skip vin if witness is undefined or null', () => {
    const mockTransaction = {
      vin: [
        { witness: null },
        { witness: undefined },
        { witness: ['abcdef', '00123456ff'] },
      ],
    } as { vin: IEsploraApi.Vin[] };

    const result = findCommitment(mockTransaction, runeName);
    expect(result).toEqual(mockTransaction.vin[2]);
  });

  it('should return null if transaction has no vin', () => {
    const result = findCommitment({ vin: [] }, runeName);
    expect(result).toBeNull();
  });
});
