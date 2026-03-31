import { readTransaction } from '../../testdata/test.helper';
import { DigitalArtifactType } from '../types/digital-artifact';
import { CounterpartyParserService } from './counterparty-parser.service';

// =============================================================================
// OP_RETURN encoding — ARC4-encrypted, ≤80 bytes (most common since 2017+)
// =============================================================================

// Real mainnet Counterparty dispenser transaction (OP_RETURN encoding)
// Dispenser: 26 XCP at 0.00029 BTC per unit
// From: https://jpjanssen.com/how-to-reverse-engineer-counterparty-txs/
const DISPENSER_TXID = '98c2165a58f7d62201f6264a91db38424a24b4d71ce25ee63c50497646092cfa';

// Enhanced send (type 2) — sends THEFAKERARE to 1EMvVadz...
const ENHANCED_SEND_TXID = 'f3981dac3d2d43abf6c3bb059fbd998bcd8f76c4174fd1e2668599b9713649c9';

// Issuance lock/reset (type 22) ��� FRONTPEPE asset
const ISSUANCE_TXID = '4366a0871759d7c720f34984883848f6a806ef3ceba8c1e614b9cfe8f7e164a4';

// Order (type 10) — DEX order
const ORDER_TXID = '22077e8e1a6c109309c01f891073969fcaf396a8c4ba163f4a7e1d5a5795a77d';

// Destroy (type 110) — permanently destroy tokens
const DESTROY_TXID = 'a23ea1acd8fd775789e43c5b244b727f16649f66ad3e9527a853aee481e989bc';

// Cancel (type 70) — cancel open order
const CANCEL_TXID = '7e4bc190548fc55ff8cfa35b51a15bd503bfebd584573ae5e6b448b6aba59706';

// =============================================================================
// Multisig encoding — 1-of-3 bare multisig with fake pubkeys (legacy, large data)
// =============================================================================

// Real mainnet Counterparty multisig transaction — OLGA image (173 multisig outputs!)
// One of the earliest NFT-style assets on Counterparty
const OLGA_MULTISIG_TXID = '627ae48d6b4cffb2ea734be1016dedef4cee3f8ffefaea5602dd58c696de6b74';

// =============================================================================
// P2TR encoding — Taproot witness envelope (v11+, block 902,000)
// =============================================================================

// Real mainnet P2TR Counterparty fairminter — THERAREONES asset
// Uses generic envelope: OP_FALSE OP_IF <data> OP_ENDIF <pubkey> OP_CHECKSIG
// The OP_RETURN contains literal "CNTRPRTY" (NOT encrypted)
const P2TR_FAIRMINTER_TXID = 'dee5acb8d9a859c731ea32a1b5defbc744450effd7fd53bd12791f21dc4b149f';

// =============================================================================
// Non-Counterparty transactions (negative tests)
// =============================================================================
const CAT21_GENESIS_TXID = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';
const INSCRIPTION_TXID = '2740d27e3017da44ee439792f6f60449e43992fddffd9387685b14d21b725ff0';

describe('CounterpartyParserService', () => {

  // ===========================================================================
  // hasCounterparty -- detects all three encodings
  // ===========================================================================

  describe('hasCounterparty', () => {
    it('should detect OP_RETURN encoding', () => {
      const txn = readTransaction(DISPENSER_TXID);
      expect(CounterpartyParserService.hasCounterparty(txn)).toBe(true);
    });

    it('should detect P2TR encoding', () => {
      const txn = readTransaction(P2TR_FAIRMINTER_TXID);
      expect(CounterpartyParserService.hasCounterparty(txn)).toBe(true);
    });

    it('should detect multisig encoding', () => {
      const txn = readTransaction(OLGA_MULTISIG_TXID);
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

  // ===========================================================================
  // parse — OP_RETURN encoding (ARC4-encrypted)
  // ===========================================================================

  describe('parse — OP_RETURN encoding', () => {

    it('should parse a dispenser (type 12)', () => {
      const txn = readTransaction(DISPENSER_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.type).toBe(DigitalArtifactType.Counterparty);
      expect(result.uniqueId).toBe(`${DigitalArtifactType.Counterparty}-${DISPENSER_TXID}`);
      expect(result.transactionId).toBe(DISPENSER_TXID);
      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(12);
      expect(result.messageType).toBe('dispenser');

      // Dispenser payload: asset_id (8 bytes BE) + give_quantity (8 bytes BE) +
      // escrow_quantity (8 bytes BE) + mainchainrate (8 bytes BE) + status (1 byte)
      const data = result.getMessageData();
      expect(data.length).toBe(33);
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

    it('should parse an enhanced send (type 2)', () => {
      const txn = readTransaction(ENHANCED_SEND_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(2);
      expect(result.messageType).toBe('enhanced_send');
      expect(result.getMessageData().length).toBe(34);
    });

    it('should parse an issuance (type 22 — lock/reset)', () => {
      const txn = readTransaction(ISSUANCE_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(22);
      expect(result.messageType).toBe('issuance');
      expect(result.getMessageData().length).toBe(36);
    });

    it('should parse an order (type 10)', () => {
      const txn = readTransaction(ORDER_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(10);
      expect(result.messageType).toBe('order');
      expect(result.getMessageData().length).toBe(42);
    });

    it('should parse a destroy (type 110)', () => {
      const txn = readTransaction(DESTROY_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(110);
      expect(result.messageType).toBe('destroy');
      expect(result.getMessageData().length).toBe(27);
    });

    it('should parse a cancel (type 70)', () => {
      const txn = readTransaction(CANCEL_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(70);
      expect(result.messageType).toBe('cancel');
      expect(result.getMessageData().length).toBe(32);
    });

    it('should return null for a non-Counterparty transaction', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      expect(CounterpartyParserService.parse(txn)).toBeNull();
    });
  });

  // ===========================================================================
  // parse — Multisig encoding (ARC4-encrypted, 1-of-3 bare multisig)
  // ===========================================================================

  describe('parse — Multisig encoding', () => {
    it('should parse a broadcast via multisig (OLGA image, 173 outputs)', () => {
      const txn = readTransaction(OLGA_MULTISIG_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.type).toBe(DigitalArtifactType.Counterparty);
      expect(result.transactionId).toBe(OLGA_MULTISIG_TXID);
      expect(result.encoding).toBe('multisig');
      expect(result.messageTypeId).toBe(30);
      expect(result.messageType).toBe('broadcast');

      // The message data is 9132 bytes (broadcast payload from 173 multisig outputs)
      // Note: OLGA predates the short_tx_type_id protocol change, so it uses 4-byte type ID
      expect(result.getMessageData().length).toBe(9132);
    });
  });

  // ===========================================================================
  // parse — P2TR encoding (Taproot witness envelope, v11+, block 902,000)
  // ===========================================================================

  describe('parse — P2TR encoding', () => {
    it('should parse a fairminter via P2TR (THERAREONES)', () => {
      const txn = readTransaction(P2TR_FAIRMINTER_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.type).toBe(DigitalArtifactType.Counterparty);
      expect(result.transactionId).toBe(P2TR_FAIRMINTER_TXID);
      expect(result.encoding).toBe('p2tr');

      // Fairminter = message type 90
      expect(result.messageTypeId).toBe(90);
      expect(result.messageType).toBe('fairminter');

      // CBOR-encoded fairminter payload (97 bytes, first byte was the type ID)
      expect(result.getMessageData().length).toBe(97);
    });

    // Real mainnet P2TR issuance using the "ord" inscription envelope
    // (OP_FALSE OP_IF "ord" [7] "xcp" [1] "image/jpeg" [5] <CBOR metadata> [0] <JPEG content> OP_ENDIF)
    // ORDINALMINT asset with embedded JPEG image, block 933,916
    // Composed with inscription=true (opt-in parameter, defaults to false)
    const P2TR_ORD_ISSUANCE_TXID = 'e6ecd07a48178c363e61a2bf109a5d1dc5e44e9b31afff096074311fb51ca01d';

    it('should parse an ord inscription envelope (ORDINALMINT issuance with JPEG)', () => {
      const txn = readTransaction(P2TR_ORD_ISSUANCE_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.type).toBe(DigitalArtifactType.Counterparty);
      expect(result.encoding).toBe('p2tr');
      expect(result.messageTypeId).toBe(22);
      expect(result.messageType).toBe('issuance');

      // Re-encoded CBOR contains: issuance fields + "image/jpeg" + JPEG content bytes
      expect(result.getMessageData().length).toBe(7458);
    });
  });

  // ===========================================================================
  // 4-byte message type ID (pre-short_tx_type_id, before block 489,956)
  // ===========================================================================

  describe('parse — 4-byte message type ID', () => {
    // Classic send (ID 0) via OP_RETURN -- uses 4-byte big-endian encoding (00 00 00 00)
    // Block 489,000 (before short_tx_type_id activation at 489,956)
    // Sends 2,100,000,000 TRIGGERS
    const CLASSIC_SEND_TXID = '6335eefb68f5e57eddb95b329c368615e53cf5efe346be14d271c88a63b5461e';

    it('should parse a classic send (ID 0, 4-byte encoding) via OP_RETURN', () => {
      const txn = readTransaction(CLASSIC_SEND_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(0);
      expect(result.messageType).toBe('send');

      // Classic send payload: asset_id (8 bytes BE) + quantity (8 bytes BE) = 16 bytes
      // API raw data: 20 bytes = 4 bytes type ID (00000000) + 16 bytes payload
      expect(result.getMessageData().length).toBe(16);
    });

    it('should parse a broadcast (ID 30, 4-byte encoding) via multisig (OLGA)', () => {
      // OLGA predates short_tx_type_id -- uses 4-byte encoding even for ID 30
      // API raw data: 9136 bytes = 4 bytes type ID (0000001e) + 9132 bytes payload
      const txn = readTransaction(OLGA_MULTISIG_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.messageTypeId).toBe(30);
      expect(result.getMessageData().length).toBe(9132);
    });
  });

  // ===========================================================================
  // Early exit correctness — reject non-Counterparty OP_RETURN transactions
  // ===========================================================================

  describe('early exits', () => {
    // Rune OP_RETURN starts with 6a5d (OP_RETURN + OP_PUSHNUM_13)
    // Our code rejects byte[1] > 0x4e before ARC4 decryption
    const RUNE_TXID = '1af2a846befbfac4091bf540adad4fd1a86604c26c004066077d5fe22510e99b';

    // Short OP_RETURN (8 hex chars = 4 bytes, below our 22 hex char minimum)
    const SHORT_OP_RETURN_TXID = '28baf9374797230174803b0c3f63fd39e22bb1972a25cc2af4e791ca8fc89dae';

    it('should reject a Rune transaction (OP_PUSHNUM_13 early exit)', () => {
      const txn = readTransaction(RUNE_TXID);
      expect(CounterpartyParserService.parse(txn)).toBeNull();
    });

    it('should reject a short OP_RETURN transaction (< 22 hex chars)', () => {
      const txn = readTransaction(SHORT_OP_RETURN_TXID);
      expect(CounterpartyParserService.parse(txn)).toBeNull();
    });
  });
});
