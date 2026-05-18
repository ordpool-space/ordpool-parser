import { readTransaction } from '../../testdata/test.helper';
import { AlkanesParserService } from './alkanes-parser.service';
import {
  ALKANES_PROTOCOL_TAG,
  hasAlkanesProtostone,
  protostoneProtocolTags,
} from './alkanes-parser.service.helper';

// Real mainnet alkanes-bearing txs, block 949000. Both carry a Runestone
// whose PROTOCOL tag (16383) holds a Protostone with protocol_tag = 1.
const ALKANES_TX_A = '972c41e6b564a5aa9663d94cd1b3cebcddd6ee8eae429c075ac50c841e3701d6';
const ALKANES_TX_B = 'a8e52911c5c398e13ccf37b24e9adca5a799d7e0fb0ac97ff3e65b470c76cf36';

// Real mainnet pure rune tx in the same block: Runestone present but no
// PROTOCOL tag at all, so no protostones.
const RUNE_NO_PROTOCOL_TX = 'bc668122adc872c81c91a1ddb3e2dee64372d6e4d749b3a655523b3af8ff9816';

// Real rune etching that predates alkanes (block 840000).
const FEHU_ETCH_TXID = '2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e';

// CAT-21 genesis — non-runestone tx (no rune envelope at all).
const CAT21_GENESIS_TXID = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';


describe('AlkanesParserService', () => {

  describe('hasAlkanes', () => {

    it('should detect a real alkanes mint (972c41e6...)', () => {
      const tx = readTransaction(ALKANES_TX_A);
      expect(AlkanesParserService.hasAlkanes(tx)).toBe(true);
    });

    it('should detect a second real alkanes mint (a8e52911...)', () => {
      const tx = readTransaction(ALKANES_TX_B);
      expect(AlkanesParserService.hasAlkanes(tx)).toBe(true);
    });

    it('should return false for a rune tx with no PROTOCOL tag (bc668122...)', () => {
      const tx = readTransaction(RUNE_NO_PROTOCOL_TX);
      expect(AlkanesParserService.hasAlkanes(tx)).toBe(false);
    });

    it('should return false for a pre-alkanes rune etching (Z*Z*Z*Z*Z*FEHU*Z*Z*Z*Z*Z)', () => {
      const tx = readTransaction(FEHU_ETCH_TXID);
      expect(AlkanesParserService.hasAlkanes(tx)).toBe(false);
    });

    it('should return false for a non-runestone tx (CAT-21 genesis)', () => {
      const tx = readTransaction(CAT21_GENESIS_TXID);
      expect(AlkanesParserService.hasAlkanes(tx)).toBe(false);
    });
  });
});


describe('alkanes protostone helpers', () => {

  it('ALKANES_PROTOCOL_TAG is 1n', () => {
    expect(ALKANES_PROTOCOL_TAG).toBe(1n);
  });

  it('hasAlkanesProtostone returns true on the real on-chain protocol field', () => {
    const tx = readTransaction(ALKANES_TX_A);
    const parsed = require('../rune/rune-parser.service').RuneParserService.parse(tx);
    // The on-chain protocol field is a single u128 carrying a Protostone
    // with payload (op-code call into the alkane). The exact value depends
    // on the call's encoded message + edicts; we only check the structural
    // signature (one packed u128) and the decoder's verdict.
    expect(parsed?.runestone?.protocol?.length).toBe(1);
    expect(hasAlkanesProtostone(parsed.runestone.protocol)).toBe(true);
  });

  it('protostoneProtocolTags identifies tag 1 on the real on-chain protocol field', () => {
    const tx = readTransaction(ALKANES_TX_A);
    const parsed = require('../rune/rune-parser.service').RuneParserService.parse(tx);
    const tags = protostoneProtocolTags(parsed.runestone.protocol);
    expect(tags).toContain(1n);
  });

  it('returns [] for an empty protocol field', () => {
    expect(protostoneProtocolTags([])).toEqual([]);
    expect(hasAlkanesProtostone([])).toBe(false);
  });

  it('returns false for undefined input', () => {
    expect(hasAlkanesProtostone(undefined)).toBe(false);
  });
});
