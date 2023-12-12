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
  it('should parse a simple `Hello, world!` envelope', () => {

    const txn = readTransaction('c1e013bdd1434450c6e1155417c81eb888e20cbde2e0cde37ec238d91cf37045');

    const actualFileData = parser.parseInscription(txn)?.getData();
    const expectedFileData = readInscriptionAsBase64('c1e013bdd1434450c6e1155417c81eb888e20cbde2e0cde37ec238d91cf37045i0', 'txt');

    expect(actualFileData).toEqual(expectedFileData);
  });

  /*
   * ++ Larger envelope:
   * eg. 78fa9d6e9b2b49fbb9f4838e1792dba7c1ec836f22e3206561e2d52759708251 --> my html inscription (text/html)
   *
   * OP_FALSE
   * OP_IF
   *   OP_PUSH "ord"                      ---> OP_PUSHBYTES_3 "ord"
   *   OP_PUSH 1                          ---> OP_PUSHBYTES_1 1
   *   OP_PUSH "text/html"                ---> OP_PUSHBYTES_9 746578742f68746d6c (text/html)
   *   OP_0
   *   OP_PUSH "<html>long text..."       ---> OP_PUSHDATA2, <2 Bytes Lenght>, data
   *   OP_PUSH "...long text</html>"      ---> OP_PUSHDATA1, <1 Byte Lenght>, data
   * OP_ENDIF
   */
  it('should parse a larger envelope (an Ordinal Cube, of course!)', () => {

    const txn = readTransaction('78fa9d6e9b2b49fbb9f4838e1792dba7c1ec836f22e3206561e2d52759708251');

    const actualFileData = parser.parseInscription(txn)?.getData();
    const expectedFileData = readInscriptionAsBase64('78fa9d6e9b2b49fbb9f4838e1792dba7c1ec836f22e3206561e2d52759708251i0', 'html');

    expect(actualFileData).toEqual(expectedFileData);
  });

  /*
   * ++ Envelope with Quadkey:
   * eg. f531eea03671ac17100a9887d5212532250d5eae09e7c8873cdd2efa6f7fab57 --> some random Quadkey
   *
   * OP_FALSE
   * OP_IF
   *   OP_PUSH "ord"                      ---> OP_PUSHBYTES_3 "ord"
   *   OP_PUSH 1                          ---> OP_PUSHBYTES_1 1
   *   OP_PUSH "text/html"                ---> OP_PUSHBYTES_9 746578742f68746d6c (text/html)
   *   OP_PUSH "qey"                      ---> OP_PUSHBYTES_3 716579 (qey)
   *   OP PUSH "???"                      ---> OP_PUSHBYTES_4 0e8124c1 (???)
   *   OP_0
   *   OP_PUSH "<html>long text..."       ---> OP_PUSHDATA1 <1 Byte Lenght> (<html><body><embed width='100%' height='100%' src='/content/493e940d306f3cdabb7bf82513dd502128fa7c27ce603615bd85e209a8d7e1c9?qkey=032200102103001' /></body></html>)
   * OP_ENDIF
   */
  it('should parse a envelope with unknown fields (envelope with Quadkey)', () => {

    const txn = readTransaction('f531eea03671ac17100a9887d5212532250d5eae09e7c8873cdd2efa6f7fab57');

    const actualFileData = parser.parseInscription(txn)?.getData();
    const expectedFileData = readInscriptionAsBase64('f531eea03671ac17100a9887d5212532250d5eae09e7c8873cdd2efa6f7fab57i0', 'html');

    expect(actualFileData).toEqual(expectedFileData);
  });
});
