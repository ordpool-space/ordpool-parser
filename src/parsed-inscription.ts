export interface ParsedInscription {

  inscriptionId: string;

  contentType: string;

  fields: { tag: Uint8Array; value: Uint8Array }[];

  /**
   * UTF-8 encoded string (not intended for binary content like images or videos)
   */
  getContentString: () => string;

  /**
   * Only the content (base64 encoded)
   */
  getData: () => string;

  /**
   * Base64 encoded data URI that can be displayed in an iframe
   */
  getDataUri: () => string;

  /**
   * Get Pointer, from tag 2
   * see pointer docs: https://docs.ordinals.com/inscriptions/pointer.html
   *
   * TODO: The pointer is not displayed anywhere on ordinals.com,
   * so I have no indication of whether these numbers are really correct
   */
  getPointer: () => number | undefined;

  /**
   * Get Parent inscription, from tag 3
   * see provenance docs: https://docs.ordinals.com/inscriptions/provenance.html
   * OWNERSHIP OF THE PARENT IS NOT VALIDATED!
   */
  getParent: () => string | undefined;

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
}
