import { OP_FALSE, OP_IF, OP_PUSHBYTES_3, byteArrayToHex, littleEndianBytesToNumber, extractParent, extractPointer, getNextInscriptionMark, hexStringToUint8Array, readBytes, uint8ArrayToSingleByteChars, utf8BytesToUtf16String, bigEndianBytesToNumber } from './inscription-parser.service.helper';

/**
 * Converts a UTF-16 encoded JavaScript string to a Uint8Array representing UTF-8 encoded bytes.
 *
 * @param str - The UTF-16 encoded string to convert.
 * @returns A Uint8Array containing the UTF-8 encoded bytes of the input string.
 */
function utf16StringToUint8Array(str: string) {
  const utf8 = [];

  for (let i = 0; i < str.length; i++) {
      let charcode = str.charCodeAt(i);

      // Handle single-byte characters (U+0000 to U+007F)
      if (charcode < 0x80) utf8.push(charcode);
      // Handle two-byte characters (U+0080 to U+07FF)
      else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
                    0x80 | (charcode & 0x3f));
      }
      // Handle three-byte characters (U+0800 to U+FFFF, excluding surrogate pairs U+D800 to U+DFFF)
      else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
                    0x80 | ((charcode >> 6) & 0x3f),
                    0x80 | (charcode & 0x3f));
      }
      // Handle surrogate pairs (U+10000 to U+10FFFF)
      else {
          i++;
          // Combine surrogate pair components into a single code point
          // UTF-16 encodes 0x10000-0x10FFFF by subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
          utf8.push(0xf0 | (charcode >> 18),
                    0x80 | ((charcode >> 12) & 0x3f),
                    0x80 | ((charcode >> 6) & 0x3f),
                    0x80 | (charcode & 0x3f));
      }
  }

  return new Uint8Array(utf8);
}



describe('Conversions between UTF-8 encoded data and UTF-16 encoded strings', () => {

  it('uint8ArrayToSingleByteChars should return the expected UTF-8 encoded string', () => {

    // UTF-8 Encoding: UTF-8 is a variable-length encoding system for Unicode,
    // capable of representing every character in the Unicode character set.
    // It uses one to four 8-bit bytes.
    const utf8EncodedBytes = new Uint8Array([111, 98, 240, 159, 164, 157, 99, 112, 102, 112]); //  'ob🤝cpfp';

    // Convert Uint8Array to a 'binary' string
    const utf8String: string = uint8ArrayToSingleByteChars(utf8EncodedBytes);

    expect(utf8String).toEqual('obð¤cpfp');
  });

  it('a conversion from UTF-16 to UTF-8 is really what I think it is', () => {

    // UTF-16 Encoding: JavaScript strings are internally represented in UTF-16,
    // where each character can be either 1 or 2 code units (16 bits each).
    const input = 'ob🤝cpfp';

    // UTF-8 Encoding: UTF-8 is a variable-length encoding system for Unicode,
    // capable of representing every character in the Unicode character set.
    // It uses one to four 8-bit bytes.
    const binaryData = utf16StringToUint8Array(input);
    expect(binaryData).toEqual(new Uint8Array([111, 98, 240, 159, 164, 157, 99, 112, 102, 112]));
  });

  it('utf8BytesToUtf16String decodes back to UTF-16', () => {

    // UTF-8 Encoding: UTF-8 is a variable-length encoding system for Unicode,
    // capable of representing every character in the Unicode character set.
    // It uses one to four 8-bit bytes.
    const binaryData = new Uint8Array([111, 98, 240, 159, 164, 157, 99, 112, 102, 112]);

    // Convert Uint8Array to a binary string
    const normalUtf16String = utf8BytesToUtf16String(binaryData);

    expect(normalUtf16String).toEqual('ob🤝cpfp');
  });
});

describe('hexStringToUint8Array', () => {

  it('should convert a simple hex string to an Uint8Array', () => {
    const orangeColorFromBitcoinLogo = 'ff9900';
    const result = hexStringToUint8Array(orangeColorFromBitcoinLogo);
    expect(result).toEqual(new Uint8Array([255, 153, 0])); // RGB (255, 153, 0)
  });

  it('should convert the inscriptionMark 0063036f7264 hex string to an Uint8Array', () => {
    const hexString = '0063036f7264';
    const result = hexStringToUint8Array(hexString);
    expect(result).toEqual(new Uint8Array([OP_FALSE, OP_IF, OP_PUSHBYTES_3, 0x6f, 0x72, 0x64]));
  });

  it('should throw an error for an empty string', () => {
    const hexString = '';
    expect(() => hexStringToUint8Array(hexString)).toThrow('Input string is empty. Hex string expected.');
  });
});

describe('readBytes', () => {

  it('should correctly read specified number of bytes from Uint8Array', () => {

    const rawData = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);

    // Define the pointer position and number of bytes to read
    const pointer = 2; // Starting from index 2
    const numberOfBytes = 3; // Read 3 bytes

    // Expected results
    const expectedSlice = new Uint8Array([30, 40, 50]);
    const expectedPointer = 5; // Original pointer (2) + number of bytes read (3)

    const [slice, newPointer] = readBytes(rawData, pointer, numberOfBytes);

    expect(slice).toEqual(expectedSlice);
    expect(newPointer).toEqual(expectedPointer);
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

// littleEndianBytesToNumber is essentially reading a binary representation of a number
// (in little-endian format) from a Uint8Array and converting it into a JavaScript number.
describe('littleEndianBytesToNumber', () => {

  it('should calculate size for single byte correctly', () => {
    const dataSizeArray = new Uint8Array([0x12]); // 18 in decimal
    const size = littleEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x12);
    expect(size).toEqual(18);
  });

  it('should calculate size for two bytes correctly in little-endian format', () => {
    const dataSizeArray = new Uint8Array([0x34, 0x12]); // 0x1234 in hexadecimal
    const size = littleEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x1234);
    expect(size).toEqual(4660);
  });

  it('should calculate size for four bytes correctly in little-endian format', () => {
    const dataSizeArray = new Uint8Array([0x78, 0x56, 0x34, 0x12]); // 0x12345678 in hexadecimal
    const size = littleEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x12345678);
    expect(size).toEqual(305419896);
  });

  it('should handle an empty array', () => {
    const dataSizeArray = new Uint8Array([]);
    expect(littleEndianBytesToNumber(dataSizeArray)).toEqual(0);
  });
});

// bigEndianBytesToNumber is essentially reading a binary representation of a number
// (in big-endian format) from a Uint8Array and converting it into a JavaScript number.
describe('bigEndianBytesToNumber', () => {

  it('should calculate size for single byte correctly', () => {
    const dataSizeArray = new Uint8Array([0x12]); // 18 in decimal
    const size = bigEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x12);
    expect(size).toEqual(18);
  });

  it('should calculate size for two bytes correctly in big-endian format', () => {
    const dataSizeArray = new Uint8Array([0x12, 0x34]); // 0x1234 in hexadecimal
    const size = bigEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x1234);
    expect(size).toEqual(4660);
  });

  it('should calculate size for four bytes correctly in big-endian format', () => {
    const dataSizeArray = new Uint8Array([0x12, 0x34, 0x56, 0x78]); // 0x12345678 in hexadecimal
    const size = bigEndianBytesToNumber(dataSizeArray);
    expect(size).toEqual(0x12345678);
    expect(size).toEqual(305419896);
  });

  it('should handle an empty array', () => {
    const dataSizeArray = new Uint8Array([]);
    expect(bigEndianBytesToNumber(dataSizeArray)).toEqual(0);
  });
});

describe('byteArrayToHex', () => {

  it('should correctly convert a byte array to a hexadecimal string', () => {
    const byteArray = new Uint8Array([0x01, 0xAB, 0x3F]);
    const expectedHex = '01ab3f';
    expect(byteArrayToHex(byteArray)).toEqual(expectedHex);
  });

  it('should correctly convert a byte array with the inscription mark to a hexadecimal string', () => {
    const byteArray = new Uint8Array([OP_FALSE, OP_IF, OP_PUSHBYTES_3, 0x6f, 0x72, 0x64]);
    const expectedHex = '0063036f7264';
    expect(byteArrayToHex(byteArray)).toEqual(expectedHex);
  });

  it('should handle an empty byte array', () => {
    const byteArray = new Uint8Array([]);
    const expectedHex = '';
    expect(byteArrayToHex(byteArray)).toEqual(expectedHex);
  });

  it('should handle a single byte correctly', () => {
    const byteArray = new Uint8Array([0x00]);
    const expectedHex = '00';
    expect(byteArrayToHex(byteArray)).toEqual(expectedHex);
  });

  it('should pad single digit hex values with a leading zero', () => {
    const byteArray = new Uint8Array([0x1, 0x2, 0xA]);
    const expectedHex = '01020a';
    expect(byteArrayToHex(byteArray)).toEqual(expectedHex);
  });

  // Additional tests can be added here, for example, testing with larger arrays.
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
    const value = hexStringToUint8Array('1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100ff');
    const expected = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1fi255';
    expect(extractParent(value)).toEqual(expected);
  });

  it('should correctly extract parent inscription ID (000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1fi256)', () => {
    const value = hexStringToUint8Array('1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a090807060504030201000001');
    const expected = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1fi256';
    expect(extractParent(value)).toEqual(expected);
  });

  it('should return undefined for undefined parent field', () => {
    expect(extractParent(undefined)).toBeUndefined();
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
    expect(extractPointer(undefined)).toBeUndefined();
  });
});
