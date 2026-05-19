import { u128 } from '../rune/src/integer';
import { decodeProtostoneU128Stream, walkProtostones } from './alkanes-parser.service.helper';

// Tags used inside a Protostone payload. See alkanes-rs
// crates/ordinals/src/runestone/tag.rs.
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
 * Decoded `message` field. `inputs[0]` is the function selector by
 * convention; the rest are arguments. Argument types are
 * contract-specific.
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

/** One decoded Protostone. Mirrors alkanes-rs `Protostone`. */
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
 * Decode every Protostone in a Runestone's protocol field. Mirrors
 * `Protostone::decipher` in alkanes-rs.
 */
export function decodeProtostones(protocol: bigint[]): ParsedProtostone[] {
  const result: ParsedProtostone[] = [];
  for (const { tag, payload } of walkProtostones(decodeProtostoneU128Stream(protocol))) {
    result.push(parsePayload(tag, payload));
  }
  return result;
}

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
 * Decode the message field as a Cellpack. Message values are byte-packed
 * the same way as the outer protocol field.
 */
export function decodeCellpack(messageValues: bigint[]): Cellpack | null {
  const stream = decodeProtostoneU128Stream(messageValues);
  if (stream.length < 2) {
    return null;
  }

  // Trailing zeros in `inputs` are padding from the 15-byte u128 packing,
  // not arguments. Target zeros are kept (0:0 is a legitimate self-ref).
  let end = stream.length;
  while (end > 2 && stream[end - 1] === 0n) {
    end--;
  }

  return {
    target: { block: stream[0], tx: stream[1] },
    inputs: stream.slice(2, end),
  };
}

/** Decode the body as edicts (same delta-encoding as standard Rune edicts). */
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
