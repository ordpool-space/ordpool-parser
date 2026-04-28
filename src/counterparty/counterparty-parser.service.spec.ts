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

// Issuance lock/reset (type 22) -- FRONTPEPE asset
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

    // Enhanced send: CBOR-encoded [asset_id, quantity, short_address, memo]
    it('should parse an enhanced send (type 2)', () => {
      const txn = readTransaction(ENHANCED_SEND_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(2);
      expect(result.messageType).toBe('enhanced_send');
      const data = result.getMessageData();
      expect(data.length).toBe(34);
      // First byte 0x84 = CBOR array of 4 elements
      expect(data[0]).toBe(0x84);
    });

    // Lock/reset issuance for FRONTPEPE asset
    it('should parse an issuance (type 22 -- lock/reset)', () => {
      const txn = readTransaction(ISSUANCE_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(22);
      expect(result.messageType).toBe('issuance');
      const data = result.getMessageData();
      expect(data.length).toBe(36);
      // Description at the end: "nardo made me do it " in ASCII
      const desc = new TextDecoder().decode(data.subarray(data.length - 20));
      expect(desc).toBe('nardo made me do it ');
    });

    // DEX order: give BTC, get XCP
    it('should parse an order (type 10)', () => {
      const txn = readTransaction(ORDER_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(10);
      expect(result.messageType).toBe('order');
      const data = result.getMessageData();
      expect(data.length).toBe(42);
      // Binary: give_asset(8) + give_qty(8) + get_asset(8) + get_qty(8) + expiration(2) + fee(8)
      const view = new DataView(data.buffer, data.byteOffset);
      expect(view.getBigUint64(0)).toBe(0n);  // give_asset = BTC (asset ID 0)
      expect(view.getBigUint64(16)).toBe(1n); // get_asset = XCP (asset ID 1)
    });

    // Destroy tokens with memo "OLTRIDER"
    it('should parse a destroy (type 110)', () => {
      const txn = readTransaction(DESTROY_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(110);
      expect(result.messageType).toBe('destroy');
      const data = result.getMessageData();
      expect(data.length).toBe(27);
      // Tag/memo at the end in ASCII: "OLTRIDER"
      const memo = new TextDecoder().decode(data.subarray(data.length - 8));
      expect(memo).toBe('OLTRIDER');
    });

    // Cancel an open DEX order
    it('should parse a cancel (type 70)', () => {
      const txn = readTransaction(CANCEL_TXID);
      const result = CounterpartyParserService.parse(txn)!;

      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(70);
      expect(result.messageType).toBe('cancel');
      const data = result.getMessageData();
      // Cancel payload = 32-byte offer_hash (the txid of the order being cancelled)
      expect(data.length).toBe(32);
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

    // Detach: unbind token from UTXO (minimal 1-byte payload: 0x30 = '0' in ASCII)
    it('should parse a detach (type 102)', () => {
      const txn = readTransaction('923ed79399ab7de8798eb8d38a56938c8b8409dc27d72193433dd3312051794f');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(102);
      expect(result.messageType).toBe('detach');
      const data = result.getMessageData();
      expect(data.length).toBe(1);
      expect(data[0]).toBe(0x30); // '0'
    });

    // Fairmint: mint from THERAREONES fairminter (CBOR: [asset_id, quantity=0])
    it('should parse a fairmint (type 91)', () => {
      const txn = readTransaction('b0006503a44154ec53e6b8ff1222f6d9c5c6df4cfe3fa93755a2d9e5027d6b26');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(91);
      expect(result.messageType).toBe('fairmint');
      const data = result.getMessageData();
      expect(data.length).toBe(11);
      // First byte 0x82 = CBOR array of 2 elements, last byte 0x00 = quantity 0
      expect(data[0]).toBe(0x82);
      expect(data[data.length - 1]).toBe(0x00);
    });

    // Rock-Paper-Scissors game commitment (3-byte CBOR payload)
    it('should parse a rps (type 80)', () => {
      const txn = readTransaction('58de8f604b563904ee76dd784003feacd87256cda014d3ad5e84610f54b2b22c');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(80);
      expect(result.messageType).toBe('rps');
      expect(result.getMessageData().length).toBe(3);
    });

    // Subasset issuance (lock/reset variant) -- FAKEARWYN.SUPERMARIOWYN
    it('should parse a subasset issuance (type 23 -- LR)', () => {
      const txn = readTransaction('2c01d2a018c1b31bf1211dc60d8c6aa44fbbae03fec6c733574cf726d975fb47');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.messageTypeId).toBe(23);
      expect(result.messageType).toBe('issuance_subasset');
      expect(result.getMessageData().length).toBe(154);
    });

    // Bet on a feed broadcast value (2 = NotEqual, deadline at block 471,400)
    // Bets are largely deprecated but the protocol path is still alive
    it('should parse a bet (type 40)', () => {
      // Real mainnet bet from block 471,011 (Aug 2017): 1AuspQ6w... wagers
      // 2.0 BTC against ~28.0 BTC counter-wager that feed value !== 7.0
      const txn = readTransaction('6f2deeab17f2559edcdd952e8d942ac7adf2679df382bfdbf2a554beb32729cf');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.encoding).toBe('opreturn');
      expect(result.messageTypeId).toBe(40);
      expect(result.messageType).toBe('bet');
      const data = result.getMessageData();
      // bet.py FORMAT = ">HIQQdII":
      //   bet_type(2) + deadline(4) + wager(8) + counterwager(8) +
      //   target_value double(8) + leverage(4) + expiration(4) = 38 bytes
      expect(data.length).toBe(38);
      const view = new DataView(data.buffer, data.byteOffset);
      // bet_type = 2 (NotEqual)
      expect(view.getUint16(0)).toBe(2);
      // deadline block = 471,400
      expect(view.getUint32(2)).toBe(471400);
      // wager = 2.0 BTC = 200,000,000 satoshis
      expect(view.getBigUint64(6)).toBe(200000000n);
      // counter-wager = 2,799,999,999 satoshis
      expect(view.getBigUint64(14)).toBe(2799999999n);
      // target_value = 7.0 (IEEE 754 double)
      expect(view.getFloat64(22)).toBe(7.0);
      // leverage = 5040 (default = 1.0x in 5040ths)
      expect(view.getUint32(30)).toBe(5040);
      // expiration = 565 blocks
      expect(view.getUint32(34)).toBe(565);
    });

    // Type 60 (burn) is the XCP-CREATION proof-of-burn (Jan-Feb 2014), NOT
    // generic asset destruction (which is type 110, 'destroy'). XCP had no
    // ICO -- it was bootstrapped by sending BTC to UNSPENDABLE_MAINNET, and
    // the protocol minted XCP at a 1500 -> 1000 time-decay multiplier.
    // No CNTRPRTY message data is involved; detection is purely by destination.
    it('should detect a proof-of-burn (type 60, XCP creation, no message data)', () => {
      // Real burn tx from block 283,810 (Feb 5, 2014, last day of burn window)
      // Source 1HVgrYx3U... burned 0.1 BTC and earned ~100.009 XCP
      const txn = readTransaction('4560d0e3d04927108b615ab106040489aca9c4aceedcf69d2b71f63b3139c7ae');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.type).toBe(DigitalArtifactType.Counterparty);
      expect(result.encoding).toBe('destination');
      expect(result.messageTypeId).toBe(60);
      expect(result.messageType).toBe('burn');
      expect(result.getMessageData().length).toBe(0);
    });

    // Window-based early exit: same vout shape (output to UNSPENDABLE), but
    // block_height moved outside [278,310, 283,810]. Must return null because
    // the burn protocol is dead post-window (lost BTC, not Counterparty).
    it('should NOT detect a burn outside the window (post-2014 send to UNSPENDABLE)', () => {
      const txn = readTransaction('4560d0e3d04927108b615ab106040489aca9c4aceedcf69d2b71f63b3139c7ae');
      // Pretend this exact tx confirmed in a modern block. Same outputs,
      // same destination, but the protocol no longer credits XCP.
      const modernTxn = { ...txn, status: { ...txn.status, block_height: 900000 } };
      expect(CounterpartyParserService.parse(modernTxn)).toBeNull();
    });

    it('should NOT detect a burn for an unconfirmed mempool tx', () => {
      const txn = readTransaction('4560d0e3d04927108b615ab106040489aca9c4aceedcf69d2b71f63b3139c7ae');
      // Drop block_height entirely (mempool tx -- can't be in 2014's burn window)
      const mempoolTxn = { ...txn, status: {} };
      expect(CounterpartyParserService.parse(mempoolTxn)).toBeNull();
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

      // 9132 bytes from 173 multisig outputs (4-byte type ID, pre-short_tx_type_id)
      const data = result.getMessageData();
      expect(data.length).toBe(9132);
      // Broadcast: timestamp (4 bytes BE) at offset 0
      const view = new DataView(data.buffer, data.byteOffset);
      expect(view.getUint32(0)).toBe(0x55ca4a7e); // Unix timestamp 1439303294
    });

    // utxo legacy (type 100) -- BITCORN attach, block 866,026 (Oct 16, 2024)
    // utxo.py was the only utxo path between Aug 27, 2024 (introduced) and
    // Oct 30, 2024 (split into attach 101 / detach 102). Tx 5c5496c4 is from
    // that 64-day window. Format: source|destination_utxo|asset|quantity
    // (UTF-8 pipe-separated, per counterparty-core utxo.py compose()).
    it('should parse a utxo attach (type 100, Aug-Oct 2024 utxo.py-only window)', () => {
      const txn = readTransaction('5c5496c4a9f2bf98dcaad2c2b67fa446b37468668ddcc503d6120d482672153d');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.encoding).toBe('multisig');
      expect(result.messageTypeId).toBe(100);
      expect(result.messageType).toBe('utxo');
      const data = result.getMessageData();
      expect(data.length).toBe(111);
      // utxo.py format: source|destination_utxo|asset|quantity
      const payload = new TextDecoder().decode(data);
      expect(payload).toBe(
        '19QWXpMXeLkoEKEJv2xo9rn8wkPCyxACSX' +                                 // source address
        '|50438351646f4c4b994cd1be2eb15df7568ea59707a2bbe9d2f32fbc0fa690e1:1' + // destination UTXO
        '|BITCORN' +                                                            // asset
        '|1'                                                                    // quantity
      );
    });

    // Subasset standard (type 21) -- HIPHOPGAME.JAHIWITNESS, block 763,846 (May 2023)
    // Pre-LR-bit era (LR_SUBASSET_ID 23 activated at block 819,300), so this uses
    // SUBASSET_ID 21. Multisig encoding (4 multisig outputs).
    it('should parse a subasset issuance standard (type 21, pre-LR)', () => {
      const txn = readTransaction('4bbd0d08aa85cdee4b863fdec2b602a57e1f9388572e326a3fac567945ac49df');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.encoding).toBe('multisig');
      expect(result.messageTypeId).toBe(21);
      expect(result.messageType).toBe('issuance_subasset');
      const data = result.getMessageData();
      // First byte after the type ID is the asset_id (compacted varint).
      // For HIPHOPGAME.JAHIWITNESS (asset_id A11540093991530252820) the description
      // field carries an Arweave URL ending in ".json".
      const tail = new TextDecoder().decode(data.subarray(data.length - 5));
      expect(tail).toBe('.json');
    });
  });

  // ===========================================================================
  // parse — P2TR encoding (Taproot witness envelope, v11+, block 902,000)
  // ===========================================================================

  // P2TR Counterparty is rare on mainnet. A scan of the most-recent 30,000
  // Counterparty transactions returned exactly ONE P2TR-encoded tx across all
  // common message types (the mpma below). Most wallets stick to OP_RETURN
  // (cheaper, universally supported); P2TR is reserved for cases like
  // fairminter, the ord-envelope issuance variant, and oversized payloads.
  // The three tests below cover all P2TR variants we have real testdata for.
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

      // CBOR-encoded fairminter payload
      const data = result.getMessageData();
      expect(data.length).toBe(97);
      // First byte 0x93 = CBOR array of 19 elements
      expect(data[0]).toBe(0x93);
    });

    // P2TR mpma (multi-peer-multi-asset send) — real mainnet tx, block 946,561.
    // Demonstrates that P2TR encoding works for non-issuance message types too.
    it('should parse an mpma via P2TR (multi-recipient send)', () => {
      const txn = readTransaction('a671933874e11bcf664326ec36dbf3c927538dd6802acd047218bffbe6cd4641');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.encoding).toBe('p2tr');
      expect(result.messageTypeId).toBe(3);
      expect(result.messageType).toBe('mpma');
      // The P2TR-encoded mpma payload is exactly 2,482 bytes for this tx
      expect(result.getMessageData().length).toBe(2482);
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

      // Re-encoded CBOR: issuance fields + "image/jpeg" + JPEG content bytes
      const data = result.getMessageData();
      expect(data.length).toBe(7458);
      // First byte 0x87 = CBOR array of 7 elements
      expect(data[0]).toBe(0x87);
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

    // RPS resolve (type 81) -- block 334,627 (Dec 2014), pre-short_tx_type_id (489,956)
    // Counterparty's own API documents that "RPS messages decoding is not implemented",
    // but the message_type_id and raw payload still parse cleanly.
    // Move 1 (rock), random nonce, paired with rps match bd157f74...
    it('should parse an rps_resolve (ID 81, 4-byte encoding) via multisig', () => {
      const txn = readTransaction('cdba50a759c3839f2004af04a890dcc0a1f1e90ed14e2400aeb69f5fe210f145');
      const result = CounterpartyParserService.parse(txn)!;
      expect(result.encoding).toBe('multisig');
      expect(result.messageTypeId).toBe(81);
      expect(result.messageType).toBe('rps_resolve');
      const data = result.getMessageData();
      // move(2 bytes BE) + random(16 bytes) + tx0_hash(32 bytes) + tx1_hash(32 bytes) = 82 bytes
      expect(data.length).toBe(82);
      const view = new DataView(data.buffer, data.byteOffset);
      // Move = 1 (rock) -- per the API params for this resolve event
      expect(view.getUint16(0)).toBe(1);
      // Random nonce: 97b2e50c2b1cdc39a9cb99322c273552
      expect(bytesToHex(data.subarray(2, 18))).toBe('97b2e50c2b1cdc39a9cb99322c273552');
      // The two paired-game txids (rps_match_id is the underscore-joined pair)
      expect(bytesToHex(data.subarray(18, 50))).toBe('bd157f74373369f25e5c7e393ac84185d654c7aa6c8d0a5646162e4b030b85c9');
      expect(bytesToHex(data.subarray(50, 82))).toBe('8d754f1579c0e1395c4f2d6580f74605481c773acd649075eeba0d52bb9dba78');
    });
  });

  // ===========================================================================
  // Early exit correctness — reject non-Counterparty OP_RETURN transactions
  // ===========================================================================

  describe('early exits', () => {
    // Rune OP_RETURN starts with 6a5d (OP_RETURN + OP_PUSHNUM_13)
    // Our code rejects byte[1] > 0x4e before ARC4 decryption
    const RUNE_TXID = '1af2a846befbfac4091bf540adad4fd1a86604c26c004066077d5fe22510e99b';

    // Another Rune tx (scriptpubkey 6a5d0100 -- byte 0x5d > 0x4e hits same early exit)
    const SHORT_RUNE_TXID = '28baf9374797230174803b0c3f63fd39e22bb1972a25cc2af4e791ca8fc89dae';

    it('should reject a Rune transaction (OP_PUSHNUM_13 early exit)', () => {
      const txn = readTransaction(RUNE_TXID);
      expect(CounterpartyParserService.parse(txn)).toBeNull();
    });

    it('should reject another Rune transaction (short OP_RETURN, also hits byte > 0x4e)', () => {
      const txn = readTransaction(SHORT_RUNE_TXID);
      expect(CounterpartyParserService.parse(txn)).toBeNull();
    });

    // Note: the scriptpubkey.length < 22 early exit in extractOpReturnData is a
    // defensive guard that has no real mainnet test. All known short OP_RETURN
    // transactions use Rune encoding (0x5d) which hits the byte > 0x4e exit first.
    // A transaction with a valid push opcode (0x01-0x4e) and < 9 bytes of data
    // would exercise this path, but none have been found on mainnet.
  });
});
