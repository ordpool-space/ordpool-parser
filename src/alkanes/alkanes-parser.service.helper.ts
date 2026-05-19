import { Runestone } from '../rune/src/runestone';
import { u128 } from '../rune/src/integer';

// Alkanes is the only protorunes subprotocol with mainnet activity. Other
// protocol_tag values are reserved.
export const ALKANES_PROTOCOL_TAG = 1n;

/**
 * Reverse of split_bytes: 15 bytes per u128, low-byte first, 16th byte
 * dropped (reserved by the encoding).
 */
function snapTo15Bytes(value: bigint): Uint8Array {
  const out = new Uint8Array(15);
  let v = value;
  for (let i = 0; i < 15; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

export function protocolFieldToBytes(protocol: bigint[]): Uint8Array {
  const result = new Uint8Array(protocol.length * 15);
  for (let i = 0; i < protocol.length; i++) {
    result.set(snapTo15Bytes(protocol[i]), i * 15);
  }
  return result;
}

/**
 * Round-trip the byte-packing both the outer Protocol field and the inner
 * Message field use: 15-byte-per-u128 pack -> LEB128 decode.
 */
export function decodeProtostoneU128Stream(values: bigint[]): u128[] {
  if (values.length === 0) {
    return [];
  }
  const bytes = protocolFieldToBytes(values);
  const decoded = Runestone.integers(bytes);
  return decoded.isNone() ? [] : decoded.unwrap();
}

/**
 * Walk a decoded protostone stream as (tag, length, ...length payload).
 * Yields each protostone; tag = 0 terminates iteration.
 */
export function* walkProtostones(stream: u128[]): Generator<{ tag: bigint; payload: u128[] }> {
  let i = 0;
  while (i < stream.length) {
    const tag = stream[i];
    if (tag === 0n) {
      return;
    }
    if (i + 1 >= stream.length) {
      return;
    }
    const length = stream[i + 1];
    const start = i + 2;
    const end = start + Number(length);
    if (end > stream.length) {
      return;
    }
    yield { tag, payload: stream.slice(start, end) };
    i = end;
  }
}

export function protostoneProtocolTags(protocol: bigint[]): bigint[] {
  const tags: bigint[] = [];
  for (const { tag } of walkProtostones(decodeProtostoneU128Stream(protocol))) {
    tags.push(tag);
  }
  return tags;
}

/** True if the Runestone carries at least one protocol_tag = 1 Protostone. */
export function hasAlkanesProtostone(protocol: bigint[] | undefined): boolean {
  if (!protocol || protocol.length === 0) {
    return false;
  }
  for (const { tag } of walkProtostones(decodeProtostoneU128Stream(protocol))) {
    if (tag === ALKANES_PROTOCOL_TAG) {
      return true;
    }
  }
  return false;
}
