import { readBinaryFileAsUint8Array, readTransaction } from '../../testdata/test.helper';
import { DigitalArtifactType } from '../types/digital-artifact';
import { ParsedSrc20 } from '../types/parsed-src20';
import { ParsedSrc721 } from '../types/parsed-src721';
import { ParsedSrc101 } from '../types/parsed-src101';
import { ParsedStamp } from '../types/parsed-stamp';
import { StampParserService } from './stamp-parser.service';

// =============================================================================
// Stamps -- OLGA P2WSH encoding (Counterparty-issued, no stamp: prefix)
// =============================================================================
// The stamp image data is stored directly in v0_p2wsh output scriptpubkeys.
// Each P2WSH output is 34 bytes: 0020 + 32 bytes of raw data.
// Counterparty-issued stamps do NOT have a stamp: prefix inside the data.

// Stamp #1383565 -- PNG pixel art, 44 P2WSH outputs, 1393 bytes
// Block 933,540, CPID A197900000000002026
const STAMP_PNG_TXID = '516e62beeffb26fb37f8e95e809274e5bbde76eb75a28357f6bbcd4eedbfe8ca';

// Stamp #1383556 -- GIF animation, 3 P2WSH outputs, 93 bytes
// Block 933,536
const STAMP_GIF_TXID = '9dbdb2ef0f84f8852f1abc3e0f39f6e223ee64ae1452ecceaea9eaf0a9ae9669';

// Stamp #1392451 -- SVG vector art, 8 P2WSH outputs, 240 bytes
// Block 936,467
const STAMP_SVG_TXID = '085e0ccbf674dfd5934eb635d392250afb4b6ce41ceb1347335f6f0e64c2f7d6';

// Stamp #1422105 -- HTML content, 1535 P2WSH outputs, 49,101 bytes
// Block 943,762 -- the largest HTML stamp we found (stress test)
const STAMP_HTML_TXID = '3dfc964777a27da2b93eddbe5a5da06923a1e1c7a80a386e884187dfb88877ff';

// =============================================================================
// SRC-721 -- OLGA P2WSH encoding (JSON payload)
// =============================================================================

// Stamp #1383566 -- SRC-721 composable NFT mint
// {"p":"src-721","op":"mint","c":"A1473703777372088053","ts":[1,4,8,4,5,4,7,0,6,6]}
// Block 933,541, 3 P2WSH outputs, 81 bytes
const SRC721_TXID = 'b74313d300902c0cdf88dc101fb8f4c9ab7ad89c978edd30ca4ee7987cccdedd';

// =============================================================================
// SRC-20 OLGA -- P2WSH encoding with "stamp:" prefix
// =============================================================================

// Real mainnet SRC-20 transfer via OLGA (block 866,000)
// Raw P2WSH data: [length=63] stamp:{"p":"src-20","op":"transfer","tick":"mbtc","amt":150100}
// This exercises the stamp: prefix stripping code path in extractOlgaData()
const SRC20_OLGA_TXID = '04460b129b970e53de19860f52a276358b5fe7dffc2bb25f7d35cefa62a1755e';

// Stamp #1222271 -- JPEG photo, 68 P2WSH outputs, 2162 bytes
// Block 912,151
const STAMP_JPEG_TXID = 'd88d5e4e1adfdc23117b52f35641ef5918812cf32ec3dcec54faa6d2d4dcae2e';

// Stamp #1061571 -- WebP image, 492 P2WSH outputs, 15734 bytes
// Block 897,731 -- exercises the bug-fixed zero-stripping path (WebP ends with 0x00 bytes)
const STAMP_WEBP_TXID = '2825437c2d6cf4250eca8b7bbc487107cc0ee4dfcd765a2dcf33ce31c7db2f45';

// Stamp #1175067 -- gzip-compressed content, 61 P2WSH outputs, 1921 bytes
// Block 906,705 -- exercises gzip magic byte detection (1f 8b)
const GZIP_STAMP_TXID = '9660860095ba470a9622b41ad7b594cb53dce5ade3c79cd2b226b27619bcd40a';

// Stamp #1220118 -- unknown format (BMN audio), 59 bytes
// Block 911,729 -- exercises the application/octet-stream fallback path
const UNKNOWN_MIME_STAMP_TXID = 'da9f7bc49861d4ab6e0933f539538963ada17c88440048519bf015305c38989d';

// =============================================================================
// SRC-101 -- ARC4 multisig encoding (key burn, stamp: prefix)
// =============================================================================

// Real mainnet SRC-101 DEPLOY: BitNameService
// Block 871,022, 22 multisig outputs, ARC4 encrypted with stamp: prefix
// stamp:{"p":"src-101","op":"deploy","root":"btc","name":"BitNameService",...}
const SRC101_TXID = '5d18994d0981c421c115bf18a1ec0047cf63c06a4c94384a560ab74d6d0552f9';

// =============================================================================
// Non-stamp transactions (negative tests)
// =============================================================================

// Existing SRC-20 test tx uses ARC4 multisig with key burn, no P2WSH outputs.
// StampParserService detects both OLGA and multisig stamps now.
const SRC20_MULTISIG_TXID = '50aeb77245a9483a5b077e4e7506c331dc2f628c22046e7d2b4c6ad6c6236ae1';

// CAT-21 genesis tx has no P2WSH outputs
const CAT21_GENESIS_TXID = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';


describe('StampParserService', () => {

  // ===========================================================================
  // Stamps -- raw file data in P2WSH outputs, no stamp: prefix
  // ===========================================================================

  describe('parse -- Stamps via OLGA P2WSH', () => {

    it('should extract a PNG image (stamp #1383565, 44 P2WSH outputs)', () => {
      const txn = readTransaction(STAMP_PNG_TXID);
      const result = StampParserService.parse(txn) as ParsedStamp;

      expect(result.type).toBe(DigitalArtifactType.Stamp);
      expect(result.transactionId).toBe(STAMP_PNG_TXID);
      expect(result.uniqueId).toBe(`${DigitalArtifactType.Stamp}-${STAMP_PNG_TXID}`);
      expect(result.contentType).toBe('image/png');

      const raw = result.getDataRaw();
      expect(raw.length).toBe(1393);

      // PNG magic bytes: 89 50 4e 47 0d 0a 1a 0a
      expect(raw[0]).toBe(0x89);
      expect(raw[1]).toBe(0x50); // P
      expect(raw[2]).toBe(0x4e); // N
      expect(raw[3]).toBe(0x47); // G
      expect(raw[4]).toBe(0x0d);
      expect(raw[5]).toBe(0x0a);
      expect(raw[6]).toBe(0x1a);
      expect(raw[7]).toBe(0x0a);

      // Byte-for-byte match against reference image extracted from stampchain API
      const reference = readBinaryFileAsUint8Array('stamp_1383565_image.png');
      expect(raw).toEqual(reference);

      // Data URI for embedding in HTML
      expect(result.getDataUri().startsWith('data:image/png;base64,')).toBe(true);
    });

    it('should extract a GIF image (stamp #1383556, 3 P2WSH outputs)', () => {
      const txn = readTransaction(STAMP_GIF_TXID);
      const result = StampParserService.parse(txn) as ParsedStamp;

      expect(result.type).toBe(DigitalArtifactType.Stamp);
      expect(result.contentType).toBe('image/gif');

      const raw = result.getDataRaw();
      expect(raw.length).toBe(93);

      // GIF magic bytes: 47 49 46 38 39 61 (GIF89a)
      expect(raw[0]).toBe(0x47); // G
      expect(raw[1]).toBe(0x49); // I
      expect(raw[2]).toBe(0x46); // F
      expect(raw[3]).toBe(0x38); // 8
      expect(raw[4]).toBe(0x39); // 9
      expect(raw[5]).toBe(0x61); // a

      const reference = readBinaryFileAsUint8Array('stamp_1383556_image.gif');
      expect(raw).toEqual(reference);

      expect(result.getDataUri().startsWith('data:image/gif;base64,')).toBe(true);
    });

    it('should extract an SVG image (stamp #1392451, 8 P2WSH outputs)', () => {
      const txn = readTransaction(STAMP_SVG_TXID);
      const result = StampParserService.parse(txn) as ParsedStamp;

      expect(result.type).toBe(DigitalArtifactType.Stamp);
      expect(result.contentType).toBe('image/svg+xml');

      const raw = result.getDataRaw();
      expect(raw.length).toBe(240);

      // SVG starts with '<svg '
      expect(raw[0]).toBe(0x3c); // <
      expect(raw[1]).toBe(0x73); // s
      expect(raw[2]).toBe(0x76); // v
      expect(raw[3]).toBe(0x67); // g

      // Content is valid SVG
      const content = result.getContent();
      expect(content.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);

      const reference = readBinaryFileAsUint8Array('stamp_1392451_image.svg');
      expect(raw).toEqual(reference);
    });

    it('should extract a JPEG image (stamp #1222271, 68 P2WSH outputs)', () => {
      const txn = readTransaction(STAMP_JPEG_TXID);
      const result = StampParserService.parse(txn) as ParsedStamp;

      expect(result.type).toBe(DigitalArtifactType.Stamp);
      expect(result.contentType).toBe('image/jpeg');

      const raw = result.getDataRaw();
      expect(raw.length).toBe(2162);

      // JPEG magic bytes: ff d8 ff e0 (JFIF marker)
      expect(raw[0]).toBe(0xff);
      expect(raw[1]).toBe(0xd8);
      expect(raw[2]).toBe(0xff);

      const reference = readBinaryFileAsUint8Array('stamp_1222271_image.jpg');
      expect(raw).toEqual(reference);
    });

    it('should extract a WebP image (stamp #1061571, 492 P2WSH outputs)', () => {
      const txn = readTransaction(STAMP_WEBP_TXID);
      const result = StampParserService.parse(txn) as ParsedStamp;

      expect(result.type).toBe(DigitalArtifactType.Stamp);
      expect(result.contentType).toBe('image/webp');

      const raw = result.getDataRaw();
      expect(raw.length).toBe(15734);

      // WebP magic: RIFF....WEBP (52 49 46 46 ... 57 45 42 50)
      expect(raw[0]).toBe(0x52); // R
      expect(raw[1]).toBe(0x49); // I
      expect(raw[2]).toBe(0x46); // F
      expect(raw[3]).toBe(0x46); // F
      expect(raw[8]).toBe(0x57); // W
      expect(raw[9]).toBe(0x45); // E
      expect(raw[10]).toBe(0x42); // B
      expect(raw[11]).toBe(0x50); // P

      const reference = readBinaryFileAsUint8Array('stamp_1061571_image.webp');
      expect(raw).toEqual(reference);
    });

    it('should extract gzip content (stamp #1175067, 61 P2WSH outputs)', () => {
      const txn = readTransaction(GZIP_STAMP_TXID);
      const result = StampParserService.parse(txn) as ParsedStamp;

      expect(result.type).toBe(DigitalArtifactType.Stamp);
      expect(result.contentType).toBe('application/gzip');

      const raw = result.getDataRaw();
      expect(raw.length).toBe(1921);

      // Gzip magic: 1f 8b
      expect(raw[0]).toBe(0x1f);
      expect(raw[1]).toBe(0x8b);

      const reference = readBinaryFileAsUint8Array('stamp_1175067.gz');
      expect(raw).toEqual(reference);
    });

    it('should fall back to application/octet-stream for unknown format (BMN audio)', () => {
      const txn = readTransaction(UNKNOWN_MIME_STAMP_TXID);
      const result = StampParserService.parse(txn) as ParsedStamp;

      expect(result.type).toBe(DigitalArtifactType.Stamp);
      expect(result.contentType).toBe('application/octet-stream');

      const raw = result.getDataRaw();
      expect(raw.length).toBe(59);

      // Starts with 42 4d (BM) but is NOT a BMP -- it's BMN audio format
      expect(raw[0]).toBe(0x42); // B
      expect(raw[1]).toBe(0x4d); // M

      const reference = readBinaryFileAsUint8Array('stamp_1220118.bin');
      expect(raw).toEqual(reference);
    });

    it('should extract HTML content (stamp #1422105, 1535 P2WSH outputs)', () => {
      const txn = readTransaction(STAMP_HTML_TXID);
      const result = StampParserService.parse(txn) as ParsedStamp;

      expect(result.type).toBe(DigitalArtifactType.Stamp);
      expect(result.contentType).toBe('text/html');

      const raw = result.getDataRaw();
      expect(raw.length).toBe(49101);

      // HTML starts with '<!DOCTYPE html>'
      const content = result.getContent();
      expect(content.startsWith('<!DOCTYPE html>')).toBe(true);

      // Stress test: 1535 P2WSH outputs concatenated correctly
      const reference = readBinaryFileAsUint8Array('stamp_1422105.html');
      expect(raw).toEqual(reference);
    });
  });

  // ===========================================================================
  // SRC-721 -- JSON content routed to ParsedSrc721
  // ===========================================================================

  describe('parse -- SRC-721 via OLGA P2WSH', () => {
    it('should parse SRC-721 mint (stamp #1383566)', () => {
      const txn = readTransaction(SRC721_TXID);
      const result = StampParserService.parse(txn) as ParsedSrc721;

      expect(result.type).toBe(DigitalArtifactType.Src721);
      expect(result.transactionId).toBe(SRC721_TXID);
      expect(result.uniqueId).toBe(`${DigitalArtifactType.Src721}-${SRC721_TXID}`);

      // Exact JSON content (81 bytes)
      const content = result.getContent();
      expect(content).toBe('{"p":"src-721","op":"mint","c":"A1473703777372088053","ts":[1,4,8,4,5,4,7,0,6,6]}');

      // Parsed fields match
      const parsed = JSON.parse(content);
      expect(parsed.p).toBe('src-721');
      expect(parsed.op).toBe('mint');
      expect(parsed.c).toBe('A1473703777372088053');
      expect(parsed.ts).toEqual([1, 4, 8, 4, 5, 4, 7, 0, 6, 6]);
    });
  });

  // ===========================================================================
  // SRC-20 OLGA -- JSON content with stamp: prefix, routed to ParsedSrc20
  // ===========================================================================

  describe('parse -- SRC-20 via OLGA P2WSH (with stamp: prefix)', () => {
    it('should strip stamp: prefix and route to ParsedSrc20', () => {
      // This tx has raw P2WSH data: [length=63] stamp:{"p":"src-20",...}
      // Exercises the stamp: prefix stripping code path
      const txn = readTransaction(SRC20_OLGA_TXID);
      const result = StampParserService.parse(txn) as ParsedSrc20;

      expect(result.type).toBe(DigitalArtifactType.Src20);
      expect(result.transactionId).toBe(SRC20_OLGA_TXID);
      expect(result.uniqueId).toBe(`${DigitalArtifactType.Src20}-${SRC20_OLGA_TXID}`);

      // Exact JSON content after stamp: prefix is stripped (57 bytes)
      const content = result.getContent();
      expect(content).toBe('{"p":"src-20","op":"transfer","tick":"mbtc","amt":150100}');
    });
  });

  // ===========================================================================
  // SRC-101 -- ARC4 multisig encoding (key burn addresses, stamp: prefix)
  // ===========================================================================

  describe('parse -- SRC-101 via ARC4 multisig', () => {
    it('should parse SRC-101 DEPLOY (BitNameService, 22 multisig outputs)', () => {
      const txn = readTransaction(SRC101_TXID);
      const result = StampParserService.parse(txn) as ParsedSrc101;

      expect(result.type).toBe(DigitalArtifactType.Src101);
      expect(result.transactionId).toBe(SRC101_TXID);
      expect(result.uniqueId).toBe(`${DigitalArtifactType.Src101}-${SRC101_TXID}`);

      const content = result.getContent();
      const parsed = JSON.parse(content);

      expect(parsed.p).toBe('src-101');
      expect(parsed.op).toBe('deploy');
      expect(parsed.name).toBe('BitNameService');
      expect(parsed.root).toBe('btc');
      expect(parsed.lim).toBe('10');
      expect(parsed.desc).toBe('Bitname Service powered by BTC stamp.');
    });
  });

  // ===========================================================================
  // SRC-20 via ARC4 multisig (same path as SRC-101)
  // ===========================================================================

  describe('parse -- SRC-20 via ARC4 multisig', () => {
    it('should parse SRC-20 transfer from multisig key-burn outputs', () => {
      const txn = readTransaction(SRC20_MULTISIG_TXID);
      const result = StampParserService.parse(txn) as ParsedSrc20;

      expect(result.type).toBe(DigitalArtifactType.Src20);
      expect(result.transactionId).toBe(SRC20_MULTISIG_TXID);

      const parsed = JSON.parse(result.getContent());
      expect(parsed.p).toBe('src-20');
      expect(parsed.op).toBe('transfer');
      expect(parsed.tick).toBe('STEVE');
      expect(parsed.amt).toBe('100000000');
    });
  });

  // ===========================================================================
  // Negative tests -- should return null
  // ===========================================================================

  describe('parse -- negative cases', () => {
    it('should return null for a CAT-21 transaction', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      expect(StampParserService.parse(txn)).toBeNull();
    });
  });

  // ===========================================================================
  // hasStamp() -- quick boolean check
  // ===========================================================================

  describe('hasStamp', () => {
    it('should return true for a Stamp', () => {
      const txn = readTransaction(STAMP_PNG_TXID);
      expect(StampParserService.hasStamp(txn)).toBe(true);
    });

    it('should return true for SRC-721', () => {
      const txn = readTransaction(SRC721_TXID);
      expect(StampParserService.hasStamp(txn)).toBe(true);
    });

    it('should return true for SRC-20 OLGA', () => {
      const txn = readTransaction(SRC20_OLGA_TXID);
      expect(StampParserService.hasStamp(txn)).toBe(true);
    });

    it('should return true for SRC-101 multisig', () => {
      const txn = readTransaction(SRC101_TXID);
      expect(StampParserService.hasStamp(txn)).toBe(true);
    });

    it('should return false for a non-stamp transaction', () => {
      const txn = readTransaction(CAT21_GENESIS_TXID);
      expect(StampParserService.hasStamp(txn)).toBe(false);
    });
  });
});
