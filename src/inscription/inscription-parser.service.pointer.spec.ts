import { InscriptionParserService } from './inscription-parser.service';
import { readBinaryInscriptionAsBase64, readInscriptionAsBase64, readTransaction } from '../../testdata/test.helper';

describe('Inscription parser', () => {

  /*
   * This makes 2000 identical recursive html inscriptions in a single transaction.
   *
   * If I understand the "pointer" spec properly, these will be assigned to sequential sats in the second output.
   * see https://twitter.com/mononautical/status/1743413793915384205
   */
  it('should parse the cursed inscription -468,454 and following', () => {

    const txn = readTransaction('2740d27e3017da44ee439792f6f60449e43992fddffd9387685b14d21b725ff0');

    const inscriptions = InscriptionParserService.parse(txn);
    expect(inscriptions.length).toBe(2000);

    const satsOutput1 = txn.vout[0].value; // 2121
    const satsOutput2 = txn.vout[1].value; // 23691
    let countingSat = inscriptions[0].getPointer() || 0; // 10121 -- so it's somewhere in the middle?

    for (var i = 0; i < inscriptions.length; i++) {

      const pointer = inscriptions[i].getPointer();

      // this verifies that all sats are sequential and that all of them are in output 2, as mentioned in the tweet
      expect(countingSat).toBe(pointer);
      expect(countingSat).toBeGreaterThan(satsOutput1);
      expect(countingSat).toBeLessThan(satsOutput1 + satsOutput2);

      countingSat++;
    }
  });

  /**
   * The parser throwed an exception for an inscription that has tag 2, followed by OP_0 as a value
   * see issue #18
   *
   * https://ordpool.space/tx/1b37f19c0a50b7e90fba7b317a30b56ef8d3494684d7530eb6efec567ebdb32f
   * https://ordinals.com/inscription/1b37f19c0a50b7e90fba7b317a30b56ef8d3494684d7530eb6efec567ebdb32fi0
   */
  it('should parse inscription 70,279,625', () => {

    const txn = readTransaction('1b37f19c0a50b7e90fba7b317a30b56ef8d3494684d7530eb6efec567ebdb32f');

    const inscription = InscriptionParserService.parse(txn)[0];

    // the emtpy push is interpreted as 0, because littleEndianBytesToNumber always starts with 0
    expect(inscription.getPointer()).toBe(0);
  });

  /*
   * The parser throwed an exception for an inscription that has tag 2, followed by OP_0 as a value
   * see issue #18
   *
   * https://ordpool.space/tx/7923e59abd8f8ab40dcc7915ae864d8b7ad6776811ba4d478f42248a7827a7f3
   * https://ordinals.com/inscription/7923e59abd8f8ab40dcc7915ae864d8b7ad6776811ba4d478f42248a7827a7f3i0
   */
  it('should parse inscription 70,279,628', () => {

    const txn = readTransaction('7923e59abd8f8ab40dcc7915ae864d8b7ad6776811ba4d478f42248a7827a7f3');

    const inscription = InscriptionParserService.parse(txn)[0];
    const actualFileData = inscription.getData();
    const expectedFileData = readBinaryInscriptionAsBase64('7923e59abd8f8ab40dcc7915ae864d8b7ad6776811ba4d478f42248a7827a7f3i0', 'jpeg');

    expect(actualFileData).toEqual(expectedFileData);

    // the emtpy push is interpreted as 0, because littleEndianBytesToNumber always starts with 0
    expect(inscription.getPointer()).toBe(0);
  });

  /*
   * This transaction one was mentioned here:
   * https://github.com/ordinals/ord/issues/3076 (Expected Behavior on inscription_pointer's overflows)
   *
   * In the transaction aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077,
   * we have an inscription trying to inscribe 5 satoshi using 4 pointers that are "overflowing"
   * (3274506, 3406092, 3537678, 3669264 *), meaning the pointer is specifying an offset going beyond
   * the quantity of satoshi available in the input provided.
   *
   * The four mentioned numbers are just inscription numbers (not pointer values!)
   * 3274506 is inscription f4c307e9479a6a48180090e096f3f56697a6ae828f9ba11db2b589897a317ba8i0 which mints orc-20 / mouse
   * 3406092 is inscription f2cb22206fff0fe4301b66ef4c68db953efdad562484edb619650b32c45129f9i0 which mints orc-20 / mouse
   * 3537678 is inscription 5ca96560944681fdf6b31faa272d4413f1bcad0fa58beb9599a68ab538cfabb7i0 which mints orc-20 / mouse
   * 3669264 is inscription 80002c1ec4b3acc156643abddcaa1017b3a9836d509a94866bfeaf30f501fe7fi0 which mints orc-20 / mouse
   *
   * but the mentioned transaction creates these 5 inscriptions
   *
   * 56575453 is inscription aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077i0 which also mints orc-20 / mouse
   * 56575454 is inscription aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077i1 which also mints orc-20 / mouse
   * 56575455 is inscription aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077i2 which also mints orc-20 / mouse
   * 56575456 is inscription aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077i3 which also mints orc-20 / mouse
   * 56575457 is inscription aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077i4 which also mints orc-20 / mouse
   *
   * ... so it took me far too much time to find out what OP wanted to describe!
   *
   * Hint: The pointer should be relative to the the first sat in the outputs.
   * (see https://github.com/ordinals/ord/issues/2718#issuecomment-1823297527)
   *
   * https://ordpool.space/tx/aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077
  */
    it('should parse a transaction with multiple pointers', () => {

      const txn = readTransaction('aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077');

      const inscriptions = InscriptionParserService.parse(txn);
      expect(inscriptions.length).toEqual(5);

      const expectedContent = '{"p":"orc-20","op":"mint","params":{"tick":"mouse","tid":"43911153","amt":"500000"}}';
      expect(inscriptions[0].getContent()).toBe(expectedContent); // 'aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077i0'
      expect(inscriptions[1].getContent()).toBe(expectedContent); // 'aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077i1'
      expect(inscriptions[2].getContent()).toBe(expectedContent); // 'aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077i2'
      expect(inscriptions[3].getContent()).toBe(expectedContent); // 'aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077i3'
      expect(inscriptions[4].getContent()).toBe(expectedContent); // 'aa2ab56587c7d6609c95157e6dff37c5c3fa6531702f41229a289a5613887077i4'

      const satsOutput1 = txn.vout[0].value; // 294
      const satsOutput2 = txn.vout[1].value; // 294
      const satsOutput3 = txn.vout[1].value; // 294
      const satsOutput4 = txn.vout[1].value; // 294
      const satsOutput5 = txn.vout[1].value; // 294

      const availableSats = satsOutput1 + satsOutput2 + satsOutput3 + satsOutput4 + satsOutput5; // 1470

      const pointer1 = inscriptions[0].getPointer(); // undefined
      const pointer2 = inscriptions[1].getPointer(); // 3289650
      const pointer3 = inscriptions[2].getPointer(); // 3421236
      const pointer4 = inscriptions[3].getPointer(); // 3552822
      const pointer5 = inscriptions[4].getPointer(); // 3684408

      // yep, they are overlowing!
      expect(pointer2).toBeGreaterThan(availableSats);
      expect(pointer3).toBeGreaterThan(availableSats);
      expect(pointer4).toBeGreaterThan(availableSats);
      expect(pointer5).toBeGreaterThan(availableSats);
    });
});
