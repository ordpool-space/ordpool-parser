import { readTransaction } from '../../testdata/test.helper';
import { bytesToHex } from '../lib/conversions';
import { InscriptionParserService } from './inscription-parser.service';

// Real mainnet inscription with rune commitment (tag 13):
// UNCOMMON•GOODS rune etching — the first rune ever etched (block 840,000)
// This inscription commits to the rune name by embedding the rune's u128 value
// as little-endian bytes in tag 13. The etching tx then spends this inscription's UTXO.
// Commitment hex: b530368c74df10a303 (matches Rune.fromString('UNCOMMONGOODS').commitment)
const UNCOMMON_GOODS_TXID = '2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e';

describe('InscriptionParserService — Rune commitment (tag 13)', () => {

  it('should extract the rune commitment from UNCOMMON•GOODS inscription', () => {
    const txn = readTransaction(UNCOMMON_GOODS_TXID);
    const inscriptions = InscriptionParserService.parse(txn);

    expect(inscriptions.length).toBe(1);
    const inscription = inscriptions[0];

    const rune = inscription.getRune();
    expect(rune).toBeDefined();
    expect(bytesToHex(rune!)).toBe('b530368c74df10a303');
  });

  it('should return undefined rune for an inscription without tag 13', () => {
    // OrdRain gallery — has properties but no rune commitment
    const txn = readTransaction('f6d848b3dc15955a82eb738f2de38e56a0346303444600f0e0726c678632c055');
    const inscriptions = InscriptionParserService.parse(txn);

    expect(inscriptions.length).toBe(1);
    expect(inscriptions[0].getRune()).toBeUndefined();
  });
});
