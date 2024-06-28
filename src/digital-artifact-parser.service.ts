import { Cat21ParserService } from './cat21/cat21-parser.service';
import { InscriptionParserService } from './inscription/inscription-parser.service';
import { RuneParserService } from './rune/rune-parser.service';
import { Src20ParserService } from './src20/src20-parser.service';
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
  static parse(transaction: {
    txid: string,
    locktime: number,
    weight: number, // NEW: to calculate the fee rate
    fee: number,    // NEW: to calculate the fee rate
    vin: {
      txid: string,
      witness?: string[] }[],
    vout: {
      scriptpubkey: string,
      scriptpubkey_type: string
    }[],
    status: {
      block_hash?: string, // undefined, if unconfirmed txn!
    }
  }): DigitalArtifact[] {

    const artifacts: DigitalArtifact[] = [];
    const parsedSrc20 = Src20ParserService.parse(transaction);
    const parsedInscriptions = InscriptionParserService.parse(transaction);
    const parsedRune = RuneParserService.parse(transaction);
    const parsedCat = Cat21ParserService.parse(transaction);

    if (parsedSrc20) {
      artifacts.push(parsedSrc20);
    }

    if (parsedInscriptions.length) {
      artifacts.push(...parsedInscriptions);
    }

    if (parsedRune) {
      artifacts.push(parsedRune);
    }

    // cats are first! 😺
    if (parsedCat) {
      artifacts.unshift(parsedCat);
    }

    return artifacts;
  }
}
