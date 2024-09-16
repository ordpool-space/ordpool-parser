import { OrdpoolTransactionFlags } from './types/ordpool-transaction-flags';
import { TransactionSimple } from './types/transaction-simple';
import { AtomicalParserService } from './atomical/atomical-parser.service';
import { Cat21ParserService } from './cat21/cat21-parser.service';
import { InscriptionParserService } from './inscription/inscription-parser.service';
import { RuneParserService } from './rune/rune-parser.service';
import { Src20ParserService } from './src20/src20-parser.service';
import { DigitalArtifactAnalyserService } from './digital-artifact-analyser.service';
import { isFlagSet } from './digital-artifact-analyser.service.helper';


jest.mock('./atomical/atomical-parser.service');
jest.mock('./cat21/cat21-parser.service');
jest.mock('./inscription/inscription-parser.service');
jest.mock('./rune/rune-parser.service');
jest.mock('./src20/src20-parser.service');

describe('DigitalArtifactAnalyserService.quickAnalyseTransaction', () => {
  let tx: TransactionSimple;

  beforeEach(() => {
    tx = { txid: 'dummy_txid' } as TransactionSimple;
    jest.resetAllMocks();
  });

  it('should set ordpool_atomical flag when Atomical is present', () => {
    (AtomicalParserService.hasAtomical as jest.Mock).mockReturnValue(true);
    const flags = DigitalArtifactAnalyserService.quickAnalyseTransaction(tx, BigInt(0));
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_atomical)).toBe(true);
  });

  it('should set ordpool_cat21 flag when CAT-21 is present', () => {
    (Cat21ParserService.hasCat21 as jest.Mock).mockReturnValue(true);
    const flags = DigitalArtifactAnalyserService.quickAnalyseTransaction(tx, BigInt(0));
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_cat21)).toBe(true);
  });

  it('should set ordpool_inscription flag when Inscription is present', () => {
    (InscriptionParserService.hasInscription as jest.Mock).mockReturnValue(true);
    const flags = DigitalArtifactAnalyserService.quickAnalyseTransaction(tx, BigInt(0));
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_inscription)).toBe(true);
  });

  it('should set ordpool_rune flag when Rune is present', () => {
    (RuneParserService.hasRunestone as jest.Mock).mockReturnValue(true);
    const flags = DigitalArtifactAnalyserService.quickAnalyseTransaction(tx, BigInt(0));
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_rune)).toBe(true);
  });

  it('should set ordpool_src20 flag when SRC-20 is present', () => {
    (Src20ParserService.hasSrc20 as jest.Mock).mockReturnValue(true);
    const flags = DigitalArtifactAnalyserService.quickAnalyseTransaction(tx, BigInt(0));
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_src20)).toBe(true);
  });

  it('should set multiple flags when multiple artifacts are present', () => {

    (AtomicalParserService.hasAtomical as jest.Mock).mockReturnValue(true);
    (Cat21ParserService.hasCat21 as jest.Mock).mockReturnValue(true);
    (InscriptionParserService.hasInscription as jest.Mock).mockReturnValue(true);

    const flags = DigitalArtifactAnalyserService.quickAnalyseTransaction(tx, BigInt(0));

    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_atomical)).toBe(true);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_cat21)).toBe(true);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_inscription)).toBe(true);
  });

  it('should not set any flags if no artifacts are present', () => {

    (AtomicalParserService.hasAtomical as jest.Mock).mockReturnValue(false);
    (Cat21ParserService.hasCat21 as jest.Mock).mockReturnValue(false);
    (InscriptionParserService.hasInscription as jest.Mock).mockReturnValue(false);
    (RuneParserService.hasRunestone as jest.Mock).mockReturnValue(false);
    (Src20ParserService.hasSrc20 as jest.Mock).mockReturnValue(false);

    const flags = DigitalArtifactAnalyserService.quickAnalyseTransaction(tx, BigInt(0));
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_atomical)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_cat21)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_inscription)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_rune)).toBe(false);
    expect(isFlagSet(Number(flags), OrdpoolTransactionFlags.ordpool_src20)).toBe(false);
  });
});
