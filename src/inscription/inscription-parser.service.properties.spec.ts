import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';

// Real mainnet gallery inscription: OrdRain collection (111 generative art pieces)
// Inscription ID: f6d848b3dc15955a82eb738f2de38e56a0346303444600f0e0726c678632c055i0
// From issue #21: https://github.com/ordpool-space/ordpool-parser/issues/21
// Properties are brotli-compressed (tag 19 = "br")
const ORDRAIN_GALLERY_TXID = 'f6d848b3dc15955a82eb738f2de38e56a0346303444600f0e0726c678632c055';

describe('InscriptionParserService — Properties / Galleries', () => {

  it('should parse the OrdRain gallery with 111 items (brotli-compressed properties)', () => {
    const txn = readTransaction(ORDRAIN_GALLERY_TXID);
    const inscriptions = InscriptionParserService.parse(txn);

    expect(inscriptions.length).toBe(1);
    const inscription = inscriptions[0];

    expect(inscription.inscriptionId).toBe(ORDRAIN_GALLERY_TXID + 'i0');
    expect(inscription.contentType).toBe('image/webp');

    const properties = inscription.getProperties()!;
    expect(properties).toBeDefined();

    // Gallery has exactly 111 items
    expect(properties.gallery.length).toBe(111);

    // No inscription-level title or traits
    expect(properties.title).toBeUndefined();
    expect(properties.traits).toBeUndefined();

    // First item
    expect(properties.gallery[0].inscriptionId).toBe(
      'b53f6e90147e519cac6a67eeb9fe132b3b316ca615b5bd4b827704d3b5a28fd1i0'
    );

    // Last item (#111)
    expect(properties.gallery[110].inscriptionId).toBe(
      '960eb5e3f62ccb4a04ce0c6bcd4cb748b37d1680e2eee875000bb106ff404539i0'
    );

    // All items should have valid inscription IDs (64 hex chars + i + number)
    for (const item of properties.gallery) {
      expect(item.inscriptionId).toMatch(/^[a-f0-9]{64}i\d+$/);
    }

    // No titles or traits on individual items in this gallery
    for (const item of properties.gallery) {
      expect(item.title).toBeUndefined();
      expect(item.traits).toBeUndefined();
    }
  });

  it('should return undefined properties for a non-gallery inscription', () => {
    // CAT-21 genesis transaction — not an inscription with properties
    const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
    const inscriptions = InscriptionParserService.parse(txn);

    // CAT-21 txns are not inscriptions
    expect(inscriptions.length).toBe(0);
  });

  it('should return undefined properties for a regular inscription without tag 17', () => {
    // This batch inscription tx has inscriptions but no properties tag
    const txn = readTransaction('2740d27e3017da44ee439792f6f60449e43992fddffd9387685b14d21b725ff0');
    const inscriptions = InscriptionParserService.parse(txn);

    expect(inscriptions.length).toBe(2000);
    expect(inscriptions[0].getProperties()).toBeUndefined();
  });
});
