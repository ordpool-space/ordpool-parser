export interface ParsedInscription {
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
   * Get Metadata, from tag 5
   * see metadata: https://docs.ordinals.com/inscriptions/metadata.html
   */
  getMetadata: () => string | undefined;

  /**
   * Get Metaprotocol, from tag 7
   */
  getMetaprotocol: () => string | undefined;
}
