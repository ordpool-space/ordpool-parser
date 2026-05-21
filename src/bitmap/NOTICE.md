# Attribution

`mondrian-layout.ts` is a TypeScript port of:

- [`bitlodo/bitmap-utils`](https://github.com/bitlodo/bitmap-utils) — MIT, Copyright © 2024 bitlodo.
  Source: [`utils/MondrianLayout.js`](https://github.com/bitlodo/bitmap-utils/blob/main/utils/MondrianLayout.js).
  Permission to copy under MIT confirmed directly with the author.

bitlodo's file in turn credits:

- [Bitfeed](https://github.com/bitfeed-project/bitfeed) by mononaut — MIT.
  Source: [`client/src/models/TxMondrianPoolScene.js`](https://github.com/bitfeed-project/bitfeed/blob/master/client/src/models/TxMondrianPoolScene.js).
  Bitfeed's own block explorer is at [bitfeed.live](https://bitfeed.live) (e.g. `https://bitfeed.live/block/height/210000`) — the canonical reference for the packing geometry every downstream renderer descends from.

The SVG rendering rules in `bitmap-renderer.ts` (`padd = 0.5`, single `<path>`
with chained `M`/`H`/`V`/`Z` commands, `viewBox` = bounding box) mirror
bitlodo's `SVGRenderer.tsx`. The default fill `#F7931A` (Bitcoin orange) is
the de-facto community convention.

## What this renders, and what it deliberately does not

This module renders the **Bitmap protocol's** convention of a block: every
transaction becomes a square sized by `logTxSize(totalOutSats)`, packed
into a grid sized by `ceil(sqrt(sum of those squares))`. The grid always
ends up fully filled — empty space is impossible by construction. That
is the Bitmap aesthetic: a dense, deterministic shape per block.

This is NOT the mempool.space block visualisation, even though both
descend from bitfeed's `MondrianLayout`. mempool.space sizes its tiles by
**transaction weight** (vsize / virtual bytes) and draws them inside a
**fixed-size canvas representing the consensus block-weight budget**, so
half-empty historical blocks render as mostly empty. mempool also
colours tiles by fee rate. The packing algorithm is shared; the input
metric, the canvas, and the colours all differ. The two visualisations
answer different questions:

- **Bitmap** — what is the block's deterministic "shape", scaled to fit?
- **mempool block view** — how full was this block, and how were fees
  distributed inside it?

## Why we copy rather than depend

ordpool-parser is a zero-dependency library on purpose. Carrying the
algorithm inline also lets us evolve it without coordinating across the
upstream's React-specific components.
