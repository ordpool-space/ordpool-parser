import { createHash } from './sha256-uint8array';

/**
 * Streaming SHA-256 over a Blob, File, or any ReadableStream of byte chunks.
 *
 * Why this exists: WebCrypto's `crypto.subtle.digest('SHA-256', buf)` is
 * one-shot only -- you have to materialise the entire input as an
 * ArrayBuffer before hashing, which spikes memory by file_size bytes and
 * blocks the JS thread for big files. This helper instead reads the Blob
 * via its native `stream()` method in chunks (typically 64 KB to a few MB
 * at a time), feeds each chunk into a streaming SHA-256 hasher, and never
 * holds more than one chunk in memory at once.
 *
 * Output is byte-identical to `crypto.subtle.digest('SHA-256', ...)` for
 * any input. This is enforced by the spec test suite alongside FIPS-180-4
 * known-answer vectors and randomized cross-checks at sizes 0 byte through
 * a few MB.
 *
 * Tested in Chrome, Firefox, Safari (browser test suite) and Node 24
 * (jsdom + native streams).
 *
 * @param input  A Blob, File, or anything that exposes a `stream()` method
 *               returning a ReadableStream<Uint8Array>.
 * @returns      32-byte SHA-256 digest as a fresh Uint8Array.
 *
 * @example
 *   const file = (event.target as HTMLInputElement).files![0];
 *   const digest = await sha256Stream(file);   // 32 bytes
 */
export async function sha256Stream(input: Blob): Promise<Uint8Array> {
  const hasher = createHash('sha256');
  const reader = input.stream().getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // value is a Uint8Array; empty chunks are legal (spec) -- skip them
      // so the underlying Hash doesn't allocate an empty internal buffer
      // copy unnecessarily.
      if (value && value.length > 0) hasher.update(value);
    }
  } finally {
    // Always release the reader so the source stream isn't leaked, even
    // on early return / throw.
    try { reader.releaseLock(); } catch { /* already released */ }
  }
  return hasher.digest();
}

/**
 * Same as `sha256Stream` but accepts any byte-emitting iterator. Useful
 * for non-Blob sources (Node fs streams via async iteration, custom
 * generators, etc.).
 *
 * @example
 *   async function* chunks(): AsyncIterable<Uint8Array> {
 *     yield new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]);  // "hello"
 *   }
 *   const digest = await sha256StreamFromIterable(chunks());
 */
export async function sha256StreamFromIterable(
  source: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
): Promise<Uint8Array> {
  const hasher = createHash('sha256');
  for await (const chunk of source) {
    if (chunk && chunk.length > 0) hasher.update(chunk);
  }
  return hasher.digest();
}
