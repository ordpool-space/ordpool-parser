import { readTransaction } from '../../testdata/test.helper';
import { CBOR } from '../lib/cbor';
import { AtomicalParserService } from './atomical-parser.service';
import { ATOMICAL_OPERATION_LABELS, AtomicalOperation } from './atomical-parser.service.helper';

/**
 * Real-mainnet coverage for the three single-letter Atomicals operations
 * `x` (splat), `y` (split), `z` (custom-color). atomicals-electrumx records
 * these in `ordpool_stats_atomical_op` as `splat`, `split`, `custom-color`;
 * the parser surfaces only the single-letter operation code, and consumers
 * map to the human-readable label via ATOMICAL_OPERATION_LABELS.
 *
 * Source-of-truth citations:
 * - atomicals-electrumx `electrumx/lib/util_atomicals.py:1161-1166` (opcode dispatch)
 * - atomicals-electrumx `electrumx/server/block_processor.py:2160-2211` (label record)
 * - atomicals-js `lib/commands/{splat,split,custom-color}-interactive-command.ts`
 *
 * `z` (custom-color) only activates at block 848484 -- the splat/split
 * fixtures are pre-activation. The custom-color fixture below was found by
 * scanning post-848484 blocks via `blockchain.atomicals.transaction_by_height`
 * with `op_type="custom-color"` on the wizz.cash electrumx proxy.
 */

// Splat (x): empty CBOR map payload (single byte 0xa0). Six confirmed mainnet txs.
const SPLAT_TXIDS = [
  '329a9fae404e4ca014b975dbcc7cb5267f47cccd2851a45ffa06c70744ae12cd', // block 811543
  '37090a948250a4d634c8835e7c00c3b7561dabd708b582f808a4843c3718c179', // block 813030
  'b8020f91301169d8d340934eea19a3ebabbfdecb347f8a1de5612348b3135ffe', // block 813285
  '9d669be60a2e49bef91242f30295f56f4ef31f5d69eddff87e20969d030a9aff', // block 813304
  '853ff028e08aa8d515e2daecebd6923ce8c7e57e704b562ffb2d524133378a29', // block 815461
  '68d809642cd9c1231b368ad5384a5bfb0286b6b1cf1179e32824be2702a7d1a2', // block 816280
];

// Split (y): payload is `{<atomical_id>: <sats>}` map. Both tracked atomical ids
// are identical on chain even though the txs come from different blocks --
// the same atomical was split twice with the same template.
const SPLIT_TXID_BLOCK_810965 = '054cc18a8162887917a1e6e5c60389bb4b6647167e6936d231466d7b2710f413';
const SPLIT_TXID_BLOCK_811074 = 'e3227e44165c2e3c148024e2a04acb7995620c8c962866b6db8052e3a4d3935c';

// Split with empty-map payload (likely a wallet bug, but the parser still
// recognises it as `y` because the opcode comes before the payload).
const SPLIT_EMPTY_TXID = 'c6ee81d9b67d44d31af4a4a7d80e32233f1abe7e5c0694e44f88cfcaab6e44c5'; // block 813219

// Custom-color (z): payload is `{atomical_id: {output_index: amount}}` map.
// First fixture is the smallest possible -- two outputs colored. Block 849384.
const CUSTOM_COLOR_SMALL_TXID = '914a3f3575a1da92035a57bd758da8588fd11776927ab880915f97e66612f773';

// Larger custom-color: distributes the FT across 69 outputs. Block 848559,
// just after the activation height (848484). Same fixture is in the live
// indexer DB at row id 2,130,304 (verified via ordpool_stats_atomical_op).
const CUSTOM_COLOR_LARGE_TXID = 'fd5016351b636a60bfbc58a9aa84bd6796a4c79cc19e1ae9f2a3ef7ecc377593';

describe('AtomicalParserService — splat / split / custom-color', () => {

  describe('splat (x)', () => {
    it.each(SPLAT_TXIDS)('parses %s as op=x with empty CBOR map payload', (txid) => {
      const tx = readTransaction(txid);

      const parsed = AtomicalParserService.parse(tx);

      expect(parsed).not.toBeNull();
      expect(parsed!.operation).toBe<AtomicalOperation>('x');

      // Empty CBOR map: a single byte 0xa0. atomicals-js' splat command
      // ships an empty payload (the operation needs no args -- the splat
      // semantic is fully determined by the witness reveal + the existing
      // atomical state).
      const payload = parsed!.getPayloadRaw();
      expect(payload.length).toBe(1);
      expect(payload[0]).toBe(0xa0);
      expect(CBOR.decode(payload)).toEqual({});
    });
  });

  describe('split (y)', () => {
    it.each([SPLIT_TXID_BLOCK_810965, SPLIT_TXID_BLOCK_811074])(
      'parses %s as op=y with `{atomical_id: sats}` payload',
      (txid) => {
        const tx = readTransaction(txid);

        const parsed = AtomicalParserService.parse(tx);

        expect(parsed).not.toBeNull();
        expect(parsed!.operation).toBe<AtomicalOperation>('y');

        const payload = parsed!.getPayloadRaw();
        expect(payload.length).toBe(72);
        expect(CBOR.decode(payload)).toEqual({
          '2679c605df1201f501b9827fa61e1405d19e37c8c9f8ac2dd8a67da2f87e76bfi0': 546,
        });
      },
    );

    it('parses an empty-payload split as op=y with `{}`', () => {
      // c6ee81d9... is a `y` operation with no map entries -- the on-chain
      // version of a wallet bug where the split command was issued with
      // no targets. atomicals-electrumx still records it as `split`, so
      // we do too. The only thing the parser asserts is the opcode; the
      // empty payload is the consumer's responsibility to validate.
      const tx = readTransaction(SPLIT_EMPTY_TXID);

      const parsed = AtomicalParserService.parse(tx);

      expect(parsed).not.toBeNull();
      expect(parsed!.operation).toBe<AtomicalOperation>('y');

      const payload = parsed!.getPayloadRaw();
      expect(payload.length).toBe(1);
      expect(payload[0]).toBe(0xa0);
      expect(CBOR.decode(payload)).toEqual({});
    });
  });

  describe('custom-color (z)', () => {
    it('parses a small two-output custom-color tx', () => {
      const tx = readTransaction(CUSTOM_COLOR_SMALL_TXID);

      const parsed = AtomicalParserService.parse(tx);

      expect(parsed).not.toBeNull();
      expect(parsed!.operation).toBe<AtomicalOperation>('z');

      const payload = parsed!.getPayloadRaw();
      expect(payload.length).toBe(78);

      // Custom-color payload: outer map of atomical_id -> inner output map.
      // The inner map keys are stringified output indexes; values are the
      // FT amounts to assign to each output. atomicals-electrumx records
      // this exact same payload structure on the wizz.cash indexer.
      expect(CBOR.decode(payload)).toEqual({
        '56a8702bab3d2405eb9a356fd0725ca112a93a8efd1ecca06c6085e7278f0341i0': {
          '0': 30,
          '1': 157,
        },
      });
    });

    it('parses a large 69-output custom-color tx with mixed amounts', () => {
      const tx = readTransaction(CUSTOM_COLOR_LARGE_TXID);

      const parsed = AtomicalParserService.parse(tx);

      expect(parsed).not.toBeNull();
      expect(parsed!.operation).toBe<AtomicalOperation>('z');

      const payload = parsed!.getPayloadRaw();
      expect(payload.length).toBe(407);

      // 69 outputs total: 0..67 each colored with 200 sats, output 68 with 6400.
      // Sum = 68 * 200 + 6400 = 20,000 -- the full FT supply of this atomical
      // being redistributed across all witness outputs in one call.
      const expectedOutputs: Record<string, number> = {};
      for (let i = 0; i <= 67; i++) {
        expectedOutputs[i.toString()] = 200;
      }
      expectedOutputs['68'] = 6400;

      expect(CBOR.decode(payload)).toEqual({
        '9125f03bcf9325f6071762b9aee00b461a0b43ed157c336e2e89e07f47ea6f66i0': expectedOutputs,
      });
    });
  });

  describe('ATOMICAL_OPERATION_LABELS', () => {
    it('maps single-letter opcodes to human-readable labels', () => {
      expect(ATOMICAL_OPERATION_LABELS.x).toBe('splat');
      expect(ATOMICAL_OPERATION_LABELS.y).toBe('split');
      expect(ATOMICAL_OPERATION_LABELS.z).toBe('custom-color');
    });

    it('keeps the multi-letter operations as their canonical form', () => {
      expect(ATOMICAL_OPERATION_LABELS.nft).toBe('NFT');
      expect(ATOMICAL_OPERATION_LABELS.ft).toBe('FT');
      expect(ATOMICAL_OPERATION_LABELS.dft).toBe('distributed FT');
      expect(ATOMICAL_OPERATION_LABELS.dmt).toBe('distributed mint');
      expect(ATOMICAL_OPERATION_LABELS.dat).toBe('data');
      expect(ATOMICAL_OPERATION_LABELS.mod).toBe('modify');
      expect(ATOMICAL_OPERATION_LABELS.evt).toBe('event');
      expect(ATOMICAL_OPERATION_LABELS.sl).toBe('seal');
      expect(ATOMICAL_OPERATION_LABELS.unknown).toBe('unknown');
    });
  });
});
