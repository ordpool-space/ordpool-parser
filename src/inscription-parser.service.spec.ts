import { InscriptionParserService } from './inscription-parser.service';
import { readInscriptionAsBase64, readTransaction } from './test.helper';

describe('Inscription parser', () => {

  let parser: InscriptionParserService;

  beforeEach(() => {
    parser = new InscriptionParserService();
  });

  /*
   * ++ Simple envelope:
   * eg. c1e013bdd1434450c6e1155417c81eb888e20cbde2e0cde37ec238d91cf37045 --> some random "Hello, world!" inscription (text/plain;charset=utf-8)
   *
   * OP_FALSE
   * OP_IF
   *   OP_PUSH "ord"                      ---> OP_PUSHBYTES_3 "ord"
   *   OP_PUSH 1                          ---> OP_PUSHBYTES_1 1
   *   OP_PUSH "text/plain;charset=utf-8" ---> OP_PUSHBYTES_24 "text/plain;charset=utf-8"
   *   OP_0
   *   OP_PUSH "Hello, world!"            ---> OP_PUSHBYTES_13 "Hello, world!"
   * OP_ENDIF
   */
  it('should parse simple `Hello, world!` envelope', () => {

    const txn = readTransaction('c1e013bdd1434450c6e1155417c81eb888e20cbde2e0cde37ec238d91cf37045');

    const actualFileData = parser.parseInscription(txn)?.getData();
    const expectedFileData = readInscriptionAsBase64('c1e013bdd1434450c6e1155417c81eb888e20cbde2e0cde37ec238d91cf37045i0', 'txt');

    expect(actualFileData).toEqual(expectedFileData);

  });
});
