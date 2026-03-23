import { BitcoinRpcVerboseBlock, BitcoinRpcVerboseTransaction } from "../types/bitcoin-rpc";
import { TransactionSimplePlus } from "../types/transaction-simple";

/**
 * Translates Bitcoin Core scriptPubKey types (TxoutType) to Esplora-style output types.
 *
 * This function provides a mapping between the script types defined in Bitcoin Core
 * and the ones used by Esplora. If a type is not recognized, it defaults to 'unknown'.

 * Known scriptPubKey types:
 * - `pubkey` (P2PK): Pay-to-Public-Key (rarely used today)
 * - `pubkeyhash` (P2PKH): Pay-to-Public-Key-Hash, the most common legacy type
 * - `scripthash` (P2SH): Pay-to-Script-Hash
 * - `witness_v0_keyhash` (v0_P2WPKH): SegWit Pay-to-Witness-Public-Key-Hash
 * - `witness_v0_scripthash` (v0_P2WSH): SegWit Pay-to-Witness-Script-Hash
 * - `witness_v1_taproot` (v1_P2TR): Taproot (SegWit v1)
 * - `nulldata` (OP_RETURN): Unspendable outputs used for metadata
 * - `multisig`: Multi-signature script
 * - `anchor`: Anchor outputs, see https://bitcoinops.org/en/topics/anchor-outputs/
 * - `nonstandard`: Scripts that do not conform to any standard
 *
 * NOT included in `translateScriptPubKeyType`, and therefore ignored
 * - `witness_unknown`: Witness outputs of undefined versions
 *
 * Sources:
 * Bitcoin Core
 * https://github.com/bitcoin/bitcoin/blob/228aba2c4d9ac0b2ca3edd3c2cdf0a92e55f669b/src/script/solver.h#L29
 * https://github.com/bitcoin/bitcoin/blob/228aba2c4d9ac0b2ca3edd3c2cdf0a92e55f669b/src/script/solver.cpp#L18
 *
 *   std::string GetTxnOutputType(TxoutType t)
 *   {
 *       switch (t) {
 *       case TxoutType::NONSTANDARD: return "nonstandard";
 *       case TxoutType::PUBKEY: return "pubkey";
 *       case TxoutType::PUBKEYHASH: return "pubkeyhash";
 *       case TxoutType::SCRIPTHASH: return "scripthash";
 *       case TxoutType::MULTISIG: return "multisig";
 *       case TxoutType::NULL_DATA: return "nulldata";
 *       case TxoutType::ANCHOR: return "anchor";
 *       case TxoutType::WITNESS_V0_KEYHASH: return "witness_v0_keyhash";
 *       case TxoutType::WITNESS_V0_SCRIPTHASH: return "witness_v0_scripthash";
 *       case TxoutType::WITNESS_V1_TAPROOT: return "witness_v1_taproot";
 *       case TxoutType::WITNESS_UNKNOWN: return "witness_unknown";
 *       } // no default case, so the compiler can warn about missing cases
 *       assert(false);
 *   }
 *
 * Mempool Electrs: https://github.com/mempool/electrs/blob/249848dc525bcf6234928ba3c570d895b903c813/src/rest.rs#L343
 * with some fancy own types!
 * and there is a converter in backend/src/api/bitcoin/bitcoin-api.ts -> translateScriptPubKeyType
 *
 * @param outputType - The Bitcoin Core `scriptPubKey` type (TxoutType).
 * @returns The corresponding Esplora-style output type.
 */
export function translateScriptPubKeyType(outputType: string): string {
  const typeMapping: { [key: string]: string } = {
    'pubkey': 'p2pk',                     // Pay-to-Public-Key
    'pubkeyhash': 'p2pkh',                // Pay-to-Public-Key-Hash
    'scripthash': 'p2sh',                 // Pay-to-Script-Hash
    'witness_v0_keyhash': 'v0_p2wpkh',    // SegWit Pay-to-Witness-Public-Key-Hash
    'witness_v0_scripthash': 'v0_p2wsh',  // SegWit Pay-to-Witness-Script-Hash
    'witness_v1_taproot': 'v1_p2tr',      // Taproot (SegWit v1)
    'nonstandard': 'nonstandard',         // Non-standard scripts
    'multisig': 'multisig',               // Multi-signature script
    'anchor': 'anchor',                   // Anchor output
    'nulldata': 'op_return',              // Unspendable metadata (OP_RETURN)

    // NOT included in translateScriptPubKeyType - will result to `unknown`
    // 'witness_unknown': 'witness_unknown' // Unknown Witness versions
  };

  // 'unknown' for unrecognized types
  return typeMapping[outputType] || 'unknown';
}


/**
 * Converts a BitcoinRpcVerboseBlock into an array of TransactionSimplePlus objects.
 *
 * This function adheres to Bitcoin Core and Esplora conventions:
 * For coinbase transactions, the `txid` is hardcoded to zeros.
 *
 * see also mempool/backend/src/api/bitcoin/bitcoin-api.ts
 * for a similar implementation with subtle differences...
 *
 * @param block - The block data in verbose format, retrieved from Bitcoin Core RPC.
 * @returns Array of transactions in TransactionSimplePlus format.
 */
export function convertVerboseBlockToSimplePlus(block: BitcoinRpcVerboseBlock): TransactionSimplePlus[] {
  return block.tx.map((tx) => {

    const isCoinbase = !!tx.vin[0]?.coinbase;

    return {
      txid: tx.txid,
      locktime: tx.locktime,
      weight: tx.weight,
      fee: Math.round((tx.fee ?? 0) * 100000000), // should be always set for verbosity 2
      size: tx.size,
      vin: tx.vin.map(vin => ({

        /**
         * txid:
         * - Hardcoded to zeros for coinbase transactions (Bitcoin Core/Esplora convention).
         * - For other transactions, uses the actual txid from the input.
         */
        txid: isCoinbase
          ? '0000000000000000000000000000000000000000000000000000000000000000'
          : vin.txid!,

        /**
         * Witness data:
         *
         * Mempool converter uses empty array if no witness data is present.
         * We will use `undefined` to stay closer to the Esplora implementation
         */
        // witness: vin.txinwitness || [],
        witness: vin.txinwitness,

        // NOT REQUIRED
        // /**
        //  * vout:
        //  * - Set to `undefined` for coinbase transactions.
        //  * - Actual vout index for regular transactions.
        //  */
        // vout: isCoinbase ? undefined : vin.vout!,

        // NOT REQUIRED
        // /**
        //  * Coinbase field:
        //  * - Included for coinbase transactions to preserve original data.
        //  */
        // coinbase: vin.coinbase || undefined,

        // NOT REQUIRED
        // /**
        //  * The script sequence number,
        //  * maximum value 4294967295 (0xFFFFFFFF) for coinbase
        //  */
        // sequence: vin.sequence,
      })),
      vout: tx.vout.map(vout => ({
        /**
         * Value of the output in satoshis.
         */
        value: Math.round(vout.value * 100000000),

        /**
         * Hex-encoded scriptPubKey.
         */
        scriptpubkey: vout.scriptPubKey.hex,

        /**
         * Type of the scriptPubKey (e.g., p2pkh, v0_p2wpkh, etc.). esplora style
         */
        scriptpubkey_type: translateScriptPubKeyType(vout.scriptPubKey.type),

        // Mempool implementation, with addresses array -- not provided by the RPC?!
        // /**
        //  * Address associated with the scriptPubKey.
        //  * - Uses `address` if available.
        //  * - Falls back to `addresses[0]` if multiple addresses exist.
        //  * - Undefined if no address is available.
        //  */
        // scriptpubkey_address: vout.scriptPubKey.address ||
        //   (vout.scriptPubKey.addresses ? vout.scriptPubKey.addresses[0] : undefined),
        scriptpubkey_address: vout.scriptPubKey.address
      })),
      status: {
        block_hash: block.hash,
        block_height: block.height,
        block_time: block.time,
      },
    };
  });
}

