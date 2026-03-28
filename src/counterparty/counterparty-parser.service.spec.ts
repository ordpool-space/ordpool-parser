import { readTransaction } from '../../testdata/test.helper';
import { bytesToHex } from '../lib/conversions';
import { DigitalArtifactType } from '../types/digital-artifact';
import { CounterpartyParserService } from './counterparty-parser.service';

// Real mainnet Counterparty dispenser transaction (OP_RETURN encoding)
// Dispenser: 26 XCP at 0.00029 BTC per unit
// From: https://jpjanssen.com/how-to-reverse-engineer-counterparty-txs/
const COUNTERPARTY_DISPENSER_TXID = '98c2165a58f7d62201f6264a91db38424a24b4d71ce25ee63c50497646092cfa';

// Real mainnet Counterparty multisig transaction — OLGA image (173 multisig outputs!)
// One of the earliest NFT-style assets on Counterparty
const COUNTERPARTY_OLGA_TXID = '627ae48d6b4cffb2ea734be1016dedef4cee3f8ffefaea5602dd58c696de6b74';

// Non-Counterparty transactions
const CAT21_GENESIS_TXID = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';
const INSCRIPTION_TXID = '2740d27e3017da44ee439792f6f60449e43992fddffd9387685b14d21b725ff0';

describe('CounterpartyParserService', () => {

  describe('hasCounterparty', () => {
    it('should detect Counterparty in a real OP_RETURN transaction', () => {
      const txn = readTransaction(COUNTERPARTY_DISPENSER_TXID);
      expect(CounterpartyParserService.hasCounterparty(txn)).toBe(true);
    });

    it('should return false for a CAT-21 transaction', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      expect(CounterpartyParserService.hasCounterparty(txn)).toBe(false);
    });

    it('should return false for an inscription transaction', () => {
      const txn = readTransaction(INSCRIPTION_TXID);
      expect(CounterpartyParserService.hasCounterparty(txn)).toBe(false);
    });
  });

  describe('parse — OP_RETURN encoding', () => {
    it('should parse a real Counterparty dispenser (OP_RETURN)', () => {
      const txn = readTransaction(COUNTERPARTY_DISPENSER_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.type).toBe(DigitalArtifactType.Counterparty);
      expect(result.uniqueId).toBe(`${DigitalArtifactType.Counterparty}-${COUNTERPARTY_DISPENSER_TXID}`);
      expect(result.transactionId).toBe(COUNTERPARTY_DISPENSER_TXID);
      expect(result.encoding).toBe('opreturn');

      // Message type 12 = Dispenser
      expect(result.messageTypeId).toBe(12);
      expect(result.messageType).toBe('dispenser');

      // Dispenser payload: asset_id (8 bytes BE) + give_quantity (8 bytes BE) +
      // escrow_quantity (8 bytes BE) + mainchainrate (8 bytes BE) + status (1 byte)
      const data = result.getMessageData();
      const view = new DataView(data.buffer, data.byteOffset);

      // Asset ID 1 = XCP (the native Counterparty token)
      expect(view.getBigUint64(0)).toBe(1n);

      // Give quantity: 100000000 = 1 XCP (8 decimal places)
      expect(view.getBigUint64(8)).toBe(100000000n);

      // Escrow quantity: 2600000000 = 26 XCP
      expect(view.getBigUint64(16)).toBe(2600000000n);

      // Mainchain rate: 29000 satoshis = 0.00029 BTC
      expect(view.getBigUint64(24)).toBe(29000n);
    });

    it('should return null for a non-Counterparty transaction', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      expect(CounterpartyParserService.parse(txn)).toBeNull();
    });
  });

  describe('parse — Multisig encoding', () => {
    it('should parse a real Counterparty multisig transaction (OLGA image)', () => {
      const txn = readTransaction(COUNTERPARTY_OLGA_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.type).toBe(DigitalArtifactType.Counterparty);
      expect(result.transactionId).toBe(COUNTERPARTY_OLGA_TXID);
      expect(result.encoding).toBe('multisig');

      // OLGA image was broadcast as data (message type 30 = broadcast)
      expect(result.messageType).toBe('broadcast');
      expect(result.messageTypeId).toBe(30);

      // The message data should contain the asset data
      const data = result.getMessageData();
      expect(data.length).toBeGreaterThan(0);

      console.log('OLGA message data length:', data.length, 'bytes');
      console.log('OLGA message type:', result.messageType);
    });
  });
});
