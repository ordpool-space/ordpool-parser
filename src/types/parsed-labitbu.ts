import { DigitalArtifact } from "./digital-artifact";

/**
 * A Labitbu digital artifact — a WebP image stored in a Taproot witness control block.
 *
 * The Labitbu project (https://github.com/labitbu/pathologies) stores 4096-byte WebP
 * images inside Taproot control blocks, using a NUMS key (Nothing-Up-My-Sleeve,
 * SHA-256 of "Labitbu") as the internal public key. This makes the key path
 * provably unspendable — the UTXO can only be spent via the script path, which
 * reveals the control block containing the embedded image.
 *
 * 10,000 Labitbu NFTs were minted across blocks 908,072–908,196.
 * Traits (body type, accessories) are derived from image analysis, not stored on-chain.
 *
 * This approach inspired the CAT-21 fake inscription technique.
 */
export interface ParsedLabitbu extends DigitalArtifact {

  contentType: 'image/webp';

  /**
   * The raw 4096-byte WebP image extracted from the control block.
   */
  getDataRaw: () => Uint8Array;

  /**
   * The image data as a UTF-8 encoded string.
   * (Not useful for binary WebP — use getData() or getDataUri() instead.)
   */
  getContent: () => string;

  /**
   * The image data, base64 encoded.
   */
  getData: () => string;

  /**
   * Base64 data URI that can be displayed in an img tag or iframe.
   * Example: 'data:image/webp;base64,...'
   */
  getDataUri: () => string;
}
