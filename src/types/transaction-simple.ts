
// simplified version of IEsploraApi.Transaction with only the properties we need for our parsers
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
