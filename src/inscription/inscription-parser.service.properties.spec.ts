import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';

// Real mainnet gallery inscription: OrdRain collection (111 generative art pieces)
// Inscription ID: f6d848b3dc15955a82eb738f2de38e56a0346303444600f0e0726c678632c055i0
// From issue #21: https://github.com/ordpool-space/ordpool-parser/issues/21
// Properties: brotli-compressed, inline inscription IDs, no attributes
const ORDRAIN_GALLERY_TXID = 'f6d848b3dc15955a82eb738f2de38e56a0346303444600f0e0726c678632c055';

// Real mainnet gallery: "The Ring" (333 items)
// Properties: brotli-compressed, per-item traits (rune), gallery-level title + description
const THE_RING_GALLERY_TXID = '47311be09e0d400a338cc8c9d69bea7b8ec29c3c5763d551668f9a6dc101d695';

// Real mainnet gallery: "Ordillas" (2230 items with rich traits)
// Properties: brotli-compressed, packed encoding (txids separated for compression),
// per-item traits (body, eyes, mouth, clothing, background, accessories)
const ORDILLAS_GALLERY_TXID = '9936fce243d5242a33afc913588ee88a2d3025af722e80d61442f5a1127bc6db';

describe('InscriptionParserService — Properties / Galleries', () => {

  describe('OrdRain gallery (111 items, no attributes)', () => {
    it('should parse gallery with exact item count and inscription IDs', async () => {
      const txn = readTransaction(ORDRAIN_GALLERY_TXID);
      const inscriptions = InscriptionParserService.parse(txn);

      expect(inscriptions.length).toBe(1);
      const inscription = inscriptions[0];
      expect(inscription.inscriptionId).toBe(ORDRAIN_GALLERY_TXID + 'i0');
      expect(inscription.contentType).toBe('image/webp');

      const properties = (await inscription.getProperties())!;
      expect(properties.gallery.length).toBe(111);
      expect(properties.title).toBeUndefined();
      expect(properties.traits).toBeUndefined();

      // First and last item — exact inscription IDs
      expect(properties.gallery[0].inscriptionId).toBe(
        'b53f6e90147e519cac6a67eeb9fe132b3b316ca615b5bd4b827704d3b5a28fd1i0'
      );
      expect(properties.gallery[110].inscriptionId).toBe(
        '960eb5e3f62ccb4a04ce0c6bcd4cb748b37d1680e2eee875000bb106ff404539i0'
      );

      // No per-item attributes
      for (const item of properties.gallery) {
        expect(item.inscriptionId).toMatch(/^[a-f0-9]{64}i\d+$/);
        expect(item.title).toBeUndefined();
        expect(item.traits).toBeUndefined();
      }
    });
  });

  describe('The Ring gallery (333 items, with traits)', () => {
    it('should parse gallery with title, description, and per-item rune traits', async () => {
      const txn = readTransaction(THE_RING_GALLERY_TXID);
      const inscriptions = InscriptionParserService.parse(txn);

      expect(inscriptions.length).toBe(1);
      expect(inscriptions[0].inscriptionId).toBe(THE_RING_GALLERY_TXID + 'i0');

      const properties = (await inscriptions[0].getProperties())!;
      expect(properties.gallery.length).toBe(333);

      // Gallery-level attributes
      expect(properties.title).toBe('The Ring');
      expect(properties.traits).toEqual({
        description: 'The Ring — 333 items preserved on-chain via Save Ordinals',
      });

      // All 333 items share the same txid (batch inscription) with indices 0-332
      // First item
      expect(properties.gallery[0].inscriptionId).toBe(
        'c280f43d4a088665b226b06ec15d893cb1a2802ac87f7a4242141cb3c1d7d163i0'
      );
      expect(properties.gallery[0].title).toBeUndefined();
      expect(properties.gallery[0].traits).toEqual({ rune: '\u16C3' }); // ᛃ (Jera rune)

      // Last item (index 332, but inscription uses i99 for the last batch item)
      expect(properties.gallery[332].inscriptionId).toBe(
        'c280f43d4a088665b226b06ec15d893cb1a2802ac87f7a4242141cb3c1d7d163i99'
      );
    });
  });

  describe('Ordillas gallery (2230 items, rich traits, packed encoding)', () => {
    it('should parse large gallery with packed txids and per-item attributes', async () => {
      const txn = readTransaction(ORDILLAS_GALLERY_TXID);
      const inscriptions = InscriptionParserService.parse(txn);

      expect(inscriptions.length).toBe(1);
      expect(inscriptions[0].inscriptionId).toBe(ORDILLAS_GALLERY_TXID + 'i0');

      const properties = (await inscriptions[0].getProperties())!;
      expect(properties.gallery.length).toBe(2230);

      // Gallery-level attributes
      expect(properties.title).toBe('Ordillas');
      expect(properties.traits).toEqual({
        description: 'Official on-chain gallery for the Ordillas collection.',
      });

      // First item — exact inscription ID and all traits
      expect(properties.gallery[0].inscriptionId).toBe(
        '001fa882ee933414cd79450db22d684a89ef50a23124e982d95aac0e78199645i0'
      );
      expect(properties.gallery[0].traits).toEqual({
        body: 'normal body',
        eyes: 'normal idle eyes',
        mouth: 'slightly opened mouth',
        clothing: 'hood blue',
        background: 'lost island',
        'special back': 'none',
        'special front': 'none',
        'face accessory': 'none',
        'hand accessory': 'normal dumbell',
        'head accessory': 'none',
      });

      // Last item
      expect(properties.gallery[2229].inscriptionId).toBe(
        'ffedf084efd1e3c76efb517ed69f8d8ade822ce7670c9e23c46b094fdf27d327i0'
      );
      expect(properties.gallery[2229].traits).toEqual({
        body: 'normal body',
        eyes: 'normal outer crossed eyes',
        mouth: 'confused new',
        clothing: 'squid game suit 212',
        background: 'baby pink',
        'special back': 'none',
        'special front': 'cat',
        'face accessory': 'scar',
        'hand accessory': 'none',
        'head accessory': 'skater hair',
      });
    });
  });

  describe('non-gallery inscriptions', () => {
    it('should return undefined properties for a non-inscription transaction', () => {
      const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
      const inscriptions = InscriptionParserService.parse(txn);
      expect(inscriptions.length).toBe(0);
    });

    it('should return undefined properties for a regular inscription without tag 17', async () => {
      const txn = readTransaction('2740d27e3017da44ee439792f6f60449e43992fddffd9387685b14d21b725ff0');
      const inscriptions = InscriptionParserService.parse(txn);
      expect(inscriptions.length).toBe(2000);
      expect(await inscriptions[0].getProperties()).toBeUndefined();
    });
  });
});
