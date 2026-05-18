import { RunestoneSpec } from '../rune';
import { RuneParserService } from '../rune/rune-parser.service';
import { hasAlkanesProtostone } from './alkanes-parser.service.helper';

export interface AlkanesTx {
  txid: string;
  vout: {
    scriptpubkey: string;
    scriptpubkey_type: string;
  }[];
}

/**
 * Alkanes (https://github.com/kungfuflex/alkanes-rs) is a Bitcoin metaprotocol
 * that piggybacks on the Runestone envelope: each alkanes-bearing tx is a
 * Runestone whose Protocol tag (16383) carries at least one Protostone with
 * `protocol_tag = 1`. The actual WASM contract bodies are inscribed
 * separately in Ordinals envelopes -- that part is out of scope here. We
 * surface only the visibility flag: "this tx invokes alkanes".
 *
 * Genesis block 880000 (Jan 2025), DIESEL contract.
 */
export class AlkanesParserService {

  /**
   * True iff the tx is a Runestone with at least one alkanes-tagged
   * (protocol_tag = 1) Protostone in tag PROTOCOL (16383). Returns false
   * for non-Runestone txs, cenotaphs, and Runestones without a protostone.
   */
  static hasAlkanes(tx: AlkanesTx): boolean {
    const parsed = RuneParserService.parse(tx);
    if (parsed === null || parsed.runestone === null) {
      return false;
    }
    return hasAlkanesProtostone(parsed.runestone.protocol);
  }
}
