
/**
 * simplified version of IEsploraApi.Transaction with only the properties we need for our parsers
 */
export interface TransactionSimple {
  txid: string,
  locktime: number,
  weight: number, // NEW: to calculate the fee rate
  fee: number,    // NEW: to calculate the fee rate
  vin: {
    txid: string,
    witness?: string[] }[],
  vout: {
    scriptpubkey: string,
    scriptpubkey_type: string
  }[],
  status: {
    block_hash?: string, // undefined, if unconfirmed txn!
  }
}

/**
 * still simple but with some more details to enrich the CAT-21 mint stats
 */
export interface TransactionSimplePlus extends TransactionSimple {

  size: number;

  vout: {
    scriptpubkey: string,
    scriptpubkey_type: string,
    scriptpubkey_address?: string;
  }[]
}
