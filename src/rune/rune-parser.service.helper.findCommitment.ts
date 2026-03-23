import { bytesToHex, isStringInArrayOfStrings } from '../lib/conversions';
import { IEsploraApi } from '../types/mempool';
import { removeSpacers } from './rune-parser.service.helper';
import { Rune } from './src/rune';


/**
 * Helper method to find the vin that contains the given commitment in its witness.
 *
 * Is it meant to be possible to etch without an inscription, or even a valid "ord" envelope?
 * https://github.com/ordinals/ord/issues/3494
 * --> Yup, that's definitely allowed.
 *
 * The rune updater looks through all input witness instructions for a valid commitment,
 * so it doesn't need to be in an envelope or inscription.
 *
 * Instead of the usual:
 *
 * FALSE
 * IF
 * "ord"
 * RUNE_TAG <rune_commitment>
 * ...
 * ENDIF
 *
 * envelope, it can also have the following:
 *
 * FALSE
 * IF
 * <rune_commitment>
 * ENDIF
 *
 * And the cheapest way include a commitment is PUSHDATA <rune_commitment> OP_DROP,
 * since it saves two instructions over FALSE IF <rune_commitment> ENDIF.
 *
 * https://github.com/ordinals/ord/issues/3494#issuecomment-2045712765
 *
 * The actual implementation in ord is here:
 * https://github.com/ordinals/ord/blob/1ae542fd703253499d0b2ea29af077cf7a24b748/src/index/updater/rune_updater.rs#L402
 *
 * The Tapscript instructions are parsed, and the updater checks each instruction to see if it contains a push operation.
 * If it finds a push operation, it compares the bytes of the pushed data with the rune commitment.
 * If they don’t match, the loop continues.
 *
 * --> Our approach will be a bit simpler, we will just search for the raw commitment value, regardless how it was pushed.
 *
 * @param transaction - The transaction object that contains an array of vin.
 * @param runeName - The rune name as a string which will be encoded as a commitment.
 * @returns The vin object that satisfies the commitment condition or null if not found.
 */
export function findCommitment(transaction: { vin: IEsploraApi.Vin[] }, runeName: string): IEsploraApi.Vin | null {

  // Clean rune name (e.g., Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z to ZZZZZFEHUZZZZZ)
  const cleanedRuneName = removeSpacers(runeName);
  const commitment = Rune.fromString(cleanedRuneName).commitment;

  for (const vin of transaction.vin) {
    const witness = vin.witness;

    if (!witness) {
      continue;
    }

    // Check if the commitment (as hex) is found in the witness (as hex)
    const commitmentFound = isStringInArrayOfStrings(bytesToHex(commitment), witness);

    if (commitmentFound) {
      return vin;
    }
  }

  return null;
}

