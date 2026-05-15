/**
 * Bitcoin Script Opcodes
 * see https://en.bitcoin.it/wiki/Script
 */
export const OP_FALSE = 0x00;
export const OP_IF = 0x63;
export const OP_0 = 0x00;

export const OP_PUSHBYTES_3 = 0x03; //  3 -- not an actual opcode, but used in documentation --> pushes the next 3 bytes onto the stack.
export const OP_PUSHBYTES_4 = 0x04; //  4 -- same as OP_PUSHBYTES_3 but for 4 bytes.
export const OP_PUSHDATA1 = 0x4c;   // 76 -- The next byte contains the number of bytes to be pushed onto the stack.
export const OP_PUSHDATA2 = 0x4d;   // 77 -- The next two bytes contain the number of bytes to be pushed onto the stack in little endian order.
export const OP_PUSHDATA4 = 0x4e;   // 78 -- The next four bytes contain the number of bytes to be pushed onto the stack in little endian order.
export const OP_ENDIF = 0x68;       // 104 -- Ends an if/else block.

export const OP_1NEGATE = 0x4f;            // 79 -- The number -1 is pushed onto the stack.
export const OP_RESERVED = 0x50;           // 80 -- Transaction is invalid unless occuring in an unexecuted OP_IF branch
export const OP_PUSHNUM_1 = 0x51;          // 81 -- also known as OP_1
export const OP_PUSHNUM_2 = 0x52;          // 82 -- also known as OP_2
export const OP_PUSHNUM_3 = 0x53;          // 83 -- also known as OP_3
export const OP_PUSHNUM_4 = 0x54;          // 84 -- also known as OP_4
export const OP_PUSHNUM_5 = 0x55;          // 85 -- also known as OP_5
export const OP_PUSHNUM_6 = 0x56;          // 86 -- also known as OP_6
export const OP_PUSHNUM_7 = 0x57;          // 87 -- also known as OP_7
export const OP_PUSHNUM_8 = 0x58;          // 88 -- also known as OP_8
export const OP_PUSHNUM_9 = 0x59;          // 89 -- also known as OP_9
export const OP_PUSHNUM_10 = 0x5a;         // 90 -- also known as OP_10
export const OP_PUSHNUM_11 = 0x5b;         // 91 -- also known as OP_11
export const OP_PUSHNUM_12 = 0x5c;         // 92 -- also known as OP_12
export const OP_PUSHNUM_13 = 0x5d;         // 93 -- also known as OP_13
export const OP_PUSHNUM_14 = 0x5e;         // 94 -- also known as OP_14
export const OP_PUSHNUM_15 = 0x5f;         // 95 -- also known as OP_15
export const OP_PUSHNUM_16 = 0x60;         // 96 -- also known as OP_16

export const OP_RETURN = 0x6a;             // 106 -- a standard way of attaching extra data to transactions is to add a zero-value output with a scriptPubKey consisting of OP_RETURN followed by data

/**
 * Full Bitcoin opcode name -> byte map.
 *
 * Originally lifted from the runestone-lib copy that lives in
 * `src/rune/src/script.ts` (see `src/rune/README.md` for the
 * shameless-copy disclosure). Moved here so callers outside the rune
 * package -- ordpool's HTML-to-JSON proxy is the first one -- can
 * resolve opcode names back to bytes without depending on the rune
 * subtree.
 *
 * The named entries cover every standard Bitcoin opcode. ord's HTML
 * `script_pubkey` ASM tokens use additional patterns NOT in this table:
 *   - `OP_PUSHBYTES_<N>` for N in 1..75 (the inline data-push opcodes)
 *   - `OP_PUSHNUM_<N>` for N in 1..16 (aliases for OP_1..OP_16)
 * Both are handled separately in `asmToHex` -- their byte values are
 * derived from the N suffix, no table needed.
 */
export const OPS_BY_NAME: Readonly<Record<string, number>> = {
  OP_FALSE: 0,
  OP_0: 0,
  OP_PUSHDATA1: 76,
  OP_PUSHDATA2: 77,
  OP_PUSHDATA4: 78,
  OP_1NEGATE: 79,
  OP_RESERVED: 80,
  OP_TRUE: 81,
  OP_1: 81,
  OP_2: 82,
  OP_3: 83,
  OP_4: 84,
  OP_5: 85,
  OP_6: 86,
  OP_7: 87,
  OP_8: 88,
  OP_9: 89,
  OP_10: 90,
  OP_11: 91,
  OP_12: 92,
  OP_13: 93,
  OP_14: 94,
  OP_15: 95,
  OP_16: 96,

  OP_NOP: 97,
  OP_VER: 98,
  OP_IF: 99,
  OP_NOTIF: 100,
  OP_VERIF: 101,
  OP_VERNOTIF: 102,
  OP_ELSE: 103,
  OP_ENDIF: 104,
  OP_VERIFY: 105,
  OP_RETURN: 106,

  OP_TOALTSTACK: 107,
  OP_FROMALTSTACK: 108,
  OP_2DROP: 109,
  OP_2DUP: 110,
  OP_3DUP: 111,
  OP_2OVER: 112,
  OP_2ROT: 113,
  OP_2SWAP: 114,
  OP_IFDUP: 115,
  OP_DEPTH: 116,
  OP_DROP: 117,
  OP_DUP: 118,
  OP_NIP: 119,
  OP_OVER: 120,
  OP_PICK: 121,
  OP_ROLL: 122,
  OP_ROT: 123,
  OP_SWAP: 124,
  OP_TUCK: 125,

  OP_CAT: 126,
  OP_SUBSTR: 127,
  OP_LEFT: 128,
  OP_RIGHT: 129,
  OP_SIZE: 130,

  OP_INVERT: 131,
  OP_AND: 132,
  OP_OR: 133,
  OP_XOR: 134,
  OP_EQUAL: 135,
  OP_EQUALVERIFY: 136,
  OP_RESERVED1: 137,
  OP_RESERVED2: 138,

  OP_1ADD: 139,
  OP_1SUB: 140,
  OP_2MUL: 141,
  OP_2DIV: 142,
  OP_NEGATE: 143,
  OP_ABS: 144,
  OP_NOT: 145,
  OP_0NOTEQUAL: 146,
  OP_ADD: 147,
  OP_SUB: 148,
  OP_MUL: 149,
  OP_DIV: 150,
  OP_MOD: 151,
  OP_LSHIFT: 152,
  OP_RSHIFT: 153,

  OP_BOOLAND: 154,
  OP_BOOLOR: 155,
  OP_NUMEQUAL: 156,
  OP_NUMEQUALVERIFY: 157,
  OP_NUMNOTEQUAL: 158,
  OP_LESSTHAN: 159,
  OP_GREATERTHAN: 160,
  OP_LESSTHANOREQUAL: 161,
  OP_GREATERTHANOREQUAL: 162,
  OP_MIN: 163,
  OP_MAX: 164,

  OP_WITHIN: 165,

  OP_RIPEMD160: 166,
  OP_SHA1: 167,
  OP_SHA256: 168,
  OP_HASH160: 169,
  OP_HASH256: 170,
  OP_CODESEPARATOR: 171,
  OP_CHECKSIG: 172,
  OP_CHECKSIGVERIFY: 173,
  OP_CHECKMULTISIG: 174,
  OP_CHECKMULTISIGVERIFY: 175,

  OP_NOP1: 176,

  OP_NOP2: 177,
  OP_CHECKLOCKTIMEVERIFY: 177,

  OP_NOP3: 178,
  OP_CHECKSEQUENCEVERIFY: 178,

  OP_NOP4: 179,
  OP_NOP5: 180,
  OP_NOP6: 181,
  OP_NOP7: 182,
  OP_NOP8: 183,
  OP_NOP9: 184,
  OP_NOP10: 185,

  OP_CHECKSIGADD: 186,

  OP_PUBKEYHASH: 253,
  OP_PUBKEY: 254,
  OP_INVALIDOPCODE: 255,
};
