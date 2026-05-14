import { DigitalArtifact } from './digital-artifact';
import { parseProtocolJson } from './parsed-protocol';

/**
 * SRC-721: Composable layered NFTs on Bitcoin Stamps.
 *
 * SRC-721 stamps reference other stamps by ID to compose layered images.
 * The JSON payload specifies which stamps to layer and in what order.
 *
 * Example: {"p":"src-721","op":"mint","c":"A1473703777372088053","ts":[1,4,8,4,5,4,7,0,6,6]}
 *
 * Encoded via OLGA P2WSH (raw JSON in P2WSH outputs, no stamp: prefix).
 */
export interface ParsedSrc721 extends DigitalArtifact {

  /**
   * The raw JSON content string.
   */
  getContent: () => string;
}

// -- Structured types for SRC-721 content validation --

export type Src721Operation = 'deploy' | 'mint';

export interface Src721Deploy {
  p: 'src-721';
  op: 'deploy';
  // Collection symbol. Canonical accepts either `tick` or legacy `symbol`
  // (index_core/src721.py:40-41 renames `symbol` -> `tick`). We accept both.
  tick?: string;
  symbol?: string;
  name?: string;
  description?: string;
  website?: string;
  // Recursive-collection version marker ("r0"). Optional.
  v?: string | number;
}

export interface Src721Mint {
  p: 'src-721';
  op: 'mint';
  // Collection id reference. Required by canonical mint path
  // (create_src721_mint_svg).
  c?: string;
  // Layer indices into the deploy's trait pools.
  ts?: unknown;
}

export type Src721Parsed = Src721Deploy | Src721Mint;

/**
 * Flaw types for invalid SRC-721 transactions. Cenotaph-style: a parseable
 * SRC-721-shaped JSON with non-empty flaws is recorded as a stamp but not
 * promoted to ordpool_src721 in the flag set.
 */
export type Src721Flaw =
  | 'unknown_op'        // op is missing or not in {deploy, mint}
  | 'missing_collection_symbol'  // deploy without tick/symbol
  | 'missing_collection_id';     // mint without c

const SRC721_OPS = ['deploy', 'mint'] as const;

/**
 * Parses raw SRC-721 JSON content into a typed object. Liberal -- accepts
 * anything with p:'src-721' and a known op. Lowercase only (canonical
 * src721.py uppercases for compare, the spec examples are lowercase).
 */
export function parseSrc721Content(content: string): Src721Parsed | null {
  return parseProtocolJson<Src721Parsed>(content, 'src-721', SRC721_OPS);
}

/**
 * Validates a parsed SRC-721 object and returns a list of flaws.
 * Empty array = valid SRC-721. Non-empty = parseable but structurally invalid;
 * caller should NOT set the ordpool_src721 flag in that case.
 *
 * Mirrors what canonical's validate_src721_and_process actually gates on
 * (op + structural minimum). We deliberately do NOT replicate canonical's
 * downstream business rules (does the referenced collection exist on chain,
 * does the deploy have a parent stamp, etc.) -- those depend on indexed state.
 */
export function getSrc721Flaws(parsed: Src721Parsed): Src721Flaw[] {
  const flaws: Src721Flaw[] = [];

  if (parsed.op !== 'deploy' && parsed.op !== 'mint') {
    flaws.push('unknown_op');
    return flaws;
  }

  if (parsed.op === 'deploy') {
    const deploy = parsed as Src721Deploy;
    // Canonical accepts `tick` or legacy `symbol`. Require at least one
    // non-empty string -- otherwise the deploy has no identity at all.
    const tickStr = typeof deploy.tick === 'string' ? deploy.tick.trim() : '';
    const symbolStr = typeof deploy.symbol === 'string' ? deploy.symbol.trim() : '';
    if (!tickStr && !symbolStr) {
      flaws.push('missing_collection_symbol');
    }
  }

  if (parsed.op === 'mint') {
    const mint = parsed as Src721Mint;
    // Mints reference a deploy via `c`. Without it, the canonical mint path
    // can't render anything and won't accept the stamp.
    if (typeof mint.c !== 'string' || mint.c.trim() === '') {
      flaws.push('missing_collection_id');
    }
  }

  return flaws;
}
