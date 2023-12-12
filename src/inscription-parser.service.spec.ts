import { helloWorld } from ".";

describe('Inscription parser', () => {
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
  it('should parse simple `Hello, world!` envelopes', () => {
    expect(helloWorld).toBe('Hello World');
  });
});
