/**
 * Standalone CAT-21 cat SVG generator bundle.
 *
 * Usage (ESM):
 *   import { createCatHash, MooncatParser } from './cat21.js';
 *   const hash = createCatHash(txid, blockId);
 *   const { svg, traits } = MooncatParser.parseAndGenerateSvg(hash, feeRate);
 *
 * Usage (IIFE):
 *   const hash = Cat21.createCatHash(txid, blockId);
 *   const { svg, traits } = Cat21.MooncatParser.parseAndGenerateSvg(hash, feeRate);
 */
export { Cat21ParserService } from './cat21-parser.service';
export { createCatHash } from './cat21-parser.service.helper';
export { MooncatParser } from './mooncat-parser';
export { feeRateToColor } from './mooncat-parser.colors';
export type { CatTraits, ParsedCat21 } from '../types/parsed-cat21';
