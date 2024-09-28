import { DigitalArtifactAnalyserService } from './digital-artifact-analyser.service';
import { DigitalArtifactsParserService } from './digital-artifacts-parser.service';
import { TransactionSimple } from './types/transaction-simple';
import { DigitalArtifactType } from './types/digital-artifact';
import { ParsedInscription } from './types/parsed-inscription';
import { ParsedRunestone } from './types/parsed-runestone';
import { ParsedSrc20 } from './types/parsed-src20';

jest.mock('./digital-artifacts-parser.service');

describe('DigitalArtifactAnalyserService.analyseTransactions - Advanced Test Cases', () => {
  let transactions: TransactionSimple[];

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should handle artifacts with malformed JSON content gracefully', () => {
    const malformedJsonInscription: ParsedInscription = {
      type: DigitalArtifactType.Inscription,
      inscriptionId: 'inscription1',
      contentType: 'application/json',
      contentSize: 100,
      envelopeSize: 150,
      getContent: () => '{"invalidJson": true', // Malformed JSON
    } as ParsedInscription;

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([malformedJsonInscription]);

    var transactions = [
      {
        txid: 'tx1',
        fee: 1000,
      } as TransactionSimple,
    ];

    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);
    expect(result.amount.brc20Mint).toBe(0); // Should not be considered a valid BRC-20 mint
    expect(result.inscription.totalContentSize).toBe(100);
    expect(result.fees.inscriptionMints).toBe(1000);
  });

  it('should handle zero-fee transactions correctly', () => {
    const zeroFeeInscription: ParsedInscription = {
      type: DigitalArtifactType.Inscription,
      inscriptionId: 'inscription2',
      contentType: 'text/plain',
      contentSize: 50,
      envelopeSize: 100,
      getContent: () => 'plain text content',
    } as ParsedInscription;

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([zeroFeeInscription]);

    var transactions = [
      {
        txid: 'tx1',
        fee: 0, // Edge case: Zero fee
      } as TransactionSimple,
      {
        txid: 'tx2',
        fee: 1000,
      } as TransactionSimple,
    ];

    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);
    expect(result.amount.inscriptionMint).toBe(2); // Should count two inscriptions
    expect(result.fees.inscriptionMints).toBe(1000); // Fee should still be 0 + 1000 == 1000
  });

  it('should handle multiple artifacts of the same type in a single transaction', () => {
    const duplicateInscription1: ParsedInscription = {
      type: DigitalArtifactType.Inscription,
      inscriptionId: 'inscription1',
      contentType: 'text/plain',
      contentSize: 100,
      envelopeSize: 150,
      getContent: () => 'inscription 1 content',
    } as ParsedInscription;

    const duplicateInscription2: ParsedInscription = {
      type: DigitalArtifactType.Inscription,
      inscriptionId: 'inscription2',
      contentType: 'text/plain',
      contentSize: 200,
      envelopeSize: 250,
      getContent: () => 'inscription 2 content',
    } as ParsedInscription;

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([duplicateInscription1, duplicateInscription2]);

    var transactions = [
      {
        txid: 'tx1',
        fee: 1000,
      } as TransactionSimple,
    ];

    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);
    expect(result.amount.inscriptionMint).toBe(2); // Two inscriptions should be counted
    expect(result.inscription.totalEnvelopeSize).toBe(400); // Sum of 150 and 250
    expect(result.inscription.totalContentSize).toBe(300);  // Sum of 100 and 200
    expect(result.fees.inscriptionMints).toBe(1000);
  });

  it('should handle artifacts with missing fields gracefully', () => {
    const missingFieldsRunestone: ParsedRunestone = {
      type: DigitalArtifactType.Runestone,
      runestone: null, // No valid runestone data
    } as ParsedRunestone;

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([missingFieldsRunestone]);

    var transactions = [
      {
        txid: 'tx1',
        fee: 1000,
      } as TransactionSimple
    ];

    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);
    expect(result.amount.runeMint).toBe(0); // Should not count the mint since it’s invalid
    expect(result.fees.runeMints).toBe(0); // No fees should be counted
  });

  it('should handle overlapping and non-overlapping artifact flags correctly', () => {
    const overlappingArtifacts: (ParsedInscription | ParsedRunestone)[] = [
      {
        type: DigitalArtifactType.Inscription,
        inscriptionId: 'overlap1',
        contentType: 'application/json',
        contentSize: 100,
        envelopeSize: 150,
        getContent: () => JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'BRC20' }),
      } as ParsedInscription,
      {
        type: DigitalArtifactType.Runestone,
        runestone: {
          mint: {
            block: 2n,
            tx: 1,
          },
        },
      } as ParsedRunestone,
    ];

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue(overlappingArtifacts);

    var transactions = [
      {
        txid: 'tx2',
        fee: 1000,
      } as TransactionSimple,
    ];

    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);
    expect(result.amount.inscriptionMint).toBe(1); // Counts the inscription
    expect(result.amount.brc20Mint).toBe(1); // Also a BRC-20 mint
    expect(result.amount.runeMint).toBe(1); // Separate rune mint
    expect(result.fees.inscriptionMints).toBe(1000); // Fee should be counted only once
    expect(result.fees.brc20Mints).toBe(1000); // Fee should be counted only once for BRC-20 mint
    expect(result.fees.runeMints).toBe(1000); // Fee should be counted once for the rune mint
  });

  it('should correctly track the most active Rune mint and Non-UncommonGoods Rune mint', () => {
    const runeMint1: ParsedRunestone = {
      type: DigitalArtifactType.Runestone,
      runestone: {
        mint: { block: 1n, tx: 0 } // Uncommon Goods
      },
    } as ParsedRunestone;

    const runeMint2: ParsedRunestone = {
      type: DigitalArtifactType.Runestone,
      runestone: {
        mint: { block: 1n, tx: 0 } // Uncommon Goods
      },
    } as ParsedRunestone;

    const runeMint3: ParsedRunestone = {
      type: DigitalArtifactType.Runestone,
      runestone: {
        mint: {
          block: 840000n,
          tx: 1,
        },
      },
    } as ParsedRunestone;

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([runeMint1, runeMint2, runeMint3]);

    var transactions = [
      {
        txid: 'tx1',
        fee: 0, // Edge case: Zero fee
      } as TransactionSimple,
      {
        txid: 'tx2',
        fee: 1000,
      } as TransactionSimple,
    ];

    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);
    expect(result.rune.mostActiveMint).toBe('1-0'); // Most active mint key
    expect(result.rune.mostActiveNonUncommonMint).toBe('840000-1'); // Should match for non-uncommon mint as well
    expect(result.fees.runeMints).toBe(1000); // Fee should only be counted once
  });

  it('should correctly track most active BRC-20 mint', () => {

    const brc20Mint: ParsedInscription = {
      type: DigitalArtifactType.Inscription,
      inscriptionId: 'brc20Mint1',
      contentType: 'application/json',
      contentSize: 100,
      envelopeSize: 150,
      getContent: () => JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'AAA' }),
    } as ParsedInscription;

    const brc20Mint2: ParsedInscription = {
      type: DigitalArtifactType.Inscription,
      inscriptionId: 'brc20Mint1',
      contentType: 'application/json',
      contentSize: 100,
      envelopeSize: 150,
      getContent: () => JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'AAA' }),
    } as ParsedInscription;

    const brc20Mint3: ParsedInscription = {
      type: DigitalArtifactType.Inscription,
      inscriptionId: 'brc20Mint1',
      contentType: 'application/json',
      contentSize: 100,
      envelopeSize: 150,
      getContent: () => JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'BBB' }),
    } as ParsedInscription;

    (DigitalArtifactsParserService.parse as jest.Mock)
      .mockReturnValueOnce([brc20Mint])
      .mockReturnValueOnce([brc20Mint2])
      .mockReturnValueOnce([brc20Mint3]);

    transactions = [
      {
        txid: 'tx1',
        fee: 1000,
      } as TransactionSimple,
      {
        txid: 'tx2',
        fee: 1000,
      } as TransactionSimple,
      {
        txid: 'tx3',
        fee: 1000,
      } as TransactionSimple,
    ];

    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);
    expect(result.brc20.mostActiveMint).toBe('AAA'); // Most active ticker should be 'AAA'
    expect(result.amount.brc20Mint).toBe(3);
  });

  it('should correctly track most active SRC-20 mint', () => {
    const src20Mint: ParsedSrc20 = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'src-20', op: 'mint', tick: 'SRC' }),
    } as ParsedSrc20;

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([src20Mint]);

    var transactions = [
      {
        txid: 'tx1',
        fee: 1000,
      } as TransactionSimple,
    ];

    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);
    expect(result.src20.mostActiveMint).toBe('SRC'); // Most active ticker should be 'SRC'
    expect(result.amount.src20Mint).toBe(1); // SRC-20 mint should be counted once
  });

  it('should handle transactions with no digital artifacts gracefully', () => {
    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([]);

    var transactions = [
      {
        txid: 'tx1',
        fee: 1000,
      } as TransactionSimple,
    ];

    const result = DigitalArtifactAnalyserService.analyseTransactions(transactions);
    expect(result.amount.inscriptionMint).toBe(0); // No inscriptions should be counted
    expect(result.amount.runeMint).toBe(0); // No runes should be counted
    expect(result.fees.inscriptionMints).toBe(0); // No fees should be counted
  });

  it('should correctly handle multiple flags in a single artifact', () => {
    const combinedArtifact: ParsedInscription = {
      type: DigitalArtifactType.Inscription,
      inscriptionId: 'combined1',
      contentType: 'application/json',
      contentSize: 100,
      envelopeSize: 150,
      getContent: () => JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'XYZ' }),
    } as ParsedInscription;

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue([combinedArtifact]);

    const result = DigitalArtifactAnalyserService.analyseTransactions([transactions[1]]);
    expect(result.amount.inscriptionMint).toBe(1); // Counts the inscription
    expect(result.amount.brc20Mint).toBe(1); // Also a BRC-20 mint
    expect(result.fees.inscriptionMints).toBe(1000); // Fee should be counted once
    expect(result.fees.brc20Mints).toBe(1000); // Fee should be counted once for BRC-20 mint
  });

  it('should correctly analyze multiple unique transactions with CAT-21', () => {
    const uniqueTransaction1 = {
      txid: 'unique_tx1',
      fee: 500,
    } as TransactionSimple;

    const uniqueTransaction2 = {
      txid: 'unique_tx2',
      fee: 800,
    } as TransactionSimple;

    const brc20Mint1: ParsedInscription = {
      type: DigitalArtifactType.Inscription,
      inscriptionId: 'brc20Mint1',
      contentType: 'application/json',
      contentSize: 100,
      envelopeSize: 150,
      getContent: () => JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'AAA' }),
    } as ParsedInscription;

    const brc20Mint2: ParsedInscription = {
      type: DigitalArtifactType.Inscription,
      inscriptionId: 'brc20Mint2',
      contentType: 'application/json',
      contentSize: 200,
      envelopeSize: 300,
      getContent: () => JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'BBB' }),
    } as ParsedInscription;

    const cat21Mint: ParsedInscription = {
      type: DigitalArtifactType.Cat21,
    } as ParsedInscription;

    (DigitalArtifactsParserService.parse as jest.Mock)
      .mockReturnValueOnce([brc20Mint1, cat21Mint])
      .mockReturnValueOnce([brc20Mint2, cat21Mint]);

    const result = DigitalArtifactAnalyserService.analyseTransactions([uniqueTransaction1, uniqueTransaction2]);
    expect(result.brc20.mostActiveMint).toBe('AAA'); // First mint should be most active initially
    expect(result.amount.brc20Mint).toBe(2); // Two mints should be counted
    expect(result.fees.brc20Mints).toBe(1300); // Sum of 500 and 800

    expect(result.amount.cat21Mint).toBe(2); // Two mints should be counted
    expect(result.fees.cat21Mints).toBe(1300); // Sum of 500 and 800
  });

  it('should handle transactions with a large number of artifacts', () => {
    const largeNumberOfArtifacts: ParsedInscription[] = Array.from({ length: 1000 }, (_, i) => ({
      type: DigitalArtifactType.Inscription,
      inscriptionId: `inscription${i}`,
      contentType: 'text/plain',
      contentSize: 50,
      envelopeSize: 100,
      getContent: () => 'content',
    })) as ParsedInscription[];

    (DigitalArtifactsParserService.parse as jest.Mock).mockReturnValue(largeNumberOfArtifacts);

    const largeTransaction = {
      txid: 'large_tx',
      fee: 1000,
    } as TransactionSimple;

    const result = DigitalArtifactAnalyserService.analyseTransactions([largeTransaction]);
    expect(result.amount.inscriptionMint).toBe(1000); // Should count all 1000 inscriptions
    expect(result.inscription.totalEnvelopeSize).toBe(100000); // 100 * 1000
    expect(result.inscription.totalContentSize).toBe(50000); // 50 * 1000
    expect(result.fees.inscriptionMints).toBe(1000); // Fee should be counted once
  });
});
