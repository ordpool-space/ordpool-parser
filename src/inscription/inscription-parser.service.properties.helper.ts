import { CBOR } from '../lib/cbor';
import { bytesToHex, bytesToUnicodeString, concatUint8Arrays } from '../lib/conversions';
import { GalleryItem, InscriptionProperties } from '../types/parsed-inscription';
import {
  extractInscriptionId,
  getDecodedContent,
  getKnownFieldValue,
  getKnownFieldValues,
  knownFields,
} from './inscription-parser.service.helper';

/**
 * CBOR-decoded values are recursive and arbitrary by spec. We use `unknown`
 * (not `any`) so callers must narrow before reading. The CBOR decoder returns
 * either primitives, arrays, Uint8Array, or objects with integer-or-string keys.
 */
type CborValue = unknown;
type CborMap = Map<unknown, CborValue>;

function isCborMap(value: CborValue): value is CborMap {
  return value instanceof Map;
}

/**
 * Raised for anything minicbor would reject while decoding `Properties`.
 *
 * ord decodes the whole structure with `minicbor::decode::<Properties>(cbor)`
 * and then `.unwrap_or_default()` (`properties.rs`, `Properties::from_cbor`),
 * so a fault ANYWHERE -- a key of the wrong type, a field of the wrong type,
 * a duplicate trait name -- discards the entire Properties, gallery included.
 * It never keeps the parts that happened to decode.
 */
class PropertiesDecodeError extends Error {}

/**
 * `Properties`, `Item` and `Attributes` are minicbor-derive `#[cbor(map)]`
 * structs. The generated decoder reads every key with `i64()?` and skips
 * unknown indices (minicbor-derive-0.19.3, `src/decode.rs`, `Encoding::Map`),
 * so a non-integer key is a decode error rather than an unknown field.
 *
 * Real mainnet case: 57f869cc..b8e4 carries `{0: [gallery], "version": "Gen1"}`
 * and that one text key makes ord drop the gallery.
 */
function assertIntegerKeys(map: CborMap): void {
  for (const key of map.keys()) {
    if (typeof key !== 'number' && typeof key !== 'bigint') {
      throw new PropertiesDecodeError();
    }
  }
}

/** ord: `Traits`, a hand-written Decode over a definite map of String -> Trait. */
function decodeTraits(raw: CborValue): Array<[string, boolean | number | bigint | string | null]> {
  if (!isCborMap(raw)) {
    throw new PropertiesDecodeError();
  }
  const traits: Array<[string, boolean | number | bigint | string | null]> = [];
  const seen = new Set<string>();
  for (const [key, value] of raw) {
    // ord decodes the name as String, and rejects a repeated one (DuplicateTrait)
    if (typeof key !== 'string' || seen.has(key)) {
      throw new PropertiesDecodeError();
    }
    seen.add(key);
    // ord's `Trait` accepts Bool, Int (i64), Null and String, nothing else.
    // A CBOR float reaches us as a JS number and is indistinguishable from an
    // integer once decoded, so a whole-numbered float is accepted here where
    // ord rejects it. No mainnet case is known; a fractional one is caught.
    const isInt = typeof value === 'bigint' || (typeof value === 'number' && Number.isInteger(value));
    if (!(value === null || typeof value === 'boolean' || typeof value === 'string' || isInt)) {
      throw new PropertiesDecodeError();
    }
    traits.push([key, value]);
  }
  return traits;
}

/** ord: `Attributes { 0: Option<String> title, 1: Traits }`. */
function decodeAttributes(raw: CborValue): { title?: string; traits?: Array<[string, boolean | number | bigint | string | null]> } {
  if (!isCborMap(raw)) {
    throw new PropertiesDecodeError();
  }
  assertIntegerKeys(raw);

  const result: { title?: string; traits?: Array<[string, boolean | number | bigint | string | null]> } = {};

  const title = raw.get(0);
  if (title !== undefined && title !== null) {
    if (typeof title !== 'string') {
      throw new PropertiesDecodeError();
    }
    result.title = title;
  }

  const traitsRaw = raw.get(1);
  if (traitsRaw !== undefined) {
    result.traits = decodeTraits(traitsRaw);
  }

  return result;
}

/**
 * Parses the CBOR properties from tag 17 fields.
 * Handles both inline and packed inscription ID encodings,
 * and decompression via brotli or gzip (tag 19).
 *
 * Mirrors Properties::from_cbor() in ord's Rust implementation.
 * see https://docs.ordinals.com/inscriptions/properties.html
 */
export async function parseProperties(fields: { tag: number; value: Uint8Array }[]): Promise<InscriptionProperties | undefined> {
  // Collect and concatenate tag 17 chunks (same as metadata)
  const chunks = getKnownFieldValues(fields, knownFields.properties);
  if (chunks.length === 0) {
    return undefined;
  }

  let propertiesBytes = concatUint8Arrays(chunks);

  // Decompress if tag 19 specifies an encoding (same as inscription content)
  const encodingRaw = getKnownFieldValue(fields, knownFields.property_encoding);
  if (encodingRaw) {
    const encoding = bytesToUnicodeString(encodingRaw);
    // NOTE: ord only supports brotli ("br") for properties. We additionally
    // support gzip for robustness — same as we do for inscription content bodies.
    propertiesBytes = await getDecodedContent(encoding, propertiesBytes);
  }

  if (propertiesBytes.length === 0) {
    return undefined;
  }

  // CBOR decode with mapsAsMaps so maps keep their entry order. ord renders
  // traits (an ordered Vec<(String, Trait)>) in the creator's order; a plain
  // object would reorder integer-like trait names ("10" before "zeta") and lose
  // that order, so we decode into Maps and read them in order.
  let decoded: CborValue;
  try {
    // decodeFirstFlag: ord decodes properties with minicbor
    // (`Properties::from_cbor`), which reads ONE item and does not object to
    // trailing bytes, exactly like ciborium does for metadata.
    decoded = CBOR.decode(propertiesBytes, undefined, undefined, true, true);
  } catch {
    return undefined;
  }

  try {
    return decodeProperties(decoded);
  } catch {
    // minicbor would have failed; ord's unwrap_or_default() shows nothing
    return undefined;
  }
}

/**
 * ord: `Properties { 0: Vec<Item> gallery, 1: Attributes, 2: Vec<u8> txids }`,
 * then the packed-txid zip in `Properties::from_cbor`.
 *
 * Throws PropertiesDecodeError wherever minicbor would error, so a single bad
 * field discards everything rather than leaving a partial gallery.
 */
function decodeProperties(decoded: CborValue): InscriptionProperties {
  if (!isCborMap(decoded)) {
    throw new PropertiesDecodeError();
  }
  assertIntegerKeys(decoded);

  const rawGalleryUnknown = decoded.get(0);
  if (rawGalleryUnknown !== undefined && !Array.isArray(rawGalleryUnknown)) {
    throw new PropertiesDecodeError();
  }
  const rawGallery: CborValue[] = Array.isArray(rawGalleryUnknown) ? rawGalleryUnknown : [];

  // key 2: concatenated 32-byte txids, the packed form
  const packedTxidsUnknown = decoded.get(2);
  if (packedTxidsUnknown !== undefined && !ArrayBuffer.isView(packedTxidsUnknown)) {
    throw new PropertiesDecodeError();
  }
  const packedTxids: Uint8Array | undefined = ArrayBuffer.isView(packedTxidsUnknown)
    ? new Uint8Array(packedTxidsUnknown.buffer, packedTxidsUnknown.byteOffset, packedTxidsUnknown.byteLength)
    : undefined;

  const attrs = decoded.get(1) === undefined ? {} : decodeAttributes(decoded.get(1));

  const gallery: GalleryItem[] = [];
  let anyItemWithoutId = false;

  for (let i = 0; i < rawGallery.length; i++) {
    const rawItem = rawGallery[i];
    if (!isCborMap(rawItem)) {
      throw new PropertiesDecodeError();
    }
    assertIntegerKeys(rawItem);

    let inscriptionId: string | undefined;

    // Inline id (key 0). ord decodes it as InscriptionId, so bytes that are not
    // a canonical id are a decode error, not a missing id.
    const inlineId = rawItem.get(0);
    if (inlineId !== undefined && inlineId !== null) {
      if (!ArrayBuffer.isView(inlineId)) {
        throw new PropertiesDecodeError();
      }
      const id = extractInscriptionId(new Uint8Array(inlineId.buffer, inlineId.byteOffset, inlineId.byteLength));
      if (id === null) {
        throw new PropertiesDecodeError();
      }
      inscriptionId = id;
    }

    const indexRaw = rawItem.get(2);
    if (indexRaw !== undefined && (typeof indexRaw !== 'number' || !Number.isInteger(indexRaw) || indexRaw < 0)) {
      throw new PropertiesDecodeError();
    }

    // Packed form: the txid comes from Properties[2] at this item's position,
    // the index from Item[2]. ord OVERWRITES the id here when a chunk exists.
    if (packedTxids) {
      const txidOffset = i * 32;
      if (txidOffset + 32 <= packedTxids.byteLength) {
        const txidBytes = new Uint8Array(packedTxids.buffer, packedTxids.byteOffset + txidOffset, 32);
        const txidHex = bytesToHex(new Uint8Array(txidBytes).reverse());
        inscriptionId = txidHex + 'i' + (typeof indexRaw === 'number' ? indexRaw : 0);
      }
    }

    const itemAttrs = rawItem.get(1) === undefined ? {} : decodeAttributes(rawItem.get(1));

    if (!inscriptionId) {
      anyItemWithoutId = true;
      continue;
    }

    gallery.push({
      inscriptionId,
      ...(itemAttrs.title !== undefined && { title: itemAttrs.title }),
      ...(itemAttrs.traits !== undefined && { traits: itemAttrs.traits }),
    });
  }

  return {
    // ord: an item that ends up without an id clears the whole gallery, but
    // keeps the attributes. That one is a fallback, not a decode error.
    gallery: anyItemWithoutId ? [] : gallery,
    ...(attrs.title !== undefined && { title: attrs.title }),
    ...(attrs.traits !== undefined && { traits: attrs.traits }),
  };
}
