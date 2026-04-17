import { DigitalArtifact } from './digital-artifact';

/**
 * SRC-101: Bitcoin Name Service (Bitname) on Bitcoin Stamps.
 *
 * SRC-101 registers and manages domain names on Bitcoin L1.
 * Encoded via OLGA P2WSH (raw JSON in P2WSH outputs).
 *
 * First appeared at block 870,652.
 */
export interface ParsedSrc101 extends DigitalArtifact {

  /**
   * The raw JSON content string.
   */
  getContent: () => string;
}
