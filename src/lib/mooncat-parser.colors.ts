// Generative color palette based on an approach by Inigo Quilez
// Typescript implementation of a GLSL method described at https://iquilezles.org/articles/palettes/
export function generativeColorPalette(x: number, a: number[], b: number[], c: number[], d: number[]): number[] {
  return [
      a[0] + b[0] * Math.cos(2*Math.PI * (c[0] * x + d[0])),
      a[1] + b[1] * Math.cos(2*Math.PI * (c[1] * x + d[1])),
      a[2] + b[2] * Math.cos(2*Math.PI * (c[2] * x + d[2]))
  ];
}
