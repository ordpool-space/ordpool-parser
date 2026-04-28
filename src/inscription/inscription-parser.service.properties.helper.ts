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
type CborMap = Record<number | string, CborValue>;

function isCborMap(value: CborValue): value is CborMap {
  return !!value && typeof value === 'object' && !ArrayBuffer.isView(value) && !Array.isArray(value);
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

  // CBOR decode — properties use integer keys
  let decoded: CborValue;
  try {
    decoded = CBOR.decode(propertiesBytes);
  } catch {
    return undefined;
  }

  if (!isCborMap(decoded)) {
    return undefined;
  }

  // Parse gallery items (key 0)
  const rawGalleryUnknown = decoded[0];
  const rawGallery: CborValue[] = Array.isArray(rawGalleryUnknown) ? rawGalleryUnknown : [];
  const packedTxidsUnknown = decoded[2]; // key 2: concatenated 32-byte txids
  const packedTxids: Uint8Array | undefined = ArrayBuffer.isView(packedTxidsUnknown)
    ? new Uint8Array(packedTxidsUnknown.buffer, packedTxidsUnknown.byteOffset, packedTxidsUnknown.byteLength)
    : undefined;

  const gallery: GalleryItem[] = [];
  for (let i = 0; i < rawGallery.length; i++) {
    const rawItem = rawGallery[i];
    if (!isCborMap(rawItem)) {
      continue;
    }

    let inscriptionId: string | undefined;

    // Try inline ID first (key 0: 32-36 byte inscription ID)
    const inlineId = rawItem[0];
    if (ArrayBuffer.isView(inlineId) && inlineId.byteLength >= 32 && inlineId.byteLength <= 36) {
      inscriptionId = extractInscriptionId(new Uint8Array(inlineId.buffer, inlineId.byteOffset, inlineId.byteLength));
    }

    // Fall back to packed encoding (txid from Properties[2], index from Item[2])
    if (!inscriptionId && packedTxids) {
      const txidOffset = i * 32;
      if (txidOffset + 32 <= packedTxids.byteLength) {
        const txidBytes = new Uint8Array(packedTxids.buffer, packedTxids.byteOffset + txidOffset, 32);
        const txidHex = bytesToHex(new Uint8Array(txidBytes).reverse());
        const indexRaw = rawItem[2];
        const index = typeof indexRaw === 'number' ? indexRaw : 0;
        inscriptionId = txidHex + 'i' + index;
      }
    }

    if (!inscriptionId) {
      // Invalid item — ord clears the entire gallery if any item has no ID
      return { gallery: [], ...parseAttributes(decoded[1]) };
    }

    const itemAttrs = parseAttributes(rawItem[1]);
    gallery.push({
      inscriptionId,
      ...(itemAttrs.title !== undefined && { title: itemAttrs.title }),
      ...(itemAttrs.traits !== undefined && { traits: itemAttrs.traits }),
    });
  }

  const attrs = parseAttributes(decoded[1]);
  return {
    gallery,
    ...(attrs.title !== undefined && { title: attrs.title }),
    ...(attrs.traits !== undefined && { traits: attrs.traits }),
  };
}

/**
 * Parses an Attributes CBOR map (key 0 = title, key 1 = traits).
 * Accepts unknown to force the caller to pass arbitrary CBOR-decoded data,
 * narrowing happens inside.
 */
export function parseAttributes(raw: unknown): { title?: string; traits?: Record<string, boolean | number | string | null> } {
  if (!isCborMap(raw)) {
    return {};
  }

  const result: { title?: string; traits?: Record<string, boolean | number | string | null> } = {};

  if (typeof raw[0] === 'string') {
    result.title = raw[0];
  }

  const traitsRaw = raw[1];
  if (isCborMap(traitsRaw)) {
    const traits: Record<string, boolean | number | string | null> = {};
    for (const key of Object.keys(traitsRaw)) {
      const val = traitsRaw[key];
      if (val === null || typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') {
        traits[key] = val;
      }
    }
    result.traits = traits;
  }

  return result;
}
