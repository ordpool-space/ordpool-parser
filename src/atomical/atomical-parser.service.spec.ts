import { readTransaction, readBinaryFileAsUint8Array } from '../../testdata/test.helper';
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

// Real mainnet atomical: realm "terafab" (#229861) — uses NFT operation (no file attachments)
// Found via atomicalmarket.com explorer
const ATOMICAL_NFT_TXID = 'd8c96e3920f15dfbca4bcb3a3b2fce214484cb913fdca3055dd0f7069387edd3';

// Real mainnet atomical: toothy collection item #7579 — NFT with image file attachment
// Atomic ID: 1618d2a204f7ecfc5054369a89a86bbadcdd0cdac5313126b004baf7504bddfdi0
const ATOMICAL_NFT_IMAGE_TXID = '7c8527547cc99b39f9d02fa2e8d963d78a3d60692a05ad378a87b96abed4aab6';

// Real mainnet non-atomical transactions
const CAT21_GENESIS_TXID = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';
const INSCRIPTION_TXID = '2740d27e3017da44ee439792f6f60449e43992fddffd9387685b14d21b725ff0';

describe('AtomicalParserService', () => {

  describe('hasAtomical', () => {
    it('should detect atomical in a real DFT transaction', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      expect(AtomicalParserService.hasAtomical(txn)).toBe(true);
    });

    it('should detect atomical in a real NFT transaction', () => {
      const txn = readTransaction(ATOMICAL_NFT_TXID);
      expect(AtomicalParserService.hasAtomical(txn)).toBe(true);
    });

    it('should detect atomical in a real NFT image transaction', () => {
      const txn = readTransaction(ATOMICAL_NFT_IMAGE_TXID);
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
      const result = AtomicalParserService.parse(txn)!;

      expect(result.type).toBe(DigitalArtifactType.Atomical);
      expect(result.uniqueId).toBe(`${DigitalArtifactType.Atomical}-${ATOMICAL_DFT_TXID}`);
      expect(result.transactionId).toBe(ATOMICAL_DFT_TXID);
      expect(result.operation).toBe('dft');

      // Raw payload: 9925 bytes (20 chunks of 520 + 1 chunk of 45 = multi-chunk CBOR)
      expect(result.getPayloadRaw().length).toBe(9925);

      // Args — all fields from the ATOM DFT deploy transaction
      const args = result.getArgs()!;
      expect(args.mint_amount).toBe(1000);
      expect(args.mint_height).toBe(808512);
      expect(args.max_mints).toBe(21000);
      expect(args.mint_bitworkc).toBe('1618');
      expect(args.request_ticker).toBe('atom');
      expect(args.bitworkc).toBe('56a8');
      expect(args.nonce).toBe(6426328);
      expect(args.time).toBe(1694929108);

      // File: embedded PNG image (Format 1: {$ct, $b} wrapper)
      const files = result.getFiles();
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('image.png');
      expect(files[0].contentType).toBe('image/png');
      expect(files[0].data.length).toBe(8496);

      // Byte-for-byte comparison with saved reference image
      const expectedImage = readBinaryFileAsUint8Array('atomical_dft_atom_image.png');
      expect(files[0].data).toEqual(expectedImage);
    });

    it('should parse a real NFT atomical (realm terafab) with args', () => {
      const txn = readTransaction(ATOMICAL_NFT_TXID);
      const result = AtomicalParserService.parse(txn)!;

      expect(result.type).toBe(DigitalArtifactType.Atomical);
      expect(result.uniqueId).toBe(`${DigitalArtifactType.Atomical}-${ATOMICAL_NFT_TXID}`);
      expect(result.transactionId).toBe(ATOMICAL_NFT_TXID);
      expect(result.operation).toBe('nft');

      // Raw payload: 64 bytes (single push, no chunking needed)
      expect(result.getPayloadRaw().length).toBe(64);

      // Args for realm "terafab"
      const args = result.getArgs()!;
      expect(args.request_realm).toBe('terafab');
      expect(args.bitworkc).toBe('8857');
      expect(args.nonce).toBe(9232990);
      expect(args.time).toBe(1773568724);

      // Realm has no file attachments
      expect(result.getFiles()).toEqual([]);
    });

    it('should parse a real NFT with image file attachment (toothy #7579)', () => {
      const txn = readTransaction(ATOMICAL_NFT_IMAGE_TXID);
      const result = AtomicalParserService.parse(txn)!;

      expect(result.type).toBe(DigitalArtifactType.Atomical);
      expect(result.uniqueId).toBe(`${DigitalArtifactType.Atomical}-${ATOMICAL_NFT_IMAGE_TXID}`);
      expect(result.transactionId).toBe(ATOMICAL_NFT_IMAGE_TXID);
      expect(result.operation).toBe('nft');

      // Raw payload: 2512 bytes
      expect(result.getPayloadRaw().length).toBe(2512);

      // Args: dmint container item
      const args = result.getArgs()!;
      expect(args.main).toBe('image.png');
      expect(args.request_dmitem).toBe('7579');
      expect(args.bitworkc).toBe('1618');
      expect(args.nonce).toBe(863997);
      expect(args.time).toBe(1701386841);
      expect(args.i).toBe(true);
      expect(args.parent_container).toBe('6341fdaf0ef212ed3d4344a73df44389950442d753dc851b423ed9f541fd9a04i0');

      // File: raw binary PNG (Format 2: no $ct/$b wrapper, content type inferred from name)
      const files = result.getFiles();
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('image.png');
      expect(files[0].contentType).toBe('image/png');
      expect(files[0].data.length).toBe(1319);

      // Byte-for-byte comparison with saved reference image
      const expectedImage = readBinaryFileAsUint8Array('atomical_nft_toothy_7579_image.png');
      expect(files[0].data).toEqual(expectedImage);
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

      // Mark is no longer detectable in truncated data
      expect(result).toBeNull();
    });
  });

  describe('extractAtomicalOperation', () => {
    it('should extract dft operation from real DFT witness bytes', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      const raw = hexToBytes(txn.vin[0].witness![1]);
      expect(extractAtomicalOperation(raw)).toBe('dft');
    });

    it('should extract nft operation from real NFT witness bytes', () => {
      const txn = readTransaction(ATOMICAL_NFT_TXID);
      const raw = hexToBytes(txn.vin[0].witness![1]);
      expect(extractAtomicalOperation(raw)).toBe('nft');
    });

    it('should return null for bytes without atomical mark', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      const raw = hexToBytes(txn.vin[0].witness![0]);
      expect(extractAtomicalOperation(raw)).toBeNull();
    });
  });

  describe('extractAtomicalOperationFromWitness', () => {
    it('should extract dft operation from real witness array', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      expect(extractAtomicalOperationFromWitness(txn.vin[0].witness!)).toBe('dft');
    });

    it('should extract nft operation from real witness array', () => {
      const txn = readTransaction(ATOMICAL_NFT_TXID);
      expect(extractAtomicalOperationFromWitness(txn.vin[0].witness!)).toBe('nft');
    });

    it('should return null for non-atomical witness', () => {
      const txn = readTransaction(INSCRIPTION_TXID);
      expect(extractAtomicalOperationFromWitness(txn.vin[0].witness!)).toBeNull();
    });
  });

  describe('extractAtomicalEnvelope', () => {
    it('should extract DFT envelope with exact multi-chunk payload size', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      const raw = hexToBytes(txn.vin[0].witness![1]);
      const envelope = extractAtomicalEnvelope(raw)!;

      expect(envelope.operation).toBe('dft');
      expect(envelope.payload.length).toBe(9925);
    });

    it('should extract NFT realm envelope with exact single-push payload size', () => {
      const txn = readTransaction(ATOMICAL_NFT_TXID);
      const raw = hexToBytes(txn.vin[0].witness![1]);
      const envelope = extractAtomicalEnvelope(raw)!;

      expect(envelope.operation).toBe('nft');
      expect(envelope.payload.length).toBe(64);
    });

    it('should extract NFT image envelope with exact payload size', () => {
      const txn = readTransaction(ATOMICAL_NFT_IMAGE_TXID);
      const raw = hexToBytes(txn.vin[0].witness![1]);
      const envelope = extractAtomicalEnvelope(raw)!;

      expect(envelope.operation).toBe('nft');
      expect(envelope.payload.length).toBe(2512);
    });

    it('should return null for non-atomical bytes', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      const raw = hexToBytes(txn.vin[0].witness![0]);
      expect(extractAtomicalEnvelope(raw)).toBeNull();
    });
  });

  describe('extractAtomicalEnvelopeFromWitness', () => {
    it('should extract DFT envelope from witness array', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      const envelope = extractAtomicalEnvelopeFromWitness(txn.vin[0].witness!)!;

      expect(envelope.operation).toBe('dft');
      expect(envelope.payload.length).toBe(9925);
    });

    it('should extract NFT envelope from witness array', () => {
      const txn = readTransaction(ATOMICAL_NFT_TXID);
      const envelope = extractAtomicalEnvelopeFromWitness(txn.vin[0].witness!)!;

      expect(envelope.operation).toBe('nft');
      expect(envelope.payload.length).toBe(64);
    });

    it('should return null for non-atomical witness', () => {
      const txn = readTransaction(INSCRIPTION_TXID);
      expect(extractAtomicalEnvelopeFromWitness(txn.vin[0].witness!)).toBeNull();
    });
  });
});
