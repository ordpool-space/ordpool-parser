import { InscriptionParserService } from './inscription-parser.service';
import { readTransaction } from './test.helper';

describe('Inscription parser', () => {

  /*
   * Multiple parents are not yet supported by ord
   * see: https://github.com/ordinals/ord/issues/2494
   */
  it('should parse inscriptions with multiple parents', () => {

    const txn = readTransaction('f988fe4b414a3f3d4a815dd1b1675dea0ba6140b1d698d8970273c781fb95746');

    const inscription = InscriptionParserService.parseInscriptions(txn)[0];
    const parents = inscription.getParents();

    // see https://twitter.com/devaloft/status/1740055605719736325
    // To show off the technology, I created the first and only, extremely limited run of 5 inscriptions, each with 11 parents:

    expect(parents.length).toBe(11);

    expect(parents[0]).toEqual('027360480f9532e84cff10d53f06663e5e24aab0817ba4f022dda288df74bf3ci0');
    expect(parents[1]).toEqual('73aa7ab6edaaf6113f1346c98566f945132cf40df4224c4d3f7568d4daf4d60ci0');
    expect(parents[2]).toEqual('1d326f968912f9b7bec37b4b59f2af893b1f2c2275dbae1a8da6863be7855c4ai0');
    expect(parents[3]).toEqual('55fc22bca4516ce05ee08267ac2eb01b0122065cb62d397eaf1a64918ec89299i0');
    expect(parents[4]).toEqual('fb391a1de8118a1e526e47d2ecfdbdbf584138549682512733515e90c558a3dci0');
    expect(parents[5]).toEqual('a35512e3a68e110c79e11232ed143847bdbf9a9adfa2f8231eaeedd26b217a29i0');
    expect(parents[6]).toEqual('21c1a90c2db1c4a1e1889894f08a47191065e1386855d06573cef4e473f368a7i0');
    expect(parents[7]).toEqual('350cfd0ce44a53950e65e579c88f4301787796fd8769e9f1970641247b67d172i0');
    expect(parents[8]).toEqual('40d274d52cb84511259a356a5a662aaf6ec0f90643c474cdc1d7f3411b891c11i0');
    expect(parents[9]).toEqual('6d7a504a947b8b07581c40f2968a990c5ce84200f53e5b4b0e34c9cfb0fa31afi0');
    expect(parents[10]).toEqual('090ca62cd75dbfd9ac26fb5c36792f7641d02edc10d6cc071592e14aae9fea41i0');
  });
});
