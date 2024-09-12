import { getTransactionsOfBlock840000 } from '../testdata/transactions-of-block-84000';
import { DigitalArtifactAnalyserService } from './digital-artifact-analyser.service';

describe('DigitalArtifacts Parser', () => {

  /**
   * Compatible with Blocks.$updateBlocks()
   * (this one loads all transactions)
   *
   * NOT Compatible with Blocks.$indexBlock --> Blocks.$getBlockExtended
   * (this one only loads the coinbase txn)
   *
   * const block2: IEsploraApi.Block = {
   *   id: "0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5",
   *   height: 840000,
   *   version: 710926336,
   *   timestamp: 1713571767,
   *   bits: 386089497,
   *   nonce: 3932395645,
   *   difficulty: 86388558925171.02,
   *   merkle_root: "031b417c3a1828ddf3d6527fc210daafcc9218e81f98257f88d4d43bd7a5894f",
   *   tx_count: 3050,
   *   size: 2325617,
   *   weight: 3993281,
   *   previousblockhash: "0000000000000000000172014ba58d66455762add0512355ad651207918494ab",
   *   mediantime: 1713570208,
   *   stale: false,
   * }
    *
   * see ordpool: backend/src/api/blocks.ts
   */
  it('should count all artifacts in a bitcoin block, provided by the mempool backend (esplora API)', () => {

    var transactions = getTransactionsOfBlock840000();
    var ordpoolStats = DigitalArtifactAnalyserService.analyseTransactions(transactions);

    expect(ordpoolStats.amount.cat21).toBe(5);
    expect(ordpoolStats.amount.cat21Mint).toBe(5);
  })
});
