/**
 * Binary flags for transaction classification (ordpool's own flags only).
 *
 * Stored as bigint here, but downcast to JS Number when set on
 * tx._ordpoolFlags so upstream mempool's sync getTransactionFlags() can
 * OR them into tx.flags. The per-flag round-trip Number↔BigInt is exact
 * for every flag because each is a single power of 2 (verified by
 * ordpool/backend/src/mempool.interfaces.test.ts).
 *
 * Layout: bits 48–74. Upstream uses 0–44; bits 45–47 are kept free as a
 * safety margin in case upstream claims more bits in a future merge.
 *
 * - 48–54: top-level type flags (atomical, cat21, inscription, rune, brc20, src20, labitbu)
 * - 55–58: stamps-family + counterparty type flags (treated as types for filter UX)
 * - 59–62: inscription sub-ops (mint, content-type buckets image/text/json)
 * - 63–64: atomical sub-ops (mint, update)
 * - 65:    cat21 sub-op (mint)
 * - 66–68: rune sub-ops (etch, mint, cenotaph)
 * - 69–71: brc20 sub-ops (deploy, mint, transfer)
 * - 72–74: src20 sub-ops (deploy, mint, transfer)
 *
 * Bits 75–77 reserved for the next protocol.
 *
 * Used in:
 *   - ordpool -> backend/src/mempool.interfaces.ts (spread into TransactionFlags)
 *   - ordpool -> frontend/src/app/shared/filters.utils.ts (filter chips)
 *   - ordpool -> backend/src/api/ordpool-database-migration.ts (DB columns named after flag keys)
 */
export const OrdpoolTransactionFlags = {

  // Type flags (bits 48–54): always set when an artifact of that type is detected.
  ordpool_atomical:             1n << 48n,
  ordpool_cat21:                1n << 49n,
  ordpool_inscription:          1n << 50n,
  ordpool_rune:                 1n << 51n,
  ordpool_brc20:                1n << 52n,
  ordpool_src20:                1n << 53n,
  ordpool_labitbu:              1n << 54n,

  // Stamps-family + counterparty type flags (bits 55–58): treated as type flags
  // because the filter UX wants one chip per protocol family.
  ordpool_counterparty:         1n << 55n,
  ordpool_stamp:                1n << 56n,
  ordpool_src721:               1n << 57n,
  ordpool_src101:               1n << 58n,

  // Inscription sub-ops (bits 59–62). The content-type buckets coexist with
  // ordpool_inscription_mint -- a mint of an image sets both _mint and _image.
  ordpool_inscription_mint:     1n << 59n,
  ordpool_inscription_image:    1n << 60n,
  ordpool_inscription_text:     1n << 61n,
  ordpool_inscription_json:     1n << 62n,

  // Atomical sub-ops (bits 63–64).
  ordpool_atomical_mint:        1n << 63n,
  ordpool_atomical_update:      1n << 64n,

  // CAT-21 sub-op (bit 65). Always set together with ordpool_cat21 (every CAT-21
  // tx is a mint by protocol definition). Kept distinct so per-block stats can
  // count cat mints without the frontend having to know that detail.
  ordpool_cat21_mint:           1n << 65n,

  // Rune sub-ops (bits 66–68).
  ordpool_rune_etch:            1n << 66n,
  ordpool_rune_mint:            1n << 67n,
  ordpool_rune_cenotaph:        1n << 68n,

  // BRC-20 sub-ops (bits 69–71). Set only when the inscription's JSON content
  // parses cleanly as BRC-20 with no flaws.
  ordpool_brc20_deploy:         1n << 69n,
  ordpool_brc20_mint:           1n << 70n,
  ordpool_brc20_transfer:       1n << 71n,

  // SRC-20 sub-ops (bits 72–74). Set only when the stamp content parses
  // cleanly as SRC-20 with no flaws.
  ordpool_src20_deploy:         1n << 72n,
  ordpool_src20_mint:           1n << 73n,
  ordpool_src20_transfer:       1n << 74n,
};

export type OrdpoolTransactionFlag = typeof OrdpoolTransactionFlags[keyof typeof OrdpoolTransactionFlags];
