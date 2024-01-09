import { DigitalArtifact } from "./digital-artifact";

export interface ParsedSrc20 extends DigitalArtifact {

  /**
   * Returns decoded SRC-20 JSON data
   */
  getContent: () => string;
}

