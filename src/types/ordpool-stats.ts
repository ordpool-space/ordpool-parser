import { OrdpoolTransactionFlag, OrdpoolTransactionFlags } from "./ordpool-transaction-flags";

export interface OrdpoolStats {
  version: number | null;
  amount: {
    atomical: number | null;
    atomicalMint: number | null;
    atomicalTransfer: number | null;
    atomicalUpdate: number | null;

    cat21: number | null;
    cat21Mint: number | null;
    cat21Transfer: number | null;

    inscription: number | null;
    inscriptionMint: number | null;
    inscriptionTransfer: number | null;
    inscriptionBurn: number | null;

    rune: number | null;
    runeEtch: number | null;
    runeMint: number | null;
    runeCenotaph: number | null;
    runeTransfer: number | null;
    runeBurn: number | null;

    brc20: number | null;
    brc20Deploy: number | null;
    brc20Mint: number | null;
    brc20Transfer: number | null;

    src20: number | null;
    src20Deploy: number | null;
    src20Mint: number | null;
    src20Transfer: number | null;
  }
}

// this empty object represents no parsed data
export function getEmptyStats(): OrdpoolStats {
  return {
    version: null,
    amount: {
      atomical: null,
      atomicalMint: null,
      atomicalTransfer: null,
      atomicalUpdate: null,

      cat21: null,
      cat21Mint: null,
      cat21Transfer: null,

      inscription: null,
      inscriptionMint: null,
      inscriptionTransfer: null,
      inscriptionBurn: null,

      rune: null,
      runeEtch: null,
      runeMint: null,
      runeCenotaph: null,
      runeTransfer: null,
      runeBurn: null,

      brc20: null,
      brc20Deploy: null,
      brc20Mint: null,
      brc20Transfer: null,

      src20: null,
      src20Deploy: null,
      src20Mint: null,
      src20Transfer: null,
    }
  };
}

/**
 * Map between OrdpoolTransactionFlag and the corresponding field in OrdpoolStats.
 */
export function getArtifactTypeMap() {
  return new Map<OrdpoolTransactionFlag, keyof OrdpoolStats['amount']>([

    [OrdpoolTransactionFlags.ordpool_atomical,              'atomical'],
    [OrdpoolTransactionFlags.ordpool_atomical_mint,         'atomicalMint'],
    [OrdpoolTransactionFlags.ordpool_atomical_transfer,     'atomicalTransfer'],
    [OrdpoolTransactionFlags.ordpool_atomcial_update,       'atomicalUpdate'],

    [OrdpoolTransactionFlags.ordpool_cat21,                 'cat21'],
    [OrdpoolTransactionFlags.ordpool_cat21_mint,            'cat21Mint'],
    [OrdpoolTransactionFlags.ordpool_cat21_transfer,        'cat21Transfer'],

    [OrdpoolTransactionFlags.ordpool_inscription,           'inscription'],
    [OrdpoolTransactionFlags.ordpool_inscription_mint,      'inscriptionMint'],
    [OrdpoolTransactionFlags.ordpool_inscription_transfer,  'inscriptionTransfer'],
    [OrdpoolTransactionFlags.ordpool_inscription_burn,      'inscriptionBurn'],

    [OrdpoolTransactionFlags.ordpool_rune,                  'rune'],
    [OrdpoolTransactionFlags.ordpool_rune_etch,             'runeEtch'],
    [OrdpoolTransactionFlags.ordpool_rune_mint,             'runeMint'],
    [OrdpoolTransactionFlags.ordpool_rune_cenotaph,         'runeCenotaph'],
    [OrdpoolTransactionFlags.ordpool_rune_transfer,         'runeTransfer'],
    [OrdpoolTransactionFlags.ordpool_rune_burn,             'runeBurn'],

    [OrdpoolTransactionFlags.ordpool_brc20,                 'brc20'],
    [OrdpoolTransactionFlags.ordpool_brc20_deploy,          'brc20Deploy'],
    [OrdpoolTransactionFlags.ordpool_brc20_mint,            'brc20Mint'],
    [OrdpoolTransactionFlags.ordpool_brc20_transfer,        'brc20Transfer'],

    [OrdpoolTransactionFlags.ordpool_src20,                 'src20'],
    [OrdpoolTransactionFlags.ordpool_src20_deploy,          'src20Deploy'],
    [OrdpoolTransactionFlags.ordpool_src20_mint,            'src20Mint'],
    [OrdpoolTransactionFlags.ordpool_src20_transfer,        'src20Transfer'],
  ]);
}
