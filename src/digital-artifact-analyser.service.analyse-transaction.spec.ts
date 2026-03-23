import { DigitalArtifactAnalyserService } from "./digital-artifact-analyser.service";
import { DigitalArtifactsParserService } from "./digital-artifacts-parser.service";
import { DigitalArtifact } from "./types/digital-artifact";
import { OrdpoolTransactionFlags } from "./types/ordpool-transaction-flags";
import { TransactionSimple } from "./types/transaction-simple";

export const TransactionFlags = {
  rbf: 0b00000001n
}

// Mock the specific method we want to mock, while preserving the rest of the service.
jest.spyOn(DigitalArtifactsParserService, 'parse').mockImplementation(jest.fn());
jest.spyOn(DigitalArtifactAnalyserService, 'analyse').mockImplementation(jest.fn());

describe('DigitalArtifactAnalyserService.analyseTransaction', () => {

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return the initial flags when no artifacts are found', async () => {
    const transaction = { txid: 'test-txid' } as TransactionSimple;
    const initialFlags = BigInt(0);

    // Mock parse to return an empty array (no artifacts)
    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([]);

    const result = await DigitalArtifactAnalyserService.analyseTransaction(transaction, initialFlags);

    expect(result).toBe(initialFlags); // Should return the initial flags
  });

  it('should apply a single artifact flag to the transaction', async () => {
    const transaction = { txid: 'test-txid' } as TransactionSimple;
    const initialFlags = BigInt(0);

    // Mock parse to return a single artifact
    const mockArtifact = { type: 'Cat21', uniqueId: 'test-unique-id', transactionId: 'test-txid' } as DigitalArtifact;
    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([mockArtifact]);

    // Mock analyse to return a single flag for the artifact
    const mockFlag = OrdpoolTransactionFlags.ordpool_cat21;
    (DigitalArtifactAnalyserService.analyse as jest.Mock).mockReturnValue({ flags: mockFlag });

    const result = await DigitalArtifactAnalyserService.analyseTransaction(transaction, initialFlags);

    expect(result).toBe(mockFlag); // Should return the flag set by the artifact
  });

  it('should accumulate flags for multiple artifacts', async () => {
    const transaction = { txid: 'test-txid' } as TransactionSimple;
    const initialFlags = BigInt(0);

    // Mock parse to return multiple artifacts
    const mockArtifacts: DigitalArtifact[] = [
      { type: 'Cat21', uniqueId: 'cat21-unique-id', transactionId: 'test-txid' } as DigitalArtifact,
      { type: 'Inscription', uniqueId: 'inscription-unique-id', transactionId: 'test-txid' } as DigitalArtifact
    ];
    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue(mockArtifacts);

    // Mock analyse to return a different flag for each artifact
    const cat21Flag = OrdpoolTransactionFlags.ordpool_cat21;
    const inscriptionFlag = OrdpoolTransactionFlags.ordpool_inscription;
    (DigitalArtifactAnalyserService.analyse as jest.Mock)
      .mockReturnValueOnce({ flags: cat21Flag })
      .mockReturnValueOnce({ flags: inscriptionFlag });

    const expectedFlags = cat21Flag | inscriptionFlag;

    const result = await DigitalArtifactAnalyserService.analyseTransaction(transaction, initialFlags);

    expect(result).toBe(expectedFlags); // Should return the combined flags of Cat21 and Inscription
  });

  it('should retain existing flags while adding new flags', async () => {
    const transaction = { txid: 'test-txid' } as TransactionSimple;
    const initialFlags = TransactionFlags.rbf; // Pre-existing RBF flag

    // Mock parse to return a new artifact
    const mockArtifact = { type: 'Inscription', uniqueId: 'inscription-unique-id', transactionId: 'test-txid' } as DigitalArtifact;
    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([mockArtifact]);

    // Mock analyse to return the new Inscription flag
    const newFlag = OrdpoolTransactionFlags.ordpool_inscription;
    (DigitalArtifactAnalyserService.analyse as jest.Mock).mockReturnValue({ flags: newFlag });

    const expectedFlags = initialFlags | newFlag;

    const result = await DigitalArtifactAnalyserService.analyseTransaction(transaction, initialFlags);

    expect(result).toBe(expectedFlags); // Should combine the existing RBF flag with the new Inscription flag
  });
});
