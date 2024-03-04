type Point = { x: number; y: number };

// Generates the top, left, right points for the cube illusion
function getCubePoints(baseX: number, baseY: number, size: number): { top: Point[], left: Point[], right: Point[] } {
  const halfSize = size / 2;
  const halfHeight = halfSize / 2; // Since height is size / 2, half of height is size / 4
  return {
    top: [
      { x: baseX - halfSize, y: baseY - halfHeight },
      { x: baseX, y: baseY - halfSize },
      { x: baseX + halfSize, y: baseY - halfHeight },
      { x: baseX, y: baseY },
    ],
    left: [
      { x: baseX - halfSize, y: baseY - halfHeight },
      { x: baseX - halfSize, y: baseY + halfHeight },
      { x: baseX, y: baseY + halfSize },
      { x: baseX, y: baseY },
    ],
    right: [
      { x: baseX, y: baseY },
      { x: baseX, y: baseY + halfSize },
      { x: baseX + halfSize, y: baseY + halfHeight },
      { x: baseX + halfSize, y: baseY - halfHeight },
    ],
  };
}

// Generates a cube illusion from three polygon
function getCubeFromPolygons(x: number, y: number, size: number, orangeCube: boolean, gridWidth: number, gridHeight: number): string {
  const points = getCubePoints(x, y, size);

  let colorTop = '#232838';
  let colorLeft = '#191c27';
  let colorRight = '#2d3348';

  if (orangeCube) {
    colorTop = '#ff9900';
    colorLeft = '#cc7a00';
    colorRight = '#ffad33';
  }

  // not visible, because even the left side is out of the grid (right overflow)
  if(points.left[0].x > gridWidth) {
    return '';
  }

  // not visible, because even the right side is out of the grid (left overflow)
  if(points.right[0].x < 0) {
    return '';
  }

  // not visible, because even the top side is out of the grid (bottom overflow)
  if(points.top[0].y > gridHeight) {
    return '';
  }

  return `
    <polygon points="${points.top.map(p => `${p.x},${p.y}`).join(' ')}" fill="${colorTop}" />
    <polygon points="${points.left.map(p => `${p.x},${p.y}`).join(' ')}" fill="${colorLeft}" />
    <polygon points="${points.right.map(p => `${p.x},${p.y}`).join(' ')}" fill="${colorRight}" />
  `;
}

export function getIsomometricCubePattern(rows: number, columns: number, cubeSize: number, gridWidth: number, gridHeight: number): string {

  let svg = '';

  // Starting point for drawing cubes in the top left corner
  const startX = cubeSize / 2;
  const startY = cubeSize / 4;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const x = startX + c * cubeSize - r * cubeSize / 2;
      const y = startY + r * cubeSize * 0.75;

      const isCube9 = r == 0 && c == 9;

      svg += getCubeFromPolygons(x, y, cubeSize, isCube9, gridWidth, gridHeight);
    }
  }
  return svg;
}
