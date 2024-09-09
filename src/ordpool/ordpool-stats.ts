import { DigitalArtifactsParserService } from '../digital-artifacts-parser.service';
import { DigitalArtifact, DigitalArtifactType } from '../types/digital-artifact';
import { getEmptyStats, OrdpoolStats } from '../types/ordpool-stats';
import { OrdpoolTransactionFlag, OrdpoolTransactionFlags } from '../types/ordpool-transaction-flags';
import { TransactionSimple } from '../types/transaction-simple';

/**
 * Returns the corresponding flag for the given digital asset.
 *
 * @param artifact - The digital artifact to analyze.
 * @returns The corresponding flag for the artifact type.
 */
export function getFlagsForDigitalAsset(artifact: DigitalArtifact): OrdpoolTransactionFlag | null {

  switch (artifact.type) {
    case DigitalArtifactType.Atomical:
      return OrdpoolTransactionFlags.ordpool_atomical;

    case DigitalArtifactType.Cat21:
      return OrdpoolTransactionFlags.ordpool_cat21;

    case DigitalArtifactType.Inscription:
      return OrdpoolTransactionFlags.ordpool_inscription;

    case DigitalArtifactType.Runestone:
      return OrdpoolTransactionFlags.ordpool_rune;

    case DigitalArtifactType.Src20:
      return OrdpoolTransactionFlags.ordpool_src20;

    // TODO: add more flags

    default:
      return null; // Return null for unknown types
  }
}

/**
 * Map between OrdpoolTransactionFlag and the corresponding field in OrdpoolStats.
 * Uses Map (instead of a Record) to allow bigint keys.
 */
const artifactTypeMap = new Map<OrdpoolTransactionFlag, keyof OrdpoolStats['amount']>([
  [OrdpoolTransactionFlags.ordpool_atomical, 'atomical'],
  [OrdpoolTransactionFlags.ordpool_cat21, 'cat21'],
  [OrdpoolTransactionFlags.ordpool_inscription, 'inscription'],
  [OrdpoolTransactionFlags.ordpool_rune, 'rune'],
  [OrdpoolTransactionFlags.ordpool_src20, 'src20'],
]);


/**
 * Analyzes an array of transactions, parses digital artifacts, and returns an OrdpoolStats object with counted amounts for each artifact type.
 *
 * @param transactions - The array of transactions to analyze.
 * @returns The OrdpoolStats object with counted amounts for each artifact type.
 */
export function getOrdpoolTransactionStats(transactions: TransactionSimple[]): OrdpoolStats {

  // Initialize OrdpoolStats with null for unknown fields,
  // to be dynamically updated for known fields
  const stats: OrdpoolStats = getEmptyStats();

  for (const tx of transactions) {

    const artifacts = DigitalArtifactsParserService.parse(tx);
    for (const artifact of artifacts) {

      const flag = getFlagsForDigitalAsset(artifact);

      // If a valid flag is returned, update the corresponding count in stats
      if (flag !== null) {
        const statKey = artifactTypeMap.get(flag);

        if (statKey) {
          stats.amount[statKey] = (stats.amount[statKey] ?? 0) + 1;
        }
      }
    }
  }

  return stats;
}
