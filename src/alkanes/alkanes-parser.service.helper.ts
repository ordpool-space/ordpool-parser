import { Runestone } from '../rune/src/runestone';
import { u128 } from '../rune/src/integer';

// Alkanes claims protocol_tag = 1 inside a Protostone (kungfuflex/alkanes-rs
// crates/protorune-support/src/protostone.rs and crates/alkanes/src/...).
// Other protorunes-based subprotocols can in principle claim other tag
// values, but in practice alkanes is the only one with mainnet activity.
export const ALKANES_PROTOCOL_TAG = 1n;

// Standard opcode conventions from alkanes-runtime (kungfuflex/alkanes-rs).
// 99/100/101 are the Token trait getters that every fungible alkane exposes.
// 0/1/77/78 are the genesis-alkane template (DIESEL and derivatives).
// Real contracts may override these; treat as a default mapping, not a guarantee.
export const ALKANE_SELECTOR_INITIALIZE    = 0;
export const ALKANE_SELECTOR_UPGRADE       = 1;
export const ALKANE_SELECTOR_MINT          = 77;
export const ALKANE_SELECTOR_COLLECT_FEES  = 78;
export const ALKANE_SELECTOR_NAME          = 99;
export const ALKANE_SELECTOR_SYMBOL        = 100;
export const ALKANE_SELECTOR_TOTAL_SUPPLY  = 101;

export const ALKANE_SELECTOR_LABELS: Readonly<Record<string, string>> = Object.freeze({
  [ALKANE_SELECTOR_INITIALIZE]:   'initialize',
  [ALKANE_SELECTOR_UPGRADE]:      'upgrade',
  [ALKANE_SELECTOR_MINT]:         'mint',
  [ALKANE_SELECTOR_COLLECT_FEES]: 'collectFees',
  [ALKANE_SELECTOR_NAME]:         'name',
  [ALKANE_SELECTOR_SYMBOL]:       'symbol',
  [ALKANE_SELECTOR_TOTAL_SUPPLY]: 'totalSupply',
});

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
 * Walk a decoded protostone stream as `(protocol_tag, length, ...length payload)`
 * tuples. Yields each protostone; a `tag` of 0 (trailing zero padding from the
 * outer split_bytes packing) terminates iteration.
 *
 * This is structural-only -- we don't decode the inner payload (edicts,
 * message bytes, refund pointer, etc.). The payload slice is handed back
 * to callers that want to interpret it.
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

/**
 * List the protocol_tag of every Protostone carried in a Runestone's
 * protocol field. Used by `hasAlkanesProtostone` and by callers that need
 * a quick presence check without decoding the payloads.
 */
export function protostoneProtocolTags(protocol: bigint[]): bigint[] {
  const tags: bigint[] = [];
  for (const { tag } of walkProtostones(decodeProtostoneU128Stream(protocol))) {
    tags.push(tag);
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
  for (const { tag } of walkProtostones(decodeProtostoneU128Stream(protocol))) {
    if (tag === ALKANES_PROTOCOL_TAG) {
      return true;
    }
  }
  return false;
}
