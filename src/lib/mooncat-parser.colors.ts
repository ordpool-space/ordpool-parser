// mempool colors

export type Color = {
  r: number,
  g: number,
  b: number,
  a: number,
};

export const mempoolFeeColors = [
  '557d00',
  '5d7d01',
  '637d02',
  '6d7d04',
  '757d05',
  '7d7d06',
  '867d08',
  '8c7d09',
  '957d0b',
  '9b7d0c',
  'a67d0e',
  'aa7d0f',
  'b27d10',
  'bb7d11',
  'bf7d12',
  'bf7815',
  'bf7319',
  'be6c1e',
  'be6820',
  'bd6125',
  'bd5c28',
  'bc552d',
  'bc4f30',
  'bc4a34',
  'bb4339',
  'bb3d3c',
  'bb373f',
  'ba3243',
  'b92b48',
  'b9254b',
  'b8214d',
  'b71d4f',
  'b61951',
  'b41453',
  'b30e55',
  'b10857',
  'b00259',
  'ae005b',
];

export const feeLevels = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 250, 300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000];

const feeColors = mempoolFeeColors.map(hexToColor);

function hexToColor(hex: string): Color {
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
    a: 1
  };
}

export function feeRateToMempoolColor(feeRate: number): Color {

  const feeLevelIndex = feeLevels.findIndex((feeLvl) => Math.max(1, feeRate) < feeLvl) - 1;
  const feeLevelColor = feeColors[feeLevelIndex] || feeColors[mempoolFeeColors.length - 1];
  return feeLevelColor;
}

// Generative color palette based on an approach by Inigo Quilez
// Typescript implementation of a GLSL method described at https://iquilezles.org/articles/palettes/
export function generativeColorPalette(x: number, a: number[], b: number[], c: number[], d: number[]): number[] {
  return [
      a[0] + b[0] * Math.cos(2*Math.PI * (c[0] * x + d[0])),
      a[1] + b[1] * Math.cos(2*Math.PI * (c[1] * x + d[1])),
      a[2] + b[2] * Math.cos(2*Math.PI * (c[2] * x + d[2]))
  ];
}
