import { readBinaryFileAsUint8Array, readTransaction } from '../../testdata/test.helper';
import { DigitalArtifactType } from '../types/digital-artifact';
import { ParsedStamp } from '../types/parsed-stamp';
import { ParsedSrc721 } from '../types/parsed-src721';
import { StampParserService } from './stamp-parser.service';

// =============================================================================
// Classic Stamp -- OLGA P2WSH encoding (Counterparty-issued, no stamp: prefix)
// =============================================================================

// Real mainnet Classic Stamp: PNG image, 1393 bytes, block 933,540
// Stamp #1383565 -- pixel art encoded via OLGA P2WSH (44 outputs)
// Counterparty issuance of CPID A197900000000002026
const CLASSIC_STAMP_PNG_TXID = '516e62beeffb26fb37f8e95e809274e5bbde76eb75a28357f6bbcd4eedbfe8ca';

// =============================================================================
// SRC-721 -- OLGA P2WSH encoding (JSON payload)
// =============================================================================

// Real mainnet SRC-721 mint: {"p":"src-721","op":"mint","c":"A1473703777372088053","ts":[1,4,8,4,5,4,7,0,6,6]}
// Stamp #1383566, block 933,541, SVG composable NFT
const SRC721_TXID = 'b74313d300902c0cdf88dc101fb8f4c9ab7ad89c978edd30ca4ee7987cccdedd';

describe('StampParserService', () => {

  // ===========================================================================
  // Classic Stamp -- OLGA P2WSH with PNG image
  // ===========================================================================

  describe('Classic Stamp (OLGA P2WSH)', () => {
    it('should extract a PNG image from P2WSH outputs', () => {
      const txn = readTransaction(CLASSIC_STAMP_PNG_TXID);
      const result = StampParserService.parse(txn)!;

      expect(result).not.toBeNull();
      expect(result.type).toBe(DigitalArtifactType.Stamp);
      expect(result.transactionId).toBe(CLASSIC_STAMP_PNG_TXID);
      expect(result.uniqueId).toBe(`${DigitalArtifactType.Stamp}-${CLASSIC_STAMP_PNG_TXID}`);

      const stamp = result as ParsedStamp;
      expect(stamp.contentType).toBe('image/png');

      // Verify image data
      const raw = stamp.getDataRaw();
      expect(raw.length).toBe(1393);

      // PNG magic header: 89 50 4e 47 0d 0a 1a 0a
      expect(raw[0]).toBe(0x89);
      expect(raw[1]).toBe(0x50); // P
      expect(raw[2]).toBe(0x4e); // N
      expect(raw[3]).toBe(0x47); // G

      // Compare byte-for-byte against the reference image
      const referenceImage = readBinaryFileAsUint8Array('stamp_1383565_image.png');
      expect(raw).toEqual(referenceImage);

      // Verify data URI
      const dataUri = stamp.getDataUri();
      expect(dataUri.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('should return null for a transaction without P2WSH outputs', () => {
      // SRC-20 test tx uses multisig, not P2WSH
      const txn = readTransaction('50aeb77245a9483a5b077e4e7506c331dc2f628c22046e7d2b4c6ad6c6236ae1');
      expect(StampParserService.parse(txn)).toBeNull();
    });
  });

  // ===========================================================================
  // SRC-721 -- OLGA P2WSH with JSON payload
  // ===========================================================================

  describe('SRC-721 (OLGA P2WSH)', () => {
    it('should parse SRC-721 mint from P2WSH outputs', () => {
      const txn = readTransaction(SRC721_TXID);
      const result = StampParserService.parse(txn)!;

      expect(result).not.toBeNull();
      expect(result.type).toBe(DigitalArtifactType.Src721);
      expect(result.transactionId).toBe(SRC721_TXID);

      const src721 = result as ParsedSrc721;
      const content = src721.getContent();

      // Verify exact JSON content
      const parsed = JSON.parse(content);
      expect(parsed.p).toBe('src-721');
      expect(parsed.op).toBe('mint');
      expect(parsed.c).toBe('A1473703777372088053');
      expect(parsed.ts).toEqual([1, 4, 8, 4, 5, 4, 7, 0, 6, 6]);
    });
  });
});
