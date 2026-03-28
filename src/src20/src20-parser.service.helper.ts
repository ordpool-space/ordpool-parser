// big question: are these really all used burners??
export const knownKeyBurnAddresses = [
  '022222222222222222222222222222222222222222222222222222222222222222',
  '033333333333333333333333333333333333333333333333333333333333333333',
  '020202020202020202020202020202020202020202020202020202020202020202',
  '030303030303030303030303030303030303030303030303030303030303030303',
];

/**
 * Checks if a given transaction contains any known stamps key burn addresses
 * see https://github.com/mikeinspace/stamps/blob/main/Key-Burn.md
 *
 * This method doesn't extract public keys, but searches the scriptpubkey strings for known burn addresses.
 * There could be potential false positives if the scriptpubkey includes the same strings in an unrelated context.
 *
 * @param transaction - The Bitcoin transaction to check.
 * @returns Returns true if any multisig output contains a known key burn address, otherwise false.
 */
export function hasKeyBurn(transaction: {
  vout: {
    scriptpubkey: string,
    scriptpubkey_type: string
  }[];
}) {

  for (const vout of transaction.vout) {
    if (vout.scriptpubkey_type === 'multisig' || vout.scriptpubkey_type === 'unknown') {
      for (const keyBurn of knownKeyBurnAddresses) {
        if (vout.scriptpubkey.includes(keyBurn)) {
          return true;
        }
      }
    }
  }

  return false;
}

// Re-export shared script utilities for backwards compatibility
export { parseScript, extractPubkeys, extractPubkeysRaw } from '../lib/script';
