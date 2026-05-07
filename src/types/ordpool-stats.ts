import { AtomicalOperation } from "../atomical/atomical-parser.service.helper";
import { CounterpartyEncoding, CounterpartyMessageType } from "./parsed-counterparty";
import { OrdpoolTransactionFlag, OrdpoolTransactionFlags } from "./ordpool-transaction-flags";
import { CatTraits } from "./parsed-cat21";

export type MintActivity = [string, number];
export type MintActivities = MintActivity[]; // Each item is [identifier, count]

// flattened version of RuneEtchingSpec, with strings instead of bigint for better serializability
export interface RuneEtchAttempt {
  txId: string;
  runeId: string; // blockHeight:txIndex
  runeName?: string;
  divisibility?: number;
  premine?: string;
  symbol?: string;
  cap?: string; // Cap of the Rune (from terms)
  amount?: string; // Amount of the Rune (from terms)
  offsetStart?: string; // Offset start (from terms.offset)
  offsetEnd?: string; // Offset end (from terms.offset)
  heightStart?: string; // Height start (from terms.height)
  heightEnd?: string; // Height end (from terms.height)
  turbo?: boolean;
}

export interface Brc20DeployAttempt {
  txId: string;
  ticker: string;
  maxSupply: string;
  mintLimit?: string;
  decimals?: string; // Default to 18 if not specified
}

export interface Src20DeployAttempt {
  txId: string;
  ticker: string;
  maxSupply: string;
  mintLimit: string; // Required for SRC-20
  decimals?: string; // Default to 18 if not specified
}

/** One Atomicals operation observed in this block. Mirror of the runeEtch /
 *  brc20Deploy / src20Deploy satellite shape. `ticker` is the ticker symbol
 *  for FT-family ops (ft / dft / dmt) read from `args.request_ticker`; null
 *  for ops that don't carry one (nft, mod, evt, sl, …). */
export interface AtomicalOp {
  txId: string;
  operation: AtomicalOperation;
  ticker: string | null;
}

/** One Counterparty message observed in this block. Counterparty has 22+
 *  message types (sends, dispensers, fairmints, bets, sweeps, …) and we want
 *  per-message-type charts — recording each tx's type lets the consumer
 *  group-by message_type. */
export interface CounterpartyMessage {
  txId: string;
  messageType: CounterpartyMessageType;
  messageTypeId: number;
  encoding: CounterpartyEncoding;
}

export interface Cat21Mint {
  /**
   * The transactionId (hash in hex format) where the CAT-21 ordinal was created / minted
   */
  transactionId: string;
  /**
   * The blockId (hash in hex format) where the CAT-21 ordinal was created / minted
   */
  blockId: string;

  /**
   * The index of the transaction in the block
   */
  txIndex: number;

  /**
   * The incremented number of the cat. Cat #0 is the first one. `undefined` if the number is not determined yet.
   */
  number?: number;

  /**
   * The paid fee rate that determines the color of the cat.
   */
  feeRate: number;

  /**
   * The block height where the CAT-21 ordinal was created / minted
   */
  blockHeight: number;

  /**
   * The block time where the CAT-21 ordinal was created / minted (Unit: seconds)'
   */
  blockTime: number;

  /**
  /**
   * Total fees paid to process the mint transaction (Unit: sats)
   */
  fee: number;

  /**
   * Total size of the mint transaction (Unit: bytes)
   */
  size: number;

  /**
   * Weight of the mint transaction, which is a measurement to compare the size of different transactions to each other in proportion to the block size limit (Unit: WU)
   */
  weight: number;

  /**
   * Value of the first output of the mint transaction (Unit: sats)
   */
  value: number;

  /**
   * The satoshi that is associated with the cat. `undefined` if the sat is not determined yet.
   */
  sat?: number;

  /**
   * The first cat owner (Address that received the first output of the mint transaction)
   */
  firstOwner: string;

  /**
   * All traits of the cat
   */
  traits: CatTraits;
}

export interface MinimalCat21Mint {
  /**
   * The transactionId (hash in hex format) where the CAT-21 ordinal was created / minted
   */
  transactionId: string;

  /**
  /**
   * Total fees paid to process the mint transaction (Unit: sats)
   */
  fee: number;

  /**
   * Weight of the mint transaction, which is a measurement to compare the size of different transactions to each other in proportion to the block size limit (Unit: WU)
   */
  weight: number;
}

/**
 * Inscription size aggregates over a set of inscriptions (whole block, or one
 * content-type bucket). The same shape is used for the global block aggregate
 * (`OrdpoolStats.inscriptions`) and per-bucket aggregates (`.image`, `.text`,
 * `.json`). Buckets are mutually exclusive, so the per-bucket totals sum to
 * the global totals.
 */
export interface InscriptionSizeAggregate {
  totalEnvelopeSize: number;
  totalContentSize: number;

  largestEnvelopeSize: number;
  largestContentSize: number;

  largestEnvelopeInscriptionId: string | null;
  largestContentInscriptionId: string | null;

  averageEnvelopeSize: number;
  averageContentSize: number;
}

/** Helper: empty size-aggregate row, used in getEmptyStats() and as the
 *  initial state for each bucket counter inside the analyser. */
export function getEmptyInscriptionSizeAggregate(): InscriptionSizeAggregate {
  return {
    totalEnvelopeSize: 0,
    totalContentSize: 0,
    largestEnvelopeSize: 0,
    largestContentSize: 0,
    largestEnvelopeInscriptionId: null,
    largestContentInscriptionId: null,
    averageEnvelopeSize: 0,
    averageContentSize: 0,
  };
}


export interface OrdpoolStats {

  amounts: {
    atomical: number;
    atomicalMint: number;
    atomicalUpdate: number;

    cat21: number;
    cat21Mint: number;

    inscription: number;
    inscriptionMint: number;
    inscriptionImage: number;
    inscriptionText: number;
    inscriptionJson: number;

    rune: number;
    runeEtch: number;
    runeMint: number;
    runeCenotaph: number;

    brc20: number;
    brc20Deploy: number;
    brc20Mint: number;
    brc20Transfer: number;

    src20: number;
    src20Deploy: number;
    src20Mint: number;
    src20Transfer: number;

    counterparty: number;
    stamp: number;
    stampImage: number;
    stampText: number;
    stampJson: number;
    src721: number;
    src101: number;

    atomicalImage: number;
    atomicalText: number;
    atomicalJson: number;
  },

  fees: {
    runeMints: number;
    nonUncommonRuneMints: number;
    brc20Mints: number;
    src20Mints: number;
    cat21Mints: number;
    atomicals: number;
    inscriptionMints: number;

    // Per-content-type inscription mint fees. Each inscription belongs to
    // exactly one bucket (image XOR text XOR json — see `analyse()` in the
    // analyser service for the bucket logic), so the three fields sum to
    // inscriptionMints (modulo inscriptions whose content type matches none
    // of the buckets, which contribute to inscriptionMints only).
    inscriptionImageMints: number;
    inscriptionTextMints: number;
    inscriptionJsonMints: number;
  };

  inscriptions: InscriptionSizeAggregate & {

    /** Per-content-type inscription size aggregates. Same shape as the
     *  global aggregate above; sums to the global total minus inscriptions
     *  whose content type is none of the three buckets. */
    image: InscriptionSizeAggregate;
    text: InscriptionSizeAggregate;
    json: InscriptionSizeAggregate;

    /** Inscriptions in this block whose body was Content-Encoding: br. */
    brotliCount: number;
    /** Inscriptions in this block whose body was Content-Encoding: gzip. */
    gzipCount: number;
    /** Sum of envelope sizes for inscriptions that used any compression.
     *  Compared against `totalEnvelopeSize` this gives the "what fraction
     *  of inscription weight is compressed" view. */
    compressedEnvelopeBytes: number;
  },

  runes: {
    mostActiveMint: string | null;
    mostActiveNonUncommonMint: string | null;
    runeMintActivity: MintActivities;
    runeEtchAttempts: RuneEtchAttempt[];

    /** Distinct rune IDs that saw any mint activity in this block. */
    uniqueMintsCount: number;
    /** Same, excluding UNCOMMON•GOODS (rune 1:0). */
    uniqueMintsCountNonUncommon: number;

    /** Mint count of the most-active rune in this block. */
    topMintCount: number;
    /** Same, excluding UNCOMMON•GOODS. */
    topMintCountNonUncommon: number;
  };

  brc20: {
    mostActiveMint: string | null;
    brc20MintActivity: MintActivities;
    brc20DeployAttempts: Brc20DeployAttempt[];
  };

  src20: {
    mostActiveMint: string | null;
    src20MintActivity: MintActivities;
    src20DeployAttempts: Src20DeployAttempt[];
  };

  cat21: {
    cat21MintActivity?: Cat21Mint[];
    minimalCat21MintActivity?: MinimalCat21Mint[];

    /** # cats with the genesis trait minted in this block. (The genesis
     *  trait is hash-derived; ~1/256 of cats by probability.) */
    genesisCount: number;

    /** AVG / MIN / MAX of feeRate (sat/vB) across cats minted this block.
     *  null for blocks with no CAT-21 mints. */
    avgFeeRate: number | null;
    minFeeRate: number | null;
    maxFeeRate: number | null;
  };

  atomicals: {
    atomicalOps: AtomicalOp[];
  };

  counterparty: {
    counterpartyMessages: CounterpartyMessage[];
  };

  version: number;
}

// this empty object represents no parsed data
export function getEmptyStats(): OrdpoolStats {
  return {
    amounts: {
      atomical: 0,
      atomicalMint: 0,
      atomicalUpdate: 0,

      cat21: 0,
      cat21Mint: 0,

      inscription: 0,
      inscriptionMint: 0,
      inscriptionImage: 0,
      inscriptionText: 0,
      inscriptionJson: 0,

      rune: 0,
      runeEtch: 0,
      runeMint: 0,
      runeCenotaph: 0,

      brc20: 0,
      brc20Deploy: 0,
      brc20Mint: 0,
      brc20Transfer: 0,

      src20: 0,
      src20Deploy: 0,
      src20Mint: 0,
      src20Transfer: 0,

      counterparty: 0,
      stamp: 0,
      stampImage: 0,
      stampText: 0,
      stampJson: 0,
      src721: 0,
      src101: 0,

      atomicalImage: 0,
      atomicalText: 0,
      atomicalJson: 0,
    },

    fees: {
      runeMints: 0,
      nonUncommonRuneMints: 0,
      brc20Mints: 0,
      src20Mints: 0,
      cat21Mints: 0,
      atomicals: 0,
      inscriptionMints: 0,
      inscriptionImageMints: 0,
      inscriptionTextMints: 0,
      inscriptionJsonMints: 0,
    },

    inscriptions: {
      ...getEmptyInscriptionSizeAggregate(),
      image: getEmptyInscriptionSizeAggregate(),
      text: getEmptyInscriptionSizeAggregate(),
      json: getEmptyInscriptionSizeAggregate(),
      brotliCount: 0,
      gzipCount: 0,
      compressedEnvelopeBytes: 0,
    },

    runes: {
      mostActiveMint: null,
      mostActiveNonUncommonMint: null,
      runeMintActivity: [],
      runeEtchAttempts: [],
      uniqueMintsCount: 0,
      uniqueMintsCountNonUncommon: 0,
      topMintCount: 0,
      topMintCountNonUncommon: 0,
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

    cat21: {
      cat21MintActivity: [],
      minimalCat21MintActivity: undefined,
      genesisCount: 0,
      avgFeeRate: null,
      minFeeRate: null,
      maxFeeRate: null,
    },

    atomicals: {
      atomicalOps: [],
    },

    counterparty: {
      counterpartyMessages: [],
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
    [OrdpoolTransactionFlags.ordpool_atomical_update,       'atomicalUpdate'],

    [OrdpoolTransactionFlags.ordpool_cat21,                 'cat21'],
    [OrdpoolTransactionFlags.ordpool_cat21_mint,            'cat21Mint'],

    [OrdpoolTransactionFlags.ordpool_inscription,           'inscription'],
    [OrdpoolTransactionFlags.ordpool_inscription_mint,      'inscriptionMint'],
    [OrdpoolTransactionFlags.ordpool_inscription_image,     'inscriptionImage'],
    [OrdpoolTransactionFlags.ordpool_inscription_text,      'inscriptionText'],
    [OrdpoolTransactionFlags.ordpool_inscription_json,      'inscriptionJson'],

    [OrdpoolTransactionFlags.ordpool_rune,                  'rune'],
    [OrdpoolTransactionFlags.ordpool_rune_etch,             'runeEtch'],
    [OrdpoolTransactionFlags.ordpool_rune_mint,             'runeMint'],
    [OrdpoolTransactionFlags.ordpool_rune_cenotaph,         'runeCenotaph'],

    [OrdpoolTransactionFlags.ordpool_brc20,                 'brc20'],
    [OrdpoolTransactionFlags.ordpool_brc20_deploy,          'brc20Deploy'],
    [OrdpoolTransactionFlags.ordpool_brc20_mint,            'brc20Mint'],
    [OrdpoolTransactionFlags.ordpool_brc20_transfer,        'brc20Transfer'],

    [OrdpoolTransactionFlags.ordpool_src20,                 'src20'],
    [OrdpoolTransactionFlags.ordpool_src20_deploy,          'src20Deploy'],
    [OrdpoolTransactionFlags.ordpool_src20_mint,            'src20Mint'],
    [OrdpoolTransactionFlags.ordpool_src20_transfer,        'src20Transfer'],

    // ordpool_labitbu intentionally omitted: the flag still fires for
    // historical blocks (908,072–908,196) but block-level stats are not
    // recorded any more — Labitbu is a one-time event with a finite
    // mint window. See `labitbu-parser.service.helper.ts` for the height
    // gate on the parser side.
    [OrdpoolTransactionFlags.ordpool_counterparty,          'counterparty'],
    [OrdpoolTransactionFlags.ordpool_stamp,                 'stamp'],
    [OrdpoolTransactionFlags.ordpool_stamp_image,           'stampImage'],
    [OrdpoolTransactionFlags.ordpool_stamp_text,            'stampText'],
    [OrdpoolTransactionFlags.ordpool_stamp_json,            'stampJson'],
    [OrdpoolTransactionFlags.ordpool_src721,                'src721'],
    [OrdpoolTransactionFlags.ordpool_src101,                'src101'],

    [OrdpoolTransactionFlags.ordpool_atomical_image,        'atomicalImage'],
    [OrdpoolTransactionFlags.ordpool_atomical_text,         'atomicalText'],
    [OrdpoolTransactionFlags.ordpool_atomical_json,         'atomicalJson'],
  ]);
}
