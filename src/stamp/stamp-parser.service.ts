import { bytesToDataUri } from '../lib/conversions';
import { DigitalArtifactType } from '../types/digital-artifact';
import { OnParseError } from '../types/parser-options';
import { ParsedSrc20 } from '../types/parsed-src20';
import { ParsedSrc721 } from '../types/parsed-src721';
import { ParsedSrc101 } from '../types/parsed-src101';
import { ParsedStamp } from '../types/parsed-stamp';
import { extractOlgaData, decryptStampMultisig, detectMimeType } from './stamp-parser.service.helper';

/**
 * Unified parser for the Bitcoin Stamps ecosystem.
 *
 * Detects Stamps (images), SRC-20, SRC-721, and SRC-101 from:
 * 1. OLGA P2WSH encoding (block 833,000+): raw file data in P2WSH outputs
 * 2. ARC4 multisig encoding (block 793,068+): encrypted data with key burn addresses
 *
 * Note: Pre-OLGA Stamps (before block 833,000) are Counterparty issuances
 * with STAMP:<base64> in the description field. Those are detected by the
 * Counterparty parser as issuance messages.
 */
export class StampParserService {

  /**
   * Parses stamp data from a transaction.
   *
   * Detection order (cheapest first):
   * 1. OLGA P2WSH -- raw file data in witness outputs (no decryption)
   * 2. ARC4 multisig -- decrypt pubkey data with key burn addresses
   *
   * Returns the most specific type: ParsedStamp, ParsedSrc20, ParsedSrc721, or ParsedSrc101.
   */
  static parse(transaction: {
    txid: string,
    vin: { txid: string }[],
    vout: { scriptpubkey: string, scriptpubkey_type: string }[]
  }, onError?: OnParseError): ParsedStamp | ParsedSrc20 | ParsedSrc721 | ParsedSrc101 | null {

    try {
      // Path 1: OLGA P2WSH -- extract raw file data from P2WSH outputs (no decryption)
      const fileData = extractOlgaData(transaction.vout);
      if (fileData && fileData.length > 0) {
        const mimeType = detectMimeType(fileData);

        if (mimeType === 'application/json') {
          return StampParserService.parseJsonStamp(transaction.txid, fileData);
        }

        if (mimeType) {
          return StampParserService.createStamp(transaction.txid, fileData, mimeType);
        }

        return StampParserService.createStamp(transaction.txid, fileData, 'application/octet-stream');
      }

      // Path 2: ARC4 multisig -- decrypt stamp content from key-burn multisig outputs
      const content = decryptStampMultisig(transaction);
      if (content) {
        return StampParserService.routeByProtocol(transaction.txid, content);
      }

      return null;
    } catch (ex) {
      onError?.(ex);
      return null;
    }
  }

  /**
   * Returns true if the transaction contains stamp data (OLGA or multisig).
   */
  static hasStamp(transaction: {
    txid: string,
    vin: { txid: string }[],
    vout: { scriptpubkey: string, scriptpubkey_type: string }[]
  }): boolean {
    return StampParserService.parse(transaction) !== null;
  }

  /**
   * Routes a JSON content string to the correct protocol type.
   * Shared by both the OLGA and ARC4 multisig paths.
   */
  private static routeByProtocol(
    txid: string,
    content: string
  ): ParsedSrc20 | ParsedSrc721 | ParsedSrc101 | null {

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      return null;
    }

    // Stamp protocols (SRC-20/721/101) require a JSON object with a 'p' field.
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      return null;
    }
    const obj = json as Record<string, unknown>;
    const rawP = obj.p ?? obj.P;
    const protocol = typeof rawP === 'string' ? rawP.toLowerCase() : '';

    if (protocol === 'src-20') {
      return StampParserService.createProtocolArtifact(DigitalArtifactType.Src20, txid, content);
    }

    if (protocol === 'src-721') {
      return StampParserService.createProtocolArtifact(DigitalArtifactType.Src721, txid, content);
    }

    if (protocol === 'src-101') {
      return StampParserService.createProtocolArtifact(DigitalArtifactType.Src101, txid, content);
    }

    return null;
  }

  /**
   * Parses OLGA P2WSH JSON content. Tries protocol routing first,
   * falls back to a Stamp artifact if the JSON isn't a known protocol.
   */
  private static parseJsonStamp(
    txid: string,
    fileData: Uint8Array
  ): ParsedSrc20 | ParsedSrc721 | ParsedSrc101 | ParsedStamp {

    const text = new TextDecoder().decode(fileData);

    // Try protocol routing (SRC-20, SRC-721, SRC-101)
    const routed = StampParserService.routeByProtocol(txid, text);
    if (routed) {
      return routed;
    }

    // JSON but not a known stamp protocol (or invalid JSON) -- treat as Stamp
    return StampParserService.createStamp(txid, fileData, 'application/json');
  }

  /**
   * Factory for SRC-20/SRC-721/SRC-101 artifacts (all share the same shape).
   */
  private static createProtocolArtifact(
    type: DigitalArtifactType,
    txid: string,
    content: string
  ): ParsedSrc20 | ParsedSrc721 | ParsedSrc101 {
    return {
      type,
      uniqueId: `${type}-${txid}`,
      transactionId: txid,
      getContent: () => content,
    };
  }

  private static createStamp(
    txid: string,
    fileData: Uint8Array,
    contentType: string
  ): ParsedStamp {
    return {
      type: DigitalArtifactType.Stamp,
      uniqueId: `${DigitalArtifactType.Stamp}-${txid}`,
      transactionId: txid,
      contentType,
      getDataRaw: () => fileData,
      getContent: () => new TextDecoder().decode(fileData),
      getDataUri: () => bytesToDataUri(fileData, contentType),
    };
  }
}
