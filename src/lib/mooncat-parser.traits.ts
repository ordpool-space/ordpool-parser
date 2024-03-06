

export const eyePositions = [
  {
    traits: 'Standing-Left',
    position:  [4, 2]
  },
  {
    traits: 'Sleeping-Left',
    position:  [4, 3]
  },
  {
    traits: 'Pouncing-Left',
    position:  [4, 3]
  },
  {
    traits: 'Stalking-Left',
    position: [10, 2]
  },
  {
    traits: 'Standing-Right',
    position:  [4, 12]
  },
  {
    traits: 'Sleeping-Right',
    position:  [4, 10]
  },
  {
    traits: 'Pouncing-Right',
    position:  [4, 7]
  },
  {
    traits: 'Stalking-Right',
    position: [10, 11]
  }
]

export const laserEyesPattern = [
  [0,6,0,0,0,6,0],
  [6,7,6,0,6,7,6],
  [0,6,0,0,0,6,0]
];


/**
 * Decodes the traits for a given Mooncat design index, translating numerical values into trait descriptions.
 * This function mirrors the logic used in the original Ruby implementation, applying operations to extract
 * pose, expression, pattern, and facing direction from the design index.
 *
 * @param {number} designIndex - The design index (0-127) representing specific traits of a Mooncat.
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
      if (designRow < alteredDesign.length && designColumn < alteredDesign[designRow].length) {
        // Only apply non-zero values from the new pattern
        if (newPattern[row][column] > 0) {
          alteredDesign[designRow][designColumn] = newPattern[row][column];
        }
      }
    }
  }
  return alteredDesign;
}

export function applyLaserEyes(design: number[][], designIndex: number): number[][] {

  const traits = decodeTraits(designIndex);
  const poseFacingKey = `${traits.pose}-${traits.facing}`;
  const eyePosition = eyePositions.find(x => x.traits == poseFacingKey);

  // ignore missing data (should never happeN)
  if (!eyePosition) {
    return design;
  }

  return alterDesign(design, eyePosition.position, laserEyesPattern)
}