import { readTransaction } from '../../testdata/test.helper';
import { hexToBytes } from '../lib/conversions';
import { DigitalArtifactType } from '../types/digital-artifact';
import { AtomicalParserService } from './atomical-parser.service';
import {
  extractAtomicalEnvelope,
  extractAtomicalEnvelopeFromWitness,
  extractAtomicalOperation,
  extractAtomicalOperationFromWitness,
} from './atomical-parser.service.helper';

// Real mainnet atomical transaction: DFT (distributed fungible token) mint
// Atomical #0 — Reveal TXID
// Atomic ID: 56a8702bab3d2405eb9a356fd0725ca112a93a8efd1ecca06c6085e7278f0341i0 (commit txn, first output)
const ATOMICAL_DFT_TXID = '1d2f39f54320631d0432fa495a45a4f298a2ca1b18adef8e4356e327d003a694';

// Real mainnet atomical: realm "terafab" (#229861) — uses NFT operation
// Found via atomicalmarket.com explorer
const ATOMICAL_NFT_TXID = 'd8c96e3920f15dfbca4bcb3a3b2fce214484cb913fdca3055dd0f7069387edd3';

// Real mainnet non-atomical transactions
const CAT21_GENESIS_TXID = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';
const INSCRIPTION_TXID = '2740d27e3017da44ee439792f6f60449e43992fddffd9387685b14d21b725ff0';

describe('AtomicalParserService', () => {

  describe('hasAtomical', () => {
    it('should detect atomical in a real DFT transaction', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      expect(AtomicalParserService.hasAtomical(txn)).toBe(true);
    });

    it('should return false for a CAT-21 transaction', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      expect(AtomicalParserService.hasAtomical(txn)).toBe(false);
    });

    it('should return false for an inscription transaction', () => {
      const txn = readTransaction(INSCRIPTION_TXID);
      expect(AtomicalParserService.hasAtomical(txn)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse a real DFT atomical with args and embedded image', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      const result = AtomicalParserService.parse(txn);

      expect(result).not.toBeNull();
      expect(result!.type).toBe(DigitalArtifactType.Atomical);
      expect(result!.transactionId).toBe(ATOMICAL_DFT_TXID);
      expect(result!.operation).toBe('dft');

      // Raw payload should be available (multi-chunk, >520 bytes)
      expect(result!.getPayloadRaw().length).toBeGreaterThan(520);

      // Args — the structured operation parameters
      const args = result!.getArgs()!;
      expect(args).not.toBeNull();
      expect(args.mint_amount).toBe(1000);
      expect(args.request_ticker).toBe('atom');

      // Files — the DFT has an embedded PNG image (was the Phase 2 blocker)
      const files = result!.getFiles();
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('image.png');
      expect(files[0].contentType).toBe('image/png');
      expect(files[0].data).toBeInstanceOf(Uint8Array);
      expect(files[0].data.length).toBeGreaterThan(1000);

      // Verify PNG magic bytes (89 50 4E 47 = \x89PNG)
      expect(files[0].data[0]).toBe(0x89);
      expect(files[0].data[1]).toBe(0x50); // P
      expect(files[0].data[2]).toBe(0x4E); // N
      expect(files[0].data[3]).toBe(0x47); // G
    });

    it('should parse a real NFT atomical (realm) with args', () => {
      const txn = readTransaction(ATOMICAL_NFT_TXID);
      const result = AtomicalParserService.parse(txn);

      expect(result).not.toBeNull();
      expect(result!.type).toBe(DigitalArtifactType.Atomical);
      expect(result!.transactionId).toBe(ATOMICAL_NFT_TXID);
      expect(result!.operation).toBe('nft');

      // Args for realm "terafab"
      const args = result!.getArgs()!;
      expect(args).not.toBeNull();
      expect(args.request_realm).toBe('terafab');
      expect(args.bitworkc).toBe('8857');

      // Realm has no file attachments
      expect(result!.getFiles()).toEqual([]);
    });

    it('should return null for a non-atomical transaction', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      expect(AtomicalParserService.parse(txn)).toBeNull();
    });

    it('should handle corrupted witness gracefully with onError', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      // Corrupt: truncate the witness element that contains the atomical mark
      txn.vin[0].witness![1] = txn.vin[0].witness![1].substring(0, 20);

      const onError = jest.fn();
      const result = AtomicalParserService.parse(txn, onError);

      // Mark is no longer detectable in truncated data → null
      expect(result).toBeNull();
    });
  });

  describe('extractAtomicalOperation', () => {
    it('should extract dft operation from real witness bytes', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      const raw = hexToBytes(txn.vin[0].witness![1]);
      expect(extractAtomicalOperation(raw)).toBe('dft');
    });

    it('should return null for bytes without atomical mark', () => {
      // Use real witness data from a non-atomical transaction
      const txn = readTransaction(CAT21_GENESIS_TXID);
      const raw = hexToBytes(txn.vin[0].witness![0]);
      expect(extractAtomicalOperation(raw)).toBeNull();
    });
  });

  describe('extractAtomicalOperationFromWitness', () => {
    it('should extract operation from real witness array', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      expect(extractAtomicalOperationFromWitness(txn.vin[0].witness!)).toBe('dft');
    });

    it('should return null for non-atomical witness', () => {
      const txn = readTransaction(INSCRIPTION_TXID);
      expect(extractAtomicalOperationFromWitness(txn.vin[0].witness!)).toBeNull();
    });
  });

  describe('extractAtomicalEnvelope', () => {
    it('should extract DFT envelope with multi-chunk CBOR payload (>520 bytes)', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      const raw = hexToBytes(txn.vin[0].witness![1]);
      const envelope = extractAtomicalEnvelope(raw);

      expect(envelope).not.toBeNull();
      expect(envelope!.operation).toBe('dft');
      // DFT payload is split across multiple 520-byte chunks — total >520
      expect(envelope!.payload.length).toBeGreaterThan(520);
    });

    it('should extract NFT envelope with small CBOR payload', () => {
      const txn = readTransaction(ATOMICAL_NFT_TXID);
      const raw = hexToBytes(txn.vin[0].witness![1]);
      const envelope = extractAtomicalEnvelope(raw);

      expect(envelope).not.toBeNull();
      expect(envelope!.operation).toBe('nft');
      // NFT realm payload fits in a single push (<520 bytes)
      expect(envelope!.payload.length).toBeGreaterThan(0);
      expect(envelope!.payload.length).toBeLessThan(520);
    });

    it('should return null for non-atomical bytes', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      const raw = hexToBytes(txn.vin[0].witness![0]);
      expect(extractAtomicalEnvelope(raw)).toBeNull();
    });
  });

  describe('extractAtomicalEnvelopeFromWitness', () => {
    it('should extract envelope from DFT witness array', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      const envelope = extractAtomicalEnvelopeFromWitness(txn.vin[0].witness!);

      expect(envelope).not.toBeNull();
      expect(envelope!.operation).toBe('dft');
      expect(envelope!.payload.length).toBeGreaterThan(520);
    });

    it('should return null for non-atomical witness', () => {
      const txn = readTransaction(INSCRIPTION_TXID);
      expect(extractAtomicalEnvelopeFromWitness(txn.vin[0].witness!)).toBeNull();
    });
  });
});
