import fs from 'fs';
import { getIsomometricCubePattern, textToBinary } from './mooncat-parser.backgrounds';

describe('getIsomometricCubePattern', () => {

  it('should render a nice background with isometric cubes', () => {

    const rows = 14;
    const columns = 17;
    const cubeSize = 2.21;
    const gridWidth = 22;
    const gridHeight = 22;

    const svgPattern = getIsomometricCubePattern(rows, columns, cubeSize, gridWidth, gridHeight);
    const svg = `<svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">${ svgPattern }</svg>`

    expect(svgPattern).toContain('<polygon');

    fs.writeFileSync('testdist/background-cubes.svg', svg);
  });

});


// https://magictool.ai/tool/binary-to-text/ returns the same result
describe('textToBinary', () => {

  it('should convert a text to zeros and ones', () => {

    const text = 'Hello, World!';
    const binaryRepresentation = textToBinary(text);
    expect(binaryRepresentation).toBe('01001000011001010110110001101100011011110010110000100000010101110110111101110010011011000110010000100001');
  });

});
