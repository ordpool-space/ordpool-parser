import { CatTraits } from "./lib/mooncat-parser";

export interface ParsedCat {

  /**
   * The transactionId of the mint
   */
  catId: string;

  /**
   * Returns the cat SVG image
   */
  getImage: () => string;

  /**
   * Returns the cat's traits
   */
  getTraits: () => CatTraits;
}

