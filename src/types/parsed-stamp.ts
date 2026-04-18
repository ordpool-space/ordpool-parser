import { DigitalArtifact } from './digital-artifact';

/**
 * A Stamp -- NFT image stored on Bitcoin L1.
 *
 * Stamps encode images (PNG, GIF, SVG, WebP, HTML) directly in Bitcoin
 * transaction outputs. Two encoding methods exist:
 *
 * 1. Pre-OLGA (block 779,652+): Counterparty issuance with STAMP:<base64> in the
 *    description field. Detected by the Counterparty parser as an issuance.
 *
 * 2. OLGA / P2WSH (block 833,000+): Raw file bytes split across P2WSH outputs.
 *    Each output's 32-byte "hash" is actually a data chunk. Concatenate all chunks,
 *    skip 2-byte big-endian length prefix, get the raw file.
 */
export interface ParsedStamp extends DigitalArtifact {

  /**
   * The detected MIME type (e.g., 'image/png', 'image/gif', 'image/svg+xml', 'text/html').
   */
  contentType: string;

  /**
   * The raw file bytes.
   */
  getDataRaw: () => Uint8Array;

  /**
   * The file as a UTF-8 string (useful for SVG and HTML).
   */
  getContent: () => string;

  /**
   * Base64-encoded data URI for embedding in HTML (e.g., data:image/png;base64,...).
   */
  getDataUri: () => string;
}
