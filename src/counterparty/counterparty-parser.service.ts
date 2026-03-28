import { hexToBytes } from '../lib/conversions';
import { DigitalArtifactType } from '../types/digital-artifact';
import { ParsedCounterparty } from '../types/parsed-counterparty';
import { OnParseError } from '../types/parser-options';
import {
  hasCounterparty,
  tryDecryptMultisig,
  tryDecryptOpReturn,
} from './counterparty-parser.service.helper';

/**
 * Extracts Counterparty messages from Bitcoin transactions.
 *
 * Counterparty (2014) is the oldest Bitcoin meta-protocol. Home of Rare Pepes,
 * Spells of Genesis, and the first DEX on Bitcoin. Data is ARC4-encrypted
 * using vin[0].txid as key, prefixed with "CNTRPRTY".
 *
 * Three encoding methods:
 * 1. OP_RETURN — for messages ≤80 bytes (most common since 2017+)
 * 2. Multisig — for larger data (legacy, same format as SRC-20/Stamps)
 * 3. P2TR — Taproot witness envelope with metaprotocol "xcp" (v11+, 2024)
 */
export class CounterpartyParserService {

  /**
   * Parses a transaction and returns a ParsedCounterparty if Counterparty data is found.
   *
   * Detection order (fast → slow):
   * 1. OP_RETURN — decrypt ≤80 bytes, check CNTRPRTY prefix (fast)
   * 2. Multisig — extract pubkeys, decrypt, check prefix (expensive)
   * 3. P2TR — TODO: check inscription metaprotocol "xcp" (requires inscription parsing)
   */
  static parse(transaction: {
    txid: string,
    vin: { txid: string, witness?: string[] }[],
    vout: { scriptpubkey: string, scriptpubkey_type: string }[]
  }, onError?: OnParseError): ParsedCounterparty | null {

    try {
      if (!transaction.vin.length) {
        return null;
      }

      // ARC4 key = TXID of first input's previous output
      const arc4Key = hexToBytes(transaction.vin[0].txid);

      // 1. Try OP_RETURN (fast)
      let result = tryDecryptOpReturn(transaction.vout, arc4Key);

      // 2. Try Multisig (expensive, only if OP_RETURN didn't match)
      if (!result) {
        result = tryDecryptMultisig(transaction.vout, arc4Key);
      }

      // 3. TODO: Try P2TR (check inscription metaprotocol "xcp")

      if (!result) {
        return null;
      }

      const messageData = result.messageData;

      return {
        type: DigitalArtifactType.Counterparty,
        uniqueId: `${DigitalArtifactType.Counterparty}-${transaction.txid}`,
        transactionId: transaction.txid,
        messageType: result.messageType,
        messageTypeId: result.messageTypeId,
        encoding: result.encoding,

        getMessageData: (): Uint8Array => {
          return messageData;
        },
      };
    } catch (ex) {
      onError?.(ex);
      return null;
    }
  }

  /**
   * Quick check: returns true if a Counterparty message is found.
   *
   * For performance, only checks OP_RETURN (fast decrypt ≤80 bytes).
   * Multisig and P2TR are not checked here — those are deferred to parse().
   */
  static hasCounterparty(transaction: {
    vin: { txid: string }[],
    vout: { scriptpubkey: string, scriptpubkey_type: string }[]
  }): boolean {

    try {
      return hasCounterparty(transaction);
    } catch {
      return false;
    }
  }
}
