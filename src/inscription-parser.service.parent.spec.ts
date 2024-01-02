import { InscriptionParserService } from './inscription-parser.service';
import { readTransaction } from './test.helper';

describe('Inscription parser', () => {

  /*
   * Multiple parents are not yet supported by ord
   * see: https://github.com/ordinals/ord/issues/2494
   */
  it('should parse inscriptions with multiple parents', () => {

    const txn = readTransaction('f988fe4b414a3f3d4a815dd1b1675dea0ba6140b1d698d8970273c781fb95746');

    const inscriptions = InscriptionParserService.parseInscriptions(txn);

    expect(inscriptions[0].getParents()[0]).toEqual('027360480f9532e84cff10d53f06663e5e24aab0817ba4f022dda288df74bf3ci0');
  });
});
