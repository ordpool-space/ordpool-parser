import { DigitalArtifact } from "./digital-artifact";

/**
 * A single item in a gallery. References another inscription by ID,
 * with optional title and traits.
 */
export interface GalleryItem {
  inscriptionId: string;
  title?: string;
  traits?: Record<string, boolean | number | string | null>;
}

/**
 * Structured properties from an inscription's tag 17 field.
 * Contains gallery items (a curated list of inscription IDs) and
 * inscription-level attributes (title, traits).
 *
 * Galleries are permissionless — anyone can create a gallery referencing
 * any inscriptions. Inclusion in a gallery does not imply provenance.
 *
 * see https://docs.ordinals.com/inscriptions/properties.html
 */
export interface InscriptionProperties {
  gallery: GalleryItem[];
  title?: string;
  traits?: Record<string, boolean | number | string | null>;
}

export interface ParsedInscription extends DigitalArtifact {

  inscriptionId: string;

  /**
   * Delegates do not need a contentType, the parser will return undefined
   */
  contentType: string | undefined;

  fields: { tag: number; value: Uint8Array }[];

  /**
   * Data as UTF-8 encoded string (not intended for binary content like images or videos)
   * If the data was compressed (brotli or gzip), it is already decompressed here.
   */
  getContent: () => Promise<string>; // returns an empty string if no data is available

  /**
   * The data, base64 encoded
   * If the data was compressed (brotli or gzip), it is already decompressed here.
   */
  getData: () => Promise<string>;

  /**
   * The raw Base64 encoded data as an URI that can be displayed in an iframe
   * If the data was compressed (brotli or gzip), it is already decompressed here.
   */
  getDataUri: () => Promise<string>;

  /**
   * The raw data, no changes made
   * If the data was compressed (brotli or gzip), it is NOT decompressed here.
   */
  getDataRaw: () => Uint8Array;

  /**
   * Get Pointer, from tag 2
   * see pointer docs: https://docs.ordinals.com/inscriptions/pointer.html
   */
  getPointer: () => number | undefined;

  /**
   * Get Parent inscription(s), from tag 3
   * see provenance docs: https://docs.ordinals.com/inscriptions/provenance.html
   */
  getParents: () => string[];

  /**
   * Get Metadata, from tag 5
   * see metadata docs: https://docs.ordinals.com/inscriptions/metadata.html
   */
  getMetadata: () => string | undefined;

  /**
   * Get Metaprotocol, from tag 7
   */
  getMetaprotocol: () => string | undefined;

  /**
   * Get Content encoding, from tag 9
   */
  getContentEncoding: () => string | undefined;

  /**
   * Get Delegate inscription(s), from tag 11
   * see delegate docs: https://docs.ordinals.com/inscriptions/delegate.html
   */
  getDelegates: () => string[];

  /**
   * Get Properties, from tag 17 (with optional brotli decompression via tag 19)
   * Contains gallery items and structured attributes.
   * see https://docs.ordinals.com/inscriptions/properties.html
   */
  getProperties: () => InscriptionProperties | undefined;

  /**
   * The size in bytes of the envelope including the entire script
   */
  envelopeSize: number;

  /**
   * The size in bytes of the content (the body of the inscription).
   * For compressed content, the unpacked size is not taken into account,
   * only the size that was actually saved is considered.
   */
  contentSize: number;
}
