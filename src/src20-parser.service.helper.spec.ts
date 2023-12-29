import { hexToString, stringToHex } from "./src20-parser.service.helper";

describe.skip('String and Hex Conversion', () => {

  it('two-byte characters should be encoded and decoded', () => {
    const utf8String = 'Hello, world! 🌍';
    const hex = stringToHex(utf8String);
    const decodedString = hexToString(hex);
    expect(decodedString).toEqual(utf8String);
  });

  it('four-byte characters should be encoded and decoded', () => {
    const utf16String = '𝔘𝔱𝔣-16 𝔱𝔢𝔰𝔱';
    const hex = stringToHex(utf16String);
    const decodedString = hexToString(hex);
    expect(decodedString).toEqual(utf16String);
  });
});
