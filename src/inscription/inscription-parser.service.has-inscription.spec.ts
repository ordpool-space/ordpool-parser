import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';


describe('Inscription parser', () => {

  it('should return false if there are no inputs', () => {
    const transaction = { vin: [] };
    expect(InscriptionParserService.hasInscription(transaction)).toBe(false);
  });

  it('should return false if no witness data contains the inscription mark', () => {
    const transaction = {
      vin: [
        { witness: ['0123', '4567'] },
        { witness: ['89ab', 'cdef'] }
      ]
    };
    expect(InscriptionParserService.hasInscription(transaction)).toBe(false);
  });

  it('should return true if any witness data contains the inscription mark', () => {
    const transaction = {
      vin: [
        { witness: ['0123', '0063036f7264abcdef'] },
        { witness: ['89ab', 'cdef'] }
      ]
    };
    expect(InscriptionParserService.hasInscription(transaction)).toBe(true);
  });

  // note from Johannes: I'm not sure if this is a realistic case.
  // witness: string[] could be potentially splitted at a super unlucky position?! --> that's why I always concatenate the data (which is inneficient, but save)
  // if someone is smarter than me, please tell me that I can change this! :-)
  it('should return true if the witness data is split at an unfortunate place', () => {
    const transaction = {
      vin: [
        // so the split here is directly at OP_PUSHBYTES_3 --- SPLIT --- ord
        { witness: ['01230063', '036f7264abcdef'] },
      ]
    };
    expect(InscriptionParserService.hasInscription(transaction)).toBe(true);
  });

  it('should return true when multiple inputs are present and only one contains the inscription mark', () => {
    const transaction = {
      vin: [
        { witness: ['nope'] },
        { witness: ['still nope'] },
        { witness: ['0063036f7264'] }  // The inscription mark is here
      ]
    };
    expect(InscriptionParserService.hasInscription(transaction)).toBe(true);
  });

  it('should handle cases with malformed or empty data gracefully', () => {
    const transaction = {
      vin: [
        {}, // No witness key
        { witness: [] }, // Empty array
        { witness: ['no inscription here'] }
      ]
    };
    expect(InscriptionParserService.hasInscription(transaction)).toBe(false);
  });

  it('should also detect an inscription with real test data', () => {
    const transaction = readTransaction('c1e013bdd1434450c6e1155417c81eb888e20cbde2e0cde37ec238d91cf37045');
    expect(InscriptionParserService.hasInscription(transaction)).toBe(true);
  });

});
