# CAT-21 Rarity Score

How rarity is calculated for every CAT-21 cat. Open, transparent, math
that holds up to inspection.

## TL;DR

- Every cat has 14 visual traits, **deterministically generated** from
  `SHA256(txid || blockHash)` and the fee rate. The bytes are immutable
  on Bitcoin. Nobody can change a cat's traits.
- We score rarity using **OpenRarity** (ProjectOpenSea's 2022 standard;
  reference port lives in `src/rarity/open-rarity.ts` in this repo).
  Formula: `Σ -log₂(p_i)` over every trait — higher = rarer.
- Every cat belongs to **exactly one category** (`sub1`, `sub1k`,
  `sub10k`, `sub50k`, `sub100k`, `sub250k`, `sub500k`, `sub1M`). The
  rarity score is **computed inside the category**. A `sub1k` cat is
  ranked against the other 998 `sub1k` cats, never against `sub10k`
  cats. Categories are distinct collections; they don't compete.
- **The Genesis Cat lives in its own collection — `sub1`.** Cat #0 is
  the first `nLockTime=21` transaction in Bitcoin history. There is
  exactly one cat in `sub1`, so the rank is `1 of 1` by definition —
  the smallest-first category model with a `< 1` row puts cat #0
  alone in its own band.

The community shorthand: **many genesis cats, only one Genesis Cat.**
The trait is plural. The Cat is singular.

## What the parser scores

A cat carries 14 trait dimensions. Every value below is computed
deterministically from the cat's hash + fee rate — the parser code
at `src/cat21/mooncat-parser.ts` is the source of truth and never
changes.

| Trait              | Type / values                                                | Source byte                |
|--------------------|--------------------------------------------------------------|----------------------------|
| `genesis`          | boolean                                                      | `catHash[0] === 79` (~0.4%) |
| `catColors`        | string[5] — body palette                                     | feeRate + `catHash[1]`     |
| `gender`           | `Female` \| `Male`                                           | `designIndex < 64` (50/50) |
| `designIndex`      | 0–127 — encodes the four design traits below                 | `catHash[1]`               |
| `designPose`       | `Standing` \| `Sleeping` \| `Pouncing` \| `Stalking`         | decoded (25% each)         |
| `designExpression` | `Smile` \| `Grumpy` \| `Pouting` \| `Shy`                    | decoded (25% each)         |
| `designPattern`    | `Solid` \| `Striped` \| `Eyepatch` \| `Half/Half`            | decoded (25% each)         |
| `designFacing`     | `Left` \| `Right`                                            | locked with `gender`       |
| `laserEyes`        | `Orange` \| `Red` \| `Green` \| `Blue` \| `None`             | `catHash[5]` (20% each)    |
| `background`       | `Block9` \| `Cyberpunk` \| `Whitepaper` \| `Orange`          | `catHash[6]` (25% each)    |
| `backgroundColors` | string[] — derived from background type                      | `catHash[6]`               |
| `crown`            | `Gold` \| `Diamond` \| `None`                                | `catHash[7]` (10% wear)    |
| `glasses`          | `Black` \| `Cool` \| `3D` \| `Nouns` \| `None`               | `catHash[8]` (conditional) |
| `glassesColors`    | string[] — derived from glasses type                         | `catHash[8]`               |

These are the only inputs to the rarity score. Color palettes
(`catColors`, `backgroundColors`, `glassesColors`) themselves aren't
scored individually — they're derivative of other values. Instead, we
score the **dominant color bucket** (see "Color buckets" below), which
is a coarse classification: red, orange, yellow, green, blue,
purple, pink, black, white, plus the two easter-egg buckets `fire` and
`saturated`.

### How the seed becomes a cat

```
catHash = SHA256(txid || blockHash)
  catHash[0]   → genesis flag
  catHash[1]   → designIndex + saturation seed for catColors
  catHash[5]   → laserEyes
  catHash[6]   → background type
  catHash[7]   → crown
  catHash[8]   → glasses
feeRate        → body color (via feeRateToColor)
```

Both halves of the seed are immutable on the Bitcoin blockchain. Any
change to the parser's mapping changes every cat's appearance — which
is exactly why the parser is SHA-pinned in every consumer and never
bumped without a deliberate "reveal the cats differently" decision.

### Visual easter eggs (lore overlays on the 14 traits)

Two fee-rate-triggered visual overrides sit on top of the 14-trait
`CatTraits` shape — same trait dimensions, different render and a
dedicated color bucket so search surfaces the set spotters expect.

| Easter egg        | Trigger                       | Effect                             |
|-------------------|-------------------------------|------------------------------------|
| **Fire cat**      | `feeRate ∈ [69, 70)` sat/vB   | Palette forced to red/orange/yellow |
| **Saturated cat** | `feeRate ∈ [420, 421)` sat/vB | Saturation pinned to 42.0          |

Source: `src/cat21/mooncat-parser.ts` (~line 230) and
`src/cat21/mooncat-parser.colors.ts` (~line 66).

## Categories — distinct collections

Each cat belongs to exactly one category, derived from its `catNumber`:

| Threshold (cat_number) | Category | Drop size                  |
|------------------------|----------|----------------------------|
| `< 1`                  | `sub1`   | 1 cat (the Genesis Cat)    |
| `< 1 000`              | `sub1k`  | 999 cats                   |
| `< 10 000`             | `sub10k` | 9 000 cats                 |
| `< 50 000`             | `sub50k` | 40 000 cats                |
| `< 100 000`            | `sub100k`| 50 000 cats                |
| `< 250 000`            | `sub250k`| 150 000 cats               |
| `< 500 000`            | `sub500k`| 250 000 cats               |
| `< 1 000 000`          | `sub1M`  | 500 000 cats               |
| `≥ 1 000 000`          | (TBD)    | unbounded — opens at #1 000 000 |

Category derivation lives in the indexer at
`cat21-indexer/backend/src/modules/sync/sync.service.ts` —
`deriveCategory(catNumber)`. The community first encountered these
band names on the Dune dashboard at `dune.com/ethspresso/cat21`,
which counts cats cumulatively: a `sub10k` query returns every cat
with `cat_number < 10000`. ordpool partitions the same supply so
rarity can be scored inside disjoint collections — each cat is
assigned to its smallest applicable band and only that band. Two
complementary views of the same data.

The CASE WHEN falls through smallest-first, so cat #0 is `sub1` (and
only `sub1`), cat #500 is `sub1k` (and only `sub1k`), never also
`sub10k`. The `sub10k` label reads cumulatively in English ("any cat
under 10k") but the storage model is mutually exclusive. The Cat
detail page on cat21.space spells out the ranges on hover.

**Categories partition the supply — each cat sits on exactly one
shelf.** Holding the Genesis Cat is membership in a 1-cat closed drop
(`sub1`). Holding a `sub1k` cat is membership in a 999-cat closed
drop. Holding a `sub10k` cat is membership in a 9 000-cat closed drop.
Different shelves, different markets, different price discovery.

That's why rarity is **scored per category**. A sub1k cat is ranked
against the other 998 sub1k cats; a sub10k cat against the other 8 999
sub10k cats. Cross-category comparisons are meaningless by design —
the price discovery for sub1, sub1k and sub10k are different markets.

## The math — OpenRarity, per category

Per cat, in its category:

```
rarityBits(cat) = Σ over the cat's traits of  -log₂(p_i)

where p_i = (tokens_in_this_category_with_the_same_value_for_trait_i)
            / (total_tokens_in_this_category)
```

This is **Shannon surprisal**, summed over the cat's traits. The
rarer a value is in the category, the more bits it contributes. A
binary trait at 50/50 contributes at most 1 bit; a 4-way trait at
25/25/25/25 contributes at most 2 bits; the rare `genesis` trait at
~0.4% contributes ~8 bits.

`rarityRank` is the 1-based position when the category's cats are
sorted by `(uniqueAttrCount DESC, rarityBits DESC, catNumber ASC)` —
the `uniqueAttrCount` primary key matches OpenRarity's reference
implementation; it surfaces cats that have a one-of-a-kind value in
some trait even when their raw bit total isn't the highest.

### Tiebreaker: lower catNumber wins

The 11-dimension scored trait surface is finite. With enough cats in
a category, two different cats can roll the same combination of
scored values (different `feeRate` or `catHash` bytes, same enum
values for every searchable trait). cat21 breaks those ties with a
strict total order so every cat gets a unique rank.

**When two cats tie on `(uniqueAttrCount, rarityBits)`, the lower
`catNumber` wins.** Older cat is rarer.

`rarityBits` carries the same float for both tied cats; the
tiebreaker only assigns the rank label. Anyone running the
algorithm with the `(a, b) => a - b` comparator on a cat's id
gets the same answer.

Implementation lives in `src/rarity/open-rarity.ts` (this repo). Test
coverage is in `src/rarity/open-rarity.spec.ts` — including the
exact-float regression cases ported from the upstream Python and the
cat21-specific tiebreaker tests.

### What's included in scoring

The 11 scoring dimensions handed to OpenRarity:

```
genesis · gender · pose · expression · pattern · facing ·
eyes · background · crown · glasses · color
```

`color` here is the **dominant color bucket**, not the raw hex
palette. The bucket has 11 possible values: 7 hue bands
(red/orange/yellow/green/blue/purple/pink), 2 genesis palettes
(black/white — the parser's hardcoded looks when `catHash[0] === 79`),
and 2 easter-egg buckets (fire/saturated). There's no `cyan` band:
`feeRateToColor` sweeps green → yellow → orange → red → blue and
never produces a hue in the [165°, 195°) teal range, so that range
folds into blue. See `src/cat21/cat-color-category.ts` for the
assignment logic.

Why a bucket and not the raw palette: the 5-hex palette is largely
deterministic from a single hue + saturation; the meaningful "what
color is this cat" question collapses to one of those 11 buckets.

### What's not in scoring

- `catNumber` itself isn't a trait. Lower numbers are scarcer by mint
  order, and that's already captured by the category model — `sub1k`
  holders rank against 1 000 cats; `sub1M` holders against 500 000.
- Fee rate isn't a trait either. It already feeds the body color
  derivation (and the fire/saturated overrides), so scoring it
  separately would double-count.
- `designIndex` is the compressed form of pose+expression+pattern+
  facing; scoring it on top of the four decoded traits would also
  double-count, so we skip it.
- `catColors`, `backgroundColors`, `glassesColors` (the raw hex
  arrays) are derivative outputs of the other traits; the bucketed
  `color` is what survives the cut.

### Why OpenRarity

Four algorithms shipped during the 2020-2022 NFT boom:

1. **Trait Rarity** (single rarest trait) — too coarse, mass ties.
2. **Statistical Rarity** (`1/Π p_i`) — wild outliers, severe
   trait-count bias.
3. **Rarity Score** (rarity.tools, `Σ 1/p_i`) — the 2021 standard;
   intuitive but unbounded.
4. **OpenRarity** (`Σ -log₂(p_i)`) — the 2022 industry standard;
   information-theoretically grounded; superseded rarity.tools.

OpenRarity wins for CAT-21 because:

- **It handles "None" values gracefully.** `Crown=None` (~90% of
  cats) contributes `-log₂(0.9) ≈ 0.15` bits — basically nothing.
  `Crown=Gold` (~1%) contributes ~6.6 bits. The math fits both rare
  and common values without per-trait tuning.
- **The rare `genesis` trait automatically dominates.** ~8 bits from
  that one boolean. The math itself recognises it.
- **Mixed-cardinality traits just work.** Binary, 4-way, 5-way —
  information content doesn't care how many values a trait has.
- **Bands are stable as more cats mint.** Adding a cat to a 9 000-cat
  `sub10k` shifts each `log₂(p)` by ~0.0001 bits per trait — ranks
  barely move. Closed bands (`sub1` is already frozen; `sub1k` freezes
  the instant cat #999 mints) never change again.

## The Genesis Cat — sub1, the one-cat collection

**Cat #0 lives alone in `sub1`.** Rank 1 of 1, by definition.

There are many `genesis: true` cats. There is only one Genesis Cat.
Cat #0 is the first `nLockTime=21` transaction in Bitcoin history,
revealed at block 824 205, carrying sat `596964966600565` and the
protocol's governance per the CAT-21 spec.

The `< 1` threshold matches cat #0 and only cat #0, so `sub1` is a
one-cat closed drop. Inside a collection of size 1, the rank is
trivially 1 of 1. The Genesis Cat's specialness is baked into the
category structure itself: cat #0 is the only inhabitant of its
collection, by the same smallest-first math that puts cat 500 in
`sub1k` and cat 5000 in `sub10k`.

The `rarityBits` field reports cat #0's natural trait-math score
(~29.6 bits) — computed against a comparison set of size 1.

## Trust — the math is mathing

- The cat's traits are **immutable on Bitcoin**. SHA-256 of the txid
  plus the block hash. Both halves can be verified by anyone with the
  blockchain.
- The parser is **open source** (this repo, MIT-licensed). Anyone
  can run `Cat21ParserService.parse(tx)` and reproduce the trait
  values byte-for-byte.
- The rarity algorithm is **open source** (`src/rarity/open-rarity.ts`)
  and a faithful port of OpenRarity's Python reference. Tests pin the
  exact-float behaviour against the upstream test vectors.
- The category derivation is **a single CASE WHEN** — the eight
  thresholds listed in the "Categories" section above. The whole
  function is ten lines, and the Genesis Cat's `1 of 1` rank falls
  out of the `< 1` row directly.
- Bits and ranks are computed the same way for every cat in every
  category, including cat #0.

Anyone can fork this repo, compute every cat's `rarityBits` from
on-chain data alone, and verify the leaderboard. That's the point.
