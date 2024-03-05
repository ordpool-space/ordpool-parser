/**
 * Generative color palette based on an approach by Inigo Quilez
 * Typescript implementation of a GLSL method described at https://iquilezles.org/articles/palettes/
 *
 * @param t Normalized palette index (0 to 1).
 * @param baseColor Base color of the palette (RGB values).
 * @param amplitude Amplitude of color variation (RGB values).
 * @param frequency Frequency of color variation (RGB values).
 * @param phase Phase offset of color variation (RGB values).
 * @returns An array of RGB color values.
 */
export function generativeColorPalette(t: number, baseColor: number[], amplitude: number[], frequency: number[], phase: number[]): number[] {
  return [
      baseColor[0] + amplitude[0] * Math.cos(2*Math.PI * (frequency[0] * t + phase[0])),
      baseColor[1] + amplitude[1] * Math.cos(2*Math.PI * (frequency[1] * t + phase[1])),
      baseColor[2] + amplitude[2] * Math.cos(2*Math.PI * (frequency[2] * t + phase[2]))
  ];
}
