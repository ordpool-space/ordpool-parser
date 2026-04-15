import { DigitalArtifact } from './digital-artifact';

/**
 * SRC-721: Composable layered NFTs on Bitcoin Stamps.
 *
 * SRC-721 stamps reference other stamps by ID to compose layered images.
 * The JSON payload specifies which stamps to layer and in what order.
 *
 * Example: {"p":"src-721","op":"mint","c":"A1473703777372088053","ts":[1,4,8,4,5,4,7,0,6,6]}
 *
 * Encoded via OLGA P2WSH (raw JSON in P2WSH outputs, no stamp: prefix).
 */
export interface ParsedSrc721 extends DigitalArtifact {

  /**
   * The raw JSON content string.
   */
  getContent: () => string;
}
