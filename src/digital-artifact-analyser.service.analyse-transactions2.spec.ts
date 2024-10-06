import { DigitalArtifactAnalyserService } from './digital-artifact-analyser.service';
import { DigitalArtifactsParserService } from './digital-artifacts-parser.service';
import { TransactionSimple } from './types/transaction-simple';
import { DigitalArtifactType } from './types/digital-artifact';
import { ParsedInscription } from './types/parsed-inscription';
import { ParsedRunestone } from './types/parsed-runestone';
import { ParsedSrc20 } from './types/parsed-src20';

jest.mock('./digital-artifacts-parser.service');

describe('DigitalArtifactAnalyserService', () => {
  let transactions: TransactionSimple[];

  beforeEach(() => {
    jest.resetAllMocks();

    // Mock data setup
    transactions = [
      {
        txid: 'tx1',
        fee: 1000,
      } as TransactionSimple,
      {
        txid: 'tx2',
        fee: 2000,
      } as TransactionSimple,
      {
        txid: 'tx3',
        fee: 1500,
      } as TransactionSimple,
    ];

    const mockInscriptions: ParsedInscription[] = [
      {
        type: DigitalArtifactType.Inscription,
        inscriptionId: 'inscription1',
        contentType: 'text/plain',
        contentSize: 150,
        envelopeSize: 200,
        getContent: () => 'test content',
      } as ParsedInscription,
      {
        type: DigitalArtifactType.Inscription,
        inscriptionId: 'inscription2',
        contentType: 'application/json',
        contentSize: 200,
        envelopeSize: 300,
        getContent: () => JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'BRC20' }),
      } as ParsedInscription,
    ];

    const mockRunestones: ParsedRunestone[] = [
      {
        type: DigitalArtifactType.Runestone,
        runestone: {
          mint: {
            block: 1n,
            tx: 0,
          },
        },
      } as ParsedRunestone,
      {
        type: DigitalArtifactType.Runestone,
        runestone: {
          mint: {
            block: 1000n,
            tx: 2,
          },
        },
      } as ParsedRunestone,
    ];

    const mockSrc20: ParsedSrc20 = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'src-20', op: 'mint', tick: 'SRC20' }),
    } as ParsedSrc20;

    (DigitalArtifactsParserService.parse as jest.Mock).mockImplementation((tx: TransactionSimple) => {
      if (tx.txid === 'tx1') {
        return [mockInscriptions[0]]; // Only plain text inscription
      } else if (tx.txid === 'tx2') {
        return [mockInscriptions[1], mockRunestones[0]]; // JSON inscription and a Runestone mint
      } else if (tx.txid === 'tx3') {
        return [mockSrc20, mockRunestones[1]]; // SRC-20 and another Runestone mint
      }
      return [];
    });
  });

  it('should correctly analyze transaction artifacts and count amounts', () => {
    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);

    // ** Checking the amount counts
    expect(result.amounts.inscription).toBe(2);  // Two inscriptions
    expect(result.amounts.runeMint).toBe(2);     // Two rune mints
    expect(result.amounts.brc20Mint).toBe(1);    // One BRC-20 mint
    expect(result.amounts.src20Mint).toBe(1);    // One SRC-20 mint

    // ** Checking fee calculations
    expect(result.fees.inscriptionMints).toBe(3000); // tx1 and tx2 fees combined for inscription mints
    expect(result.fees.runeMints).toBe(3500);        // tx2 and tx3 fees combined for rune mints
    expect(result.fees.nonUncommonRuneMints).toBe(1500); // Only tx3 fees (non-Uncommon mint)
    expect(result.fees.brc20Mints).toBe(2000);       // tx2 fee for BRC-20 mint
    expect(result.fees.src20Mints).toBe(1500);       // tx3 fee for SRC-20 mint
  });

  it('should track the most active mint tickers for runes, BRC-20, and SRC-20', () => {
    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);

    // Rune mint activity tracking
    expect(result.runes.mostActiveMint).toBe('1:0'); // Most active mint is Uncommon Goods Rune
    expect(result.runes.mostActiveNonUncommonMint).toBe('1000:2'); // Most active non-Uncommon mint

    // BRC-20 mint activity tracking
    expect(result.brc20.mostActiveMint).toBe('BRC20');

    // SRC-20 mint activity tracking
    expect(result.src20.mostActiveMint).toBe('SRC20');
  });

  it('should calculate the total and average envelope and content sizes for inscriptions', () => {
    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);

    // ** Checking the sizes and ids
    expect(result.inscriptions.totalEnvelopeSize).toBe(500); // Sum of 200 and 300
    expect(result.inscriptions.totalContentSize).toBe(350);  // Sum of 150 and 200
    expect(result.inscriptions.largestEnvelopeSize).toBe(300);
    expect(result.inscriptions.largestContentSize).toBe(200);
    expect(result.inscriptions.largestEnvelopeInscriptionId).toBe('inscription2');
    expect(result.inscriptions.largestContentInscriptionId).toBe('inscription2');

    expect(result.inscriptions.averageEnvelopeSize).toBe(500 / 2); // 250
    expect(result.inscriptions.averageContentSize).toBe(350 / 2); // 175
  });

  it('should correctly set empty fields when no artifacts are present', () => {
    // Clear the mock parser's return value for this test case
    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([]);

    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);

    // ** Checking all zero or null values
    expect(result.amounts.inscription).toBe(0);
    expect(result.amounts.runeMint).toBe(0);
    expect(result.amounts.brc20Mint).toBe(0);
    expect(result.amounts.src20Mint).toBe(0);

    expect(result.fees.inscriptionMints).toBe(0);
    expect(result.fees.runeMints).toBe(0);
    expect(result.fees.nonUncommonRuneMints).toBe(0);
    expect(result.fees.brc20Mints).toBe(0);
    expect(result.fees.src20Mints).toBe(0);

    expect(result.inscriptions.totalEnvelopeSize).toBe(0);
    expect(result.inscriptions.totalContentSize).toBe(0);
    expect(result.inscriptions.largestEnvelopeSize).toBe(0);
    expect(result.inscriptions.largestContentSize).toBe(0);
    expect(result.inscriptions.largestEnvelopeInscriptionId).toBe(null);
    expect(result.inscriptions.largestContentInscriptionId).toBe(null);
    expect(result.inscriptions.averageEnvelopeSize).toBe(0);
    expect(result.inscriptions.averageContentSize).toBe(0);

    expect(result.runes.mostActiveMint).toBe(null);
    expect(result.runes.mostActiveNonUncommonMint).toBe(null);
    expect(result.brc20.mostActiveMint).toBe(null);
    expect(result.src20.mostActiveMint).toBe(null);
  });
});
