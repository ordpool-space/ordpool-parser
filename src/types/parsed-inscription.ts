import { DigitalArtifact } from "./digital-artifact";

export interface ParsedInscription extends DigitalArtifact {

  inscriptionId: string;

  contentType: string;

  fields: { tag: number; value: Uint8Array }[];

  /**
   * Data as UTF-8 encoded string (not intended for binary content like images or videos)
   */
  getContent: () => string;

  /**
   * The raw data (base64 encoded)
   */
  getData: () => string;

  /**
   * The raw Base64 encoded data as an URI that can be displayed in an iframe
   */
  getDataUri: () => string;

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
}
