import { asmToHex } from './script';

// Each case is { name, asm-as-ord-renders-it, expected-hex-as-serde-renders-it }.
// The ASM samples are pasted from real ord HTML pages (`/output/<outpoint>`);
// the expected hex is the corresponding `script_pubkey` JSON value from
// `explorer.ordinalsbot.com` for the same outpoint. ord prints ASM in lowercase
// hex tokens; we emit lowercase to match serde_json's output.
describe('asmToHex (script ASM -> hex)', () => {
  it('P2TR: OP_PUSHNUM_1 OP_PUSHBYTES_32 <x-only-pubkey>', () => {
    expect(asmToHex(
      'OP_PUSHNUM_1 OP_PUSHBYTES_32 6974611399f11924aab8df1fe37619122320ee8b2273baacdd6d2d954bb0aefc'
    )).toBe('51206974611399f11924aab8df1fe37619122320ee8b2273baacdd6d2d954bb0aefc');
  });

  it('P2PK: OP_PUSHBYTES_65 <uncompressed-pubkey> OP_CHECKSIG (Satoshi genesis output)', () => {
    expect(asmToHex(
      'OP_PUSHBYTES_65 04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f OP_CHECKSIG'
    )).toBe('4104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac');
  });

  it('P2PKH: OP_DUP OP_HASH160 OP_PUSHBYTES_20 <hash> OP_EQUALVERIFY OP_CHECKSIG', () => {
    expect(asmToHex(
      'OP_DUP OP_HASH160 OP_PUSHBYTES_20 0000000000000000000000000000000000000000 OP_EQUALVERIFY OP_CHECKSIG'
    )).toBe('76a914000000000000000000000000000000000000000088ac');
  });

  it('P2WPKH: OP_0 OP_PUSHBYTES_20 <hash>', () => {
    expect(asmToHex(
      'OP_0 OP_PUSHBYTES_20 0000000000000000000000000000000000000000'
    )).toBe('00140000000000000000000000000000000000000000');
  });

  it('OP_RETURN: OP_RETURN OP_PUSHBYTES_5 <data>', () => {
    expect(asmToHex(
      'OP_RETURN OP_PUSHBYTES_5 deadbeef00'
    )).toBe('6a05deadbeef00');
  });

  it('rejects unknown opcodes', () => {
    expect(() => asmToHex('OP_NOT_A_REAL_OPCODE')).toThrow(/unknown/);
  });

  it('rejects OP_PUSHBYTES_N when operand length mismatches', () => {
    expect(() => asmToHex('OP_PUSHBYTES_4 deadbeef00')).toThrow(/length mismatch/);
  });
});
