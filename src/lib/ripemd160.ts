/**
 * Inline RIPEMD-160 implementation. Zero deps, browser + Node.
 *
 * Used by the OTS verifier (some attestation chains include OP_RIPEMD160
 * — e.g. the canonical hello-world.txt.ots example). RIPEMD-160 is NOT
 * available via WebCrypto's SubtleCrypto, so we inline it.
 *
 * Algorithm: RFC 5802 / Dobbertin-Bosselaers-Preneel "RIPEMD-160: A
 * Strengthened Version of RIPEMD" (1996). 5 rounds, 16 ops per round,
 * two parallel chains XORed at the end. Standard, public-domain
 * algorithm; this is a port of the canonical reference implementation
 * with no behavioural deviations.
 *
 * Verified against the published test vectors:
 *   ""                 -> 9c1185a5c5e9fc54612808977ee8f548b2258d31
 *   "a"                -> 0bdc9d2d256b3ee9daae347be6f4dc835a467ffe
 *   "abc"              -> 8eb208f7e05d987a9b044a8e98c6b087f15a0bfc
 *   "message digest"   -> 5d0689ef49d2fae572b881b123a85ffa21595f36
 *   "a..z"             -> f71c27109c692c1b56bbdceb5b9d2865b3708dbc
 *   1M × "a"           -> 52783243c1697bdbe16d37f97f68f08325dc1528
 */

function rotl32(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

// Five non-linear bit-mixing functions.
function f(j: number, x: number, y: number, z: number): number {
  if (j < 16) return (x ^ y ^ z) >>> 0;
  if (j < 32) return (((x & y) | (~x & z)) >>> 0);
  if (j < 48) return (((x | ~y) ^ z) >>> 0);
  if (j < 64) return (((x & z) | (y & ~z)) >>> 0);
  return ((x ^ (y | ~z)) >>> 0);
}

// Constants K and K' for left and right lines.
const K = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
const KP = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];

// Message-word selection r, r' for left and right lines (5 rounds × 16 ops).
const R: number[] = [
  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,
  7,  4, 13,  1, 10,  6, 15,  3, 12,  0,  9,  5,  2, 14, 11,  8,
  3, 10, 14,  4,  9, 15,  8,  1,  2,  7,  0,  6, 13, 11,  5, 12,
  1,  9, 11, 10,  0,  8, 12,  4, 13,  3,  7, 15, 14,  5,  6,  2,
  4,  0,  5,  9,  7, 12,  2, 10, 14,  1,  3,  8, 11,  6, 15, 13,
];
const RP: number[] = [
  5, 14,  7,  0,  9,  2, 11,  4, 13,  6, 15,  8,  1, 10,  3, 12,
  6, 11,  3,  7,  0, 13,  5, 10, 14, 15,  8, 12,  4,  9,  1,  2,
  15,  5,  1,  3,  7, 14,  6,  9, 11,  8, 12,  2, 10,  0,  4, 13,
  8,  6,  4,  1,  3, 11, 15,  0,  5, 12,  2, 13,  9,  7, 10, 14,
  12, 15, 10,  4,  1,  5,  8,  7,  6,  2, 13, 14,  0,  3,  9, 11,
];

// Per-step rotate amounts s, s' for left and right lines.
const S: number[] = [
  11, 14, 15, 12,  5,  8,  7,  9, 11, 13, 14, 15,  6,  7,  9,  8,
   7,  6,  8, 13, 11,  9,  7, 15,  7, 12, 15,  9, 11,  7, 13, 12,
  11, 13,  6,  7, 14,  9, 13, 15, 14,  8, 13,  6,  5, 12,  7,  5,
  11, 12, 14, 15, 14, 15,  9,  8,  9, 14,  5,  6,  8,  6,  5, 12,
   9, 15,  5, 11,  6,  8, 13, 12,  5, 12, 13, 14, 11,  8,  5,  6,
];
const SP: number[] = [
   8,  9,  9, 11, 13, 15, 15,  5,  7,  7,  8, 11, 14, 14, 12,  6,
   9, 13, 15,  7, 12,  8,  9, 11,  7,  7, 12,  7,  6, 15, 13, 11,
   9,  7, 15, 11,  8,  6,  6, 14, 12, 13,  5, 14, 13, 13,  7,  5,
  15,  5,  8, 11, 14, 14,  6, 14,  6,  9, 12,  9, 12,  5, 15,  8,
   8,  5, 12,  9, 12,  5, 14,  6,  8, 13,  6,  5, 15, 13, 11, 11,
];

function processBlock(state: Uint32Array, block: Uint32Array): void {
  let aa = state[0], bb = state[1], cc = state[2], dd = state[3], ee = state[4];
  let aap = state[0], bbp = state[1], ccp = state[2], ddp = state[3], eep = state[4];

  for (let j = 0; j < 80; j++) {
    const round = (j / 16) | 0;
    let t = (aa + f(j, bb, cc, dd) + block[R[j]] + K[round]) >>> 0;
    t = (rotl32(t, S[j]) + ee) >>> 0;
    aa = ee; ee = dd; dd = rotl32(cc, 10); cc = bb; bb = t;

    let tp = (aap + f(79 - j, bbp, ccp, ddp) + block[RP[j]] + KP[round]) >>> 0;
    tp = (rotl32(tp, SP[j]) + eep) >>> 0;
    aap = eep; eep = ddp; ddp = rotl32(ccp, 10); ccp = bbp; bbp = tp;
  }

  const t = (state[1] + cc + ddp) >>> 0;
  state[1] = (state[2] + dd + eep) >>> 0;
  state[2] = (state[3] + ee + aap) >>> 0;
  state[3] = (state[4] + aa + bbp) >>> 0;
  state[4] = (state[0] + bb + ccp) >>> 0;
  state[0] = t;
}

/** RIPEMD-160 hash. Returns a 20-byte Uint8Array. */
export function ripemd160(message: Uint8Array): Uint8Array {
  // Initial state vectors (per spec).
  const state = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);

  // Pad: append 0x80, then zeros, then 8-byte LE bit length.
  const bitLen = BigInt(message.length) * 8n;
  const padLen = (message.length % 64 < 56)
    ? (56 - (message.length % 64))
    : (120 - (message.length % 64));
  const padded = new Uint8Array(message.length + padLen + 8);
  padded.set(message, 0);
  padded[message.length] = 0x80;
  // Write bit length as little-endian 64-bit.
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Number(bitLen & 0xffffffffn), true);
  dv.setUint32(padded.length - 4, Number(bitLen >> 32n) & 0xffffffff, true);

  // Process 64-byte blocks as 16 little-endian uint32 words.
  const block = new Uint32Array(16);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      block[i] =
        (padded[off + i * 4]) |
        (padded[off + i * 4 + 1] << 8) |
        (padded[off + i * 4 + 2] << 16) |
        (padded[off + i * 4 + 3] << 24);
    }
    processBlock(state, block);
  }

  // Output 20 bytes, little-endian.
  const out = new Uint8Array(20);
  const odv = new DataView(out.buffer);
  odv.setUint32(0,  state[0], true);
  odv.setUint32(4,  state[1], true);
  odv.setUint32(8,  state[2], true);
  odv.setUint32(12, state[3], true);
  odv.setUint32(16, state[4], true);
  return out;
}
