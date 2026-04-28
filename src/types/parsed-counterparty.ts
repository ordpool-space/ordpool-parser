import { DigitalArtifact } from "./digital-artifact";

/**
 * Known Counterparty message type IDs.
 * Source: counterparty-core Python source + JP Janssen's blog.
 *
 * Counterparty is the oldest Bitcoin meta-protocol (2014). Home of Rare Pepes,
 * Spells of Genesis, and the first DEX on Bitcoin. Every action is a real Bitcoin
 * L1 transaction with embedded data (OP_RETURN, multisig, or P2TR witness).
 *
 * All data is ARC4-encrypted using vin[0].txid as the key, then prefixed
 * with "CNTRPRTY" (0x434e545250525459). The message type ID follows.
 */
export type CounterpartyMessageType =
  | 'send'               // 0 — Classic send (v1, uses 4-byte ID encoding)
  | 'enhanced_send'      // 2 — Send with memo
  | 'mpma'               // 3 — Multi-Peer Multi-Asset send
  | 'sweep'              // 4 — Transfer all assets from one address to another
  | 'order'              // 10 — DEX order
  | 'btcpay'             // 11 — BTC payment for DEX match
  | 'dispenser'          // 12 — Vending machine for tokens
  | 'dispense'           // 13 — Auto-triggered dispense (DISPENSE_ID)
  | 'issuance'           // 20, 22 — Create/modify asset (22 = lock/reset)
  | 'issuance_subasset'  // 21, 23 — Create subasset (23 = lock/reset)
  | 'broadcast'          // 30 — Publish data/oracle feed
  | 'bet'                // 40 — Betting contract
  | 'dividend'           // 50 — Pay dividends to holders
  | 'burn'               // 60 — XCP proof-of-burn creation
  | 'cancel'             // 70 — Cancel open order/bet
  | 'rps'                // 80 — Rock-Paper-Scissors
  | 'rps_resolve'        // 81 — Reveal RPS choice
  | 'fairminter'         // 90 — Create fair mint token
  | 'fairmint'           // 91 — Mint from fair minter
  | 'utxo'               // 100 — UTXO attach/detach (legacy)
  | 'attach'             // 101 — Bind token to UTXO
  | 'detach'             // 102 — Unbind token from UTXO
  | 'destroy'            // 110 — Permanently destroy tokens
  | 'unknown';

/**
 * How the Counterparty data was encoded in the Bitcoin transaction.
 *
 * - 'opreturn' / 'multisig' / 'p2tr': CNTRPRTY-prefixed message data (the common case).
 * - 'destination': no message data on chain, classified by sending BTC to a hardcoded
 *   Counterparty address. Used by the proof-of-burn protocol (Jan-Feb 2014):
 *   any output to 1CounterpartyXXXXXXXXXXXXXXXUWLpVr (mainnet UNSPENDABLE) is a burn.
 */
export type CounterpartyEncoding = 'opreturn' | 'multisig' | 'p2tr' | 'destination';

export interface ParsedCounterparty extends DigitalArtifact {

  /**
   * The decoded message type (e.g., 'enhanced_send', 'dispenser', 'issuance').
   */
  messageType: CounterpartyMessageType;

  /**
   * The raw message type ID number from the Counterparty protocol.
   */
  messageTypeId: number;

  /**
   * How this message was encoded in the Bitcoin transaction.
   */
  encoding: CounterpartyEncoding;

  /**
   * The raw decrypted message bytes (after the CNTRPRTY prefix and message type ID).
   */
  getMessageData: () => Uint8Array;
}
