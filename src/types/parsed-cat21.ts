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
   * The gender (sex) of a cat.
   * There is a 50% chance to receive a female cat.
   * Female cats have a inverted color palette, so that it's easy to identify them.
   *
   * see https://github.com/cryptocopycats/awesome-mooncatrescue-bubble/blob/master/COLORS.md
   */
  gender: 'male' | 'female';

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
   * The laser eyes trait. All cats have laser eyes.
   *
   * There is a ~10% chance to receive a cat with orange laser eyes.
   * There is a ~20% chance to receive a cat with red laser eyes.
   * There is a ~30% chance to receive a cat with green laser eyes.
   * There is a ~40% chance to receive a cat with blue laser eyes.
   */
  laserEyes: 'orange' | 'red' | 'green' | 'blue';

  /**
   * The background trait. All images have a background color.
   * There is a ~10% chance to receive a cat with a Block 9 background.
   * There is a ~20% chance to receive a cat with a cyberpunk background.
   * There is a ~30% chance to receive a cat with a background of the Bitcoin Whitepaper.
   * There is a ~40% chance to receive a cat with an orange background.
   * The orange color is #ff9900.
   */
  background: 'block9' | 'cyberpunk' | 'whitepaper' | 'orange';

  /**
   * The crown trait.
   * There is a ~10% chance to receive a cat with a crown.
   * The crown is golden when the background is not orange.
   * The crown is made of diamonds if the background is orange.
   */
  crown: 'gold' | 'diamond' | 'none';
}

export interface ParsedCat21 extends DigitalArtifact {

  /**
   * Returns the block hash if the transaction is confirmed, or `null` if the transaction is still unconfirmed
   */
  blockId: string | null;

  /**
   * Returns the final cat SVG image for confirmed transactions
   * or the official placeholder image if the transaction is still unconfirmed
   */
  getImage: () => string;

  /**
   * Returns the cat's traits
   */
  getTraits: () => CatTraits | null;
}

