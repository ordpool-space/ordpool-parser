// stripped and fixed version of
// ordpool -> backend/src/mempool.interfaces.ts
// ordpool -> backend/src/api/bitcoin/esplora-api.interface.ts
// to match the data of `block_84000_txns.ts`

export namespace IEsploraApi {

  export interface Transaction {
    txid: string;
    version: number;
    locktime: number;
    size: number;
    weight: number;
    fee: number;
    sigops?: number;
    vin: Vin[];
    vout: Vout[];
    status: Status;
    hex?: string;

    order?: number; // from MempoolTransactionExtended, optional
    adjustedVsize?: number; // from MempoolTransactionExtended, optional
    adjustedFeePerVsize?: number; // from MempoolTransactionExtended, optional

  }

  export interface Vin {
    txid: string;
    vout: number;
    is_coinbase: boolean;
    scriptsig: string;
    scriptsig_asm: string;
    inner_redeemscript_asm?: string; // changed to optional
    inner_witnessscript_asm?: string; // changed to optional
    sequence: any;
    witness?: string[];  // changed to optional
    prevout: Vout | null;
    // Elements
    is_pegin?: boolean;
    issuance?: Issuance;
    // Custom
    lazy?: boolean;
  }

  interface Issuance {
    asset_id: string;
    is_reissuance: string;
    asset_blinding_nonce: string;
    asset_entropy: string;
    contract_hash: string;
    assetamount?: number;
    assetamountcommitment?: string;
    tokenamount?: number;
    tokenamountcommitment?: string;
  }

  export interface Vout {
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address?: string; // changed to optional
    value: number;
    // Elements
    valuecommitment?: number;
    asset?: string;
    pegout?: Pegout;
  }

  interface Pegout {
    genesis_hash: string;
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_address: string;
  }

  export interface Status {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  }

  export interface Block {
    id: string;
    height: number;
    version: number;
    timestamp: number;
    bits: number;
    nonce: number;
    difficulty: number;
    merkle_root: string;
    tx_count: number;
    size: number;
    weight: number;
    previousblockhash: string;
    mediantime: number;
    stale: boolean;
  }
}

export interface Ancestor {
  txid: string;
  weight: number;
  fee: number;
}

interface BestDescendant {
  txid: string;
  weight: number;
  fee: number;
}

export interface TransactionExtended extends IEsploraApi.Transaction {
  vsize: number;
  feePerVsize: number;
  firstSeen?: number;
  effectiveFeePerVsize: number;
  ancestors?: Ancestor[];
  descendants?: Ancestor[];
  bestDescendant?: BestDescendant | null;
  cpfpChecked?: boolean;
  position?: {
    block: number,
    vsize: number,
  };
  acceleration?: boolean;
  replacement?: boolean;
  uid?: number;
  flags?: number;
}
