import { binaryStringToBase64 } from "./binaryStringToBase64";

describe('Base64 encoding and decoding', () => {

  it('binaryStringToBase64 should correctly encode a basic ASCII string', () => {
    const input = 'Hello World';
    const expectedOutput = 'SGVsbG8gV29ybGQ='; // Base64 encoded string of 'Hello World'
    expect(binaryStringToBase64(input)).toEqual(expectedOutput);
  });

  it('binaryStringToBase64 should correctly encode an UTF-8 encoded string containing special characters', () => {
    const utf8String = 'obð¤cpfp';
    const expectedOutput = 'b2Lwn6SdY3BmcA==';
    expect(binaryStringToBase64(utf8String)).toEqual(expectedOutput);
  });

});
