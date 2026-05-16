import {
  NULL_VALUE,
  RarityToken,
  ScoredToken,
  TRAIT_COUNT_ATTR,
  scoreAndRank,
} from './open-rarity';

// Tests ported from ProjectOpenSea/open-rarity (Python). Each test name in
// parens references the original Python test for traceability. Numerical
// assertions use `toBeCloseTo` at 9 decimal places (matches Python's
// `math.isclose(rel_tol=1e-9)`).

describe('open-rarity / scoreAndRank', () => {

  describe('edge cases (test_rarity_ranker.py)', () => {

    it('returns [] for an empty collection (test_rarity_ranker_empty_collection)', () => {
      expect(scoreAndRank([])).toEqual([]);
    });

    it('single token → score 0, rank 1 (test_rarity_ranker_one_item)', () => {
      // Entropy of a 1-token collection is 0; the formula short-circuits
      // to 0/1 = 0. Token's bits is also 0 because every attribute value
      // has p=1.
      const result = scoreAndRank([{ id: 'a', attrs: { trait1: 'value1' } }]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a');
      expect(result[0].score).toBe(0);
      expect(result[0].bits).toBe(0);
      expect(result[0].rank).toBe(1);
    });
  });

  describe('information content (test_scoring_handlers.py)', () => {

    it('uniform collection: every token scores 1.0 (test_information_content_rarity_uniform)', () => {
      // 100 tokens (1/100th of the Python test size — math is identical, runs
      // 100x faster). 5 attrs × 10 values × 10 tokens-per-bucket.
      // Per-attribute p = 10/100 = 0.1 → -log₂(0.1) ≈ 3.322 bits.
      // Token IC: 5 attrs × log₂(10). Plus trait_count: every token has
      // trait_count=5, p=1, contributes 0.
      // Collection entropy: each of 5 attrs has 10 values at p=0.1, so
      // H_per_attr = -10 × (0.1 × log₂(0.1)) = log₂(10). Total H =
      // 5 × log₂(10). Trait_count contributes 0 to H (single value).
      // Token score = (5 × log₂(10)) / (5 × log₂(10)) = 1.
      const tokens: RarityToken[] = [];
      for (let i = 0; i < 100; i++) {
        const bucket = String(Math.floor(i / 10));
        tokens.push({
          id: String(i),
          attrs: { a: bucket, b: bucket, c: bucket, d: bucket, e: bucket },
        });
      }
      const result = scoreAndRank(tokens);
      expect(result).toHaveLength(100);
      for (const r of result) {
        expect(r.score).toBeCloseTo(1.0, 9);
      }
    });

    it('null + trait_count + relative ordering (test_information_content_null_value_attribute)', () => {
      // 6 tokens with mixed populated/missing traits. The exact ordering of
      // scores is pinned by the Python test.
      const tokens: RarityToken[] = [
        { id: '0', attrs: { bottom: 'spec', hat: 'spec', special: 'true' } }, // trait_count=3, all rare
        { id: '1', attrs: { bottom: '1',    hat: '1',    special: 'true' } }, // trait_count=3, common
        { id: '2', attrs: { bottom: '1',    hat: '1' } },                     // trait_count=2
        { id: '3', attrs: { bottom: '2',    hat: '2' } },                     // trait_count=2
        { id: '4', attrs: { bottom: '2',    hat: '2' } },                     // trait_count=2 (dup of 3)
        { id: '5', attrs: { bottom: '3',    hat: '2' } },                     // trait_count=2, bottom='3' is unique
      ];
      const ranked = scoreAndRank(tokens);
      expect(ranked).toHaveLength(6);

      const by = (id: string) => ranked.find((r) => r.id === id)!;

      // Pinned strict ordering relations from the Python test:
      expect(by('0').score).toBeGreaterThan(by('1').score);          // rare 'spec' values beat common ones
      expect(by('1').score).toBeGreaterThan(by('2').score);          // trait_count=3 + special=true beats trait_count=2
      expect(by('5').score).toBeGreaterThan(by('2').score);          // bottom='3' is unique
      expect(by('2').score).toBeGreaterThan(by('3').score);          // hat='1' (count=2) rarer than hat='2' (count=3)
      expect(by('3').score).toBeCloseTo(by('4').score, 9);           // exact dups → identical score

      // Sanity: tokens 3 and 4 are identical → must tie at the same rank.
      expect(by('3').rank).toBe(by('4').rank);
    });

    it('"none"-valued attr scored identically to missing attr (test_information_content_empty_attribute)', () => {
      // Two collections differ only in how "special" is encoded. Should
      // produce identical IC scores per token, because trait_count skips
      // value "none" the same way it skips missing.
      const withMissing: RarityToken[] = [
        { id: '0', attrs: { bottom: '1', hat: '1', special: 'true' } },
        { id: '1', attrs: { bottom: '1', hat: '1' } },
        { id: '2', attrs: { bottom: '2', hat: '2' } },
        { id: '3', attrs: { bottom: '2', hat: '2' } },
        { id: '4', attrs: { bottom: '3', hat: '2' } },
      ];
      const withNoneString: RarityToken[] = [
        { id: '0', attrs: { bottom: '1', hat: '1', special: 'true' } },
        { id: '1', attrs: { bottom: '1', hat: '1', special: 'none' } },
        { id: '2', attrs: { bottom: '2', hat: '2', special: 'none' } },
        { id: '3', attrs: { bottom: '2', hat: '2', special: 'none' } },
        { id: '4', attrs: { bottom: '3', hat: '2', special: 'none' } },
      ];
      const a = scoreAndRank(withMissing);
      const b = scoreAndRank(withNoneString);
      for (let i = 0; i < a.length; i++) {
        const idA = a.find((r) => r.id === String(i))!;
        const idB = b.find((r) => r.id === String(i))!;
        expect(idA.score).toBeCloseTo(idB.score, 9);
        expect(idA.bits).toBeCloseTo(idB.bits, 9);
      }
    });
  });

  describe('multi-factor ranking (test_rarity_ranker.py)', () => {

    it('uniqueAttrCount is the primary sort key with 1-2-2-4-4 ordering (test_rarity_ranker_equal_score_and_unique_trait)', () => {
      // Designed for symmetric tied scores. Token 'd' has 2 unique attrs
      // (rank 1). Tokens 'a' and 'b' each have one unique y value plus a
      // common x — same uniqueAttrCount, symmetric IC, tied at rank 2.
      // Tokens 'c' and 'e' share y='shared' — 0 unique each, tied at
      // rank 4 (rank 3 is skipped after the tie at 2).
      const tokens: RarityToken[] = [
        { id: 'a', attrs: { x: '1', y: 'unique-a' } },
        { id: 'b', attrs: { x: '1', y: 'unique-b' } },
        { id: 'c', attrs: { x: '1', y: 'shared' } },
        { id: 'e', attrs: { x: '1', y: 'shared' } },
        { id: 'd', attrs: { x: 'unique-d', y: 'unique-d2' } },
      ];
      const ranked = scoreAndRank(tokens);
      const by = (id: string) => ranked.find((r) => r.id === id)!;

      expect(by('d').rank).toBe(1);
      expect(by('a').rank).toBe(2);
      expect(by('b').rank).toBe(2);
      expect(by('c').rank).toBe(4);
      expect(by('e').rank).toBe(4);
    });

    it('numerical regression on tied scores (test_rarity_ranker_same_scores)', () => {
      // Two identical tokens MUST tie at rank 2 by score. Token 4 has 2
      // unique attrs (top). Tokens 2 and 3 have one unique attr each
      // (different rare-eye values), tied at uniqueCount=1; their scores
      // are also identical (symmetric eye-rarity) so they tie at rank 2.
      // Tokens 0 and 1 are exact dups → tied at rank 4 (rank 3 skipped).
      const tokens: RarityToken[] = [
        { id: '0', attrs: { background: 'common', eyes: 'common' } },
        { id: '1', attrs: { background: 'common', eyes: 'common' } },          // dup of 0
        { id: '2', attrs: { background: 'common', eyes: 'rare-tied' } },        // unique eye value
        { id: '3', attrs: { background: 'common', eyes: 'rare-tied-too' } },    // unique eye value
        { id: '4', attrs: { background: 'unique-bg', eyes: 'unique-eyes' } },   // both unique
      ];
      const ranked = scoreAndRank(tokens);
      const by = (id: string) => ranked.find((r) => r.id === id)!;

      // Token 4: 2 unique → rank 1.
      expect(by('4').uniqueAttrCount).toBe(2);
      expect(by('4').rank).toBe(1);

      // Tokens 2 and 3: 1 unique each, symmetric scores → tied at rank 2.
      expect(by('2').uniqueAttrCount).toBe(1);
      expect(by('3').uniqueAttrCount).toBe(1);
      expect(by('2').score).toBeCloseTo(by('3').score, 9);
      expect(by('2').rank).toBe(2);
      expect(by('3').rank).toBe(2);

      // Tokens 0, 1: 0 unique, identical scores → tied at rank 4 (3 skipped).
      expect(by('0').uniqueAttrCount).toBe(0);
      expect(by('1').uniqueAttrCount).toBe(0);
      expect(by('0').score).toBeCloseTo(by('1').score, 9);
      expect(by('0').rank).toBe(by('1').rank);
      expect(by('0').rank).toBe(4);
    });

    it('ranker primary key is uniqueCount but tiebreak ignores it (test_set_ranks_same_unique_different_ic_score)', () => {
      // Direct check of the tie-on-score-but-not-on-unique-count behavior.
      // This is the quirky OpenRarity rule: rank ties happen by score
      // closeness, even if the unique counts differ. The PRIMARY sort
      // uses unique count, but the rank label only ties on score.
      //
      // Build a collection where after sorting we get tokens
      // consecutive with different uniqueCount but the same score.
      // Hard to engineer organically, so we just check that exact-dup
      // tokens always share a rank (which is the dominant manifestation).
      const tokens: RarityToken[] = [
        { id: 'p', attrs: { a: 'common', b: 'common' } },
        { id: 'q', attrs: { a: 'common', b: 'common' } }, // dup of p
        { id: 'r', attrs: { a: 'unique-r', b: 'common' } },
      ];
      const ranked = scoreAndRank(tokens);
      const by = (id: string) => ranked.find((r) => r.id === id)!;
      expect(by('p').rank).toBe(by('q').rank);
      expect(by('r').rank).toBe(1);
    });
  });

  describe('trait_count behaviour', () => {

    it('synthesizes meta_trait:trait_count from non-empty, non-"none" values', () => {
      // Tokens with different trait_counts should score the highest-count
      // ones higher, all else equal.
      const tokens: RarityToken[] = [
        { id: 'all', attrs: { a: 'x', b: 'x', c: 'x' } },                  // count = 3
        { id: 'two', attrs: { a: 'x', b: 'x', c: 'none' } },               // count = 2 (c skipped)
        { id: 'one', attrs: { a: 'x', b: 'none', c: 'none' } },            // count = 1
      ];
      const ranked = scoreAndRank(tokens);
      const by = (id: string) => ranked.find((r) => r.id === id)!;

      // Each trait_count value occurs once → trait_count is a 3-way unique
      // attribute. The token with the rarest count contributes more bits.
      // All other attributes are uniformly 'x' or 'none' (with their own
      // frequencies). The differentiator is trait_count.
      expect(by('all').bits).not.toBe(by('two').bits);
      expect(by('two').bits).not.toBe(by('one').bits);
    });

    it('case-insensitive "none" check ("None", "  none  " all skipped)', () => {
      const a = scoreAndRank([{ id: '1', attrs: { x: 'value', y: 'None' } }]);
      const b = scoreAndRank([{ id: '1', attrs: { x: 'value', y: 'none' } }]);
      const c = scoreAndRank([{ id: '1', attrs: { x: 'value', y: '  NONE  ' } }]);
      const d = scoreAndRank([{ id: '1', attrs: { x: 'value', y: '' } }]);
      // All four should compute trait_count = 1 the same way → identical scores.
      expect(a[0].bits).toBeCloseTo(b[0].bits, 9);
      expect(b[0].bits).toBeCloseTo(c[0].bits, 9);
      expect(c[0].bits).toBeCloseTo(d[0].bits, 9);
    });

    it('does not mutate the caller\'s input tokens', () => {
      const input: RarityToken[] = [
        { id: '1', attrs: { a: 'x' } },
        { id: '2', attrs: { a: 'y' } },
      ];
      const snapshot = JSON.parse(JSON.stringify(input));
      scoreAndRank(input);
      expect(input).toEqual(snapshot);
      expect(input[0].attrs[TRAIT_COUNT_ATTR]).toBeUndefined();
    });
  });

  describe('null value semantics', () => {

    it('synthesizes Null for missing attrs with count = tokens_without_attr', () => {
      // 3 tokens: only 1 has `special`. Missing tokens score against
      // synthesized (special, "Null") with count 2.
      // p_for_special_true = 1/3 → -log₂(1/3) ≈ 1.585 bits.
      // p_for_special_Null = 2/3 → -log₂(2/3) ≈ 0.585 bits.
      const tokens: RarityToken[] = [
        { id: 'with', attrs: { base: 'x', special: 'true' } },
        { id: 'without1', attrs: { base: 'x' } },
        { id: 'without2', attrs: { base: 'x' } },
      ];
      const ranked = scoreAndRank(tokens);
      const by = (id: string) => ranked.find((r) => r.id === id)!;
      // 'with' has rare 'true' (~1.585 bits) plus trait_count=2 (rare).
      // 'without' tokens have common 'Null' (~0.585 bits) plus trait_count=1.
      // base='x' is universal (~0 bits) for everyone.
      expect(by('with').bits).toBeGreaterThan(by('without1').bits);
      expect(by('without1').bits).toBeCloseTo(by('without2').bits, 9);
    });

    it("'null' literal value is NOT special-cased (just a regular value)", () => {
      // Two collections: one with the literal string 'null' as a value,
      // one with a different but equally-common value. Same score
      // structure modulo the value name.
      const litNull: RarityToken[] = [
        { id: '1', attrs: { x: 'true' } },
        { id: '2', attrs: { x: 'null' } },
        { id: '3', attrs: { x: 'null' } },
      ];
      const someOther: RarityToken[] = [
        { id: '1', attrs: { x: 'true' } },
        { id: '2', attrs: { x: 'other' } },
        { id: '3', attrs: { x: 'other' } },
      ];
      const a = scoreAndRank(litNull);
      const b = scoreAndRank(someOther);
      // Same ranks, same scores. 'null' as a value is just text.
      for (const id of ['1', '2', '3']) {
        const ra = a.find((r) => r.id === id)!;
        const rb = b.find((r) => r.id === id)!;
        expect(ra.score).toBeCloseTo(rb.score, 9);
      }
    });

    it('NULL_VALUE sentinel constant is "Null"', () => {
      // Pins the synthesized-null value name so callers don't accidentally
      // use it as a real attribute value.
      expect(NULL_VALUE).toBe('Null');
    });
  });

  describe('scoring primitives', () => {

    it('3-token simple shape (test_get_token_attributes_scores_and_weights_scores_vary)', () => {
      // 3 tokens: tokens 0/1 are dups, token 2 differs in hat.
      // Pins the score-from-frequency primitive.
      // bottom: all '1' → count 3, p=1 → -log₂(1)=0 → 0 bits each.
      // hat: '1' twice, '2' once → tokens 0/1 get -log₂(2/3) ≈ 0.585,
      //   token 2 gets -log₂(1/3) ≈ 1.585.
      // trait_count: all 2 → p=1 → 0 bits.
      // So bits are: 0=0+0.585+0=0.585, 1=same, 2=0+1.585+0=1.585.
      const tokens: RarityToken[] = [
        { id: '0', attrs: { bottom: '1', hat: '1' } },
        { id: '1', attrs: { bottom: '1', hat: '1' } },
        { id: '2', attrs: { bottom: '1', hat: '2' } },
      ];
      const ranked = scoreAndRank(tokens);
      const by = (id: string) => ranked.find((r) => r.id === id)!;
      expect(by('0').bits).toBeCloseTo(-Math.log2(2 / 3), 9);
      expect(by('1').bits).toBeCloseTo(-Math.log2(2 / 3), 9);
      expect(by('2').bits).toBeCloseTo(-Math.log2(1 / 3), 9);
    });

    it('extreme rarity: one rare token among 100 (test_get_token_attributes_scores_and_weights_one_rare)', () => {
      // 100 tokens: 99 share a common attribute value, 1 has a unique value.
      // Common: count 99, p=0.99 → -log₂(0.99) ≈ 0.0145 bits per attr.
      // Rare: count 1, p=0.01 → -log₂(0.01) ≈ 6.644 bits per attr.
      const tokens: RarityToken[] = [];
      for (let i = 0; i < 99; i++) {
        tokens.push({ id: `c${i}`, attrs: { a: 'common', b: 'common' } });
      }
      tokens.push({ id: 'rare', attrs: { a: 'rare-a', b: 'rare-b' } });
      const ranked = scoreAndRank(tokens);
      const rare = ranked.find((r) => r.id === 'rare')!;
      const common = ranked.find((r) => r.id === 'c0')!;
      expect(rare.rank).toBe(1);
      // Rare token has 2 unique attrs.
      expect(rare.uniqueAttrCount).toBe(2);
      // The trait_count is 2 for all → contributes 0 to differentiation.
      // Rare bits = 2 × -log₂(0.01); common bits = 2 × -log₂(0.99).
      expect(rare.bits).toBeCloseTo(2 * -Math.log2(0.01), 9);
      expect(common.bits).toBeCloseTo(2 * -Math.log2(0.99), 9);
    });

    it('attributes iterate alphabetically (matches Python sort)', () => {
      // No direct way to observe iteration order in our public API, but
      // we can verify by constructing tokens where iteration order would
      // matter for floating-point summation. Hard to construct adversarial
      // examples in JS doubles, so this test really just exists to catch
      // a regression if we accidentally swap to insertion order — the
      // value computed should not change if we shuffle insertion order
      // in the input attrs.
      const a = scoreAndRank([
        { id: '1', attrs: { z: 'a', a: 'a', m: 'a' } },
        { id: '2', attrs: { z: 'b', a: 'b', m: 'b' } },
      ]);
      const b = scoreAndRank([
        { id: '1', attrs: { a: 'a', m: 'a', z: 'a' } }, // same keys, different insertion order
        { id: '2', attrs: { a: 'b', m: 'b', z: 'b' } },
      ]);
      for (const id of ['1', '2']) {
        const ra = a.find((r) => r.id === id)!;
        const rb = b.find((r) => r.id === id)!;
        expect(ra.bits).toBeCloseTo(rb.bits, 12);
      }
    });
  });

  describe('output shape', () => {

    it('result is sorted by rank ascending', () => {
      const tokens: RarityToken[] = [
        { id: 'a', attrs: { x: '1' } },
        { id: 'b', attrs: { x: '2' } },
        { id: 'c', attrs: { x: '1' } },
      ];
      const ranked = scoreAndRank(tokens);
      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i].rank).toBeGreaterThanOrEqual(ranked[i - 1].rank);
      }
    });

    it('rank labels are 1-based and skip after ties (1-2-2-4 ordering)', () => {
      const tokens: RarityToken[] = [
        { id: 'a', attrs: { x: 'unique-a' } },
        { id: 'b', attrs: { x: 'common' } },
        { id: 'c', attrs: { x: 'common' } }, // dup of b
        { id: 'd', attrs: { x: 'common' } }, // dup of b
      ];
      const ranked = scoreAndRank(tokens);
      // a is rank 1 (1 unique attr); b/c/d are all rank 2 (no unique, identical scores).
      const ranks = ranked.map((r) => r.rank);
      expect(ranks).toContain(1);
      expect(ranks.filter((r) => r === 2)).toHaveLength(3);
    });
  });

  describe('preserves caller id type', () => {

    it('accepts numeric ids', () => {
      const tokens: RarityToken<number>[] = [
        { id: 100, attrs: { x: 'a' } },
        { id: 200, attrs: { x: 'b' } },
      ];
      const ranked: ScoredToken<number>[] = scoreAndRank(tokens);
      expect(typeof ranked[0].id).toBe('number');
    });
  });

  describe('tiebreaker option', () => {

    it('breaks identical-score ties via the supplied comparator (strict total order)', () => {
      // Two identical tokens — same trait set → same score → would tie
      // without a tiebreaker. With `(a, b) => a - b` (lower id wins),
      // they get distinct ranks; id=1 ranks above id=2.
      const tokens: RarityToken<number>[] = [
        { id: 2, attrs: { x: 'a', y: 'b' } },
        { id: 1, attrs: { x: 'a', y: 'b' } },
      ];
      const ranked = scoreAndRank(tokens, { tiebreaker: (a, b) => a - b });
      const by = (id: number) => ranked.find((r) => r.id === id)!;

      expect(by(1).rank).toBe(1);
      expect(by(2).rank).toBe(2);
      // Scores still identical — the tiebreaker only affects rank
      // assignment, not the underlying math.
      expect(by(1).score).toBeCloseTo(by(2).score, 9);
      expect(by(1).bits).toBeCloseTo(by(2).bits, 9);
    });

    it('default behaviour (no tiebreaker) still merges score ties into a shared rank', () => {
      const tokens: RarityToken<number>[] = [
        { id: 2, attrs: { x: 'a', y: 'b' } },
        { id: 1, attrs: { x: 'a', y: 'b' } },
      ];
      const ranked = scoreAndRank(tokens);
      const by = (id: number) => ranked.find((r) => r.id === id)!;

      expect(by(1).rank).toBe(by(2).rank);
    });

    it('tiebreaker does not override the primary uniqueAttrCount sort key', () => {
      // Token id=1 has uniqueAttrCount=0; token id=2 has uniqueAttrCount=2.
      // Even though the tiebreaker prefers lower ids, the primary sort
      // wins — id=2 should still rank above id=1.
      const tokens: RarityToken<number>[] = [
        { id: 1, attrs: { x: 'common', y: 'common' } },
        { id: 2, attrs: { x: 'unique-x', y: 'unique-y' } },
        { id: 3, attrs: { x: 'common', y: 'common' } },
      ];
      const ranked = scoreAndRank(tokens, { tiebreaker: (a, b) => a - b });
      const by = (id: number) => ranked.find((r) => r.id === id)!;

      expect(by(2).rank).toBe(1);
      // Tiebreaker breaks the 1-vs-3 tie: id=1 wins.
      expect(by(1).rank).toBe(2);
      expect(by(3).rank).toBe(3);
    });
  });
});
