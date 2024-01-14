import { DigitalArtifact } from "./digital-artifact";

export interface CatTraits {

  /**
   * The super rare genesis trait. Genesis cats are white or black, and have no bright colors.
   * Probability: ~0.4%
   */
  genesis: boolean;

  /**
   * All colors (or shades of gray for genesis cats) that are used to paint the cat.
   * (colors of the laser eyes are not included)
   *
   * The genesis cats are always:
   * "#555555", "#d3d3d3", "#ffffff", "#aaaaaa", "#ff9999"
   * or
   * "#555555", "#222222", "#111111", "#bbbbbb", "#ff9999"
   *
   * see https://github.com/cryptocopycats/awesome-mooncatrescue-bubble/blob/master/COLORS.md
   */
  colors: string[];

  /**
   * Inverted cats have a inverted color palette.
   * There is a 50% chance to receive an inverted cat.
   *
   * see https://github.com/cryptocopycats/awesome-mooncatrescue-bubble/blob/master/COLORS.md
   */
  inverted: boolean;

  /**
   * One of the 128 designs (from 0 to 127)
   * The design is a combination of the following traits:
   *
   * Pose: 'Standing' | 'Sleeping' | 'Pouncing' | 'Stalking'
   * Facing: 'Left' | 'Right'
   * Pattern: 'Solid' | 'Striped' | 'Eyepatch' | 'Half/Half'
   * Expression: 'Smile' | 'Grumpy' | 'Pouting' | 'Shy'
   *
   * see https://github.com/cryptocopycats/awesome-mooncatrescue-bubble/blob/master/DESIGNS.md
   * see https://github.com/cryptocopycats/awesome-mooncatrescue-bubble/blob/master/TRAITS.md
   */
  designIndex: number;
  designPose: 'Standing' | 'Sleeping' | 'Pouncing' | 'Stalking',
  designExpression: 'Smile' | 'Grumpy' | 'Pouting' | 'Shy',
  designPattern: 'Solid' | 'Striped' | 'Eyepatch' | 'Half/Half',
  designFacing: 'Left' | 'Right',

  /**
   * The laser eyes trait.
   * There is a ~10% chance to receive a cat with red laser eyes.
   * There is a ~10% chance to receive a cat with green laser eyes.
   * There is a ~10% chance to receive a cat with blue laser eyes.
   */
  laserEyes: 'red' | 'green' | 'blue' | 'none';

  /**
   * The orange background trait.
   * There is a ~10% chance to receive a cat with an orange background instead of an transparent background.
   * The orange color is #ff9900, because this is the only true orange Bitcoin color!
   */
  orangeBackground: boolean;
}

export interface ParsedCat21 extends DigitalArtifact {

  /**
   * Returns the cat SVG image
   */
  getImage: () => string;

  /**
   * Returns the cat's traits
   */
  getTraits: () => CatTraits;
}

