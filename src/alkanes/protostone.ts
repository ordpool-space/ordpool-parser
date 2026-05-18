import { u128 } from '../rune/src/integer';
import { Runestone } from '../rune/src/runestone';
import { protocolFieldToBytes } from './alkanes-parser.service.helper';

// Tags used inside a Protostone payload. Distinct from the outer Runestone
// Tag enum -- these only have meaning between the (protocol_tag, length)
// marker and the next protostone. See alkanes-rs
// crates/ordinals/src/runestone/tag.rs (Burn / Message / Refund /
// ProtoPointer / From) and crates/protorune-support/src/protostone.rs
// for the wire format.
const TAG_BURN          = 83n;
const TAG_MESSAGE       = 81n;
const TAG_REFUND        = 93n;
const TAG_PROTO_POINTER = 91n;
const TAG_FROM          = 95n;
const TAG_BODY          = 0n;

const U32_MAX = 4294967295n;

/** Alkanes contract address. `block:tx` -- e.g. `2:0` is DIESEL. */
export interface AlkaneId {
  block: bigint;
  tx: bigint;
}

/**
 * Decoded contents of a Protostone's `message` field. The first two u128s
 * of the (re-decoded) message byte stream identify the target contract;
 * `inputs[0]` is the function selector by convention, the rest are
 * arguments. Argument semantics are contract-specific -- decoding them
 * requires the contract's WASM bytecode or an out-of-band ABI.
 */
export interface Cellpack {
  target: AlkaneId;
  inputs: bigint[];
}

/** Token transfer recorded as part of a Protostone. */
export interface ProtostoneEdict {
  id: AlkaneId;
  amount: bigint;
  output: bigint;
}

/**
 * One decoded Protostone -- a sub-protocol payload carried in a Runestone's
 * tag PROTOCOL (16383). The wire format mirrors alkanes-rs'
 * `crates/protorune-support/src/protostone.rs::Protostone`.
 */
export interface ParsedProtostone {
  protocolTag: bigint;
  message: Cellpack | null;
  edicts: ProtostoneEdict[];
  burn: bigint | null;
  pointer: number | null;
  refund: number | null;
  from: number | null;
}

/**
 * Decode every Protostone carried in a Runestone's protocol field.
 * Mirrors `Protostone::decipher` in alkanes-rs: the outer u128 list is
 * byte-packed (15 bytes per u128), then LEB128-decoded back to a flat
 * u128 stream, then walked as `(protocol_tag, length, ...length u128s)`
 * tuples until a protocol_tag of 0 terminates.
 */
export function decodeProtostones(protocol: bigint[]): ParsedProtostone[] {
  if (protocol.length === 0) {
    return [];
  }

  const bytes = protocolFieldToBytes(protocol);
  const decoded = Runestone.integers(bytes);
  if (decoded.isNone()) {
    return [];
  }

  const values = decoded.unwrap();
  const result: ParsedProtostone[] = [];

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
    const start = i + 2;
    const end = start + Number(length);

    if (end > values.length) {
      break;
    }

    const payload = values.slice(start, end);
    result.push(parsePayload(protocolTag, payload));
    i = end;
  }

  return result;
}

/**
 * Decode a single Protostone's payload u128s into structured fields. Same
 * tag-value pair grouping as the outer Runestone: pairs `(tag, value)` are
 * collected into a map until tag = 0 (BODY) is encountered, at which point
 * the remaining values are the body (edicts).
 */
function parsePayload(protocolTag: bigint, payload: u128[]): ParsedProtostone {
  const fields = new Map<bigint, u128[]>();
  let idx = 0;
  while (idx < payload.length) {
    const tag = payload[idx];
    if (tag === TAG_BODY) {
      const remaining = payload.slice(idx + 1);
      const existing = fields.get(TAG_BODY) ?? [];
      fields.set(TAG_BODY, existing.concat(remaining));
      break;
    }
    if (idx + 1 >= payload.length) {
      break;
    }
    const value = payload[idx + 1];
    const existing = fields.get(tag) ?? [];
    existing.push(value);
    fields.set(tag, existing);
    idx += 2;
  }

  const burn    = takeOne(fields, TAG_BURN);
  const pointer = takeU32(fields, TAG_PROTO_POINTER);
  const refund  = takeU32(fields, TAG_REFUND);
  const from    = takeU32(fields, TAG_FROM);
  const message = decodeCellpack(fields.get(TAG_MESSAGE) ?? []);
  const edicts  = decodeEdicts(fields.get(TAG_BODY) ?? []);

  return {
    protocolTag,
    message,
    edicts,
    burn:    burn    ?? null,
    pointer: pointer ?? null,
    refund:  refund  ?? null,
    from:    from    ?? null,
  };
}

function takeOne(fields: Map<bigint, u128[]>, tag: bigint): bigint | undefined {
  const arr = fields.get(tag);
  return arr && arr.length > 0 ? arr[0] : undefined;
}

function takeU32(fields: Map<bigint, u128[]>, tag: bigint): number | undefined {
  const v = takeOne(fields, tag);
  if (v === undefined || v > U32_MAX) {
    return undefined;
  }
  return Number(v);
}

/**
 * Decode the message field as a Cellpack. Message values are themselves
 * byte-packed: pack the u128 list back to bytes via the same 15-byte
 * packing the outer Protocol field uses, LEB-decode to a u128 stream, then
 * read the first two as target AlkaneId and the rest as inputs.
 *
 * Trailing zero inputs from the byte-packing padding are stripped --
 * they're noise, not arguments. The contract typically reads only as many
 * inputs as it expects.
 */
export function decodeCellpack(messageValues: bigint[]): Cellpack | null {
  if (messageValues.length === 0) {
    return null;
  }

  const bytes = protocolFieldToBytes(messageValues);
  const decoded = Runestone.integers(bytes);
  if (decoded.isNone()) {
    return null;
  }
  const stream = decoded.unwrap();
  if (stream.length < 2) {
    return null;
  }

  // Strip trailing zeros from inputs -- padding artifact of the u128
  // byte-packing. The target AlkaneId itself (first two u128s) is kept
  // verbatim; `{block: 0, tx: 0}` is the legitimate self-reference target
  // for some contract patterns, so we don't drop those zeros.
  let end = stream.length;
  while (end > 2 && stream[end - 1] === 0n) {
    end--;
  }

  return {
    target: { block: stream[0], tx: stream[1] },
    inputs: stream.slice(2, end),
  };
}

/**
 * Decode the body (tag 0) as a list of edicts. Same delta-encoding as
 * standard Rune edicts (alkanes-rs
 * `crates/protorune-support/src/protostone.rs::protostone_edicts_from_integers`).
 * Each edict is 4 u128s: block-delta, tx-delta-or-absolute, amount, output.
 */
function decodeEdicts(body: bigint[]): ProtostoneEdict[] {
  if (body.length === 0 || body.length % 4 !== 0) {
    return [];
  }

  const result: ProtostoneEdict[] = [];
  let lastBlock = 0n;
  let lastTx = 0n;

  for (let i = 0; i + 4 <= body.length; i += 4) {
    const blockDelta = body[i];
    const txField    = body[i + 1];
    const amount     = body[i + 2];
    const output     = body[i + 3];

    const block = lastBlock + blockDelta;
    const tx    = blockDelta === 0n ? lastTx + txField : txField;

    result.push({ id: { block, tx }, amount, output });
    lastBlock = block;
    lastTx = tx;
  }

  return result;
}
