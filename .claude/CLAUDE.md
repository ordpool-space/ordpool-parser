# CLAUDE.md

`ordpool-parser`: zero-dependency TypeScript that parses Bitcoin digital artifacts (inscriptions, runes, BRC-20, SRC-20, CAT-21, atomicals, Labitbu, Counterparty, Stamps) out of Esplora-format transactions. Dual output: ESM `dist/`, CommonJS `dist-commonjs/`. Family-wide rules live in the workspace `CLAUDE.md`; this file is parser-specific.

Version 2.x is the v2 rewrite. Consumers are ordpool.space and cat21.space only, so no CHANGELOG.

## ABSOLUTE RULE: Never change CAT-21 output

- The protocol is LIVE. Cats are minted and owned; every appearance and trait is derived from `SHA256(txId + blockId)` and is immutable forever.
- Do NOT change `src/cat21/mooncat-parser.ts`, `src/cat21/mooncat-parser.traits.ts`, `src/cat21/mooncat-parser.designs.ts`, `src/cat21/mooncat-parser.colors.ts`, or any constant, magic number or byte offset in them. A bug fix that "improves" output is still forbidden.
- If you find a bug in CAT-21, the bug IS the specification. Document it, do not fix it.
- Safe changes only: NEW traits that do not affect existing output, refactors proven byte-identical by snapshot, perf work that changes no bytes, docs and comments.
- Before touching any CAT-21 file, run the full suite and verify ALL existing cat images match their snapshots byte-for-byte.

## ABSOLUTE RULE: Never delete protocol support without the maintainer's consent

- Never remove code, types, enum values, flags or routing because you could not find a test transaction. Say so instead; we find one together.
- Push back when a `/simplify` agent calls protocol support "dead code". It is not dead, it is waiting for its first transaction.

Why: the right response to missing evidence is to search harder for it, never to delete the support.

## GOLDEN RULE: Tests assert against real mainnet data

- Every test asserts against a real transaction, fetched by `npm run fetch-tx-testdata`, stored as `testdata/tx_<txid>.json` in Esplora format.
- Never fabricate transaction data. Never mock the parser input.
- Need data for a new feature? Find a real mainnet transaction that exercises it.

<!-- long-rule: the carve-out has four criteria and dropping one makes it unsafe -->

Scope: the rule governs transaction data and parser INPUT. A unit test of a pure helper taking bytes rather than a transaction (`bytesToStrictUnicodeString`, `readInstruction`, the CBOR reader) has no transaction to fake. Construct byte arrays freely there, preferring bytes lifted from a real inscription.

The one carve-out: a constructed envelope or script, allowed only when ALL four hold.

1. The shape is absent from a scan you RAN, not one you failed to find an example in. Name the block range in the file.
2. It is relayable and cheap, so its absence is an accident of history rather than a rule of Bitcoin.
3. What it pins is a hang, a crash, an unbounded read, or a field ord reads and we do not. A disagreement with ord about what a real inscription SAYS always needs a real transaction.
4. It is marked `SYNTHETIC INPUT` in the `describe()` title AND a file header naming the scan that found nothing. The title matters: the marking must reach test output, not just the source.

Replace a carve-out file with a mainnet fixture the day one appears. This is not permission to fabricate a transaction because finding the real one is tedious; that is the case the golden rule exists for.

Current carve-out files: `inscription-parser.service.oversized-push.spec.ts`, `inscription-parser.service.fuzz.spec.ts`, `inscription-parser.service.tag-bytes.spec.ts`.

## RULE: Claimed support needs a real transaction behind it

- If the parser claims to detect a type or operation, `testdata/` holds a real mainnet transaction exercising it.
- Cannot find one? Do not claim support for that type.

## RULE: No lazy assertions

- Assert exact deterministic values. Ranges and existence checks are forbidden.
- Banned: `expect(result).not.toBeNull()`, `toBeGreaterThan(520)`, `toBeInstanceOf(Uint8Array)`, `toBeDefined()`.
- Required: `expect(result.operation).toBe('dft')`, `expect(result.getPayloadRaw().length).toBe(9925)`, `expect(args.request_ticker).toBe('atom')`.

Why: a payload that should be 9925 bytes but is 520 (first chunk only) still passes `toBeGreaterThan(0)`. Exact values catch what ranges miss.

## RULE: Binary output is pinned byte-for-byte against a committed reference

- Extract the file, inspect it VISUALLY, commit it to `testdata/`, then compare: `expect(files[0].data).toEqual(readBinaryFileAsUint8Array('atomical_dft_atom_image.png'))`.
- Naming: `testdata/<artifact_type>_<description>_<content>.<ext>`, e.g. `atomical_nft_toothy_7579_image.png`, `inscription_<inscriptionId>.png`.

Why: the visual check is what makes the byte comparison meaningful; without it you pin whatever the parser did the first time.

## RULE: Every line of production code runs in Node AND the browser

- `Uint8Array`, never `Buffer`. `Buffer` is Node-only.
- `ArrayBuffer.isView(x)`, never `x instanceof Uint8Array`: `instanceof` fails across realms (iframes, workers), each having its own constructor.
- `TextEncoder`/`TextDecoder` for strings, never `Buffer.from(str)`. `ArrayBuffer` + `DataView` for binary, never Node streams.
- `Buffer` is allowed in test code only (`testdata/test.helper.ts`), wrapped in `new Uint8Array()` before comparing with parser output.

## RULE: Zero runtime dependencies

- All algorithms stay inline: brotli, CBOR, RC4. Never add an npm dependency.

Why: the library ships to browsers and to third parties; a dependency there is a supply-chain surface we do not control.

## RULE: Keep explanatory comments, and always decode hex

- Keep flow comments. This code parses script opcodes, CBOR and envelope structures; comments like "Update startPosition for the next iteration" are navigation, not noise. Do not strip them as "unnecessary WHAT comments".
- Every hex constant, test snippet and inline byte sequence carries its meaning: `'0063036f7264'` means nothing without `// OP_FALSE, OP_IF, OP_PUSHBYTES_3, 'o', 'r', 'd'`.
- Trim text inside a comment (no bombast, no before/after history); keep the block.

Why: humans cannot read hex, and a reader cannot reconstruct an opcode sequence from the bytes.

## RULE: Never quote counts in docs or comments

- No "436 tests", "39 suites", "63,000 cats" in any doc or comment. Describe the capability; anyone can run `npm test` for the number.

Why: they rot on the next commit and invite invented numbers when unverifiable.

## RULE: `parse()` returns null on error, silently

- Every `parse()` returns `null` rather than throwing: most Bitcoin data is not a valid artifact, and a parser must never crash its caller on malformed input. `null` means "not what you are looking for".
- Known trade-off: bugs in the parser itself are swallowed the same way. Log while developing, stay silent in production.

## RULE: An artifact the reference implementation rejects is not counted

- Before reporting an artifact, match the reference's validity decision, not just its parsing. A payload the reference refuses means NO artifact, not an artifact with empty fields.
- Atomicals: a non-empty payload that fails to CBOR-decode, or does not decode to a map, makes `atomicals-electrumx` `continue` past that input and record nothing (`util_atomicals.py:1306-1317`).
- Validate EAGERLY. Lazy decoding defeats this: the artifact gets built and counted before the payload is ever read.
- Incomplete: the reference also rejects a payload whose `meta`, `args`, `ctx` or `init` is not a whitelisted dict. Replicating it means copying `is_sanitized_dict_whitelist_only`, which returns on the FIRST nested dict instead of checking every key.

Why: these counts reach `ordpool_stats`, so a lenient parser inflates a statistic against its own reference.
Ref: `70cf3b0`

## RULE: CBOR text strings are decoded strictly where a reference is strict

- `CBOR.decode`/`decodeFirst` take an opt-in `strictUtf8`. It is set at metadata (tag 5), properties (tag 17), Atomicals and Counterparty.
- Every one of those references builds a native string and rejects invalid UTF-8: ciborium and minicbor (Rust `String`), `cbor2` (raises `CBORDecodeError`), `serde_cbor` (`Value::Text(String)`).
- A caller with no strict reference stays lenient. Do not make the decoder globally fatal.

Ref: `d247fc8`.

## RULE: Absence needs a census, presence does not

- One hit proves a shape exists on chain. Only a gapless scan proves it does not, so never report "none found" from a strided or sampled scan.
- A stride aliases against clustered populations. Four scans here reported a clean range and were wrong, the worst by nearly 14,000 blocks.
- Run the instrument against a block known to hold the shape before trusting any zero. A scanner that silently does nothing reports the same zero as a clean range.
- A scan that claims to replicate the parser carries no guard the parser lacks. A bounds check added for safety hid an entire era of payloads.
- Report the covered range with every count. A number without its range invites being read as chain-wide.

Why: a sampled zero and a measured zero read identically in a report, and a decision made on the wrong one cannot be recovered from the number.
Ref: `22d6ef8`.

## Commands

```bash
npm install
npm test                    # node + browser suites
npm run test:node           # node only
npm run test:browser        # jsdom only
npm run build               # ESM + CJS
npm run build:cat21         # standalone cat21.js (ESM + IIFE)
npm run fetch-tx-testdata   # download raw tx JSON for tests
npm run create-link         # build + npm link for local development
```

## Releasing

Two consumer paths:

**a) git SHA ref (backends).** `ordpool/backend` and `cat21-indexer/backend` pin `"ordpool-parser": "github:ordpool-space/ordpool-parser#<sha>"`. The `prepare` script builds on install, so no publish is needed: commit, push `main`, bump the SHA in the consumer's `package.json`, `npm install`, commit BOTH files.

**b) npm publish (`ordpool/frontend`, pinned `^2.0.x`).** Every publish needs a matching tag and GitHub release:

```bash
# bump version in package.json, commit "v2.0.x: <summary>", push main
git tag v2.0.x && git push origin v2.0.x
gh release create v2.0.x --title "v2.0.x" --notes "..."
npm publish --otp=<code>
```

## Architecture

Helpers live in `*.helper.ts`, never inline in the service; services stay thin and delegate. Tests sit next to the code they test.

```
src/
├── index.ts                        # public API exports
├── atomical/                       # `atom` envelope, CBOR payload, operation types
├── cat21/                          # FROZEN: mooncat-parser{,.traits,.designs,.colors}.ts
├── counterparty/                   # CBOR metadata from ord and OP_RETURN envelopes
├── inscription/                    # envelopes from witness data; .properties.helper.ts = tag 17
├── labitbu/                        # WebP in Taproot control blocks, NUMS key detection
├── rune/src/                       # forked JS rune lib, trimmed; nesting is original, do not "fix"
├── src20/                          # RC4 decryption of stamp data from multisig outputs
├── stamp/                          # Stamps / SRC-721 / SRC-101
├── types/                          # digital-artifact.ts, parsed-*.ts
├── lib/                            # reader.ts, conversions.ts, cbor.ts, brotli-decode.ts
└── digital-artifact-analyser.service.ts   # parses every artifact type at once
```

Style: TypeScript strict, pure functions, no DI, no `ILogger` abstractions, `XxxParserService` static classes with `parse()`.

## Public API

```typescript
DigitalArtifactsParserService.parse(tx): DigitalArtifact[]

InscriptionParserService.parse(tx): ParsedInscription[]
Cat21ParserService.parse(tx): ParsedCat21 | null
RuneParserService.parse(tx): ParsedRunestone | null
AtomicalParserService.parse(tx): ParsedAtomical | null
LabitbuParserService.parse(tx): ParsedLabitbu | null
Src20ParserService.parse(tx): ParsedSrc20 | null

DigitalArtifactAnalyserService.analyseTransactions(txs): Promise<OrdpoolStats>
DigitalArtifactAnalyserService.analyseTransaction(tx, flags): Promise<bigint>
```

## Integration contract: functional, not side-channel

`analyseTransaction(tx, flags) -> Promise<bigint>` takes the consumer's flag bigint, ORs in the artifact bits and returns the merged value. Both `backend/src/api/common.ts::Common.getTransactionFlags` and `frontend/src/app/shared/transaction.utils.ts::getTransactionFlags` rely on the RETURN VALUE, never a side-channel.

`analyseTransactions()` and `analyseTransaction()` still assign `tx._ordpoolFlags`. Flag classification no longer reads it, but **removing the assignment silently breaks OTS flagging**: `backend/src/api/ordpool-ots-flag.ts` mutates that field to inject the indexer-derived `ordpool_ots` bit before the final analyser call.

## Lazy evaluation, and where it must not apply

Expensive work (CBOR decode, decompression) is deferred to method calls so a consumer needing only `contentType` skips it: `getContent()`, `getDataRaw()`, `getMetadata()`, `getArgs()`, `getFiles()`, `getPayloadRaw()`.

Laziness stops at validity. See "An artifact the reference implementation rejects is not counted": whether an artifact EXISTS is decided eagerly in `parse()`.

## Content serving

`ordpool/backend` serves `/content/:inscriptionId` and `/preview/:inscriptionId`. Every parser returning binary content provides all four:

| member | returns | purpose |
|---|---|---|
| `getDataRaw()` | `Uint8Array` | raw bytes, NO decompression; the backend ships them with `Content-Encoding` and the browser decompresses |
| `getContent()` | `Promise<string>` | UTF-8, decompressed, for JSON/HTML/SVG/code |
| `getDataUri()` | `Promise<string>` | base64 data URI, decompressed, for HTML previews without a second request |
| `contentType` | property | the `Content-Type` header |

## Parser notes

- **CAT-21** (frozen): trait probabilities read bytes of the SHA-256 (byte[4] 0-50 = orange laser eyes, ~20%); genesis byte is `byte[0] === 79`; SVG is a 22x22 grid of `<rect>`. Adapted from the original MoonCat algorithm.
- **Inscriptions**: single, batch (pointer), parent-child, delegate, CBOR metadata. Brotli inline, gzip via native APIs.
- **Runes**: custom u128 (JS has no 128-bit int). Write operations and external deps removed so it runs in a browser.
- **SRC-20**: RC4 decryption from multisig outputs; deploy and mint.
- **Atomicals**: `atom` marker, multi-chunk CBOR payload. Two mainnet file formats: `{$ct, $b}` wrapper (old) and raw binary (new). See `atomical-parser.service.helper.ts` for operation types.
- **Labitbu**: 10,000 WebP images in Taproot control blocks, blocks 908072-908196. Detect `witness[2] == 4129` bytes containing the NUMS key (SHA-256 of "Labitbu"); take 4096 bytes of WebP after the RIFF header. No envelope: the data rides in the control block's 128 x 32 sibling hashes. Tracked by ordinal theory on the first sat. Refs: https://github.com/labitbu/pathologies, https://github.com/stutxo/labitbu-maker
- Some stress tests are marked `xit()` as SLOW and are not needed for regular development.
