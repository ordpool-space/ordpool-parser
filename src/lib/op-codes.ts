/**
 * Bitcoin Script Opcodes
 * see https://en.bitcoin.it/wiki/Script
 */
export const OP_FALSE = 0x00;
export const OP_IF = 0x63;
export const OP_0 = 0x00;

export const OP_PUSHBYTES_3 = 0x03; //  3 -- not an actual opcode, but used in documentation --> pushes the next 3 bytes onto the stack.
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
