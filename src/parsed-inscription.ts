export interface ParsedInscription {
  contentType: string;

  fields: { tag: Uint8Array; value: Uint8Array }[];

  getContentString: () => string;

  /**
   * Only the content (base64 encoded)
   */
  getData: () => string;

  /**
   * Full data URI with contentType + content (base64 encoded)
   */
  getDataUri: () => string;
}
