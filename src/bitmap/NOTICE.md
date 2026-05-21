# Attribution

`mondrian-layout.ts` is a TypeScript port of:

- [`bitlodo/bitmap-utils`](https://github.com/bitlodo/bitmap-utils) — MIT, Copyright © 2024 bitlodo.
  Source: [`utils/MondrianLayout.js`](https://github.com/bitlodo/bitmap-utils/blob/main/utils/MondrianLayout.js).
  Permission to copy under MIT confirmed directly with the author.

bitlodo's file in turn credits:

- [Bitfeed](https://github.com/bitfeed-project/bitfeed) by mononaut — MIT.
  Source: [`client/src/models/TxMondrianPoolScene.js`](https://github.com/bitfeed-project/bitfeed/blob/master/client/src/models/TxMondrianPoolScene.js).
  Bitfeed is an OSS Bitcoin explorer (live at [bitfeed.live](https://bitfeed.live), e.g. `https://bitfeed.live/block/height/210000`). The Bitmap community liked its block visualisation and adopted the packing algorithm.

The SVG rendering rules in `bitmap-renderer.ts` (`padd = 0.5`, single `<path>`
with chained `M`/`H`/`V`/`Z` commands, `viewBox` = bounding box) mirror
bitlodo's `SVGRenderer.tsx`. The default fill `#F7931A` (Bitcoin orange) is
the de-facto community convention.

## Why we copy rather than depend

ordpool-parser is a zero-dependency library on purpose. Carrying the
algorithm inline also lets us evolve it without coordinating across the
upstream's React-specific components.
