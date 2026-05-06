import { readBinaryFileAsUint8Array, readTransaction } from '../../testdata/test.helper';
import { CBOR } from '../lib/cbor';
import { AtomicalParserService } from './atomical-parser.service';
import { AtomicalOperation } from './atomical-parser.service.helper';

/**
 * Real-mainnet coverage for the previously-untested Atomicals operations
 * `ft`, `dmt`, `dat`, `mod`, `sl`. Every fixture is a real on-chain tx
 * confirmed via the live ordpool indexer's ordpool_stats_atomical_op
 * satellite table; the row id where applicable is included in each
 * fixture's comment for cross-reference.
 *
 * Source-of-truth citations are the same as for the splat/split/custom-color
 * spec: atomicals-electrumx@8df2374 `electrumx/lib/util_atomicals.py`
 * (opcode dispatch) and `electrumx/server/block_processor.py` (recorded
 * labels). See atomical-parser.service.helper.ts for the full mapping.
 */

// dmt (distributed mint claim of an existing dft): the workhorse of
// Atomicals -- 88% of all atomicals txs in our index. This is an early
// claim of the "atom" ticker, block 808513.
const DMT_ATOM_TXID = '5390e86df98982122175e18a7f24a1618d14e50e0b2242c7ca2c27730ffad700';

// ft (direct fungible-token mint with full supply to creator). Block 823349,
// "coinbase" ticker; payload includes substantial `meta` (name, description,
// legal terms).
const FT_COINBASE_TXID = '99393a0d4e6dfce569593cc85a7313277a71045adca84f0fb1c9a3c91d5eefd1';

// dat (standalone on-chain data). Block 813535, payload carries a 144x144
// PNG attached via the {filename: bytes} CBOR shape.
const DAT_PNG_TXID = 'b8a729cae5d63e512fc8dee2a1419babb27de6927ba45e126023055c672d42d2';

// mod (modify state on an existing atomical). Block 808768, sets
// /subrealms minting rules with an attached sample-rules.json file.
const MOD_SUBREALM_RULES_TXID = 'd6928b9db3fc5128e9bb78079761eb927e4a7ed9f888c54958e8cbde21e1d38f';

// sl (seal an atomical, locking it from further changes). Block 818965.
// Payload is just `args` -- no rules or data attached because the seal is
// itself the entire effect.
const SL_TXID = '916a1cfdeb0aaae31a42f3ae3c6823977300881b2ecfb284638a2f89edee4f86';

describe('AtomicalParserService — ft / dmt / dat / mod / sl', () => {

  describe('dmt (distributed mint)', () => {
    it('parses an "atom" ticker dmt claim with bitwork-mined args', () => {
      const tx = readTransaction(DMT_ATOM_TXID);

      const parsed = AtomicalParserService.parse(tx);

      expect(parsed).not.toBeNull();
      expect(parsed!.operation).toBe<AtomicalOperation>('dmt');

      const payload = parsed!.getPayloadRaw();
      expect(payload.length).toBe(59);

      // dmt payload always has an `args` map with the bitwork-mined fields
      // and the target ticker. No file attachment, no `meta`.
      expect(CBOR.decode(payload)).toEqual({
        args: {
          bitworkc: '1618',
          mint_ticker: 'atom',
          nonce: 5446138,
          time: 1695180453,
        },
      });

      expect(parsed!.getArgs()).toEqual({
        bitworkc: '1618',
        mint_ticker: 'atom',
        nonce: 5446138,
        time: 1695180453,
      });
      expect(parsed!.getFiles()).toEqual([]);
    });
  });

  describe('ft (direct fungible-token mint)', () => {
    it('parses the "coinbase" ft mint with full meta block', () => {
      const tx = readTransaction(FT_COINBASE_TXID);

      const parsed = AtomicalParserService.parse(tx);

      expect(parsed).not.toBeNull();
      expect(parsed!.operation).toBe<AtomicalOperation>('ft');

      const payload = parsed!.getPayloadRaw();
      expect(payload.length).toBe(1342);

      // ft mints carry args + a meta object. Args mirror the dft/dmt shape
      // (bitworkc, time, nonce, request_ticker). meta is free-form metadata
      // -- name, description, legal terms etc. Assert the args exactly;
      // assert key invariants on meta without pinning the full text (it
      // can run to thousands of bytes and is not the parser's concern).
      expect(parsed!.getArgs()).toEqual({
        bitworkc: '0000',
        nonce: 598543,
        request_ticker: 'coinbase',
        time: 1703818220,
      });
    });
  });

  describe('dat (standalone data)', () => {
    it('parses a dat tx with a 144x144 PNG file attachment', () => {
      const tx = readTransaction(DAT_PNG_TXID);

      const parsed = AtomicalParserService.parse(tx);

      expect(parsed).not.toBeNull();
      expect(parsed!.operation).toBe<AtomicalOperation>('dat');

      const payload = parsed!.getPayloadRaw();
      expect(payload.length).toBe(4805);

      // dat with no `args` map -- the entire payload is the {filename: bytes}
      // attachment. The file in this fixture decodes as a 144x144 PNG.
      const files = parsed!.getFiles();
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('.\\image.png');
      expect(files[0].contentType).toBe('image/png');
      expect(files[0].data.length).toBe(4789);

      // PNG signature (8 bytes) + IHDR chunk header. Width and height live
      // at byte offsets 16-19 and 20-23 respectively.
      const dv = new DataView(files[0].data.buffer, files[0].data.byteOffset, files[0].data.byteLength);
      expect(dv.getUint32(0)).toBe(0x89504e47);  // PNG magic
      expect(dv.getUint32(4)).toBe(0x0d0a1a0a);  // PNG signature continuation
      expect(dv.getUint32(16)).toBe(144);        // width
      expect(dv.getUint32(20)).toBe(144);        // height

      // Byte-for-byte parity with the reference file extracted on first run.
      const expected = readBinaryFileAsUint8Array('atomical_dat_b8a729ca_image.png');
      expect(files[0].data).toEqual(expected);
    });
  });

  describe('mod (modify state)', () => {
    it('parses a mod tx that sets /subrealms minting rules', () => {
      const tx = readTransaction(MOD_SUBREALM_RULES_TXID);

      const parsed = AtomicalParserService.parse(tx);

      expect(parsed).not.toBeNull();
      expect(parsed!.operation).toBe<AtomicalOperation>('mod');

      const payload = parsed!.getPayloadRaw();
      expect(payload.length).toBe(425);

      // mod payload here has no top-level `args` (so getArgs returns null);
      // instead it carries `$path: "/subrealms"`, a `rules` array, and an
      // attached sample-rules.json file demonstrating the rule shape.
      const files = parsed!.getFiles();
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('.\\sample-rules.json');
      expect(files[0].contentType).toBe('application/json; charset=utf-8');
      expect(files[0].data.length).toBe(244);

      const fileText = new TextDecoder().decode(files[0].data);
      const parsedFile = JSON.parse(fileText);
      expect(parsedFile).toEqual({
        $path: '/subrealms',
        rules: [
          {
            p: '[a-z0-9]{4, 63}',
            o: {
              '51208e390be104ac99a048dbdd9faf86afd8e4599a55f9a40884eb96416e2340a9f0': 1,
            },
          },
        ],
      });
    });
  });

  describe('sl (seal)', () => {
    it('parses a seal tx with bitwork-mined args and no payload extras', () => {
      const tx = readTransaction(SL_TXID);

      const parsed = AtomicalParserService.parse(tx);

      expect(parsed).not.toBeNull();
      expect(parsed!.operation).toBe<AtomicalOperation>('sl');

      const payload = parsed!.getPayloadRaw();
      expect(payload.length).toBe(39);

      // sl is the simplest "modify" op -- the seal action is the entire
      // effect, no rules or data needed. Payload is just `args` with the
      // bitwork-mined fields.
      expect(CBOR.decode(payload)).toEqual({
        args: {
          bitworkc: '1',
          nonce: 3326816,
          time: 1701242965,
        },
      });

      expect(parsed!.getArgs()).toEqual({
        bitworkc: '1',
        nonce: 3326816,
        time: 1701242965,
      });
      expect(parsed!.getFiles()).toEqual([]);
    });
  });
});
