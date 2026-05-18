import { Runestone } from '../rune/src/runestone';
import { u128 } from '../rune/src/integer';

// Alkanes claims protocol_tag = 1 inside a Protostone (kungfuflex/alkanes-rs
// crates/protorune-support/src/protostone.rs and crates/alkanes/src/...).
// Other protorunes-based subprotocols can in principle claim other tag
// values, but in practice alkanes is the only one with mainnet activity.
export const ALKANES_PROTOCOL_TAG = 1n;

/**
 * Re-encodes one u128 as 15 little-endian bytes. The Protorunes wire format
 * packs an arbitrary byte stream into a u128[] by storing 15 bytes of
 * payload per u128 (the 16th byte is reserved -- the encoding guarantees
 * the terminal-byte bitfields aren't truncated). See
 * crates/protorune-support/src/protostone.rs::split_bytes / join_to_bytes.
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

/**
 * Reverse of split_bytes: rebuild the byte stream from the u128 list
 * stored under Runestone tag PROTOCOL (16383).
 */
export function protocolFieldToBytes(protocol: bigint[]): Uint8Array {
  const result = new Uint8Array(protocol.length * 15);
  for (let i = 0; i < protocol.length; i++) {
    result.set(snapTo15Bytes(protocol[i]), i * 15);
  }
  return result;
}

/**
 * Walks the decoded Protostone byte stream and returns the list of
 * protocol_tag values it contains. Each protostone is laid out as
 *   `[protocol_tag (u128), length (u128), ...length u128 payload values]`.
 * A protocol_tag of 0 terminates the list (trailing zero padding from the
 * outer split_bytes packing).
 *
 * This is structural-only -- we don't decode the payload of each protostone
 * (edicts, message bytes, refund pointer, etc.). All we need is "is there
 * at least one protostone with protocol_tag = 1?".
 */
export function protostoneProtocolTags(protocol: bigint[]): bigint[] {
  if (protocol.length === 0) {
    return [];
  }

  const bytes = protocolFieldToBytes(protocol);
  const decoded = Runestone.integers(bytes);
  if (decoded.isNone()) {
    return [];
  }

  const values: u128[] = decoded.unwrap();
  const tags: bigint[] = [];

  let i = 0;
  while (i < values.length) {
    const protocolTag = values[i];
    if (protocolTag === 0n) {
      break;
    }
    if (i + 1 >= values.length) {
      break;
    }
    const length = values[i + 1];
    tags.push(protocolTag);
    // Skip the payload. Use Number(length) is safe because realistic
    // lengths are well below 2^53; if the value is corrupt and too large,
    // we'd just walk past the end of the array, which is fine -- the
    // while loop terminates on the next iteration.
    i += 2 + Number(length);
  }

  return tags;
}

/**
 * True when the Runestone carries at least one protostone tagged with
 * protocol_tag = 1 (Alkanes).
 */
export function hasAlkanesProtostone(protocol: bigint[] | undefined): boolean {
  if (!protocol || protocol.length === 0) {
    return false;
  }
  return protostoneProtocolTags(protocol).includes(ALKANES_PROTOCOL_TAG);
}
