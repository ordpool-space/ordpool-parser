export interface ParsedCat {

  /**
   * The transactionId of the mint
   */
  catId: string;

  /**
   * Returns the cat image (base64 encoded)
   */
  getImage: () => string;
}
