import { readTransaction } from '../../testdata/test.helper';
import { bytesToHex } from '../lib/conversions';
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

    // BTCPay: BTC payment settling a DEX order match
    // Payload = tx0_hash (32 bytes) + tx1_hash (32 bytes) = two order txids
    it('should parse a btcpay (type 11)', () => {
      const txn = readTransaction('838e1b0726a2c7f87e9eb5e3cca86947f19298b7bbb50c4b2f94d42f3f758e8f');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(11);
      expect(result.messageType).toBe('btcpay');
      const data = result.getMessageData();
      expect(data.length).toBe(64);

      // First 32 bytes = tx0_hash, second 32 bytes = tx1_hash (the matched order pair)
      expect(bytesToHex(data.subarray(0, 32))).toBe('e303ecbaddbf71a0b0a7e77e0138bdb0557433fe9c02329026df335b677862aa');
      expect(bytesToHex(data.subarray(32, 64))).toBe('3970379861d05776754e20ab6417c7347d0854be2c129340cc022f7c1cc73b58');
    });

    // Standard issuance: RAREPIXELS, 100 units, non-divisible, locked
    it('should parse a standard issuance (type 20)', () => {
      const txn = readTransaction('64e52c9e087a88652dd02d68333392fa16c16ddd60c247b0c1f45976769cc691');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(20);
      expect(result.messageType).toBe('issuance');
      const data = result.getMessageData();
      expect(data.length).toBe(70);

      // asset_id (8 bytes BE) + quantity (8 bytes BE)
      const view = new DataView(data.buffer, data.byteOffset);
      expect(view.getBigUint64(0)).toBe(92439521262392n);   // RAREPIXELS asset ID
      expect(view.getBigUint64(8)).toBe(100n);              // 100 units
    });

    // Dividend: pay 1 PIGEONSTEVE per unit of RAREPIGEON held
    it('should parse a dividend (type 50)', () => {
      const txn = readTransaction('6ea9cecabdabf1774345eef042d73d5f48e5d7c6f05f610deb246619522b74e1');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(50);
      expect(result.messageType).toBe('dividend');
      const data = result.getMessageData();
      expect(data.length).toBe(24);

      // quantity_per_unit (8 bytes BE) + asset_id (8 bytes BE) + dividend_asset_id (8 bytes BE)
      const view = new DataView(data.buffer, data.byteOffset);
      expect(view.getBigUint64(0)).toBe(1n); // 1 unit per holding
    });

    // Sweep: transfer all assets from one address to another, flags=3
    it('should parse a sweep (type 4)', () => {
      const txn = readTransaction('c3e9e1a8b37bb2dc6e18fe5ff6e85d17819ee9deea14c4be8b69db51551a17aa');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(4);
      expect(result.messageType).toBe('sweep');
      const data = result.getMessageData();
      expect(data.length).toBe(25);

      // CBOR-encoded in v11+: [destination_hash (20 bytes), flags (1 byte), ...]
      // Flags byte at offset 24: 0x03 = transfer tokens + rights + ownership
      // The value 0x40 at the end is CBOR encoding overhead
      expect(data[23]).toBe(0x03);
    });

    // MPMA: Multi-Peer Multi-Asset send (BITCORNBILL + BITCORNGOLD to same destination)
    it('should parse an mpma send (type 3)', () => {
      const txn = readTransaction('6dda21d218ce41ba97c2e27ff2d1811a327725da470ed8a333c9b7e5a0fbd572');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(3);
      expect(result.messageType).toBe('mpma');
      expect(result.getMessageData().length).toBe(154);
    });

    // Dispense: auto-triggered when BTC is sent to a dispenser address
    // Payload is minimal (1 byte: 0x00)
    it('should parse a dispense (type 13)', () => {
      const txn = readTransaction('f6962ec64b432c29f825af51e64365bd16cfcb988c7dec1bca26d765a23820a0');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(13);
      expect(result.messageType).toBe('dispense');
      expect(result.getMessageData().length).toBe(1);
      expect(result.getMessageData()[0]).toBe(0x00);
    });

    // Attach: bind 300,000,000,000,000 UAUSD to a UTXO
    // v10+ CBOR format: asset name + quantity as pipe-delimited string
    it('should parse an attach (type 101)', () => {
      const txn = readTransaction('936c44a1d8cdb61eacce626fb8d4dd339fb3ca87458e3a81e2431d9050fe5e87');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(101);
      expect(result.messageType).toBe('attach');
      const data = result.getMessageData();
      expect(data.length).toBe(22);

      // v10+ attach uses a pipe-delimited string: "UAUSD|300000000000000|"
      const text = new TextDecoder().decode(data);
      expect(text).toBe('UAUSD|300000000000000|');
    });

    // Detach: unbind token from UTXO (minimal payload)
    it('should parse a detach (type 102)', () => {
      const txn = readTransaction('923ed79399ab7de8798eb8d38a56938c8b8409dc27d72193433dd3312051794f');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(102);
      expect(result.messageType).toBe('detach');
      expect(result.getMessageData().length).toBe(1);
    });

    // Fairmint: mint from THERAREONES fairminter
    it('should parse a fairmint (type 91)', () => {
      const txn = readTransaction('b0006503a44154ec53e6b8ff1222f6d9c5c6df4cfe3fa93755a2d9e5027d6b26');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(91);
      expect(result.messageType).toBe('fairmint');
      expect(result.getMessageData().length).toBe(11);
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
