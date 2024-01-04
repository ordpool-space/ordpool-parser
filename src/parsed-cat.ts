export interface ParsedCat {

  /**
   * The transactionId of the mint
   */
  catId: string;

  /**
   * Returns the cat SVG image
   */
  getImage: () => string;
}
