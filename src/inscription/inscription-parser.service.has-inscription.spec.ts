import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';


describe('Inscription parser', () => {

  it('should return false if there are no inputs', () => {
    const transaction = { vin: [] };
    expect(InscriptionParserService.hasInscription(transaction)).toBe(false);
  });

  it('should return false if no witness data contains the inscription mark', () => {
    // a plain mainnet payment, two inputs, no inscription anywhere
    const transaction = readTransaction('054cc18a8162887917a1e6e5c60389bb4b6647167e6936d231466d7b2710f413');
    expect(InscriptionParserService.hasInscription(transaction)).toBe(false);
  });

  it('should return true if any witness data contains the inscription mark', () => {
    // mainnet inscription 117420871
    const transaction = readTransaction('37b10b5186bb9349e6beb036d608d93bedd342b31dab97cea9fc49ca3f7e3363');
    expect(InscriptionParserService.hasInscription(transaction)).toBe(true);
  });

  // Cross-boundary splits can't happen: each Bitcoin witness item is an atomic byte array.
  // The inscription envelope is always within a single element (the tapscript).

  it('should return true when multiple inputs are present and only one contains the inscription mark', () => {
    // mainnet: input 0 carries the envelope, input 1 is a key-path spend
    const transaction = readTransaction('37b10b5186bb9349e6beb036d608d93bedd342b31dab97cea9fc49ca3f7e3363');

    expect(transaction.vin.length).toBe(2);
    expect(transaction.vin[1].witness!.length).toBe(1);

    expect(InscriptionParserService.hasInscription(transaction)).toBe(true);
  });

  it('should handle inputs without witness data gracefully', () => {
    // vin entries without a witness key exist on every pre-segwit input
    const transaction = { vin: [{}, { witness: [] }] };
    expect(InscriptionParserService.hasInscription(transaction)).toBe(false);
  });

  it('should also detect an inscription with real test data', () => {
    const transaction = readTransaction('c1e013bdd1434450c6e1155417c81eb888e20cbde2e0cde37ec238d91cf37045');
    expect(InscriptionParserService.hasInscription(transaction)).toBe(true);
  });

});
