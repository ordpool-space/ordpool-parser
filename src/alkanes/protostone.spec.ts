import { readTransaction } from '../../testdata/test.helper';
import { RuneParserService } from '../rune/rune-parser.service';
import {
  AlkaneId,
  decodeCellpack,
  decodeProtostones,
  ParsedProtostone,
} from './protostone';

// Two real DIESEL mints from block 949,000. Same on-chain Protostone shape:
// alkanes (protocol_tag=1), one Message field re-decoding to target 2:0
// with a single function-selector input.
const DIESEL_MINT_TX_A = '972c41e6b564a5aa9663d94cd1b3cebcddd6ee8eae429c075ac50c841e3701d6';
const DIESEL_MINT_TX_B = 'a8e52911c5c398e13ccf37b24e9adca5a799d7e0fb0ac97ff3e65b470c76cf36';

// Plain Runestone in the same block (no PROTOCOL tag at all).
const RUNE_NO_PROTOCOL_TX = 'bc668122adc872c81c91a1ddb3e2dee64372d6e4d749b3a655523b3af8ff9816';


describe('decodeProtostones', () => {

  it('decodes a real DIESEL mint protostone end-to-end', () => {
    const tx = readTransaction(DIESEL_MINT_TX_A);
    const protocol = RuneParserService.parse(tx)!.runestone!.protocol!;
    const protostones = decodeProtostones(protocol);

    expect(protostones).toHaveLength(1);
    const ps = protostones[0];
    expect(ps.protocolTag).toBe(1n);
    expect(ps.message).toEqual<ParsedProtostone['message']>({
      target: { block: 2n, tx: 0n },     // AlkaneId 2:0 = DIESEL
      inputs: [77n],                      // function selector (trailing zeros stripped)
    });
    expect(ps.pointer).toBe(0);
    expect(ps.refund).toBe(0);
    expect(ps.edicts).toEqual([]);
    expect(ps.burn).toBeNull();
    expect(ps.from).toBeNull();
  });

  it('decodes both DIESEL mint fixtures to the same Cellpack shape', () => {
    const txA = readTransaction(DIESEL_MINT_TX_A);
    const txB = readTransaction(DIESEL_MINT_TX_B);
    const psA = decodeProtostones(RuneParserService.parse(txA)!.runestone!.protocol!);
    const psB = decodeProtostones(RuneParserService.parse(txB)!.runestone!.protocol!);

    expect(psA[0].message).toEqual(psB[0].message);
    expect(psA[0].pointer).toEqual(psB[0].pointer);
    expect(psA[0].refund).toEqual(psB[0].refund);
  });

  it('returns [] for a Runestone with no PROTOCOL tag', () => {
    const tx = readTransaction(RUNE_NO_PROTOCOL_TX);
    const protocol = RuneParserService.parse(tx)!.runestone!.protocol;
    // RunestoneSpec.protocol is omitted from the JSON when the tag isn't
    // present (same as mint, pointer, edicts). Decoder accepts both.
    expect(protocol).toBeUndefined();
    expect(decodeProtostones(protocol ?? [])).toEqual([]);
  });

  it('returns [] for an empty protocol field', () => {
    expect(decodeProtostones([])).toEqual([]);
  });
});


describe('decodeCellpack', () => {

  it('returns null for an empty message', () => {
    expect(decodeCellpack([])).toBeNull();
  });

  it('decodes the DIESEL mint cellpack', () => {
    // Real on-chain message value from tx 972c41e6...
    // 5046274 (LE bytes 02 00 4D) re-decodes via LEB128 to [2, 0, 77].
    const cellpack = decodeCellpack([5046274n]);
    expect(cellpack).toEqual<ReturnType<typeof decodeCellpack>>({
      target: { block: 2n, tx: 0n },
      inputs: [77n],
    });
  });

  it('preserves target zeros (self-reference) but strips trailing input zeros', () => {
    // Build a message that decodes to [0, 0, 5, 0, 0, 0] in the byte
    // stream -- target 0:0 (kept), inputs [5] (trailing zeros stripped).
    // LEB128 bytes: 00 00 05 00 00 00 ... -> packed as u128 with byte 2 = 0x05.
    const messageU128 = 5n * (256n * 256n); // bytes [00, 00, 05, 00, ...]
    expect(decodeCellpack([messageU128])).toEqual({
      target: { block: 0n, tx: 0n },
      inputs: [5n],
    });
  });
});
