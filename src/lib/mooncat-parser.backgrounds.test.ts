import fs from 'fs';
import { getIsomometricCubePattern } from './mooncat-parser.backgrounds';

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
