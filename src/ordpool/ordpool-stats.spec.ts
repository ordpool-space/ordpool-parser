import { DigitalArtifactsParserService } from "../digital-artifacts-parser.service";
import { DigitalArtifact, DigitalArtifactType } from "../types/digital-artifact";
import { TransactionSimple } from "../types/transaction-simple";
import { getOrdpoolTransactionStats } from "./ordpool-stats";

jest.mock('../digital-artifacts-parser.service');

describe('Ordpool Transaction Stats Tests', () => {
  let tx: TransactionSimple;

  beforeEach(() => {
    tx = { txid: 'dummy_txid' } as TransactionSimple;
    jest.clearAllMocks();
  });

  it('should count Atomical artifacts correctly', () => {
    const artifacts: DigitalArtifact[] = [
      { type: DigitalArtifactType.Atomical, uniqueId: 'unique1', transactionId: 'tx1' }
    ];

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue(artifacts);

    const stats = getOrdpoolTransactionStats([tx]);
    expect(stats.amount.atomical).toBe(1);
  });

  it('should count multiple artifacts in one transaction', () => {
    const artifacts: DigitalArtifact[] = [
      { type: DigitalArtifactType.Atomical, uniqueId: 'unique1', transactionId: 'tx1' },
      { type: DigitalArtifactType.Atomical, uniqueId: 'unique2', transactionId: 'tx2' },
      { type: DigitalArtifactType.Cat21,    uniqueId: 'unique3', transactionId: 'tx3' }
    ];

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue(artifacts);

    const stats = getOrdpoolTransactionStats([tx]);
    expect(stats.amount.atomical).toBe(2);
    expect(stats.amount.cat21).toBe(1);
  });

  it('should handle multiple transactions and artifacts', () => {
    const tx1: TransactionSimple = { txid: 'tx1' } as TransactionSimple;
    const tx2: TransactionSimple = { txid: 'tx2' } as TransactionSimple;

    const artifacts1: DigitalArtifact[] = [
      { type: DigitalArtifactType.Atomical, uniqueId: 'unique1', transactionId: 'tx1' }
    ];

    const artifacts2: DigitalArtifact[] = [
      { type: DigitalArtifactType.Cat21, uniqueId: 'unique2', transactionId: 'tx2' },
      { type: DigitalArtifactType.Cat21, uniqueId: 'unique3', transactionId: 'tx3' },
      { type: DigitalArtifactType.Cat21, uniqueId: 'unique4', transactionId: 'tx4' }
    ];

    (DigitalArtifactsParserService.parse as jest.Mock)
      .mockReturnValueOnce(artifacts1)
      .mockReturnValueOnce(artifacts2);

    const stats = getOrdpoolTransactionStats([tx1, tx2]);
    expect(stats.amount.atomical).toBe(1);
    expect(stats.amount.cat21).toBe(3);
  });
});
