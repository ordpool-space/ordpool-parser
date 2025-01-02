/**
 * Represents a verbose block returned by Bitcoin Core's `getblock` RPC with verbosity 2.
 * see https://bitcoincore.org/en/doc/22.0.0/rpc/blockchain/getblock/
 */
export interface BitcoinRpcVerboseBlock {
  /** The hash of the block */
  hash: string;
  /** The number of confirmations for this block (-1 if the block is not on the main chain) */
  confirmations: number;
  /** The full size of the serialized block (bytes) */
  size: number;
  /** The size of the block excluding witness data (bytes) */
  strippedsize: number;
  /** The block weight as defined in BIP 141 */
  weight: number;
  /** The height of the block in the blockchain */
  height: number;
  /** The block version as a number */
  version: number;
  /** The block version in hexadecimal format */
  versionHex: string;
  /** The merkle root of the transactions in the block */
  merkleroot: string;
  /**
   * The list of transactions in the block.
   * - Contains full verbose transaction objects (`BitcoinRpcVerboseTransaction`) in verbosity 2.
   */
  tx: BitcoinRpcVerboseTransaction[];
  /** The time the block was mined (UNIX epoch time) */
  time: number;
  /** The median block time (UNIX epoch time) */
  mediantime: number;
  /** The nonce used in the proof-of-work algorithm */
  nonce: number;
  /** The compact difficulty target in hexadecimal format */
  bits: string;
  /** The difficulty value of the block */
  difficulty: number;
  /** The cumulative chainwork in hexadecimal format */
  chainwork: string;
  /** The number of transactions in the block */
  nTx: number;
  /** The hash of the previous block (optional if no previous block exists, e.g., for the genesis block) */
  previousblockhash?: string;
  /** The hash of the next block (optional if no next block exists) */
  nextblockhash?: string;
}

/**
 * Represents a verbose transaction returned by Bitcoin Core's `getrawtransaction` RPC or as part of
 * a verbose block from `getblock` with verbosity 2.
 * see https://bitcoincore.org/en/doc/22.0.0/rpc/rawtransactions/getrawtransaction/
 *
 * Note: the transaction data does not include redundant fields such as
 * `blockhash`, `confirmations`, `blocktime`, and `time`,
 * which are part of the block header data and not specific to individual transactions.
 */
export interface BitcoinRpcVerboseTransaction {
  /** The transaction ID */
  txid: string;
  /** The transaction hash (differs from `txid` for witness transactions) */
  hash: string;
  /** The full serialized size of the transaction (in bytes) */
  size: number;
  /** The virtual size of the transaction, accounting for witness data (in bytes) */
  vsize: number;
  /** The weight of the transaction (as defined in BIP 141) */
  weight: number;
  /** The transaction version */
  version: number;
  /** The locktime of the transaction */
  locktime: number;

  /**
   * The transaction inputs.
   * - Standard transactions include `txid` and `vout` referencing previous outputs.
   * - Coinbase transactions omit `txid` and `vout` and include `coinbase` instead.
   */
  vin: {
    /** The transaction ID of the input being spent (absent for coinbase transactions) */
    txid?: string;
    /** The index of the output being spent (absent for coinbase transactions) */
    vout?: number;
    /** The unlocking script for the input (present for non-coinbase transactions) */
    scriptSig?: {
      /** The script assembly */
      asm: string;
      /** The script in hexadecimal format */
      hex: string;
    };
    /** The sequence number of the input */
    sequence: number;
    /**
     * The witness data for SegWit transactions.
     * - Contains the stack of witness elements, if applicable.
     */
    txinwitness?: string[];
    /**
     * The coinbase data for coinbase transactions.
     * - Present only if `txid` and `vout` are absent.
     */
    coinbase?: string;
  }[];

  /**
   * The transaction outputs.
   * - Includes the outputs created by this transaction.
   */
  vout: {
    /** The value of the output in BTC */
    value: number;
    /** The index of the output in the transaction */
    n: number;
    /** The locking script for the output */
    scriptPubKey: {
      /** The script assembly */
      asm: string;
      /** The script in hexadecimal format */
      hex: string;
      /** The type of the scriptPubKey (e.g., `pubkeyhash`, `scripthash`, `nulldata`) */
      type: string;
      /** The Bitcoin address associated with the scriptPubKey (if applicable) */
      address?: string;
      /**
       * A descriptor that may include additional metadata for this output.
       * - For example, it may include a checksum or type information.
       */
      desc?: string;
    };
  }[];

  /**
   * The fee paid for this transaction in BTC.
   * - Present only if block undo data is available.
   */
  fee?: number;

  /**
   * The raw serialized transaction in hexadecimal format.
   * - Useful for debugging or re-broadcasting transactions.
   */
  hex: string;
}

