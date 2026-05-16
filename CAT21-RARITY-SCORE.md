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
- Every cat belongs to **exactly one category** (`sub1k`, `sub10k`,
  `sub50k`, `sub100k`, `sub250k`, `sub500k`, `sub1M`). The rarity score
  is **computed inside the category**. A `sub1k` cat is ranked against
  the other 999 `sub1k` cats, never against `sub10k` cats. Categories
  are distinct collections; they don't compete.
- **The Genesis Cat is always rank 1 in `sub1k`.** Cat #0 is the first
  `nLockTime=21` transaction in Bitcoin history. Protocol significance
  overrides trait math.

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
is a coarse classification: red, orange, yellow, green, cyan, blue,
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

### Visual easter eggs (lore, not extra traits)

Two fee-rate-triggered visual overrides exist. They are **not new
traits** — the cat carries the same 14-dimension `CatTraits` shape
either way. They just render differently and get their own color
bucket so search returns the set spotters expect.

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
| `< 1 000`              | `sub1k`  | 1 000 cats                 |
| `< 10 000`             | `sub10k` | 9 000 cats                 |
| `< 50 000`             | `sub50k` | 40 000 cats                |
| `< 100 000`            | `sub100k`| 50 000 cats                |
| `< 250 000`            | `sub250k`| 150 000 cats               |
| `< 500 000`            | `sub500k`| 250 000 cats               |
| `< 1 000 000`          | `sub1M`  | 500 000 cats               |
| `≥ 1 000 000`          | (TBD)    | unbounded — opens at #1 000 000 |

Source: `ordpool/official_dune_dasboard_query.sql`, the canonical
Dune dashboard query mirror.

The CASE WHEN falls through smallest-first, so a cat numbered 500 is
`sub1k` and **only** `sub1k`, never also `sub10k`. The `sub10k` label
reads cumulatively in English ("any cat under 10k") but the storage
model is mutually exclusive. The Cat detail page on cat21.space spells
out the ranges on hover.

**Categories don't nest. Each is a distinct collection.** Holding a
`sub1k` cat is membership in a 1 000-cat closed drop. Holding a
`sub10k` cat is membership in a 9 000-cat closed drop. They're not
overlapping shelves; they're different shelves.

That's why rarity is **scored per category**. A sub1k cat is ranked
against the other 999 sub1k cats; a sub10k cat against the other 8 999
sub10k cats. Cross-category comparisons are meaningless by design —
the price discovery for sub1k and sub10k are different markets.

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
sorted by `(uniqueAttrCount DESC, rarityBits DESC)` — the
`uniqueAttrCount` primary key matches OpenRarity's reference
implementation; it surfaces cats that have a one-of-a-kind value in
some trait even when their raw bit total isn't the highest.

Implementation lives in `src/rarity/open-rarity.ts` (this repo). Test
coverage is in `src/rarity/open-rarity.spec.ts` — 20 tests, including
the exact-float regression cases ported from the upstream Python.

### What's included in scoring

The 11 scoring dimensions handed to OpenRarity:

```
genesis · gender · pose · expression · pattern · facing ·
eyes · background · crown · glasses · color
```

`color` here is the **dominant color bucket**, not the raw hex
palette. The bucket has 12 possible values: 8 hue bands
(red/orange/yellow/green/cyan/blue/purple/pink), 2 genesis palettes
(black/white — the parser's hardcoded looks when `catHash[0] === 79`),
and 2 easter-egg buckets (fire/saturated). See
`src/cat21/cat-color-category.ts` for the assignment logic.

Why a bucket and not the raw palette: the 5-hex palette is largely
deterministic from a single hue + saturation; the meaningful "what
color is this cat" question collapses to one of those 12 buckets.

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
  `Crown=Gold` (~1%) contributes ~6.6 bits. No special-casing needed.
- **The rare `genesis` trait automatically dominates.** ~8 bits from
  that one boolean. The math itself recognises it.
- **Mixed-cardinality traits just work.** Binary, 4-way, 5-way —
  information content doesn't care how many values a trait has.
- **Bands are stable as more cats mint.** Adding a cat to a 9 000-cat
  `sub10k` shifts each `log₂(p)` by ~0.0001 bits per trait — ranks
  barely move. Closed bands (`sub1k` will freeze the instant cat #999
  is minted) never change again.

## The Genesis Cat Bonus

**There are many `genesis: true` cats. There is only one Genesis Cat.**

Cat #0 is the first `nLockTime=21` transaction in Bitcoin history.
Block 824 205. Holder of sat `596964966600565`. The mother of the
protocol.

Its specialness is **historical, not statistical**. No trait-frequency
math can manufacture protocol significance, and we don't try.

OpenRarity ranks cat #0 around **rank 8** in sub1k by trait math
alone. The genesis trait carries ~8 bits, but cat #0's secondaries —
Standing pose, Red laser eyes, no crown, no glasses — are common; cat
#802 wins the natural rank with rare secondaries on top of the
genesis trait (Cool glasses + Green eyes + Pouncing pose + Whitepaper
background).

We **pin cat #0 at rank 1 inside sub1k**. Always.

Implementation: in `recomputeRarityForCategory`, after `scoreAndRank`
returns the natural order, if `category === 'sub1k'`, cat #0 is moved
to position 0 of the ranked array and ranks renumber sequentially.

**The `rarityBits` field is untouched.** Cat #0's score still reports
its honest natural value (~29.6 bits). Only the *rank label* is
pinned. A degen reading the API can see both:

- `rarityBits: 29.626…` — the trait math, fair and transparent.
- `rarityRank: 1` — the rank, with the Genesis Cat Bonus applied.

We're not faking the math. We're saying: rank is a community-facing
number that should reflect the protocol's truth, and the protocol's
truth is that there's one Genesis Cat. Bits stay honest. Anyone
suspicious can compute `rarityBits` themselves from the parser and
see we're not hiding anything.

Limited strictly to sub1k. No other category contains the Genesis
Cat, so no other category has the bonus.

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
- The category derivation is **a single CASE WHEN** mirrored from the
  Dune dashboard query at `ordpool/official_dune_dasboard_query.sql`.
- The Genesis Cat Bonus is **explicitly documented** (this section).
  No hidden "rarity boosts" anywhere else; the only override exists
  for cat #0 in sub1k, and it touches the rank label only.

Anyone can fork this repo, compute every cat's `rarityBits` from
on-chain data alone, and verify the leaderboard. That's the point.
