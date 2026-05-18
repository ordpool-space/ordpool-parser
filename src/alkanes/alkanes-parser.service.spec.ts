import { readTransaction } from '../../testdata/test.helper';
import { AlkanesParserService } from './alkanes-parser.service';
import { hasAlkanesProtostone, protostoneProtocolTags } from './alkanes-parser.service.helper';

// Minimum valid alkanes runestone: OP_RETURN OP_PUSHNUM_13 followed by
// the LEB128 sequence [tag=16383, value=1]. The value of 1 (as a u128
// inside the protocol field) re-decodes via snap_to_15_bytes + LEB128 as
// [protocol_tag=1, length=0] -- a zero-payload Protostone tagged for
// alkanes. The wire bytes are 6 in total:
//   6a       OP_RETURN
//   5d       OP_PUSHNUM_13 (Runestone magic)
//   03       OP_PUSHBYTES_3
//   ff 7f    LEB128(16383) -- Tag.PROTOCOL
//   01       LEB128(1)    -- one u128 value packed into tag PROTOCOL
const SYNTHETIC_ALKANES_TX = {
  txid: 'synthetic-alkanes',
  vout: [
    { scriptpubkey: '6a5d03ff7f01', scriptpubkey_type: 'op_return' },
  ],
};

// Same shape but the protocol-tag inside the protostone is 2 instead of 1.
// LEB128(16383) LEB128(2) = ff 7f 02. The u128 value 2 re-decodes as
// [protocol_tag=2, length=0] -- a non-alkanes protostone.
const SYNTHETIC_OTHER_PROTOSTONE_TX = {
  txid: 'synthetic-other',
  vout: [
    { scriptpubkey: '6a5d03ff7f02', scriptpubkey_type: 'op_return' },
  ],
};

// Empty Runestone: OP_RETURN OP_PUSHNUM_13 with no payload. Valid per
// the rune spec (no tags = no-op), but no protocol field -> no alkanes.
const SYNTHETIC_EMPTY_RUNESTONE_TX = {
  txid: 'synthetic-empty',
  vout: [
    { scriptpubkey: '6a5d', scriptpubkey_type: 'op_return' },
  ],
};

const CAT21_GENESIS_TXID = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';


describe('AlkanesParserService', () => {

  describe('hasAlkanes', () => {

    it('should return true for a synthetic alkanes runestone (protocol_tag = 1)', () => {
      expect(AlkanesParserService.hasAlkanes(SYNTHETIC_ALKANES_TX)).toBe(true);
    });

    it('should return false for a synthetic runestone with a non-alkanes protostone', () => {
      expect(AlkanesParserService.hasAlkanes(SYNTHETIC_OTHER_PROTOSTONE_TX)).toBe(false);
    });

    it('should return false for an empty runestone', () => {
      expect(AlkanesParserService.hasAlkanes(SYNTHETIC_EMPTY_RUNESTONE_TX)).toBe(false);
    });

    it('should return false for a real rune etching that has no protocol field (Z*Z*Z*Z*Z*FEHU*Z*Z*Z*Z*Z)', () => {
      const tx = readTransaction('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
      expect(AlkanesParserService.hasAlkanes(tx)).toBe(false);
    });

    it('should return false for a non-runestone tx (CAT-21 genesis)', () => {
      const tx = readTransaction(CAT21_GENESIS_TXID);
      expect(AlkanesParserService.hasAlkanes(tx)).toBe(false);
    });
  });
});


describe('protostone helpers', () => {

  it('protostoneProtocolTags returns [1n] for the minimal alkanes encoding', () => {
    // [1n] in the protocol field re-decodes as [protocol_tag=1, length=0]
    expect(protostoneProtocolTags([1n])).toEqual([1n]);
  });

  it('protostoneProtocolTags returns [] for an empty protocol field', () => {
    expect(protostoneProtocolTags([])).toEqual([]);
  });

  it('hasAlkanesProtostone returns false for undefined input', () => {
    expect(hasAlkanesProtostone(undefined)).toBe(false);
  });

  it('hasAlkanesProtostone returns false for a tag-2 protostone', () => {
    expect(hasAlkanesProtostone([2n])).toBe(false);
  });

  it('protostoneProtocolTags walks multiple protostones in one runestone', () => {
    // Synthetic byte stream encoding two protostones:
    //   protocol_tag=1, length=0
    //   protocol_tag=7, length=0
    // After split into 15-byte u128s, this fits in a single u128 whose
    // LE bytes are [01, 00, 07, 00, 00, ...] -- value 0x70001 = 458753.
    expect(protostoneProtocolTags([458753n])).toEqual([1n, 7n]);
  });
});
