/**
 * OpenRarity scoring — TypeScript port.
 *
 * Faithful port of the algorithm from ProjectOpenSea/open-rarity (Python),
 * the de-facto NFT rarity standard from 2022. Computes per-token rarity
 * scores using information content (Shannon surprisal) of each token's
 * attributes, normalized by the collection's attribute entropy.
 *
 * Zero dependencies. The math is `Math.log2` and array reductions.
 *
 * ## Algorithm
 *
 * For a collection of tokens, each with a record of `attr → value`:
 *
 *   1. Synthesize a `meta_trait:trait_count` attribute on each token,
 *      counting its non-empty, non-"none" attribute values. Adds a new
 *      dimension that rewards tokens with more populated traits.
 *   2. For each attribute the collection has, count value frequencies
 *      and synthesize a `Null` entry for tokens missing it.
 *   3. For each token, sum `-log₂(p_i)` over its attributes (sorted
 *      alphabetically), where `p_i = count_with_value / total_tokens`.
 *      This is the token's raw "bits".
 *   4. Compute collection entropy `H = -Σ p · log₂(p)` over every
 *      (attribute, value) pair (including synthesized `Null`).
 *   5. Token score = `bits / H` (or `bits / 1` if `H == 0`, the
 *      single-token edge case).
 *   6. Rank tokens by `(uniqueAttrCount DESC, score DESC)`. Cats with
 *      the same score share a rank.
 *
 * ## Semantics worth knowing
 *
 * - Values `""` and `"none"` (case-insensitive, trimmed) don't count
 *   toward `trait_count` — they're treated as "absent" for that
 *   purpose only. They still show up as their own buckets in
 *   frequency counts otherwise.
 * - Tokens missing an attribute another token has get a synthesized
 *   `Null` value with count = `tokens_without_attr`. So a token without
 *   `crown` in a collection where 95% have a crown contributes
 *   `-log₂(0.05) ≈ 4.32` bits from that attribute.
 * - The trait_count attribute is INCLUDED in unique-count detection
 *   (matches OpenRarity's Python behaviour).
 * - The synthesized null value uses the literal string `"Null"`. Don't
 *   pass that as a real attribute value — it would collide.
 * - The trait_count uses the literal string key
 *   `"meta_trait:trait_count"` for the same reason: chosen to be
 *   unlikely to collide with real attribute names.
 *
 * Faithful to OpenRarity's choices, including the controversial trait-
 * count synthesis. Critics argue it amplifies rarity that's already
 * implicit; the upstream authors chose to keep it because markets had
 * already started using it as a primary signal. We port it for parity.
 */

/** Synthesized attribute key — prefixed to avoid collision with real attrs. */
export const TRAIT_COUNT_ATTR = 'meta_trait:trait_count';

/** Synthesized value used when a token doesn't carry an attribute the
 *  collection has. Token cannot legitimately use this exact string as a
 *  real attribute value or it'll collide with the synthesized entry. */
export const NULL_VALUE = 'Null';

/** Values that don't count toward `trait_count` — match OpenRarity's Python
 *  `normalize_attribute_string(v) in ('none', '')` check. Case-insensitive,
 *  whitespace-trimmed. */
const EMPTY_FOR_TRAIT_COUNT = new Set(['none', '']);

/** Tolerance used to decide score ties (matches Python `math.isclose` default). */
const SCORE_TIE_REL_TOL = 1e-9;

export interface RarityToken<TId = string> {
  /** Caller-supplied identifier. Returned unchanged in `ScoredToken.id`. */
  id: TId;
  /** Attribute name → value. Strings only; case-sensitive (we don't
   *  normalize input — preserve what the caller passed in). */
  attrs: Record<string, string>;
}

export interface ScoredToken<TId = string> {
  id: TId;
  /** Raw information content sum, `Σ -log₂(p_i)`. Display this as "23.4 bits". */
  bits: number;
  /** Normalized score `bits / collectionEntropy`. Same ranks as `bits`,
   *  but more meaningful as a cross-collection number. */
  score: number;
  /** 1-based rank within the collection. When a `tiebreaker` is
   *  supplied, ranks are a strict total ordering (1, 2, 3, …, n).
   *  Without one, identical scores share a rank. */
  rank: number;
  /** Number of attributes whose value occurs exactly once in the collection. */
  uniqueAttrCount: number;
}

export interface ScoreAndRankOptions<TId = string> {
  /**
   * Optional deterministic tiebreaker. Applied when two tokens land on
   * the same `(uniqueAttrCount, score)`. Same shape as `Array.sort`'s
   * comparator: return negative if `a` should rank higher, positive if
   * `b` should rank higher. Returning 0 leaves the rank-tied behaviour
   * intact for that pair.
   *
   * When provided, identical-score tokens get distinct ranks instead
   * of a shared rank — the strict total ordering means there are no
   * ties at all. This is an extension to OpenRarity's reference
   * algorithm, useful when the caller has a natural seniority key
   * (mint order, ordinal number, etc.).
   *
   * Example for cat21: `(a, b) => a - b` — lower `catNumber` wins.
   */
  tiebreaker?: (a: TId, b: TId) => number;
}

/**
 * Score and rank a collection of tokens. The input is not mutated; the
 * returned array is sorted by rank ascending (rarest first).
 *
 * Empty collection → empty array. Single token → score 0, rank 1.
 */
export function scoreAndRank<TId = string>(
  inputTokens: readonly RarityToken<TId>[],
  options?: ScoreAndRankOptions<TId>,
): ScoredToken<TId>[] {
  if (inputTokens.length === 0) return [];
  const tiebreaker = options?.tiebreaker;

  // Step 1: clone + inject trait_count. Avoids mutating caller input.
  const tokens = withTraitCount(inputTokens);
  const totalSupply = tokens.length;

  // Step 2: frequency table over the (now-augmented) tokens.
  const freq = buildFreqCounts(tokens);
  const nullAttrs = extractNullAttributes(freq, totalSupply);

  // Step 4: collection entropy.
  const entropy = collectionEntropy(freq, nullAttrs, totalSupply);
  const divisor = entropy || 1; // single-token edge case: 0/1 = 0.

  // Steps 3 + 5: per-token IC and normalized score.
  const features = tokens.map((t) => {
    const bits = tokenInformationContent(t, freq, nullAttrs, totalSupply);
    const score = bits / divisor;
    const uniqueAttrCount = tokenUniqueAttrCount(t, freq);
    return { id: t.id, bits, score, uniqueAttrCount };
  });

  // Step 6: sort by (uniqueAttrCount DESC, score DESC), then apply the
  // caller's tiebreaker if any. Without a tiebreaker, identical-score
  // tokens keep their input order (Array.sort is stable in modern JS)
  // and the rank-assignment loop merges them into shared ranks. With a
  // tiebreaker, the comparator imposes a strict total order, so ranks
  // are assigned 1..n without merging.
  features.sort((a, b) => {
    const byUnique = b.uniqueAttrCount - a.uniqueAttrCount;
    if (byUnique !== 0) return byUnique;
    const byScore = b.score - a.score;
    if (byScore !== 0) return byScore;
    return tiebreaker ? tiebreaker(a.id, b.id) : 0;
  });

  const ranked: ScoredToken<TId>[] = [];
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    let rank = i + 1;
    if (i > 0 && !tiebreaker) {
      const prev = ranked[i - 1];
      if (scoresClose(f.score, prev.score)) {
        rank = prev.rank;
      }
    }
    ranked.push({
      id: f.id,
      bits: f.bits,
      score: f.score,
      rank,
      uniqueAttrCount: f.uniqueAttrCount,
    });
  }
  return ranked;
}

// -- Internals ----------------------------------------------------------------

function withTraitCount<TId>(
  tokens: readonly RarityToken<TId>[],
): RarityToken<TId>[] {
  return tokens.map((t) => {
    let count = 0;
    for (const value of Object.values(t.attrs)) {
      if (!isEmptyForTraitCount(value)) count++;
    }
    // If a caller already supplied trait_count we'd double-inject.
    // Strip it first so the count we compute always wins.
    const { [TRAIT_COUNT_ATTR]: _drop, ...rest } = t.attrs;
    return {
      id: t.id,
      attrs: { ...rest, [TRAIT_COUNT_ATTR]: String(count) },
    };
  });
}

function isEmptyForTraitCount(value: string): boolean {
  return EMPTY_FOR_TRAIT_COUNT.has(value.toLowerCase().trim());
}

function buildFreqCounts<TId>(
  tokens: readonly RarityToken<TId>[],
): Record<string, Record<string, number>> {
  const freq: Record<string, Record<string, number>> = {};
  for (const t of tokens) {
    for (const [name, value] of Object.entries(t.attrs)) {
      (freq[name] ??= {})[value] = ((freq[name][value]) ?? 0) + 1;
    }
  }
  return freq;
}

/**
 * For each attribute the collection has, count how many tokens DON'T
 * carry it. Returns a map of `attrName → assets_without_trait`. Only
 * attributes with at least one missing token get an entry.
 */
function extractNullAttributes(
  freq: Record<string, Record<string, number>>,
  totalSupply: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [name, values] of Object.entries(freq)) {
    const sum = Object.values(values).reduce((a, b) => a + b, 0);
    const without = totalSupply - sum;
    if (without > 0) result[name] = without;
  }
  return result;
}

function collectionEntropy(
  freq: Record<string, Record<string, number>>,
  nullAttrs: Record<string, number>,
  totalSupply: number,
): number {
  // Flatten every (attr, value) into a probability and apply Shannon.
  let h = 0;
  for (const [name, values] of Object.entries(freq)) {
    for (const count of Object.values(values)) {
      const p = count / totalSupply;
      if (p > 0) h += p * Math.log2(p);
    }
    const nullCount = nullAttrs[name];
    if (nullCount !== undefined) {
      const p = nullCount / totalSupply;
      if (p > 0) h += p * Math.log2(p);
    }
  }
  return -h;
}

function tokenInformationContent<TId>(
  token: RarityToken<TId>,
  freq: Record<string, Record<string, number>>,
  nullAttrs: Record<string, number>,
  totalSupply: number,
): number {
  // Alphabetical iteration matches the Python `sorted(combined.keys())`
  // contract (pinned by `test_get_token_attributes_scores_and_weights_null_attributes`).
  // Order doesn't change the sum but it's load-bearing for any future
  // weighted variants we might add.
  const allAttrNames = Object.keys(freq).sort();
  let ic = 0;
  for (const name of allAttrNames) {
    const tokenValue = token.attrs[name];
    let count: number;
    if (tokenValue !== undefined) {
      count = freq[name][tokenValue];
    } else if (nullAttrs[name] !== undefined) {
      count = nullAttrs[name];
    } else {
      // Token doesn't have this attribute AND collection has no null
      // entry for it — meaning every other token has it but this one
      // doesn't, which would be a bug in nullAttrs construction. Skip
      // defensively.
      continue;
    }
    if (count > 0) {
      const p = count / totalSupply;
      ic += -Math.log2(p);
    }
  }
  return ic;
}

function tokenUniqueAttrCount<TId>(
  token: RarityToken<TId>,
  freq: Record<string, Record<string, number>>,
): number {
  let n = 0;
  for (const [name, value] of Object.entries(token.attrs)) {
    if (freq[name]?.[value] === 1) n++;
  }
  return n;
}

function scoresClose(a: number, b: number): boolean {
  // math.isclose default: rel_tol=1e-9, abs_tol=0
  return Math.abs(a - b) <= SCORE_TIE_REL_TOL * Math.max(Math.abs(a), Math.abs(b));
}
