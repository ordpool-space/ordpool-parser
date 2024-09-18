import { warn } from 'console';

import { loadCompressedJsonData } from '../testdata/test.helper';
import { DigitalArtifactAnalyserService } from './digital-artifact-analyser.service';
import { TransactionExtended } from './types/mempool';

describe('DigitalArtifacts Parser', () => {

  it('should count all artifacts in block 832,947, which only holds the 3.97 MB Runestone inscription', () => {

    const transactions = loadCompressedJsonData('block_832947_txns.json.br') as TransactionExtended[];

    const start = performance.now();
    var ordpoolStats = DigitalArtifactAnalyserService.analyseTransactions(transactions);
    const end = performance.now();
    warn(`Block 832,947 txns – Execution time: ${(end - start) / 1000 }s`);

    expect(ordpoolStats.amount.inscription).toBe(1);
    expect(ordpoolStats.amount.inscriptionMint).toBe(1);
  });

  it('should count all artifacts in block 831,802, which holds a lot BRC-20 trio mints and a large video inscription', () => {

    const transactions = loadCompressedJsonData('block_831802_txns.json.br') as TransactionExtended[];

    const start = performance.now();
    var ordpoolStats = DigitalArtifactAnalyserService.analyseTransactions(transactions);
    const end = performance.now();
    warn(`Block 831,802 txns – Execution time: ${(end - start) / 1000 }s`);

    expect(ordpoolStats.amount.brc20).toBe(2100);
    expect(ordpoolStats.amount.brc20Mint).toBe(2100);
  });
});
