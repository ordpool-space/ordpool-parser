import { bytesToHex, isStringInArrayOfStrings } from '../lib/conversions';
import { IEsploraApi } from '../types/mempool';
import { removeSpacers } from './rune-parser.service.helper';
import { findCommitment } from './rune-parser.service.helper.findCommitment';
import { Rune } from './src/rune';


jest.mock('../lib/conversions', () => ({
  isStringInArrayOfStrings: jest.fn(),
  bytesToHex: jest.fn()
}));

jest.mock('./rune-parser.service.helper', () => ({
  removeSpacers: jest.fn(),
  isStringInArrayOfStrings: jest.fn()
}));

jest.mock('./src/rune', () => ({
  Rune: { fromString: jest.fn() }
}));

describe('findCommitment', () => {
  let mockTransaction: { vin: IEsploraApi.Vin[] };
  let runeName: string;

  beforeEach(() => {
    jest.resetAllMocks();

    // Sample mock transaction structure
    mockTransaction = {
      vin: [
        { witness: ['abcdef', '123456'] },
        { witness: ['987654', 'fedcba'] },
      ]
    } as { vin: IEsploraApi.Vin[] };

    runeName = 'Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z';

    // Mock the basic helpers
    (removeSpacers as jest.Mock).mockReturnValue('ZZZZZFEHUZZZZZ');
    (bytesToHex as jest.Mock).mockReturnValue('123456');

    // Mock Rune.fromString to return the commitment
    (Rune.fromString as jest.Mock).mockReturnValue({
      commitment: new Uint8Array([0x12, 0x34, 0x56]),
    });
  });

  it('should return the correct vin if commitment is found', () => {

    // Mock the function to return true when a commitment is found
    (isStringInArrayOfStrings as jest.Mock).mockReturnValue(true);

    const result = findCommitment(mockTransaction, runeName);

    expect(removeSpacers).toHaveBeenCalledWith(runeName);
    expect(Rune.fromString).toHaveBeenCalledWith('ZZZZZFEHUZZZZZ');
    expect(bytesToHex).toHaveBeenCalledWith(new Uint8Array([0x12, 0x34, 0x56]));
    expect(isStringInArrayOfStrings).toHaveBeenCalledWith('123456', mockTransaction.vin[0].witness);
    expect(result).toEqual(mockTransaction.vin[0]); // The first vin should be returned
  });

  it('should return null if no commitment is found in any vin', () => {

    // Mock the function to return false when no commitment is found
    (isStringInArrayOfStrings as jest.Mock).mockReturnValue(false);

    const result = findCommitment(mockTransaction, runeName);

    expect(removeSpacers).toHaveBeenCalledWith(runeName);
    expect(Rune.fromString).toHaveBeenCalledWith('ZZZZZFEHUZZZZZ');
    expect(bytesToHex).toHaveBeenCalledWith(new Uint8Array([0x12, 0x34, 0x56]));
    expect(isStringInArrayOfStrings).toHaveBeenCalledWith('123456', mockTransaction.vin[0].witness);
    expect(isStringInArrayOfStrings).toHaveBeenCalledWith('123456', mockTransaction.vin[1].witness);
    expect(result).toBeNull(); // Since no commitment is found, result should be null
  });

  it('should skip vin if witness is undefined or null', () => {
    // Update mockTransaction to include a vin without witness
    mockTransaction = {
      vin: [
        { witness: null },
        { witness: undefined },
        { witness: ['abcdef', '123456'] }, // Only this one should be checked
      ],
    } as { vin: IEsploraApi.Vin[] };

    // Mock the function to return true when a commitment is found
    (isStringInArrayOfStrings as jest.Mock).mockReturnValue(true);

    const result = findCommitment(mockTransaction, runeName);

    expect(isStringInArrayOfStrings).toHaveBeenCalledWith('123456', mockTransaction.vin[2].witness);
    expect(result).toEqual(mockTransaction.vin[2]); // Only the third vin should be checked and returned
  });

  it('should return null if transaction has no vin', () => {

    // Mock an empty vin array
    mockTransaction = { vin: [] };

    const result = findCommitment(mockTransaction, runeName);

    expect(result).toBeNull(); // Since no vin exists, result should be null
  });
});
