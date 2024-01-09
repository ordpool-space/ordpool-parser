import { CatTraits } from "../lib/mooncat-parser";
import { DigitalArtifact } from "./digital-artifact";

export interface ParsedCat21 extends DigitalArtifact {

  /**
   * Returns the cat SVG image
   */
  getImage: () => string;

  /**
   * Returns the cat's traits
   */
  getTraits: () => CatTraits;
}

