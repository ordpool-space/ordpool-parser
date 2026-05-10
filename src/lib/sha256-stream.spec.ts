import { sha256Stream, sha256StreamFromIterable } from './sha256-stream';
import { createHash } from './sha256-uint8array';

/* eslint-disable no-bitwise */

// -- helpers -----------------------------------------------------------------

function hex(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) {
    const h = b[i].toString(16);
    s += h.length === 1 ? '0' + h : h;
  }
  return s;
}

function bytesEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Deterministic PRNG (xorshift32) so test failures are reproducible. */
function* xorshift32(seed: number): Generator<number> {
  let x = seed >>> 0;
  while (true) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    yield x & 0xff;
  }
}

function fillRandom(bytes: Uint8Array, seed: number): Uint8Array {
  const gen = xorshift32(seed);
  for (let i = 0; i < bytes.length; i++) bytes[i] = gen.next().value as number;
  return bytes;
}

/** Polyfill a Blob-like object whose `stream()` method emits the given
 *  bytes in chunks of `chunkSize`. Lets us drive sha256Stream() from
 *  test code without depending on the `Blob` constructor's stream
 *  semantics across environments. */
function makeChunkedBlob(bytes: Uint8Array, chunkSize: number): Blob {
  return {
    size: bytes.length,
    type: '',
    stream(): ReadableStream<Uint8Array> {
      let p = 0;
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          if (p >= bytes.length) { controller.close(); return; }
          const end = Math.min(p + chunkSize, bytes.length);
          controller.enqueue(bytes.slice(p, end));
          p = end;
        },
      });
    },
    // Required Blob methods we don't use; satisfy the type at runtime via casts.
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    text: async () => '',
    slice: () => new Blob([]),
  } as unknown as Blob;
}

// -- FIPS-180-4 known answer vectors ----------------------------------------
// Source: https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA256.pdf
// These are the canonical FIPS reference outputs every SHA-256 in the world
// is judged against. If any of these fails, the implementation is broken.

const FIPS_VECTORS: Array<{ name: string; input: Uint8Array; expected: string }> = [
  {
    name: 'empty input',
    input: new Uint8Array(0),
    expected: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  {
    name: '"abc" (FIPS Appendix B.1)',
    input: new TextEncoder().encode('abc'),
    expected: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  },
  {
    name: '"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq" (FIPS Appendix B.2)',
    input: new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    expected: '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  },
  {
    name: 'one million "a" (FIPS Appendix B.3)',
    input: (() => { const a = new Uint8Array(1_000_000); a.fill(0x61); return a; })(),
    expected: 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
  },
];

describe('sha256Stream — FIPS-180-4 known-answer vectors', () => {
  for (const v of FIPS_VECTORS) {
    it(`matches FIPS expected output for ${v.name}`, async () => {
      const blob = makeChunkedBlob(v.input, 4096);
      const out = await sha256Stream(blob);
      expect(hex(out)).toBe(v.expected);
    });
  }
});

// -- cross-validation against the existing one-shot Hash --------------------
// `sha256-uint8array.ts` already has a Node-style Hash class with a single
// update + digest call path that matches WebCrypto. We treat that as our
// known-good reference for one-shot inputs. The streaming code MUST agree
// with it for every input shape we throw at it.

describe('sha256Stream — cross-validation vs one-shot hash', () => {
  // Sizes deliberately chosen to exercise SHA-256's internal block boundaries
  // (64-byte blocks; 56-byte boundary triggers an extra padding block).
  const SIZES = [
    0, 1, 7, 31, 32, 33,
    55, 56, 57, 63, 64, 65,
    111, 112, 113, 127, 128, 129,
    1023, 1024, 1025,
    4095, 4096, 4097,
    65535, 65536, 65537,
    1048576,                          // 1 MiB
    1048576 * 4 + 17,                 // 4 MiB + odd tail
  ];

  for (const size of SIZES) {
    it(`size ${size} bytes — random data, single-chunk stream matches one-shot`, async () => {
      const data = fillRandom(new Uint8Array(size), 0xcafef00d ^ size);
      const oneshot = createHash('sha256').update(data).digest();
      const blob = makeChunkedBlob(data, Math.max(size, 1));   // single chunk
      const streamed = await sha256Stream(blob);
      expect(hex(streamed)).toBe(hex(oneshot));
    });
  }

  // Same data, but split into many chunks of varying sizes. The streamed
  // result must be byte-identical regardless of how the input is chunked.
  describe('chunking invariance', () => {
    const TARGET_SIZE = 100_003;     // prime-ish, won't align with any chunk size
    const data = fillRandom(new Uint8Array(TARGET_SIZE), 0xdeadbeef);
    const expected = hex(createHash('sha256').update(data).digest());

    const CHUNK_SIZES = [1, 7, 32, 63, 64, 65, 1024, 65536, TARGET_SIZE];

    for (const cs of CHUNK_SIZES) {
      it(`100 KB random, ${cs}-byte chunks → same digest as one-shot`, async () => {
        const blob = makeChunkedBlob(data, cs);
        const streamed = await sha256Stream(blob);
        expect(hex(streamed)).toBe(expected);
      });
    }
  });
});

// -- cross-validation against WebCrypto -------------------------------------
// `crypto.subtle.digest` is the runtime's reference implementation. If our
// streaming output ever drifts from it the receipts we generate become
// junk, so we re-verify on every test run.

describe('sha256Stream — agrees with crypto.subtle.digest (WebCrypto)', () => {
  // Skip cleanly if WebCrypto isn't present (e.g. very old Node without
  // the polyfill) -- our jest setup polyfills it, so this should never
  // skip in practice.
  const cryptoOk = typeof crypto !== 'undefined' && typeof crypto.subtle?.digest === 'function';
  const maybeIt = cryptoOk ? it : it.skip;

  const SIZES = [0, 1, 32, 64, 100, 1024, 64 * 1024, 1024 * 1024];

  for (const size of SIZES) {
    maybeIt(`${size} bytes random — streamed digest === WebCrypto digest`, async () => {
      const data = fillRandom(new Uint8Array(size), 0xa5a5a5 ^ size);
      const wc = new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));
      const streamed = await sha256Stream(makeChunkedBlob(data, 4096));
      expect(bytesEq(streamed, wc)).toBe(true);
    });
  }

  // Bonus: chunking should not affect the digest. Verify against WC for
  // a single representative size with weird chunk schedules.
  maybeIt('same digest as WebCrypto regardless of chunk size (50 KB)', async () => {
    const data = fillRandom(new Uint8Array(50_000), 0x12345678);
    const wc = new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));
    for (const cs of [1, 13, 64, 4096, 50_000]) {
      const streamed = await sha256Stream(makeChunkedBlob(data, cs));
      expect(bytesEq(streamed, wc)).toBe(true);
    }
  });
});

// -- iterable form -----------------------------------------------------------

describe('sha256StreamFromIterable', () => {
  it('matches one-shot for a pre-baked array of chunks', async () => {
    const a = new TextEncoder().encode('hello ');
    const b = new TextEncoder().encode('world');
    const expected = createHash('sha256').update(new Uint8Array([...a, ...b])).digest();
    const out = await sha256StreamFromIterable([a, b]);
    expect(hex(out)).toBe(hex(expected));
  });

  it('matches one-shot for an async iterator', async () => {
    const data = fillRandom(new Uint8Array(33_333), 0x99999999);
    const expected = hex(createHash('sha256').update(data).digest());
    async function* gen(): AsyncIterable<Uint8Array> {
      for (let p = 0; p < data.length; p += 911) yield data.slice(p, p + 911);
    }
    const out = await sha256StreamFromIterable(gen());
    expect(hex(out)).toBe(expected);
  });

  it('tolerates empty chunks interleaved with real ones', async () => {
    const a = new TextEncoder().encode('foo');
    const b = new TextEncoder().encode('bar');
    const empty = new Uint8Array(0);
    const expected = createHash('sha256').update(new Uint8Array([...a, ...b])).digest();
    const out = await sha256StreamFromIterable([empty, a, empty, empty, b, empty]);
    expect(hex(out)).toBe(hex(expected));
  });

  it('produces FIPS empty-string digest for an empty iterable', async () => {
    const out = await sha256StreamFromIterable([]);
    expect(hex(out)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
