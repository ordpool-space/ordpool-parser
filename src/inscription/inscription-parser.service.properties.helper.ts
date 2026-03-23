import { CBOR } from '../lib/cbor';
import { bytesToHex, bytesToUnicodeString } from '../lib/conversions';
import { GalleryItem, InscriptionProperties } from '../types/parsed-inscription';
import {
  brotliDecodeUint8Array,
  extractInscriptionId,
  getDecodedContent,
  getKnownFieldValue,
  getKnownFieldValues,
  knownFields,
} from './inscription-parser.service.helper';

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

  let propertiesBytes: Uint8Array;
  if (chunks.length === 1) {
    propertiesBytes = chunks[0];
  } else {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    propertiesBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      propertiesBytes.set(chunk, offset);
      offset += chunk.length;
    }
  }

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
  let decoded: any;
  try {
    decoded = CBOR.decode(propertiesBytes);
  } catch {
    return undefined;
  }

  if (!decoded || typeof decoded !== 'object') {
    return undefined;
  }

  // Parse gallery items (key 0)
  const rawGallery: any[] = decoded[0] || [];
  const packedTxids: Uint8Array | undefined = decoded[2]; // key 2: concatenated 32-byte txids

  const gallery: GalleryItem[] = [];
  for (let i = 0; i < rawGallery.length; i++) {
    const rawItem = rawGallery[i];
    if (!rawItem || typeof rawItem !== 'object') {
      continue;
    }

    let inscriptionId: string | undefined;

    // Try inline ID first (key 0: 32-36 byte inscription ID)
    const inlineId: Uint8Array | undefined = rawItem[0];
    if (ArrayBuffer.isView(inlineId) && inlineId.byteLength >= 32 && inlineId.byteLength <= 36) {
      inscriptionId = extractInscriptionId(new Uint8Array(inlineId.buffer, inlineId.byteOffset, inlineId.byteLength));
    }

    // Fall back to packed encoding (txid from Properties[2], index from Item[2])
    if (!inscriptionId && ArrayBuffer.isView(packedTxids)) {
      const txidOffset = i * 32;
      if (txidOffset + 32 <= packedTxids.byteLength) {
        const txidBytes = new Uint8Array(packedTxids.buffer, packedTxids.byteOffset + txidOffset, 32);
        const txidHex = bytesToHex(new Uint8Array(txidBytes).reverse());
        const index = rawItem[2] ?? 0;
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
 */
export function parseAttributes(raw: any): { title?: string; traits?: Record<string, boolean | number | string | null> } {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const result: { title?: string; traits?: Record<string, boolean | number | string | null> } = {};

  if (typeof raw[0] === 'string') {
    result.title = raw[0];
  }

  if (raw[1] && typeof raw[1] === 'object' && !ArrayBuffer.isView(raw[1])) {
    const traits: Record<string, boolean | number | string | null> = {};
    for (const key of Object.keys(raw[1])) {
      const val = raw[1][key];
      if (val === null || typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') {
        traits[key] = val;
      }
    }
    result.traits = traits;
  }

  return result;
}
