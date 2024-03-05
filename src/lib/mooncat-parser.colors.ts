export const feeLevels = [
  1, 5, 8, 10, 12, 15, 20, 24, 27, 30, 33, 36, 40, 43,
  47, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115,
  120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190,
  195, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250, 260, 270, 280,
  300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000
];

// Generative color palette based on an approach by Inigo Quilez
// Typescript implementation of a GLSL method described at https://iquilezles.org/articles/palettes/
export function generativeColorPalette(x: number, a: number[], b: number[], c: number[], d: number[]): number[] {
  return [
      a[0] + b[0] * Math.cos(2*Math.PI * (c[0] * x + d[0])),
      a[1] + b[1] * Math.cos(2*Math.PI * (c[1] * x + d[1])),
      a[2] + b[2] * Math.cos(2*Math.PI * (c[2] * x + d[2]))
  ];
}
