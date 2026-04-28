import { extractInscriptionId, extractPointer, getKnownFieldValue, getKnownFieldValues, getNextInscriptionMark, isValidInscriptionId, measureInscriptionSize } from './inscription-parser.service.helper';
import { hexToBytes } from '../lib/conversions';

describe('getKnownFieldValue', () => {

  it('should return the value for a matching field', () => {
    const fields = [
      { tag: 1, value: new Uint8Array([10]) },
      { tag: 2, value: new Uint8Array([20]) }
    ];
    const result = getKnownFieldValue(fields, 1);
    expect(result).toEqual(new Uint8Array([10]));
  });

  it('should return undefined if there is no matching field', () => {
    const fields = [
      { tag: 1, value: new Uint8Array([10]) },
      { tag: 2, value: new Uint8Array([20]) }
    ];
    const result = getKnownFieldValue(fields, 3);
    expect(result).toBe(undefined);
  });
});

describe('getKnownFieldValues', () => {

  it('should return all values for matching fields', () => {
    const fields = [
      { tag: 1, value: new Uint8Array([10]) },
      { tag: 1, value: new Uint8Array([15]) },
      { tag: 2, value: new Uint8Array([20]) }
    ];
    const result = getKnownFieldValues(fields, 1);
    expect(result).toEqual([new Uint8Array([10]), new Uint8Array([15])]);
  });

  it('should return an empty array if there are no matching fields', () => {
    const fields = [
      { tag: 1, value: new Uint8Array([10]) },
      { tag: 2, value: new Uint8Array([20]) }
    ];
    const result = getKnownFieldValues(fields, 3);
    expect(result).toEqual([]);
  });
});

describe('getNextInscriptionMark', () => {

  it('should find the inscription mark (00 63 03 6f 72 64) and return the position after it', () => {
    const raw = new Uint8Array([0, 1, 2, 0x00, 0x63, 0x03, 0x6f, 0x72, 0x64, 10, 20]);
    const startPosition = 0;
    const expectedPosition = 9;
    expect(getNextInscriptionMark(raw, startPosition)).toEqual(expectedPosition);
  });

  it('should return -1 if the inscription mark is not found', () => {
    const raw = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const startPosition = 0;
    expect(getNextInscriptionMark(raw, startPosition)).toEqual(-1);
  });

  it('should correctly handle an empty array', () => {
    const raw = new Uint8Array([]);
    const startPosition = 0;
    expect(getNextInscriptionMark(raw, startPosition)).toEqual(-1);
  });

  it('should find the inscription mark even if it starts next to the end of the array', () => {
    const raw = new Uint8Array([0, 1, 2, 0x00, 0x63, 0x03, 0x6f, 0x72, 0x64]);
    const startPosition = 3;
    const expectedPosition = 9;
    expect(getNextInscriptionMark(raw, startPosition)).toEqual(expectedPosition);
  });

  it('should find the inscription mark starting exactly at the startPosition', () => {
    const raw = new Uint8Array([0x00, 0x63, 0x03, 0x6f, 0x72, 0x64, 10, 20, 30]);
    const startPosition = 0;
    const expectedPosition = 6;
    expect(getNextInscriptionMark(raw, startPosition)).toEqual(expectedPosition);
  });
});


/*
Provenance
==========

The owner of an inscription can create child inscriptions, trustlessly
establishing the provenance of those children on-chain as having been created
by the owner of the parent inscription. This can be used for collections, with
the children of a parent inscription being members of the same collection.

Children can themselves have children, allowing for complex hierarchies. For
example, an artist might create an inscription representing themselves, with
sub inscriptions representing collections that they create, with the children
of those sub inscriptions being items in those collections.

### Specification

To create a child inscription C with parent inscription P:

- Create an inscribe transaction T as usual for C.
- Spend the parent P in one of the inputs of T.
- Include tag `3`, i.e. `OP_PUSH 3`, in C, with the value of the serialized
  binary inscription ID of P, serialized as the 32-byte `TXID`, followed by the
  four-byte little-endian `INDEX`, with trailing zeroes omitted.

_NB_ The bytes of a bitcoin transaction ID are reversed in their text
representation, so the serialized transaction ID will be in the opposite order.

### Example

An example of a child inscription of
`000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1fi0`:

```
OP_FALSE
OP_IF
  OP_PUSH "ord"
  OP_PUSH 1
  OP_PUSH "text/plain;charset=utf-8"
  OP_PUSH 3
  OP_PUSH 0x1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100
  OP_PUSH 0
  OP_PUSH "Hello, world!"
OP_ENDIF
```

Note that the value of tag `3` is binary, not hex, and that for the child
inscription to be recognized as a child,
`000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1fi0` must be
spent as one of the inputs of the inscribe transaction.

Example encoding of inscription ID
`000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1fi255`:

```
OP_FALSE
OP_IF
  …
  OP_PUSH 3
  OP_PUSH 0x1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100ff
  …
OP_ENDIF
```

And of inscription ID `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1fi256`:

```
OP_FALSE
OP_IF
  …
  OP_PUSH 3
  OP_PUSH 0x1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a090807060504030201000001
  …
OP_ENDIF
```

### Notes

The tag `3` is used because it is the first available odd tag. Unrecognized odd
tags do not make an inscription unbound, so child inscriptions would be
recognized and tracked by old versions of `ord`.

A collection can be closed by burning the collection's parent inscription,
which guarantees that no more items in the collection can be issued.
*/
describe('extractParent', () => {

  it('should correctly extract parent inscription ID (000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1fi255)', () => {
    const value = hexToBytes('1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100ff');
    const expected = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1fi255';
    expect(extractInscriptionId(value)).toEqual(expected);
  });

  it('should correctly extract parent inscription ID (000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1fi256)', () => {
    const value = hexToBytes('1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a090807060504030201000001');
    const expected = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1fi256';
    expect(extractInscriptionId(value)).toEqual(expected);
  });
});


/*
Pointer
=======

In order to make an inscription on a sat other than the first of its input, a
zero-based integer, called the "pointer", can be provided with tag `2`, causing
the inscription to be made on the sat at the given position in the outputs. If
the pointer is equal to or greater than the number of total sats in the outputs
of the inscribe transaction, it is ignored, and the inscription is made as
usual. The value of the pointer field is a little endian integer, with trailing
zeroes ignored.

An even tag is used, so that old versions of `ord` consider the inscription to
be unbound, instead of assigning it, incorrectly, to the first sat.

This can be used to create multiple inscriptions in a single transaction on
different sats, when otherwise they would be made on the same sat.

Examples
--------

An inscription with pointer 255:

```
OP_FALSE
OP_IF
  OP_PUSH "ord"
  OP_PUSH 1
  OP_PUSH "text/plain;charset=utf-8"
  OP_PUSH 2
  OP_PUSH 0xff
  OP_PUSH 0
  OP_PUSH "Hello, world!"
OP_ENDIF
```

An inscription with pointer 256:

```
OP_FALSE
OP_IF
  OP_PUSH "ord"
  OP_PUSH 1
  OP_PUSH "text/plain;charset=utf-8"
  OP_PUSH 2
  OP_PUSH 0x0001
  OP_PUSH 0
  OP_PUSH "Hello, world!"
OP_ENDIF
```

An inscription with pointer 256, with trailing zeroes, which are ignored:

```
OP_FALSE
OP_IF
  OP_PUSH "ord"
  OP_PUSH 1
  OP_PUSH "text/plain;charset=utf-8"
  OP_PUSH 2
  OP_PUSH 0x000100
  OP_PUSH 0
  OP_PUSH "Hello, world!"
OP_ENDIF
```
*/
describe('extractPointer', () => {

  // An inscription with pointer 255:
  it('should correctly extract a one-byte pointer value', () => {
    const pointer = extractPointer(new Uint8Array([0xff]));
    expect(pointer).toEqual(255);
  });

  // An inscription with pointer 256:
  it('should correctly extract a multi-byte pointer value', () => {
    const pointer = new Uint8Array([0x00, 0x01]);
    expect(extractPointer(pointer)).toEqual(256);
  });

  // An inscription with pointer 256, with trailing zeroes, which are ignored:
  it('should handle a pointer value with trailing zeroes', () => {
    const pointer = new Uint8Array([0x00, 0x01, 0x00]);
    expect(extractPointer(pointer)).toEqual(256);
  });

  it('should return undefined for undefined pointer value', () => {
    expect(extractPointer(undefined)).toBe(undefined);
  });
});


describe('measureInscriptionSize', () => {

  // Each witness item is an atomic byte array. The inscription envelope
  // (mark through OP_ENDIF) is always within a single element (the tapscript).

  it('should return the correct size for a simple envelope', () => {
    const witness = [
      '00', // Placeholder (signature)
      '0063036f7264' + '1122' + '68', // OP_FALSE, OP_IF, OP_PUSH "ord" (6 bytes) + 2 extra bytes + OP_ENDIF
      '00' // Placeholder (control block)
    ];

    const expectedSize = 6 + 2 + 1; // mark + data + OP_ENDIF

    expect(measureInscriptionSize(witness)).toBe(expectedSize);
  });

  it('should return null if the witness is empty', () => {
    const witness: string[] = [];
    expect(measureInscriptionSize(witness)).toBeNull();
  });

  it('should return null if the witness does not contain an inscription mark', () => {
    const witness = [
      '00',
      'abcd1234' // No inscription mark
    ];
    expect(measureInscriptionSize(witness)).toBeNull();
  });

  it('should return null if OP_ENDIF is missing', () => {
    const witness = [
      '00', // Placeholder
      '0063036f7264' // OP_FALSE, OP_IF, OP_PUSH "ord", but no OP_ENDIF
    ];
    expect(measureInscriptionSize(witness)).toBeNull();
  });

  it('should return the correct size with extra data before OP_ENDIF', () => {
    const witness = [
      '00',
      '0063036f7264' + 'abcdef123456' + '68', // OP_FALSE, OP_IF, OP_PUSH "ord" (6) + additional push data (6) + OP_ENDIF (1)
    ];

    const expectedSize = 6 + 6 + 1; // mark + data + OP_ENDIF

    expect(measureInscriptionSize(witness)).toBe(expectedSize);
  });

  it('should use last OP_ENDIF when multiple exist', () => {
    const witness = [
      '00',
      '0063036f7264' + 'abcdef123456' + '68' + '68', // mark + data (6) + evil inner OP_ENDIF (1) + real OP_ENDIF (1)
    ];

    const expectedSize = 6 + 6 + 1 + 1; // mark + data + evil OP_ENDIF + real OP_ENDIF

    expect(measureInscriptionSize(witness)).toBe(expectedSize);
  });
});

describe('isValidInscriptionId', () => {
  it('should return true for a valid inscription ID', () => {
    const validId = "521f8eccffa4c41a3a7728dd012ea5a4a02feed81f41159231251ecf1e5c79dai0";
    expect(isValidInscriptionId(validId)).toBe(true);
  });

  it('should return false for an invalid inscription ID with incorrect TXID length', () => {
    const invalidId = "521f8eccffa4c41ai0"; // Short TXID
    expect(isValidInscriptionId(invalidId)).toBe(false);
  });

  it('should return false for an invalid inscription ID with uppercase hex characters', () => {
    const invalidId = "521F8ECCFFA4C41A3A7728DD012EA5A4A02FEED81F41159231251ECF1E5C79DAI0";
    expect(isValidInscriptionId(invalidId)).toBe(false);
  });

  it('should return false for an invalid inscription ID without the "i" separator', () => {
    const invalidId = "521f8eccffa4c41a3a7728dd012ea5a4a02feed81f41159231251ecf1e5c79da0";
    expect(isValidInscriptionId(invalidId)).toBe(false);
  });

  it('should return false for an invalid inscription ID without an index', () => {
    const invalidId = "521f8eccffa4c41a3a7728dd012ea5a4a02feed81f41159231251ecf1e5c79dai";
    expect(isValidInscriptionId(invalidId)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isValidInscriptionId(undefined as any)).toBe(false);
  });
});
