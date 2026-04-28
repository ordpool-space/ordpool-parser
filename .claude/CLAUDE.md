# CLAUDE.md

## Overview

**ordpool-parser** is a zero-dependency TypeScript library that parses Bitcoin digital artifacts from raw transaction data. It detects Inscriptions, Runes, BRC-20, SRC-20, CAT-21, and Atomicals in the Esplora API transaction format.

- **Zero runtime dependencies** — works in Node.js AND browsers
- **Dual output**: ESM (`dist/`) and CommonJS (`dist-commonjs/`)
- **Version 2.x** is the v2 ecosystem rewrite. There are no external consumers — the only users are ordpool.space (frontend) and cat21.space (frontend + backend). No CHANGELOG needed.

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

## Releasing

Two consumer paths, two ways to ship a change:

**a) git SHA refs (preferred for backends).** `ordpool/backend` and
`cat21-indexer/backend` pin via `"ordpool-parser":
"github:ordpool-space/ordpool-parser#<sha>"`. The `prepare` script in
`package.json` runs `npm run build` automatically when a git ref is
installed, so no publish is needed. To ship a change to a backend
consumer: commit + push to `main`, then bump the SHA in the consumer's
`package.json` and `npm install`.

**b) npm publish (for `ordpool/frontend`, which still pins `^2.0.x`).**
Every publish needs a matching git tag and GitHub release to keep
sources in sync:

```bash
# 1. Bump version in package.json
# 2. Commit: "v2.0.x: <summary>"
# 3. Push to main
# 4. Tag and push tag
git tag v2.0.x && git push origin v2.0.x
# 5. Create GitHub release
gh release create v2.0.x --title "v2.0.x" --notes "..."
# 6. Publish to npm (requires OTP from authenticator)
npm publish --otp=<code>
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

## ABSOLUTE RULE: Never Delete Support Without User Consent

**NEVER remove code, types, enum values, flags, or protocol support because you couldn't find a test transaction.** If you're struggling to find on-chain evidence, TELL THE USER. We will find a solution together. Deleting working code is never the answer.

If a /simplify agent suggests removing "dead code" that represents protocol support (types, enum values, routing logic, flags), **push back**. The code is not dead -- it's waiting for its first transaction. The right response is to search harder for test data, not to delete the support.

## General Rules

- **Never brag with arbitrary numbers.** Don't write "436 tests" or "39 test suites" or "63,000 cats" in documentation or comments — these numbers change constantly and get stale. Anyone can run `npm test` and see the actual count.
- **Zero runtime dependencies is a hard requirement.** All algorithms must be inline (brotli, CBOR, RC4, etc.). Never add an npm dependency.
- **Pure functions preferred.** No DI, no classes with state where avoidable. No ILogger abstractions.
- **Keep explanatory comments.** This codebase parses Bitcoin script opcodes, CBOR binary formats, and protocol-specific envelope structures. These are genuinely complicated. Comments that explain the flow ("No more inscriptions found", "Parse the inscription at the current position", "Update startPosition for the next iteration") help humans navigate the logic. Do NOT remove them as "unnecessary WHAT comments" — they are useful here.
- **Humans can't read hex.** Always comment what hex values mean: `'0063036f7264'` is meaningless without `// OP_FALSE, OP_IF, OP_PUSHBYTES_3, 'o', 'r', 'd'`. Every hex constant, test data snippet, and inline byte sequence MUST have a human-readable explanation next to it. Never remove these comments.

## Architecture

```
src/
├── index.ts                          # Public API exports
├── atomical/                         # Atomicals parser
│   ├── atomical-parser.service.ts    # Entry point: parse() → ParsedAtomical
│   └── atomical-parser.service.helper.ts  # Detection, envelope extraction, operation types
├── cat21/                            # CAT-21 parser (FROZEN — see rule above)
│   ├── cat21-parser.service.ts       # Entry point: parse() → ParsedCat21
│   ├── mooncat-parser.ts             # Image + trait generation (monolithic, by design)
│   ├── mooncat-parser.traits.ts      # Trait patterns (eyes, crown, glasses, designs)
│   ├── mooncat-parser.designs.ts     # 128 cat designs
│   └── mooncat-parser.colors.ts      # Color palettes, backgrounds
├── inscription/                      # Inscription parser (Ordinals)
│   ├── inscription-parser.service.ts # Parses envelopes from witness data
│   ├── inscription-parser.service.helper.ts  # Field extraction, content decoding
│   └── inscription-parser.service.properties.helper.ts  # Gallery/properties (tag 17) parsing
├── labitbu/                          # Labitbu parser (WebP in Taproot control blocks)
│   ├── labitbu-parser.service.ts     # Entry point: parse() → ParsedLabitbu
│   └── labitbu-parser.service.helper.ts  # NUMS key detection, image extraction
├── rune/                             # Rune parser
│   ├── index.ts
│   └── src/                          # Forked from a JS rune library, heavily trimmed
├── src20/                            # SRC-20 parser (Stamps)
│   └── src20-parser.service.ts       # RC4 decryption of stamp data from multisig outputs
├── types/                            # TypeScript interfaces
│   ├── digital-artifact.ts           # Base type for all artifacts
│   ├── parsed-inscription.ts         # ParsedInscription + GalleryItem + InscriptionProperties
│   ├── parsed-atomical.ts            # ParsedAtomical + AtomicalFile
│   ├── parsed-labitbu.ts             # ParsedLabitbu
│   └── ...
├── lib/                              # Shared utilities
│   ├── reader.ts                     # Binary reader for Bitcoin script (readPushdata)
│   ├── conversions.ts                # Hex/byte conversions, concatUint8Arrays, isStringInArrayOfStrings
│   ├── cbor.ts                       # CBOR encoder + decoder (for metadata and Atomicals payloads)
│   └── brotli-decode.ts              # Brotli decompression (inline, zero-dep)
└── digital-artifact-analyser.service.ts  # Unified: parse all artifact types at once
```

## IMPORTANT: _ordpoolFlags Side Effect Pattern

`analyseTransactions()` and `analyseTransaction()` set `tx._ordpoolFlags` as a **side effect** on each transaction object they process. This is intentional and critical for the ordpool/mempool integration.

**Why**: The ordpool backend is a fork of mempool.space. Upstream's `getTransactionFlags()` is **synchronous**, and making it async would cascade `async/await` changes through 15+ upstream files (`classifyTransaction`, `classifyTransactions`, `summarizeBlockTransactions`, `processBlockTemplates`, `dataToMempoolBlocks`, `processClusterMempoolBlocks`, and all their callers). Every upstream merge would re-create these conflicts.

**How it works**: Instead of making upstream functions async, we pre-compute ordpool flags BEFORE upstream classification runs:
1. `analyseTransactions(transactions)` iterates all txs, parses artifacts, and sets `tx._ordpoolFlags = Number(combinedOrdpoolFlags)` on each tx object
2. `analyseTransaction(tx, flags)` does the same for a single tx
3. Upstream's `getTransactionFlags(tx)` (sync) reads `tx._ordpoolFlags` via a 3-line HACK and ORs them into the flags
4. Since JavaScript arrays are passed by reference, enriching tx objects in `$getBlockExtended` makes them visible to `summarizeBlockTransactions` which runs next on the same array

**Do NOT remove the `_ordpoolFlags` assignment.** It looks like a weird side effect but it's the only way to inject ordpool flags into the upstream classification pipeline without making 15+ files async.

## Public API

```typescript
// Parse all digital artifacts in a transaction
DigitalArtifactsParserService.parse(tx): DigitalArtifact[]

// Parse specific types
InscriptionParserService.parse(tx): ParsedInscription[]
Cat21ParserService.parse(tx): ParsedCat21 | null
RuneParserService.parse(tx): ParsedRunestone | null
AtomicalParserService.parse(tx): ParsedAtomical | null
LabitbuParserService.parse(tx): ParsedLabitbu | null
Src20ParserService.parse(tx): ParsedSrc20 | null

// Analyze a full block's transactions (used by ordpool backend)
// SIDE EFFECT: sets tx._ordpoolFlags on each transaction (see above)
DigitalArtifactAnalyserService.analyseTransactions(txs): OrdpoolStats

// Analyze a single transaction (used for mempool tx pre-enrichment)
// SIDE EFFECT: sets tx._ordpoolFlags on the transaction (see above)
DigitalArtifactAnalyserService.analyseTransaction(tx, flags): Promise<bigint>
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
- Fetched via `npm run fetch-tx-testdata` from Esplora API (pipes txid to the interactive script)
- **NEVER use synthetic/fabricated transaction data** — always use a real txid
- **NEVER mock the parser input** — use the actual Esplora API format
- If you need test data for a new feature, find a real mainnet transaction that exercises it

### Test Coverage Rule

If the parser claims to detect a specific type or operation, there MUST be a real mainnet transaction in `testdata/` that exercises it. No exceptions. If you can't find a real transaction, don't claim support for that type.

### NO LAZY ASSERTIONS

**Every assertion must use exact, deterministic values. Ranges and existence checks are forbidden.**

Bad (lazy):
```typescript
expect(result).not.toBeNull();               // just proves it exists
expect(payload.length).toBeGreaterThan(520);  // what IS the length?
expect(files[0].data.length).toBeGreaterThan(1000);  // vague
expect(files[0].data).toBeInstanceOf(Uint8Array);    // proves nothing useful
expect(args).toBeDefined();                   // weakest possible check
```

Good (exact):
```typescript
expect(result.operation).toBe('dft');
expect(result.getPayloadRaw().length).toBe(9925);
expect(files[0].data.length).toBe(8496);
expect(args.mint_amount).toBe(1000);
expect(args.request_ticker).toBe('atom');
```

**Why?** Lazy assertions pass even when the code is wrong. If the payload is supposed to be 9925 bytes but a bug makes it 520 (first chunk only), `toBeGreaterThan(0)` still passes. Exact values catch regressions that ranges miss.

### Binary Content: Save Reference Files and Compare Byte-for-Byte

When the parser extracts binary data (images, etc.), save the extracted file to `testdata/` as a reference and compare against it in tests:

```typescript
// Save once (during development): extract the image, visually verify it, commit to testdata/
// Then in tests:
const expectedImage = readBinaryFileAsUint8Array('atomical_dft_atom_image.png');
expect(files[0].data).toEqual(expectedImage);
```

Naming convention: `testdata/<artifact_type>_<description>_<content>.<ext>`
- `atomical_dft_atom_image.png`
- `atomical_nft_toothy_7579_image.png`
- `inscription_<inscriptionId>.png`

**The developer MUST visually inspect the image before committing it as a reference.** The test proves the parser reproduces the exact same bytes every time.

### Other Testing Rules

- Both Node.js and browser (jsdom) environments tested
- Some tests marked `xit()` as SLOW — these are stress tests, not needed for regular development

## Code Style

- TypeScript strict mode enabled
- Pure functions preferred (no DI, no classes with state where avoidable)
- Service pattern: `XxxParserService` as static classes with `parse()` methods
- Zero runtime dependencies — all algorithms inline (brotli, CBOR, RC4, etc.)

### File Organization

Helper functions go in separate `*.helper.ts` files, NOT inline in the service file. Tests live next to the code they test.

```
src/inscription/
├── inscription-parser.service.ts            # Main service (thin, delegates to helpers)
├── inscription-parser.service.helper.ts     # Helpers: field extraction, content decoding, etc.
├── inscription-parser.service.spec.ts       # Tests for the main service
├── inscription-parser.service.helper.spec.ts # Tests for the helpers
├── inscription-parser.service.parent.spec.ts # Tests for parent/child parsing
└── inscription-parser.service.properties.helper.ts  # Properties/gallery parsing helpers
```

Keep service files thin. Move complex logic to helper files where it can be tested independently.

### Browser Compatibility (CRITICAL)

This library runs in **both Node.js and browsers**. Every line of production code must work in both.

- **Use `Uint8Array`**, never Node's `Buffer`. `Buffer` is Node-only and fails in browsers.
- **Use `ArrayBuffer.isView(x)`** to check for binary data, never `x instanceof Uint8Array`. The `instanceof` check fails across realms (iframes, web workers) because each realm has its own `Uint8Array` constructor. `ArrayBuffer.isView()` works everywhere.
- **Use `TextEncoder`/`TextDecoder`** for string encoding, never `Buffer.from(str)`.
- **Use `ArrayBuffer` + `DataView`** for binary manipulation, never Node streams.
- `Buffer` is acceptable in **test code only** (`testdata/test.helper.ts`), but must be wrapped in `new Uint8Array()` before comparison with parser output.

### Lazy Evaluation Pattern

Expensive operations (CBOR decoding, decompression) are deferred to method calls, not computed eagerly in `parse()`. This way consumers who only need metadata skip the heavy work.

```typescript
// Inscription pattern:
contentType     // cheap: direct property
getContent()    // lazy: decompresses + decodes on demand
getDataRaw()    // lazy: returns raw bytes
getMetadata()   // lazy: CBOR-decodes metadata field

// Atomicals pattern (same idea):
operation       // cheap: direct property
getArgs()       // lazy: CBOR-decodes and returns args
getFiles()      // lazy: CBOR-decodes and extracts file attachments
getPayloadRaw() // lazy: returns raw CBOR bytes
```

### Content Serving Pattern (for parsers that return files)

The ordpool backend serves inscription content via `/content/:inscriptionId` and `/preview/:inscriptionId`. These routes use three data access methods, each serving a different purpose:

- **`getDataRaw()`** → `Uint8Array` — Raw bytes, NO decompression. Used by the backend to serve content with `Content-Encoding` header (browser decompresses). This is the main approach for server-side content delivery.
- **`getContent()`** → `Promise<string>` — UTF-8 string, decompressed. For text-based content (JSON, HTML, SVG, code).
- **`getDataUri()`** → `Promise<string>` — Base64 data URI, decompressed. For embedding in HTML previews (`<img src="data:image/png;base64,...">`) without a second network request.

**Every parser that returns binary content MUST provide all three access methods:**

1. `getDataRaw()` → `Uint8Array` — raw bytes for server-side content delivery
2. `getContent()` → `Promise<string>` — UTF-8 string for text-based content
3. `getDataUri()` → `Promise<string>` — base64 data URI for embedding in HTML previews
4. `contentType` as a direct property — needed for `Content-Type` header

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
- Detects the `atom` envelope marker in witness data (similar to inscriptions' `ord` marker)
- Extracts operation type and CBOR-encoded payload (multi-chunk, same as inscription body)
- Two CBOR file formats on mainnet: `{$ct, $b}` wrapper (old) and raw binary (new)
- Lazy API: `getArgs()`, `getFiles()`, `getPayloadRaw()`
- See `atomical-parser.service.helper.ts` for full documentation of operation types and terminology

### Labitbu
- 10,000 WebP images stored in Taproot witness control blocks (blocks 908,072–908,196)
- Detection: witness[2] == 4129 bytes + contains NUMS key (SHA-256 of "Labitbu")
- Extraction: find RIFF header in control block, take 4096 bytes of WebP data
- No inscription envelope — data lives in the control block's sibling hashes (128 × 32 bytes)
- Tracking uses ordinal theory (same as inscriptions) — the image lives on the first sat
- This approach inspired the CAT-21 fake inscription technique
- See https://github.com/labitbu/pathologies (ord fork) and https://github.com/stutxo/labitbu-maker
