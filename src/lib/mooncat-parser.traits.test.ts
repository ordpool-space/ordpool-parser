import { alterDesign, decodeTraits, eyesOffset, laserEyesPattern } from "./mooncat-parser.traits";

// extracted from here:
// https://github.com/cryptocopycats/awesome-mooncatrescue-bubble/blob/master/DESIGNS.md
export const expectedMooncatDesignsToTraits: [
  number,
  'Standing' | 'Sleeping' | 'Pouncing' | 'Stalking',  // Pose
  'Smile' | 'Grumpy' | 'Pouting' | 'Shy', // Expression
  'Solid' | 'Striped' | 'Eyepatch' | 'Half/Half', // Pattern
  'Left' | 'Right' // Facing
][] = [
  [0, 'Standing', 'Smile', 'Solid', 'Left'],
  [4, 'Standing', 'Smile', 'Striped', 'Left'],
  [8, 'Standing', 'Smile', 'Eyepatch', 'Left'],
  [12, 'Standing', 'Smile', 'Half/Half', 'Left'],
  [16, 'Standing', 'Grumpy', 'Solid', 'Left'],
  [20, 'Standing', 'Grumpy', 'Striped', 'Left'],
  [24, 'Standing', 'Grumpy', 'Eyepatch', 'Left'],
  [28, 'Standing', 'Grumpy', 'Half/Half', 'Left'],
  [32, 'Standing', 'Pouting', 'Solid', 'Left'],
  [36, 'Standing', 'Pouting', 'Striped', 'Left'],
  [40, 'Standing', 'Pouting', 'Eyepatch', 'Left'],
  [44, 'Standing', 'Pouting', 'Half/Half', 'Left'],
  [48, 'Standing', 'Shy', 'Solid', 'Left'],
  [52, 'Standing', 'Shy', 'Striped', 'Left'],
  [56, 'Standing', 'Shy', 'Eyepatch', 'Left'],
  [60, 'Standing', 'Shy', 'Half/Half', 'Left'],
  [64, 'Standing', 'Smile', 'Solid', 'Right'],
  [68, 'Standing', 'Smile', 'Striped', 'Right'],
  [72, 'Standing', 'Smile', 'Eyepatch', 'Right'],
  [76, 'Standing', 'Smile', 'Half/Half', 'Right'],
  [80, 'Standing', 'Grumpy', 'Solid', 'Right'],
  [84, 'Standing', 'Grumpy', 'Striped', 'Right'],
  [88, 'Standing', 'Grumpy', 'Eyepatch', 'Right'],
  [92, 'Standing', 'Grumpy', 'Half/Half', 'Right'],
  [96, 'Standing', 'Pouting', 'Solid', 'Right'],
  [100, 'Standing', 'Pouting', 'Striped', 'Right'],
  [104, 'Standing', 'Pouting', 'Eyepatch', 'Right'],
  [108, 'Standing', 'Pouting', 'Half/Half', 'Right'],
  [112, 'Standing', 'Shy', 'Solid', 'Right'],
  [116, 'Standing', 'Shy', 'Striped', 'Right'],
  [120, 'Standing', 'Shy', 'Eyepatch', 'Right'],
  [124, 'Standing', 'Shy', 'Half/Half', 'Right'],

  [1, 'Sleeping', 'Smile', 'Solid', 'Left'],
  [5, 'Sleeping', 'Smile', 'Striped', 'Left'],
  [9, 'Sleeping', 'Smile', 'Eyepatch', 'Left'],
  [13, 'Sleeping', 'Smile', 'Half/Half', 'Left'],
  [17, 'Sleeping', 'Grumpy', 'Solid', 'Left'],
  [21, 'Sleeping', 'Grumpy', 'Striped', 'Left'],
  [25, 'Sleeping', 'Grumpy', 'Eyepatch', 'Left'],
  [29, 'Sleeping', 'Grumpy', 'Half/Half', 'Left'],
  [33, 'Sleeping', 'Pouting', 'Solid', 'Left'],
  [37, 'Sleeping', 'Pouting', 'Striped', 'Left'],
  [41, 'Sleeping', 'Pouting', 'Eyepatch', 'Left'],
  [45, 'Sleeping', 'Pouting', 'Half/Half', 'Left'],
  [49, 'Sleeping', 'Shy', 'Solid', 'Left'],
  [53, 'Sleeping', 'Shy', 'Striped', 'Left'],
  [57, 'Sleeping', 'Shy', 'Eyepatch', 'Left'],
  [61, 'Sleeping', 'Shy', 'Half/Half', 'Left'],
  [65, 'Sleeping', 'Smile', 'Solid', 'Right'],
  [69, 'Sleeping', 'Smile', 'Striped', 'Right'],
  [73, 'Sleeping', 'Smile', 'Eyepatch', 'Right'],
  [77, 'Sleeping', 'Smile', 'Half/Half', 'Right'],
  [81, 'Sleeping', 'Grumpy', 'Solid', 'Right'],
  [85, 'Sleeping', 'Grumpy', 'Striped', 'Right'],
  [89, 'Sleeping', 'Grumpy', 'Eyepatch', 'Right'],
  [93, 'Sleeping', 'Grumpy', 'Half/Half', 'Right'],
  [97, 'Sleeping', 'Pouting', 'Solid', 'Right'],
  [101, 'Sleeping', 'Pouting', 'Striped', 'Right'],
  [105, 'Sleeping', 'Pouting', 'Eyepatch', 'Right'],
  [109, 'Sleeping', 'Pouting', 'Half/Half', 'Right'],
  [113, 'Sleeping', 'Shy', 'Solid', 'Right'],
  [117, 'Sleeping', 'Shy', 'Striped', 'Right'],
  [121, 'Sleeping', 'Shy', 'Eyepatch', 'Right'],
  [125, 'Sleeping', 'Shy', 'Half/Half', 'Right'],

  [2, 'Pouncing', 'Smile', 'Solid', 'Left'],
  [6, 'Pouncing', 'Smile', 'Striped', 'Left'],
  [10, 'Pouncing', 'Smile', 'Eyepatch', 'Left'],
  [14, 'Pouncing', 'Smile', 'Half/Half', 'Left'],
  [18, 'Pouncing', 'Grumpy', 'Solid', 'Left'],
  [22, 'Pouncing', 'Grumpy', 'Striped', 'Left'],
  [26, 'Pouncing', 'Grumpy', 'Eyepatch', 'Left'],
  [30, 'Pouncing', 'Grumpy', 'Half/Half', 'Left'],
  [34, 'Pouncing', 'Pouting', 'Solid', 'Left'],
  [38, 'Pouncing', 'Pouting', 'Striped', 'Left'],
  [42, 'Pouncing', 'Pouting', 'Eyepatch', 'Left'],
  [46, 'Pouncing', 'Pouting', 'Half/Half', 'Left'],
  [50, 'Pouncing', 'Shy', 'Solid', 'Left'],
  [54, 'Pouncing', 'Shy', 'Striped', 'Left'],
  [58, 'Pouncing', 'Shy', 'Eyepatch', 'Left'],
  [62, 'Pouncing', 'Shy', 'Half/Half', 'Left'],
  [66, 'Pouncing', 'Smile', 'Solid', 'Right'],
  [70, 'Pouncing', 'Smile', 'Striped', 'Right'],
  [74, 'Pouncing', 'Smile', 'Eyepatch', 'Right'],
  [78, 'Pouncing', 'Smile', 'Half/Half', 'Right'],
  [82, 'Pouncing', 'Grumpy', 'Solid', 'Right'],
  [86, 'Pouncing', 'Grumpy', 'Striped', 'Right'],
  [90, 'Pouncing', 'Grumpy', 'Eyepatch', 'Right'],
  [94, 'Pouncing', 'Grumpy', 'Half/Half', 'Right'],
  [98, 'Pouncing', 'Pouting', 'Solid', 'Right'],
  [102, 'Pouncing', 'Pouting', 'Striped', 'Right'],
  [106, 'Pouncing', 'Pouting', 'Eyepatch', 'Right'],
  [110, 'Pouncing', 'Pouting', 'Half/Half', 'Right'],
  [114, 'Pouncing', 'Shy', 'Solid', 'Right'],
  [118, 'Pouncing', 'Shy', 'Striped', 'Right'],
  [122, 'Pouncing', 'Shy', 'Eyepatch', 'Right'],
  [126, 'Pouncing', 'Shy', 'Half/Half', 'Right'],

  [3, 'Stalking', 'Smile', 'Solid', 'Left'],
  [7, 'Stalking', 'Smile', 'Striped', 'Left'],
  [11, 'Stalking', 'Smile', 'Eyepatch', 'Left'],
  [15, 'Stalking', 'Smile', 'Half/Half', 'Left'],
  [19, 'Stalking', 'Grumpy', 'Solid', 'Left'],
  [23, 'Stalking', 'Grumpy', 'Striped', 'Left'],
  [27, 'Stalking', 'Grumpy', 'Eyepatch', 'Left'],
  [31, 'Stalking', 'Grumpy', 'Half/Half', 'Left'],
  [35, 'Stalking', 'Pouting', 'Solid', 'Left'],
  [39, 'Stalking', 'Pouting', 'Striped', 'Left'],
  [43, 'Stalking', 'Pouting', 'Eyepatch', 'Left'],
  [47, 'Stalking', 'Pouting', 'Half/Half', 'Left'],
  [51, 'Stalking', 'Shy', 'Solid', 'Left'],
  [55, 'Stalking', 'Shy', 'Striped', 'Left'],
  [59, 'Stalking', 'Shy', 'Eyepatch', 'Left'],
  [63, 'Stalking', 'Shy', 'Half/Half', 'Left'],
  [67, 'Stalking', 'Smile', 'Solid', 'Right'],
  [71, 'Stalking', 'Smile', 'Striped', 'Right'],
  [75, 'Stalking', 'Smile', 'Eyepatch', 'Right'],
  [79, 'Stalking', 'Smile', 'Half/Half', 'Right'],
  [83, 'Stalking', 'Grumpy', 'Solid', 'Right'],
  [87, 'Stalking', 'Grumpy', 'Striped', 'Right'],
  [91, 'Stalking', 'Grumpy', 'Eyepatch', 'Right'],
  [95, 'Stalking', 'Grumpy', 'Half/Half', 'Right'],
  [99, 'Stalking', 'Pouting', 'Solid', 'Right'],
  [103, 'Stalking', 'Pouting', 'Striped', 'Right'],
  [107, 'Stalking', 'Pouting', 'Eyepatch', 'Right'],
  [111, 'Stalking', 'Pouting', 'Half/Half', 'Right'],
  [115, 'Stalking', 'Shy', 'Solid', 'Right'],
  [119, 'Stalking', 'Shy', 'Striped', 'Right'],
  [123, 'Stalking', 'Shy', 'Eyepatch', 'Right'],
  [127, 'Stalking', 'Shy', 'Half/Half', 'Right']
];

describe('decodeTraits', () => {
  it('should correctly decode all mooncat traits', () => {
    expectedMooncatDesignsToTraits.forEach((expectedTraits) => {
      
      const designIndex = expectedTraits[0];
      const decodedTraits = decodeTraits(designIndex);

      const actualTraits = [
        designIndex,
        decodedTraits.pose,
        decodedTraits.expression,
        decodedTraits.pattern,
        decodedTraits.facing,
      ];

      expect(actualTraits).toEqual(expectedTraits);
    });
  });
});

describe('alterDesign function', () => {

  it('should correctly apply the laserEyesPattern to a cat design', () => {

    // cat 0 (Standing)
    const beforeDesign = [
      [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
      [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
      [1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
      [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 0, 1, 3, 1],
      [1, 3, 3, 4, 3, 5, 3, 4, 3, 3, 1, 3, 3, 3, 3, 3, 1, 0, 1, 3, 1],
      [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 3, 3, 3, 1, 1, 1, 3, 1],
      [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
      [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 0],
      [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0],
      [0, 0, 1, 3, 3, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 3, 3, 1, 3, 3, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]
    ];

    // cat 0 with laser eyes (color 6 and 7)
    const afterDesign = [
      [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
      [1, 3, 3, 6, 3, 3, 3, 6, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
      [1, 3, 6, 7, 6, 3, 6, 7, 6, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
      [1, 3, 3, 6, 3, 3, 3, 6, 3, 3, 1, 3, 3, 3, 3, 1, 1, 0, 1, 3, 1],
      [1, 3, 3, 4, 3, 5, 3, 4, 3, 3, 1, 3, 3, 3, 3, 3, 1, 0, 1, 3, 1],
      [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 3, 3, 3, 1, 1, 1, 3, 1],
      [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
      [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 0],
      [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0],
      [0, 0, 1, 3, 3, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 3, 3, 1, 3, 3, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]
    ];

    const headOffset = [4, 2];
    const result = alterDesign(beforeDesign, headOffset, laserEyesPattern);

    expect(result).toEqual(afterDesign);
  });
});