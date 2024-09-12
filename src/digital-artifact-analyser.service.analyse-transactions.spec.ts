import { DigitalArtifactAnalyserService } from "./digital-artifact-analyser.service";
import { DigitalArtifactsParserService } from "./digital-artifacts-parser.service";
import { DigitalArtifact, DigitalArtifactType } from "./types/digital-artifact";
import { ParsedInscription } from "./types/parsed-inscription";
import { ParsedRunestone } from "./types/parsed-runestone";
import { ParsedSrc20 } from "./types/parsed-src20";
import { TransactionSimple } from "./types/transaction-simple";

jest.mock('./digital-artifacts-parser.service');

describe('DigitalArtifactAnalyserService.analyseTransactions', () => {
  let tx: TransactionSimple;

  beforeEach(() => {
    tx = { txid: 'dummy_txid' } as TransactionSimple;
    jest.clearAllMocks();
  });

  it('should count one artifact in one transaction', () => {
    const artifacts: DigitalArtifact[] = [
      { type: DigitalArtifactType.Inscription, contentType: '', uniqueId: 'unique1', transactionId: 'tx1' } as ParsedInscription
    ];

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue(artifacts);

    const stats = DigitalArtifactAnalyserService.analyseTransactions([tx]);
    expect(stats.amount.inscription).toBe(1);
  });

  it('should count multiple artifacts in one transaction', () => {
    const artifacts: DigitalArtifact[] = [
      { type: DigitalArtifactType.Atomical, uniqueId: 'unique1', transactionId: 'tx1' },
      { type: DigitalArtifactType.Atomical, uniqueId: 'unique2', transactionId: 'tx2' },
      { type: DigitalArtifactType.Cat21,    uniqueId: 'unique3', transactionId: 'tx3' }
    ];

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue(artifacts);

    const stats = DigitalArtifactAnalyserService.analyseTransactions([tx]);
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

    const stats = DigitalArtifactAnalyserService.analyseTransactions([tx1, tx2]);
    expect(stats.amount.atomical).toBe(1);
    expect(stats.amount.cat21).toBe(3);
  });

  it('should count multiple flags for an Inscription with BRC-20 mint', () => {
    const artifacts: any[] = [
      {
        type: DigitalArtifactType.Inscription,
        contentType: 'application/json',
        getContent: () => JSON.stringify({ p: 'brc-20', op: 'mint' }),
      } as ParsedInscription,
    ];

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue(artifacts);

    const stats = DigitalArtifactAnalyserService.analyseTransactions([tx]);
    expect(stats.amount.inscription).toBe(1);
    expect(stats.amount.inscriptionMint).toBe(1);
    expect(stats.amount.brc20Mint).toBe(1);
  });

  it('should count multiple flags for a Runestone with etching and mint', () => {
    const artifacts: any[] = [
      {
        type: DigitalArtifactType.Runestone,
        runestone: {
          etching: true,
          mint: true,
        },
      } as unknown as ParsedRunestone,
    ];

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue(artifacts);

    const stats = DigitalArtifactAnalyserService.analyseTransactions([tx]);
    expect(stats.amount.rune).toBe(1);
    expect(stats.amount.runeEtch).toBe(1);
    expect(stats.amount.runeMint).toBe(1);
  });

  it('should count SRC-20 deploy correctly', () => {
    const artifacts: any[] = [
      {
        type: DigitalArtifactType.Src20,
        getContent: () => JSON.stringify({ p: 'src-20', op: 'deploy' }),
      } as ParsedSrc20,
    ];

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue(artifacts);

    const stats = DigitalArtifactAnalyserService.analyseTransactions([tx]);
    expect(stats.amount.src20).toBe(1);
    expect(stats.amount.src20Deploy).toBe(1);
  });
});
