import { readBytes } from "./reader";

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
