import { readTransaction } from '../../testdata/test.helper';
import { AtomicalParserService } from './atomical-parser.service';


describe('Atomical parser', () => {

  // more tests in the Inscription Parser!
  it('should return true if any witness data contains the atomical mark', () => {
    const transaction = {
      vin: [
        { witness: ['0123', '00630461746f6d'] },
        { witness: ['89ab', 'cdef'] }
      ]
    };
    expect(AtomicalParserService.hasAtomical(transaction)).toBe(true);
  });

  it('should also detect an atomical with real test data', () => {

    // so they are handling commmit and reveal txn differently!
    // Atomical 0 has
    // Atomic ID 56a8702bab3d2405eb9a356fd0725ca112a93a8efd1ecca06c6085e7278f0341i0 (commmit txn, first output)
    // Reveal TXID 1d2f39f54320631d0432fa495a45a4f298a2ca1b18adef8e4356e327d003a694 (reveal txn)

    const transaction = readTransaction('1d2f39f54320631d0432fa495a45a4f298a2ca1b18adef8e4356e327d003a694');
    expect(AtomicalParserService.hasAtomical(transaction)).toBe(true);
  });

});
