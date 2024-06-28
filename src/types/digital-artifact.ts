export enum DigitalArtifactType {
  Inscription = 'Inscription',
  Src20 = 'Src20',
  Cat21 = 'Cat21',
  Runestone = 'Runestone',
  Atomical = 'Atomical'
}

/**
 * Shared interface for all supported assets
 */
export interface DigitalArtifact {

  /**
   * Type of the digital artifact, right now supported:
   * - Inscription
   * - SRC-20 (Stamps)
   * - CAT-21
   * - Runestone
   * - Atomical
   */
  type: DigitalArtifactType;

  /**
   * Unique ID, since a single transaction can have multiple types of digital artifacts
   */
  uniqueId: string;

  /**
   * The transactionId where the artifact was created / minted
   */
  transactionId: string;
}

