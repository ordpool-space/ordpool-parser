import { Cat21ParserService } from './cat21-parser.service';
import { InscriptionParserService } from './inscription-parser.service';
import { Src20ParserService } from './src20-parser.service';
import { DigitalArtifact } from './types/digital-artifact';

/**
 * Unified service to parse all supported digital artifacts.
 */
export class DigitalArtifactsParserService {

  /**
   * Parses a transaction and extracts all supported digital artifacts.
   *
   * @param transaction - The transaction to parse.
   * @returns The parsed digital artifacts or an empty array
   */
  static parseDigitalArtifacts(transaction: {
    txid: string,
    locktime: number,
    vin: {
      txid: string,
      witness?: string[] }[],
    vout: {
      scriptpubkey: string,
      scriptpubkey_type: string
    }[];
  }): DigitalArtifact[] {

    const artifacts: DigitalArtifact[] = InscriptionParserService.parseInscriptions(transaction);
    const parsedSrc20 = Src20ParserService.parseSrc20Transaction(transaction);
    const parsedCat = Cat21ParserService.parseCat(transaction);

    if (parsedSrc20) {
      artifacts.push(parsedSrc20);
    }

    if (parsedCat) {
      artifacts.push(parsedCat);
    }

    return artifacts;
  }
}
