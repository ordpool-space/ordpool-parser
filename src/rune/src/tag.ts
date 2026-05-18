import { None, Option, Some } from './monads';
import { u128 } from './integer';
import { FixedArray } from './utils';

export enum Tag {
  BODY = 0,
  FLAGS = 2,
  RUNE = 4,

  PREMINE = 6,
  CAP = 8,
  AMOUNT = 10,
  HEIGHT_START = 12,
  HEIGHT_END = 14,
  OFFSET_START = 16,
  OFFSET_END = 18,
  MINT = 20,
  POINTER = 22,
  CENOTAPH = 126,

  DIVISIBILITY = 1,
  SPACERS = 3,
  SYMBOL = 5,
  // Protocol extension tag, introduced by the Protorunes spec
  // (kungfuflex/protorune). Carries one or more Protostones --
  // sub-protocols that share the Runestone envelope. Alkanes
  // (protocol_tag = 1) is the most active consumer.
  // Tag is odd, so unconsumed values do not produce a cenotaph.
  PROTOCOL = 16383,
  NOP = 127,
}

export namespace Tag {
  export function take<N extends number, T extends {}>(
    tag: Tag,
    fields: Map<u128, u128[]>,
    n: N,
    withFn: (values: FixedArray<u128, N>) => Option<T>
  ): Option<T> {
    const field = fields.get(u128(tag));
    if (field === undefined) {
      return None;
    }

    const values: u128[] = [];
    for (const i of [...Array(n).keys()]) {
      if (field[i] === undefined) {
        return None;
      }
      values[i] = field[i];
    }

    const optionValue = withFn(values as FixedArray<u128, N>);
    if (optionValue.isNone()) {
      return None;
    }

    field.splice(0, n);

    if (field.length === 0) {
      fields.delete(u128(tag));
    }

    return Some(optionValue.unwrap());
  }

  // Consume EVERY value stored under `tag`, regardless of count. Used for
  // PROTOCOL (16383) where Protorunes packs an arbitrary number of u128s.
  export function takeAll(tag: Tag, fields: Map<u128, u128[]>): u128[] {
    const field = fields.get(u128(tag));
    if (field === undefined || field.length === 0) {
      return [];
    }
    const values = field.slice();
    fields.delete(u128(tag));
    return values;
  }
}
