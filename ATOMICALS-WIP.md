# Atomicals Parser — Work In Progress

## Current State (2026-03-23)

### What's done (Phase 1 + Phase 2 — committed)

- **Detection**: `hasAtomical()` finds the `atom` marker (`00630461746f6d`) in witness data
- **Operation extraction**: Reads the operation byte(s) after the marker
- **CBOR payload decoding**: Concatenates multi-chunk pushdata (>520 bytes) and CBOR-decodes the full payload — same approach as the inscription parser's body extraction
- **Two verified operations with real mainnet test data**:
  - `dft` — tx `1d2f39f54320631d0432fa495a45a4f298a2ca1b18adef8e4356e327d003a694` (Atomical #0, the `atom` DFT token)
    - `args.request_ticker` = `"atom"`, `args.mint_amount` = `1000`
    - Contains embedded PNG image (`image.png`, `$ct: "image/png"`, ~8KB binary)
  - `nft` — tx `d8c96e3920f15dfbca4bcb3a3b2fce214484cb913fdca3055dd0f7069387edd3` (realm "terafab", #229861)
    - `args.request_realm` = `"terafab"`, `args.bitworkc` = `"8857"`
- **ParsedAtomical** returns `{ type, transactionId, uniqueId, operation, payload }`
- **16 tests** passing, all using real mainnet data
- **onError callback** wired in

### Phase 2 blocker — RESOLVED

The CBOR decoder was never broken. The problem was that Bitcoin Script limits pushdata to 520 bytes, so large CBOR payloads are **split across multiple pushdata elements** (same as inscription content). The DFT payload is 20 chunks of 520 bytes + 1 chunk of 45 bytes = 10,445 bytes total. We were only feeding the first 520-byte chunk to the CBOR decoder, which then choked trying to allocate an 8,496-byte string that didn't fit.

**Fix**: `extractAtomicalEnvelope()` now uses `readPushdata()` from `reader.ts` to collect all chunks until `OP_ENDIF`, concatenates them, then passes the full buffer to `CBOR.decodeFirst()`. This is the exact same pattern the inscription parser uses for body extraction.

### What's next (Phase 3 — more operation types)

1. **Find more test data** for unverified operations:
   - `ft` — direct fungible token (not distributed)
   - `mod`, `evt`, `dat` — state modifications
   - `sl` — container seal
   - Use atomicalmarket.com explorer or atomicals.tech/explore to find txids
   - Playwright browser automation works for these client-rendered sites

2. **Extract structured data from known payloads**:
   - NFT/realm: `args.request_realm` → realm name
   - DFT: `args.mint_amount`, `args.request_ticker` → token info
   - The `args` field is the structured metadata, other fields are file attachments

### Envelope structure (reverse-engineered from real data)

```
Witness element layout:
  <taproot script>
  OP_FALSE (00)
  OP_IF (63)
  OP_PUSHBYTES_4 (04)
  "atom" (61 74 6f 6d)
  <pushdata: operation string>    e.g., 03 "dft" or 03 "nft"
  <pushdata: CBOR chunk 1>       up to 520 bytes (OP_PUSHDATA2)
  <pushdata: CBOR chunk 2>       ...
  <pushdata: CBOR chunk N>       last chunk may be smaller
  OP_ENDIF (68)
```

The CBOR payload is a map. Known keys:
- `args` — always present, contains operation parameters
- `image.png`, `image.svg`, etc. — file attachments (NFTs)
- Each file attachment has `$ct` (content type) and `$b` (binary data)

### Key files

- `src/atomical/atomical-parser.service.ts` — main parser (CBOR decode + operation extraction)
- `src/atomical/atomical-parser.service.helper.ts` — detection, operation extraction, envelope extraction
- `src/atomical/atomical-parser.service.spec.ts` — tests
- `src/types/parsed-atomical.ts` — ParsedAtomical interface (with payload)
- `src/lib/cbor.ts` — CBOR decoder (works fine, was never the problem)
- `src/lib/reader.ts` — readPushdata() shared with inscription parser
- `testdata/tx_1d2f39f5...json` — DFT real data
- `testdata/tx_d8c96e39...json` — NFT (realm) real data

### Testing rules (from CLAUDE.md)

- ALL tests use real mainnet transaction data — zero exceptions
- If you claim to parse a type, you MUST have a real tx in testdata/ that proves it
- Use `readTransaction()` from `testdata/test.helper.ts` to load test data
- Fetch new test data via mempool.space API: `curl https://mempool.space/api/tx/<txid>`

### Git state

Branch `parser-dev`, all committed. When done: fast-forward `ordpool-v2` branch to `parser-dev`.
