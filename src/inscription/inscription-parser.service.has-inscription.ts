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

});
