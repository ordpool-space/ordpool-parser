import { readTransaction } from '../testdata/test.helper';
import { DigitalArtifactAnalyserService } from './digital-artifact-analyser.service';
import { TransactionSimplePlus } from './types/transaction-simple';

// Real mainnet atomicals DFT mint — operation 'dft', ticker 'atom'
const ATOMICAL_DFT_TXID = '1d2f39f54320631d0432fa495a45a4f298a2ca1b18adef8e4356e327d003a694';

// Real mainnet Counterparty enhanced_send — message type ID 2
const ENHANCED_SEND_TXID = 'f3981dac3d2d43abf6c3bb059fbd998bcd8f76c4174fd1e2668599b9713649c9';

describe('DigitalArtifactAnalyserService — satellite arrays', () => {

  it('records every atomical operation in atomicalOps with operation + ticker', async () => {
    const tx = readTransaction(ATOMICAL_DFT_TXID) as unknown as TransactionSimplePlus;
    const stats = await DigitalArtifactAnalyserService.analyseTransactions([tx]);

    expect(stats.atomicals.atomicalOps).toEqual([
      { txId: ATOMICAL_DFT_TXID, operation: 'dft', ticker: 'atom' },
    ]);
  });

  it('records every counterparty message in counterpartyMessages with messageType + id + encoding', async () => {
    const tx = readTransaction(ENHANCED_SEND_TXID) as unknown as TransactionSimplePlus;
    const stats = await DigitalArtifactAnalyserService.analyseTransactions([tx]);

    expect(stats.counterparty.counterpartyMessages).toHaveLength(1);
    const message = stats.counterparty.counterpartyMessages[0];
    expect(message.txId).toBe(ENHANCED_SEND_TXID);
    expect(message.messageType).toBe('enhanced_send');
    expect(message.messageTypeId).toBe(2);
    expect(message.encoding).toBe('opreturn');
  });

  it('returns empty arrays when neither atomicals nor counterparty are present', async () => {
    // CAT-21 genesis tx: no atomical, no counterparty.
    const tx = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892') as unknown as TransactionSimplePlus;
    const stats = await DigitalArtifactAnalyserService.analyseTransactions([tx]);

    expect(stats.atomicals.atomicalOps).toEqual([]);
    expect(stats.counterparty.counterpartyMessages).toEqual([]);
  });
});
