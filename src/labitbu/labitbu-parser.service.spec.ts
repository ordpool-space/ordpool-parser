import { readTransaction, readBinaryFileAsUint8Array } from '../../testdata/test.helper';
import { DigitalArtifactType } from '../types/digital-artifact';
import { LabitbuParserService } from './labitbu-parser.service';
import { hasLabitbu, extractLabitbuImage } from './labitbu-parser.service.helper';

// Real mainnet Labitbu transaction — WebP image stored in Taproot control block
// From https://github.com/stutxo/labitbu-maker README
const LABITBU_TXID = '5a15dabc8f0c1656ccd07bd2739f683b4c562fb66487329a41f959c38f0cf7d3';

// Non-Labitbu transactions for negative tests
const CAT21_GENESIS_TXID = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';
const INSCRIPTION_TXID = '2740d27e3017da44ee439792f6f60449e43992fddffd9387685b14d21b725ff0';
const ATOMICAL_DFT_TXID = '1d2f39f54320631d0432fa495a45a4f298a2ca1b18adef8e4356e327d003a694';

describe('LabitbuParserService', () => {

  describe('hasLabitbu', () => {
    it('should detect Labitbu in a real transaction', () => {
      const txn = readTransaction(LABITBU_TXID);
      expect(LabitbuParserService.hasLabitbu(txn)).toBe(true);
    });

    it('should return false for a CAT-21 transaction', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      expect(LabitbuParserService.hasLabitbu(txn)).toBe(false);
    });

    it('should return false for an inscription transaction', () => {
      const txn = readTransaction(INSCRIPTION_TXID);
      expect(LabitbuParserService.hasLabitbu(txn)).toBe(false);
    });

    it('should return false for an atomical transaction', () => {
      const txn = readTransaction(ATOMICAL_DFT_TXID);
      expect(LabitbuParserService.hasLabitbu(txn)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse a real Labitbu transaction and extract the WebP image', () => {
      const txn = readTransaction(LABITBU_TXID);
      const result = LabitbuParserService.parse(txn)!;

      expect(result.type).toBe(DigitalArtifactType.Labitbu);
      expect(result.uniqueId).toBe(`${DigitalArtifactType.Labitbu}-${LABITBU_TXID}`);
      expect(result.transactionId).toBe(LABITBU_TXID);
      expect(result.contentType).toBe('image/webp');

      // The WebP image is exactly 4096 bytes
      const image = result.getDataRaw();
      expect(image.length).toBe(4096);

      // Verify WebP magic bytes:
      // "RIFF" (52 49 46 46) at offset 0
      expect(image[0]).toBe(0x52); // R
      expect(image[1]).toBe(0x49); // I
      expect(image[2]).toBe(0x46); // F
      expect(image[3]).toBe(0x46); // F

      // "WEBP" (57 45 42 50) at offset 8
      expect(image[8]).toBe(0x57);  // W
      expect(image[9]).toBe(0x45);  // E
      expect(image[10]).toBe(0x42); // B
      expect(image[11]).toBe(0x50); // P

      // Byte-for-byte comparison with saved reference image
      const expectedImage = readBinaryFileAsUint8Array('labitbu_5a15dabc.webp');
      expect(image).toEqual(expectedImage);

      // getData() returns base64 encoded string
      const base64 = result.getData();
      expect(base64.length).toBe(5464); // 4096 bytes → 5464 base64 chars

      // getDataUri() returns embeddable data URI
      const dataUri = result.getDataUri();
      expect(dataUri).toBe(`data:image/webp;base64,${base64}`);
    });

    it('should return null for a non-Labitbu transaction', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      expect(LabitbuParserService.parse(txn)).toBeNull();
    });
  });

  describe('helper functions', () => {
    it('hasLabitbu should detect the NUMS key in witness[2]', () => {
      const txn = readTransaction(LABITBU_TXID);
      expect(hasLabitbu(txn.vin[0].witness!)).toBe(true);
    });

    it('hasLabitbu should return false for witness with < 3 items', () => {
      expect(hasLabitbu(['aa', 'bb'])).toBe(false);
    });

    it('extractLabitbuImage should return the WebP bytes', () => {
      const txn = readTransaction(LABITBU_TXID);
      const image = extractLabitbuImage(txn.vin[0].witness!)!;
      expect(image.length).toBe(4096);
    });

    it('extractLabitbuImage should return null for non-Labitbu witness', () => {
      const txn = readTransaction(INSCRIPTION_TXID);
      expect(extractLabitbuImage(txn.vin[0].witness!)).toBeNull();
    });
  });
});
