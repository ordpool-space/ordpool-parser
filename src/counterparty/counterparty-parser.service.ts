import { hexToBytes } from '../lib/conversions';
import { DigitalArtifactType } from '../types/digital-artifact';
import { ParsedCounterparty } from '../types/parsed-counterparty';
import { OnParseError } from '../types/parser-options';
import {
  tryDecryptMultisig,
  tryDecryptOpReturn,
  tryDetectBurn,
  tryExtractP2tr,
} from './counterparty-parser.service.helper';

/**
 * Extracts Counterparty messages from Bitcoin transactions.
 *
 * Counterparty (2014) is the oldest Bitcoin meta-protocol. Home of Rare Pepes,
 * Spells of Genesis, and the first DEX on Bitcoin. Data is ARC4-encrypted
 * using vin[0].txid as key, prefixed with "CNTRPRTY".
 *
 * Four detection paths:
 * 1. OP_RETURN -- for messages <=80 bytes (most common since 2017+)
 * 2. Multisig -- for larger data (legacy, same format as SRC-20/Stamps)
 * 3. P2TR -- Taproot witness envelope (v11+, block 902,000)
 * 4. Destination address -- proof-of-burn (no message data, identified by
 *    output paying the hardcoded UNSPENDABLE address). Burn period was
 *    blocks 278,310-283,810 (Jan-Feb 2014).
 */
export class CounterpartyParserService {

  /**
   * Parses a transaction and returns a ParsedCounterparty if Counterparty data is found.
   *
   * Detection order (cheapest first):
   * 1. P2TR -- literal "CNTRPRTY" OP_RETURN + witness envelope (no decryption)
   * 2. OP_RETURN -- ARC4 decrypt <=80 bytes, check CNTRPRTY prefix
   * 3. Multisig -- extract pubkeys per output, decrypt, check prefix (expensive)
   * 4. Burn -- output to UNSPENDABLE address (last, since it's a fallback
   *    that doesn't carry message data and we'd rather match a real CNTRPRTY
   *    payload first if one happens to coexist with a burn output).
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

      // Single pass over vout: classify output types for early exit decisions
      let hasOpReturn = false;
      let hasMultisig = false;
      let hasLiteralCntrprty = false;
      for (const v of transaction.vout) {
        if (v.scriptpubkey_type === 'op_return') {
          hasOpReturn = true;
          // P2TR reveal tx has literal "CNTRPRTY" OP_RETURN (hex: 6a08434e545250525459)
          if (v.scriptpubkey === '6a08434e545250525459') {
            hasLiteralCntrprty = true;
          }
        } else if (v.scriptpubkey_type === 'multisig' || v.scriptpubkey_type === 'unknown') {
          hasMultisig = true;
        }
      }

      // 1. P2TR (cheapest -- no decryption, just check literal marker + witness envelope)
      let result = hasLiteralCntrprty
        ? tryExtractP2tr(transaction.vin, transaction.vout)
        : null;

      // 2. OP_RETURN with ARC4 decryption (fast, <=80 bytes)
      if (!result && hasOpReturn && !hasLiteralCntrprty) {
        const arc4Key = hexToBytes(transaction.vin[0].txid);
        result = tryDecryptOpReturn(transaction.vout, arc4Key);
      }

      // 3. Multisig (expensive -- decrypt each output independently)
      // Note: pre-fork Stamps (before block 796,000) ARE Counterparty transactions
      // with key burn addresses. We must NOT skip based on burn keys.
      if (!result && hasMultisig) {
        const arc4Key = hexToBytes(transaction.vin[0].txid);
        result = tryDecryptMultisig(transaction.vout, arc4Key);
      }

      // 4. Burn detection -- last, since it's a fallback that doesn't carry
      //    message data. A burn tx never has CNTRPRTY-prefixed data anyway,
      //    so the previous three paths will have returned null.
      if (!result) {
        result = tryDetectBurn(transaction.vout);
      }

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
   * Returns true if a Counterparty message is found in the transaction.
   * Checks all three encodings (P2TR, OP_RETURN, Multisig).
   */
  static hasCounterparty(transaction: {
    txid: string,
    vin: { txid: string, witness?: string[] }[],
    vout: { scriptpubkey: string, scriptpubkey_type: string }[]
  }): boolean {
    return CounterpartyParserService.parse(transaction) !== null;
  }
}
