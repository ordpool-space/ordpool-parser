# CLAUDE.md

## Overview

**ordpool-parser** is a zero-dependency TypeScript library that parses Bitcoin digital artifacts from raw transaction data. It detects Inscriptions, Runes, BRC-20, SRC-20, CAT-21, and Atomicals in the Esplora API transaction format.

- **Zero runtime dependencies** — works in Node.js AND browsers
- **Dual output**: ESM (`dist/`) and CommonJS (`dist-commonjs/`)
- **Version 2.x** is the version for the ordpool-v2 ecosystem rewrite. There are no external consumers — the only users are ordpool.space and cat21.space. No CHANGELOG needed.

## Commands

```bash
npm install
npm test                    # runs both node + browser test suites
npm run test:node           # node tests only
npm run test:browser        # jsdom browser tests only
npm run build               # builds both ESM and CJS
npm run build:cat21         # builds standalone cat21.js bundle (ESM + IIFE)
npm run fetch-tx-testdata   # download raw tx JSON for testing
npm run create-link         # build + npm link for local development
```

## ABSOLUTE RULE: Never Change CAT-21 Output

**This is the most important rule in this entire codebase.**

The CAT-21 protocol is LIVE. Cats have been minted and are owned by real people. Every cat's appearance (SVG image) and traits are deterministically generated from `SHA256(txId + blockId)`. The generated output is **immutable forever**.

**NEVER modify any code that affects CAT-21 image generation or trait computation.** Even bug fixes that "improve" the output are forbidden — they would change existing cats' appearances, breaking the protocol and upsetting holders.

Specifically, DO NOT change:
- `src/cat21/mooncat-parser.ts` — image generation algorithm
- `src/cat21/mooncat-parser.traits.ts` — trait patterns (eyes, crown, glasses, etc.)
- `src/cat21/mooncat-parser.designs.ts` — the 128 cat designs
- `src/cat21/mooncat-parser.colors.ts` — color palette derivation
- Any constant, magic number, or byte offset in these files

If you suspect a bug in CAT-21: **the bug IS the specification.** Document it, don't fix it.

The only safe changes to CAT-21 code:
- Adding NEW traits/features that don't affect existing output (e.g., new metadata)
- Refactoring that provably produces identical output (must be verified with snapshot tests)
- Performance optimizations that don't change any bytes
- Documentation and comments

**Before touching any CAT-21 file**: Run the full test suite and verify ALL existing cat images match their snapshots byte-for-byte.

## General Rules

- **Never brag with arbitrary numbers.** Don't write "436 tests" or "39 test suites" or "63,000 cats" in documentation or comments — these numbers change constantly and get stale. Anyone can run `npm test` and see the actual count.
- **Zero runtime dependencies is a hard requirement.** All algorithms must be inline (brotli, CBOR, RC4, etc.). Never add an npm dependency.
- **Pure functions preferred.** No DI, no classes with state where avoidable. No ILogger abstractions.

## Architecture

```
src/
├── index.ts                          # Public API exports
├── cat21/                            # CAT-21 parser (FROZEN — see rule above)
│   ├── cat21-parser.service.ts       # Entry point: parse() → ParsedCat21
│   ├── mooncat-parser.ts             # Image + trait generation (monolithic, by design)
│   ├── mooncat-parser.traits.ts      # Trait patterns (eyes, crown, glasses, designs)
│   ├── mooncat-parser.designs.ts     # 128 cat designs
│   └── mooncat-parser.colors.ts      # Color palettes, backgrounds
├── inscription/                      # Inscription parser (Ordinals)
│   ├── inscription-parser.service.ts # Parses envelopes from witness data
│   └── inscription-parser.service.helper.ts
├── rune/                             # Rune parser
│   ├── index.ts
│   └── src/                          # Forked from a JS rune library, heavily trimmed
├── types/                            # TypeScript interfaces
│   ├── digital-artifact.ts           # Base type for all artifacts
│   ├── parsed-cat21.ts               # ParsedCat21 + CatTraits
│   ├── parsed-inscription.ts         # ParsedInscription
│   └── ...
├── lib/                              # Shared utilities
│   ├── reader.ts                     # Binary reader for Bitcoin script
│   ├── conversions.ts                # Hex/byte conversions, helpers
│   ├── cbor-encoder.ts               # CBOR encoding (for inscription metadata)
│   └── brotli-decoder.ts             # Brotli decompression (inline, zero-dep)
└── digital-artifact-analyser.service.ts  # Unified: parse all artifact types at once
```

## Public API

```typescript
// Parse all digital artifacts in a transaction
DigitalArtifactsParserService.parse(tx): DigitalArtifact[]

// Parse specific types
InscriptionParserService.parse(tx): ParsedInscription[]
Cat21ParserService.parse(tx): ParsedCat21 | null
RuneParserService.parse(tx): ParsedRunestone | null

// Analyze a full block's transactions (used by ordpool backend)
DigitalArtifactAnalyserService.analyseTransactions(txs): OrdpoolStats
```

## Error Handling Convention

All `parse()` methods return `null` on error — silently. This is intentional:
- Bitcoin transactions contain arbitrary data, most of which is not valid digital artifacts
- A parser must never crash the caller over malformed input
- `null` = "this transaction doesn't contain what you're looking for"

**However**: errors in the PARSER ITSELF (bugs) are also silently swallowed. This is a known trade-off. If you add new parsing logic, consider logging errors during development but ensure they're silent in production.

## Testing

### GOLDEN RULE: All Tests Use Real Blockchain Data

**Every test MUST assert against real transaction data downloaded from the Bitcoin blockchain. Zero exceptions.**

- Test data lives in `testdata/` as JSON files (`tx_<txid>.json`)
- Fetched via `npm run fetch-tx-testdata` from Esplora API
- **NEVER use synthetic/fabricated transaction data** — always use a real txid
- **NEVER mock the parser input** — use the actual Esplora API format
- If you need test data for a new feature, find a real mainnet transaction that exercises it

### Test Coverage Rule

If the parser claims to detect a specific type or operation, there MUST be a real mainnet transaction in `testdata/` that exercises it. No exceptions. If you can't find a real transaction, don't claim support for that type.

### Other Testing Rules

- Both Node.js and browser (jsdom) environments tested
- Some tests marked `xit()` as SLOW — these are stress tests, not needed for regular development

## Code Style

- TypeScript strict mode enabled
- Pure functions preferred (no DI, no classes with state where avoidable)
- Service pattern: `XxxParserService` as static classes with `parse()` methods
- Zero runtime dependencies — all algorithms inline (brotli, CBOR, RC4, etc.)

## Parser-Specific Notes

### CAT-21 (FROZEN)
- Trait probabilities use byte values from SHA-256 hash (e.g., byte[4] 0-50 = orange laser eyes = ~20%)
- Genesis byte is `byte[0] === 79` — this is the hash of the actual genesis cat transaction
- SVG is a 22x22 pixel grid rendered as `<rect>` elements
- The mooncat-parser originates from the original MoonCat algorithm, heavily adapted

### Inscriptions
- Supports: single, batch (pointer field), parent-child, delegate, CBOR metadata
- Decompression: brotli (inline decoder), gzip (via native APIs)
- Content types detected from inscription envelope

### Runes
- Forked from a JavaScript rune library (which was inspired by the official Rust `ord` implementation)
- Stripped down: removed all write operations and external dependencies to make it run in the browser
- Custom u128 integer type (JavaScript doesn't have native 128-bit ints)
- The `src/rune/src/` nesting is from the original fork structure — don't "fix" it

### SRC-20
- Uses RC4 decryption to decode stamp data from multisig outputs
- Detects both SRC-20 deploy and mint operations

### Atomicals
- **Stub only** — `parse()` always returns null
- Implementation was never completed
- Kept as placeholder for potential future work
