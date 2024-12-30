import { OrdpoolTransactionFlag, OrdpoolTransactionFlags } from "./ordpool-transaction-flags";

type Activities = [string, number][]; // Each item is [identifier, count]
type Attempts = [string, string[]][]; // Each item is [identifier, [txId1, txId2, ...]]

export interface OrdpoolStats {

  amounts: {
    atomical: number;
    atomicalMint: number;        // unused, for now
    atomicalTransfer: number;    // unused, for now
    atomicalUpdate: number;      // unused, for now

    cat21: number;
    cat21Mint: number;
    cat21Transfer: number;       // unused, for now

    inscription: number;
    inscriptionMint: number;
    inscriptionTransfer: number; // unused, for now
    inscriptionBurn: number;     // unused, for now

    rune: number;
    runeEtch: number;
    runeMint: number;
    runeCenotaph: number;
    runeTransfer: number;         // unused, for now
    runeBurn: number;             // unused, for now

    brc20: number;
    brc20Deploy: number;
    brc20Mint: number;
    brc20Transfer: number;

    src20: number;
    src20Deploy: number;
    src20Mint: number;
    src20Transfer: number;
  },

  fees: {
    runeMints: number;
    nonUncommonRuneMints: number;
    brc20Mints: number;
    src20Mints: number;
    cat21Mints: number;
    atomicals: number;
    inscriptionMints: number;
  };

  inscriptions: {

    totalEnvelopeSize: number;
    totalContentSize: number;

    largestEnvelopeSize: number;
    largestContentSize: number;

    largestEnvelopeInscriptionId: string | null;
    largestContentInscriptionId: string | null;

    averageEnvelopeSize: number;
    averageContentSize: number;
  },

  runes: {
    mostActiveMint: string | null;
    mostActiveNonUncommonMint: string | null;
    runeMintActivity: Activities;
    runeEtchAttempts: Attempts;
  };

  brc20: {
    mostActiveMint: string | null;
    brc20MintActivity: Activities;
    brc20DeployAttempts: Attempts;
  };

  src20: {
    mostActiveMint: string | null;
    src20MintActivity: Activities;
    src20DeployAttempts: Attempts;
  };

  version: number;
}

// this empty object represents no parsed data
export function getEmptyStats(): OrdpoolStats {
  return {
    amounts: {
      atomical: 0,
      atomicalMint: 0,
      atomicalTransfer: 0,
      atomicalUpdate: 0,

      cat21: 0,
      cat21Mint: 0,
      cat21Transfer: 0,

      inscription: 0,
      inscriptionMint: 0,
      inscriptionTransfer: 0,
      inscriptionBurn: 0,

      rune: 0,
      runeEtch: 0,
      runeMint: 0,
      runeCenotaph: 0,
      runeTransfer: 0,
      runeBurn: 0,

      brc20: 0,
      brc20Deploy: 0,
      brc20Mint: 0,
      brc20Transfer: 0,

      src20: 0,
      src20Deploy: 0,
      src20Mint: 0,
      src20Transfer: 0,
    },

    fees: {
      runeMints: 0,
      nonUncommonRuneMints: 0,
      brc20Mints: 0,
      src20Mints: 0,
      cat21Mints: 0,
      atomicals: 0,
      inscriptionMints: 0,
    },

    inscriptions: {

      totalEnvelopeSize: 0,
      totalContentSize: 0,

      largestEnvelopeSize: 0,
      largestContentSize: 0,

      largestEnvelopeInscriptionId: null,
      largestContentInscriptionId: null,

      averageEnvelopeSize: 0,
      averageContentSize: 0,

    },

    runes: {
      mostActiveMint: null,
      mostActiveNonUncommonMint: null,
      runeMintActivity: [],
      runeEtchAttempts: []
    },

    brc20: {
      mostActiveMint: null,
      brc20MintActivity: [],
      brc20DeployAttempts: []
    },

    src20: {
      mostActiveMint: null,
      src20MintActivity: [],
      src20DeployAttempts: []
    },

    version: 0
  };
}

/**
 * Map between OrdpoolTransactionFlag and the corresponding field in OrdpoolStats.
 */
export function getArtifactTypeMap() {
  return new Map<OrdpoolTransactionFlag, keyof OrdpoolStats['amounts']>([

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
