# Atomicals Parser — Work In Progress

## Current State (2026-03-22)

### What's done (Phase 1 — committed)

- **Detection**: `hasAtomical()` finds the `atom` marker (`00630461746f6d`) in witness data
- **Operation extraction**: Reads the operation byte(s) after the marker
- **Two verified operations with real mainnet test data**:
  - `dft` — tx `1d2f39f54320631d0432fa495a45a4f298a2ca1b18adef8e4356e327d003a694` (Atomical #0, the `atom` DFT token)
  - `nft` — tx `d8c96e3920f15dfbca4bcb3a3b2fce214484cb913fdca3055dd0f7069387edd3` (realm "terafab", #229861)
- **ParsedAtomical** returns `{ type, transactionId, uniqueId, operation }`
- **11 tests** passing, all using real mainnet data
- **onError callback** wired in

### What's next (Phase 2 — CBOR payload decoding)

The CBOR payload after the operation byte contains the actual Atomicals data. We already have a CBOR decoder at `src/lib/cbor.ts`.

**NFT/realm payloads decode successfully:**
```
tx d8c96e39...: Direct push 64 bytes → CBOR decodes to:
{
  args: {
    bitworkc: "8857",
    request_realm: "terafab",
    nonce: 9232990,
    time: 1773568724
  }
}
```

**DFT payloads fail — CBOR decoder chokes on large payloads (520+ bytes):**
```
tx 1d2f39f5...: PUSHDATA2 520 bytes → CBOR decode error: "Invalid typed array length: 8496"
```

The DFT payload contains an embedded PNG image (binary blob inside CBOR map). The error suggests our CBOR decoder can't handle large byte strings or has a buffer allocation limit. **This is the blocker for Phase 2.**

### How to continue

1. **Fix the CBOR decoder** for large payloads:
   - Read `src/lib/cbor.ts` — find where `typed array length` is checked
   - The DFT CBOR contains: `{ image.png: { $ct: "image/png", $b: <large binary> }, args: {...} }`
   - The `$b` field is a raw PNG binary (~8KB) — our decoder probably can't allocate that
   - Fix: increase the allocation limit or handle large byte strings differently
   - **DO NOT change the CBOR encoder** — only the decoder is affected

2. **Add `payload` field to ParsedAtomical**:
   ```typescript
   export interface ParsedAtomical extends DigitalArtifact {
     operation: AtomicalOperation;
     payload: Record<string, unknown> | null;  // decoded CBOR, null if decode fails
   }
   ```

3. **Extract structured data from known payloads**:
   - NFT/realm: `args.request_realm` → realm name
   - DFT: `args.mint_amount`, `args.request_ticker` → token info
   - The `args` field is the structured metadata, other fields are file attachments

4. **Find more test data** for unverified operations:
   - `ft` — direct fungible token (not distributed)
   - `mod`, `evt`, `dat` — state modifications
   - `sl` — container seal
   - Use atomicalmarket.com explorer or atomicals.tech/explore to find txids
   - Playwright browser automation works for these client-rendered sites

### Envelope structure (reverse-engineered from real data)

```
Witness element layout:
  <taproot script>
  OP_FALSE (00)
  OP_IF (63)
  OP_PUSHBYTES_4 (04)
  "atom" (61 74 6f 6d)
  <pushdata: operation string>    e.g., 03 "dft" or 03 "nft"
  <pushdata: CBOR payload>        e.g., 4d <len16> <cbor bytes>
  OP_ENDIF (68)
```

The CBOR payload is a map. Known keys:
- `args` — always present, contains operation parameters
- `image.png`, `image.svg`, etc. — file attachments (NFTs)
- Each file attachment has `$ct` (content type) and `$b` (binary data)

### Key files

- `src/atomical/atomical-parser.service.ts` — main parser
- `src/atomical/atomical-parser.service.helper.ts` — detection + operation extraction
- `src/atomical/atomical-parser.service.spec.ts` — tests
- `src/types/parsed-atomical.ts` — ParsedAtomical interface
- `src/lib/cbor.ts` — CBOR decoder (needs fix for large payloads)
- `testdata/tx_1d2f39f5...json` — DFT real data
- `testdata/tx_d8c96e39...json` — NFT (realm) real data

### Testing rules (from CLAUDE.md)

- ALL tests use real mainnet transaction data — zero exceptions
- If you claim to parse a type, you MUST have a real tx in testdata/ that proves it
- Use `readTransaction()` from `testdata/test.helper.ts` to load test data
- Fetch new test data via mempool.space API: `curl https://mempool.space/api/tx/<txid>`

### Other work done in this session

- **onError callback** added to all parsers (optional, backward compatible)
- **BRC-20 types** wired into analyser service (was orphaned, now used)
- **prepublishOnly** typo fixed in package.json
- **CLAUDE.md** created with immutability rule, testing golden rule, architecture docs
- Working in git worktree at `/Users/johanneshoppe/Work/ordpool/ordpool-parser-dev` on branch `parser-dev`
- Original `ordpool-parser/` is untouched (running indexer uses it via npm link)

### Git state

Branch `parser-dev`, all committed. Commits:
1. `f4adc0d` — add .claude/CLAUDE.md, fix prepublishOnly typo
2. `561066b` — add optional onError callback to all parsers
3. `30ef070` — wire BRC-20 types into analyser service
4. `7d9dc65` — implement Atomicals Phase 1: detect operation type
5. `f51d0f6` — add real NFT test data for Atomicals parser

When done: fast-forward `ordpool-v2` branch to `parser-dev`.
