import { bytesToHex, hexToBytes } from "./src20-parser.service.helper";


describe('hexToBytes', () => {
  it('should convert a hexadecimal string to an array of bytes', () => {
    expect(hexToBytes('')).toEqual([]);
    expect(hexToBytes('00')).toEqual([0]);
    expect(hexToBytes('ff')).toEqual([255]);
    expect(hexToBytes('00ff')).toEqual([0, 255]);
    expect(hexToBytes('000102')).toEqual([0, 1, 2]);
    expect(hexToBytes('abcdef')).toEqual([171, 205, 239]);
  });
});

it('converts an array of bytes to a hexadecimal string', () => {
  expect(bytesToHex([])).toEqual('');
  expect(bytesToHex([0])).toEqual('00');
  expect(bytesToHex([255])).toEqual('ff');
  expect(bytesToHex([0, 255])).toEqual('00ff');
  expect(bytesToHex([0, 1, 2])).toEqual('000102');
  expect(bytesToHex([171, 205, 239])).toEqual('abcdef');
});
