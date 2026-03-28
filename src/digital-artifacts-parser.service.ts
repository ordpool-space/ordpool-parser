import { AtomicalParserService } from './atomical/atomical-parser.service';
import { Cat21ParserService } from './cat21/cat21-parser.service';
import { CounterpartyParserService } from './counterparty/counterparty-parser.service';
import { InscriptionParserService } from './inscription/inscription-parser.service';
import { LabitbuParserService } from './labitbu/labitbu-parser.service';
import { RuneParserService } from './rune/rune-parser.service';
import { Src20ParserService } from './src20/src20-parser.service';
import { DigitalArtifact } from './types/digital-artifact';
import { OnParseError } from './types/parser-options';
import { TransactionSimple } from './types/transaction-simple';

/**
 * Unified service to parse all supported digital artifacts.
 */
export class DigitalArtifactsParserService {

  /**
   * Parses a transaction and extracts all supported digital artifacts.
   *
   * @param transaction - The transaction to parse.
   * @param onError - Optional callback for parser errors. By default, errors are silently suppressed.
   * @returns The parsed digital artifacts or an empty array
   */
  static parse(transaction: TransactionSimple, onError?: OnParseError): DigitalArtifact[] {

    const artifacts: DigitalArtifact[] = [];
    const parsedCat = Cat21ParserService.parse(transaction, onError);
    const parsedRune = RuneParserService.parse(transaction, onError);
    const parsedInscriptions = InscriptionParserService.parse(transaction, onError);
    const parsedAtomical = AtomicalParserService.parse(transaction, onError);
    const parsedLabitbu = LabitbuParserService.parse(transaction, onError);
    const parsedCounterparty = CounterpartyParserService.parse(transaction, onError);
    const parsedSrc20 = Src20ParserService.parse(transaction, onError);


    // cats are always first! 😺
    if (parsedCat) {
      artifacts.unshift(parsedCat);
    }

    if (parsedRune) {
      artifacts.push(parsedRune);
    }

    if (parsedInscriptions.length) {
      artifacts.push(...parsedInscriptions);
    }

    if (parsedAtomical) {
      artifacts.push(parsedAtomical);
    }

    if (parsedLabitbu) {
      artifacts.push(parsedLabitbu);
    }

    if (parsedCounterparty) {
      artifacts.push(parsedCounterparty);
    }

    if (parsedSrc20) {
      artifacts.push(parsedSrc20);
    }

    return artifacts;
  }
}
