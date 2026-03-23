import { warn } from 'console';

import { getBlock840000Txns } from '../../testdata/block_840000_txns';
import { getRawBlock840000 } from '../../testdata/block_84000_from_rpc';
import { convertVerboseBlockToSimplePlus, translateScriptPubKeyType } from './bitcoin-rpc';

describe('translateScriptPubKeyType', () => {
  it('should correctly map Bitcoin Core scriptPubKey types to Esplora types', () => {
      expect(translateScriptPubKeyType('pubkey')).toBe('p2pk');
      expect(translateScriptPubKeyType('pubkeyhash')).toBe('p2pkh');
      expect(translateScriptPubKeyType('scripthash')).toBe('p2sh');
      expect(translateScriptPubKeyType('witness_v0_keyhash')).toBe('v0_p2wpkh');
      expect(translateScriptPubKeyType('witness_v0_scripthash')).toBe('v0_p2wsh');
      expect(translateScriptPubKeyType('witness_v1_taproot')).toBe('v1_p2tr');
      expect(translateScriptPubKeyType('nonstandard')).toBe('nonstandard');
      expect(translateScriptPubKeyType('multisig')).toBe('multisig');
      expect(translateScriptPubKeyType('nulldata')).toBe('op_return');
      expect(translateScriptPubKeyType('anchor')).toBe('anchor');

      // expect(translateScriptPubKeyType('witness_unknown')).toBe('witness_unknown');
      expect(translateScriptPubKeyType('witness_unknown')).toBe('unknown');
  });

  it('should return "unknown" for unrecognized scriptPubKey types', () => {

      expect(translateScriptPubKeyType('random_type')).toBe('unknown');
      expect(translateScriptPubKeyType('new_future_type')).toBe('unknown');
  });
});

describe('convertVerboseBlockToSimplePlus', () => {
  it('should correctly convert a verbose block to TransactionSimplePlus format and match known data', () => {

    const verboseBlock = getRawBlock840000();
    const expectedTransactions = getBlock840000Txns();

    const start = performance.now();
    const actualTransactions = convertVerboseBlockToSimplePlus(verboseBlock);
    const end = performance.now();
    warn(`Block 840,000 txns (convertVerboseBlockToSimplePlus) – Execution time: ${(end - start) / 100} ms`);

    // Ensure the number of transactions matches
    expect(actualTransactions.length).toEqual(expectedTransactions.length);

    // Compare known properties for every transaction
    actualTransactions.forEach((actual, index) => {
      const expected = expectedTransactions[index];

      // Compare each property explicitly to ensure correctness
      expect(actual.txid).toEqual(expected.txid);
      expect(actual.locktime).toEqual(expected.locktime);
      expect(actual.weight).toEqual(expected.weight);
      expect(actual.size).toEqual(expected.size);
      expect(actual.fee).toEqual(expected.fee);

      // Compare vin
      actual.vin.forEach((actualVin, vinIndex) => {
        const expectedVin = expected.vin[vinIndex];
        expect(actualVin.txid).toEqual(expectedVin.txid);
        expect(actualVin.witness).toEqual(expectedVin.witness);
      });

      // Compare vout
      actual.vout.forEach((actualVout, voutIndex) => {
        const expectedVout = expected.vout[voutIndex];
        expect(actualVout.scriptpubkey).toEqual(expectedVout.scriptpubkey);
        expect(actualVout.scriptpubkey_type).toEqual(expectedVout.scriptpubkey_type);
        expect(actualVout.scriptpubkey_address).toEqual(expectedVout.scriptpubkey_address);
        expect(actualVout.value).toEqual(expectedVout.value);
      });

      // Compare status
      expect(actual.status.block_hash).toEqual(expected.status.block_hash);
      expect(actual.status.block_height).toEqual(expected.status.block_height);
      expect(actual.status.block_time).toEqual(expected.status.block_time);
    });
  });
});
