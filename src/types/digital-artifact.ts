export enum DigitalArtifactType {
  Inscription = 'Inscription',
  Src20 = 'Src20',
  Cat21 = 'Cat21'
}

/**
 * Shared interface for all supported assets
 */
export interface DigitalArtifact {

  /**
   * A unique identifier for the type of the digital artifact, right now supported:
   * - Inscription
   * - SRC-20 (Stamps)
   * - CAT-21
   * - more to come?!
   */
  type: DigitalArtifactType;

  /**
   * The transactionId where the artifact was created / minted
   */
  transactionId: string;
}

