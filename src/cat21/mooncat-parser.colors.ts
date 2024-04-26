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

/**
 * Map a number from one range to another. Heavily inspired by p5.js map() at https://p5js.org/reference/#/p5/map
 * @param n - Number to map
 * @param from1 - Start of range for n
 * @param to1 - End of range for n
 * @param from2 - Start of destination range for result
 * @param to2 - End of destination range for result
 * @returns The number mapped to the destination range
 */
export function map(n: number, from1: number, to1: number, from2: number, to2: number): number {
  return (n - from1) / (to1 - from1) * (to2 - from2) + from2;
}

/**
 * Generates a color based on the fee rate, using a generative color palette approach. This function creates a smooth
 * transition of colors based on the fee rate value. Initially, it starts with green colors for low fee rates,
 * transitions through yellow and orange for mid-range fee rates, and finally moves towards red. After reaching
 * a specific threshold (fee rate 300), it starts to oscillate within the blue-red spectrum.
 *
 * @param {number} feeRate - The fee rate value used to determine the color.
 * @param {number} saturationSeed - Byte from catHash to inject some randomness in color saturation.
 * @returns {{ rgb: number[], saturation: number }} An object containing the RGB color array and the saturation value.
 * The RGB color array ([R, G, B]) consists of three elements, each representing the intensity of red, green,
 * and blue components, respectively. The saturation value ranges from 0.6 to 1.0, dictating the color's intensity.
 *
 * The transition starts from green to yellow and orange, then to red as the fee rate increases. Around fee rate 300,
 * a smoothing transition is applied to gradually shift from the yellow-orange spectrum to oscillating within the
 * blue-red spectrum.
 */
export function feeRateToColor(feeRate: number, saturationSeed: number): { rgb: number[], saturation: number } {
  const baseColor = [0.5, 0.5, 0.5];
  const amplitude = [-0.9, 0.6, 0.4];
  const frequency =  [1.0, 0.5, 0.5]; // Slow color transition
  const phase = [0.0, 0.0, 0.0];

  // Use a phase shifting palette
  const rgb = generativeColorPalette(
    feeRate / 300,
    baseColor,
    amplitude,
    frequency,
    phase
  );

  // for the culture - saturated cat 😸
  let saturation = map(saturationSeed, 0, 255, 0.75, 1.0);
  if (feeRate >= 420 && feeRate < 421) {
    saturation = 42.0;
  }

  // smoothing transition around feeRate 300
  if (feeRate < 300) {
    let transitionFactor = Math.max(0, (feeRate - 250) / 50); // Start transition 50 units before 300
    rgb[0] += (0.7 * (1 - transitionFactor));
    rgb[2] *= transitionFactor; // gradually introduce blue
  } else {
    let postTransitionFactor = Math.min(1, (feeRate - 300) / 50); // smooth transition for 50 units post 300
    rgb[1] *= (1 - postTransitionFactor); // gradually reduce green
    rgb[2] = postTransitionFactor; // ensure blue is fully present after transition
  }

  return {
    rgb,
    saturation
  }
}
