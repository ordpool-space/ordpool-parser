export const eyesPositions = [
  {
    traits: 'Standing-Left',
    position:  [8, 2]
  },
  {
    traits: 'Sleeping-Left',
    position:  [11, 4]
  },
  {
    traits: 'Pouncing-Left',
    position:  [4, 5]
  },
  {
    traits: 'Stalking-Left',
    position: [10, 3]
  },
  {
    traits: 'Standing-Right',
    position:  [8, 12]
  },
  {
    traits: 'Sleeping-Right',
    position:  [11, 11]
  },
  {
    traits: 'Pouncing-Right',
    position:  [4, 9]
  },
  {
    traits: 'Stalking-Right',
    position: [10, 12]
  }
]

// just for debugging - 1px eye for finding the eyesPositions
// export const laserEyesPattern = [
//   [0,0,0,0,0,0,0],
//   [0,6,0,0,0,6,0],
//   [0,0,0,0,0,0,0]
// ];

export const laserEyesPattern = [
  [0,6,0,0,0,6,0],
  [6,7,6,0,6,7,6],
  [0,6,0,0,0,6,0]
];

export const crownPattern = [
  [8,9,0,0,0,8,0,0,0,9,8],
  [8,9,9,0,8,8,8,0,9,9,8],
  [8,8,9,8,8,9,8,8,9,8,8],
  [0,8,8,9,9,8,9,9,8,8,0]
];

// completely opaque glasses
export const blackSunglassesPattern = [
  [10, 10,10,10,10,10,10,10,10,10,10,10],
  [ 0, 0, 10,10,10,10, 0,10,10,10,10, 0],
  [ 0, 0,  0,10,10, 0, 0, 0,10,10, 0, 0],
];

// glasses where you can see 1px of the eyes
export const laserEyesBlackSunglassesPattern = [
  [10, 10,10,10,10,10,10,10,10,10,10,10],
  [ 0, 0,10,10, 0,10, 0,10, 0,10,10, 0],
  [ 0, 0, 0,10,10, 0, 0, 0,10,10, 0, 0],
];

// completely opaque glasses
export const coolSunglassesPattern = [
  [ 0,10,10,10,10,10, 0,10,10,10,10,10],
  [ 0,10,11,11,11,10,10,10,11,11,11,10],
  [10,10,12,12,12,10, 0,10,12,12,12,10],
  [ 0,10,13,13,13,10, 0,10,13,13,13,10],
  [ 0, 0,10,10,10, 0, 0, 0,10,10,10, 0],
];

// glasses where you can see 1px of the eyes
export const laserEyesCoolSunglassesPattern = [
  [ 0,10,10,10,10,10, 0,10,10,10,10,10],
  [ 0,10,11,11 ,0,10,10,10, 0,11,11,10],
  [10,10,12,12,12,10, 0,10,12,12,12,10],
  [ 0,10,13,13,13,10, 0,10,13,13,13,10],
  [ 0, 0,10,10,10, 0, 0, 0,10,10,10, 0],
];

// 3D glasses
export const threeDimensionsGlassesPattern = [
  [10,10,10,10,10,10,10,10,10,10,10,10],
  [ 0, 0,10,11,11,11,10,12,12,12,10, 0],
  [ 0, 0,10,11,11,11,10,12,12,12,10, 0],
  [ 0, 0,10,10,10,10, 0,10,10,10,10, 0],
];

// nouns glasses
export const nounsGlassesPattern = [
  [ 0, 0,10,10,10,10, 0,10,10,10,10],
  [10,10,10,11,12,10,10,10,11,12,10],
  [10, 0,10,11,12,10, 0,10,11,12,10],
  [ 0, 0,10,10,10,10, 0,10,10,10,10],
];

/**
 * Enlarges and aligns a cat design to a fixed 22x22 grid.
 * The original design is centered horizontally and aligned to the bottom vertically.
 * This adjustment ensures that the design fits within the standard grid size,
 * allowing for consistent application of patterns or alterations across various designs.
 *
 * @param originalDesign - The original cat design as a 2D array of numbers.
 * @returns The enlarged and aligned cat design as a 22x22 2D array of numbers.
 */
export function enlargeAndAlignDesign(originalDesign: number[][]): number[][] {
  const gridWidth = 22;
  const gridHeight = 22;
  const bottomPadding = 1; // Adds 1px padding to the bottom if possible, otherwise 0

  const catWidth = originalDesign[0].length; // Width is now determined by the length of the first row
  const catHeight = originalDesign.length; // Height is determined by the number of rows

  // Calculate offsets for centering and bottom alignment
  const xOffset = Math.floor((gridWidth - catWidth) / 2);
  const yOffset = Math.max(gridHeight - catHeight - bottomPadding, 0);

  // Initialize a new 22x22 grid filled with zeros
  const enlargedDesign = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));

  // Copy the original design into the center-bottom of the new grid
  for (let rowIndex = 0; rowIndex < catHeight; rowIndex++) {
    for (let colIndex = 0; colIndex < catWidth; colIndex++) {
      const newRow = rowIndex + yOffset;
      const newCol = colIndex + xOffset;
      enlargedDesign[newRow][newCol] = originalDesign[rowIndex][colIndex];
    }
  }

  return enlargedDesign;
}

/**
 * Decodes the traits for a given Mooncat design index, translating numerical values into trait descriptions.
 * This function mirrors the logic used in the original Ruby implementation, applying operations to extract
 * pose, expression, pattern, and facing direction from the design index.
 *
 * @param designIndex - The design index (0-127) representing specific traits of a Mooncat.
 * @returns An object containing the decoded traits: pose, expression, pattern, and facing direction.
 *
 * Trait decoding logic:
 * - Pose: Derived from the remainder when the design index is divided by 4. This operation cycles through
 *   the poses for every set of 4 consecutive design indices.
 * - Expression: Determined by dividing the design index by 16 and then applying modulo 4 to the quotient.
 *   This calculation segments the design indices into groups of 16, each group cycling through the expressions.
 * - Pattern: Obtained by first dividing the design index by 4 and then applying modulo 4. This mirrors the
 *   cycle used for pose, but aligned to the sequence in which patterns appear across the design indices.
 * - Facing Direction: Decided based on the design index being less than 64, indicating 'Left', otherwise 'Right'.
 *   This binary determination is rooted in the most significant bit of the lower half versus the upper half of
 *   the 0-127 range, aligning with how the Ruby implementation encoded the facing direction.
 *
 * see https://github.com/cryptocopycats/mooncats/blob/fc9ba95aeff28cc84714a1c66d40ba9b024dcdc8/mooncats/lib/mooncats/structs.rb#L54
 */
export function decodeTraits(designIndex: number): {
  pose: 'Standing' | 'Sleeping' | 'Pouncing' | 'Stalking',
  expression: 'Smile' | 'Grumpy' | 'Pouting' | 'Shy',
  pattern: 'Solid' | 'Striped' | 'Eyepatch' | 'Half/Half',
  facing: 'Left' | 'Right'
} {
  const poses = ['Standing', 'Sleeping', 'Pouncing', 'Stalking'];
  const expressions = ['Smile', 'Grumpy', 'Pouting', 'Shy'];
  const patterns = ['Solid', 'Striped', 'Eyepatch', 'Half/Half'];

  const pose = poses[designIndex % 4] as 'Standing' | 'Sleeping' | 'Pouncing' | 'Stalking';
  const expression = expressions[Math.floor(designIndex / 16) % 4] as 'Smile' | 'Grumpy' | 'Pouting' | 'Shy';
  const pattern = patterns[Math.floor(designIndex / 4) % 4] as 'Solid' | 'Striped' | 'Eyepatch' | 'Half/Half';
  const facing = designIndex < 64 ? 'Left' : 'Right';

  return {
    pose, expression, pattern, facing
  };
}

/**
 * Alters a given design by applying a new pattern at a specified position.
 * The new pattern overlays onto the original design, replacing pixels based on the pattern.
 * A zero value in the new pattern means the original pixel is left unchanged.
 *
 * @param design - The original design as a 2D array of numbers.
 * @param position - The row and column position where the new pattern should be applied.
 * @param newPattern - The new pattern to overlay on the design, where non-zero values replace the design's pixels.
 * @returns The altered design with the new pattern applied.
 */
export function alterDesign(design: number[][], position: number[], newPattern: number[][]): number[][] {

  // Clone the original design to avoid mutating the input directly
  const alteredDesign = design.map(row => [...row]);

  // Extract the starting point for the pattern application
  const [startRow, startColumn] = position;

  // Apply the new pattern to the design
  for (let row = 0; row < newPattern.length; row++) {
    for (let column = 0; column < newPattern[row].length; column++) {
      // Calculate the exact position in the design where the pattern's current pixel should be applied
      const designRow = startRow + row;
      const designColumn = startColumn + column;

      // Ensure the position is within the bounds of the design
      if (alteredDesign[designRow] !== undefined &&
          alteredDesign[designRow][designColumn] !== undefined) {
        // Only apply non-zero values from the new pattern
        if (newPattern[row][column] > 0) {
          alteredDesign[designRow][designColumn] = newPattern[row][column];
        }
      }
    }
  }
  return alteredDesign;
}

/**
 * Retrieves the position of eyes based on the design index.
 * @param  designIndex - The design index to decode traits.
 * @returns The position of eyes, or undefined if not found (should not happen).
 */
export function getEyesPosition(designIndex: number, rowOffset: number = 0, colOffset: number = 0) {
  const traits = decodeTraits(designIndex);
  const poseFacingKey = `${traits.pose}-${traits.facing}`;
  const eyesPosition = eyesPositions.find(x => x.traits == poseFacingKey);

  // this code should always return a valid position,
  // but even if not - then these large negate numbers will make sure that the coordinates
  // are just outside bounds of the design – so nothing will happen
  if (!eyesPosition) { return [-99, -99]; }

  return [eyesPosition.position[0] + rowOffset, eyesPosition.position[1] + colOffset]
}

/**
 * Applies laser eyes to the design.
 * @param design - The design to alter.
 * @param designIndex - The design index to retrieve eyes position.
 * @returns The altered design with laser eyes applied.
 */
export function applyLaserEyes(design: number[][], designIndex: number): number[][] {
  const position = getEyesPosition(designIndex);
  return alterDesign(design, position, laserEyesPattern)
}

/**
 * Applies a crown to the design.
 * @param design - The design to alter.
 * @param The design index to retrieve eyes position.
 * @returns The altered design with a crown applied.
 */
export function applyCrown(design: number[][], designIndex: number): number[][] {
  const position = getEyesPosition(designIndex, -4, -2);
  return alterDesign(design, position, crownPattern);
}

/**
 * Applies black sunglasses to the design (completely opaque glasses).
 * @param design - The design to alter.
 * @param designIndex - The design index to retrieve eyes position.
 * @returns The altered design with sunglasses applied.
 */
export function applyBlackSunglasses(design: number[][], designIndex: number): number[][] {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, blackSunglassesPattern);
}

/**
 * Applies black sunglasses to the design (glasses where you can see 1px of the eyes).
 * @param design - The design to alter.
 * @param designIndex - The design index to retrieve eyes position.
 * @returns The altered design with sunglasses applied.
 */
export function applyLaserEyesBlackSunglasses(design: number[][], designIndex: number): number[][] {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, laserEyesBlackSunglassesPattern);
}

/**
 * Applies cool sunglasses to the design (completely opaque glasses).
 * @param design - The design to alter.
 * @param designIndex - The design index to retrieve eyes position.
 * @returns The altered design with sunglasses applied.
 */
export function applyCoolSunglasses(design: number[][], designIndex: number): number[][] {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, coolSunglassesPattern);
}

/**
 * Applies cool sunglasses to the design (glasses where you can see 1px of the eyes).
 * @param design - The design to alter.
 * @param designIndex - The design index to retrieve eyes position.
 * @returns The altered design with sunglasses applied.
 */
export function applyLaserEyesCoolSunglasses(design: number[][], designIndex: number): number[][] {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, laserEyesCoolSunglassesPattern);
}

/**
 * Applies 3D glasses to the design (completely opaque glasses).
 * @param design - The design to alter.
 * @param designIndex - The design index to retrieve eyes position.
 * @returns The altered design with 3D glasses applied.
 */
export function applyThreeDimensionsGlasses(design: number[][], designIndex: number): number[][] {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, threeDimensionsGlassesPattern);
}

/**
 * Applies nouns-inspired glasses to the design (completely opaque glasses).
 * @param design - The design to alter.
 * @param designIndex - The design index to retrieve eyes position.
 * @returns The altered design with nouns glasses applied.
 */
export function applyNounsGlasses(design: number[][], designIndex: number): number[][] {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, nounsGlassesPattern);
}

