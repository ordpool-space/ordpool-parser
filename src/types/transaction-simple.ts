
/**
 * simplified version of IEsploraApi.Transaction with only the properties we need for our parsers
 */
export interface TransactionSimple {
  txid: string;
  locktime: number;
  weight: number; // to calculate the CAT-21 fee rate
  fee: number;    // to calculate the CAT-21 fee rate
  vin: {
    txid: string;
    witness?: string[] }[];
  vout: {
    scriptpubkey: string;
    scriptpubkey_type: string;
  }[];
  status: {
    block_hash?: string; // undefined; if unconfirmed txn!
  }
}

/**
 * still simple but with some more details to enrich the CAT-21 mint stats
 */
export interface TransactionSimplePlus extends TransactionSimple {

  size: number;

  vout: {
    scriptpubkey: string;
    scriptpubkey_type: string;
    scriptpubkey_address?: string;
    value: number;
  }[];

  status: {
    block_hash?: string; // `undefined` if unconfirmed txn
    block_height?: number; // `undefined` if unconfirmed txn
    block_time?: number; // `undefined` if unconfirmed txn
  }
}
