import { readTransaction } from '../../testdata/test.helper';
import { ParsedInscription } from '../types/parsed-inscription';
import { InscriptionParserService } from './inscription-parser.service';
import { formatJSON, InscriptionPreviewService, validateJson } from './inscription-preview.service';

// Real inscriptions from testdata, picked to exercise the preview MIME-type
// router across every branch (image/png, text/html, image/svg+xml as iframe,
// text/plain, application/javascript, image/jpeg, unknown content type).
const PNG_INSCRIPTION_TXID = '092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cc';
const HTML_INSCRIPTION_TXID = '11d3f4b39e8ab97995bab1eacf7dcbf1345ec59c07261c0197e18bf29b88d8da';
// 49cbc5cb... is a BRC-20 'deploy' JSON inscription (text/plain, valid JSON)
const TXT_JSON_INSCRIPTION_TXID = '49cbc5cbac92cf917dd4539d62720a3e528d17e22ef5fc47070a17ec0d3cf307';
// 430901... is text/plain with non-JSON content ("ob🤝cpfp")
const TXT_NONJSON_INSCRIPTION_TXID = '430901147831e41111aced3895ee4b9742cf72ac3cffa132624bd38c551ef379';
const SVG_INSCRIPTION_TXID = '4c83f2e1d12d6f71e9f69159aff48f7946ce04c5ffcc3a3feee4080bac343722';
const JS_INSCRIPTION_TXID = '6dc2c16a74dedcae46300b2058ebadc7ca78aea78236459662375c8d7d9804db';
const JPEG_INSCRIPTION_TXID = '7923e59abd8f8ab40dcc7915ae864d8b7ad6776811ba4d478f42248a7827a7f3';

function firstInscription(txid: string): ParsedInscription {
  const tx = readTransaction(txid);
  return InscriptionParserService.parse(tx)[0];
}

describe('InscriptionPreviewService', () => {

  describe('getPreview — undefined inscription', () => {
    it('returns the unknown placeholder with renderDirectly=false and no instructionsFor', async () => {
      const preview = await InscriptionPreviewService.getPreview(undefined);
      expect(preview.instructionsFor).toBe(undefined);
      expect(preview.renderDirectly).toBe(false);
      // The unknown template is a complete HTML document with a single "?" body
      expect(preview.previewContent).toContain('<!doctype html>');
      expect(preview.previewContent).toContain('>?</h1>');
    });
  });

  describe('getPreview — image MIME types -> getPreviewImage', () => {
    it('returns image preview HTML with embedded data URI for image/png', async () => {
      const inscription = firstInscription(PNG_INSCRIPTION_TXID);
      expect(inscription.contentType).toBe('image/png');

      const preview = await InscriptionPreviewService.getPreview(inscription);
      expect(preview.instructionsFor).toBe(inscription.inscriptionId);
      expect(preview.renderDirectly).toBe(false);
      // Image preview embeds the data URI in both background-image and <img src>
      expect(preview.previewContent).toContain('data:image/png;base64,');
      expect(preview.previewContent).toContain('background-image: url(');
      expect(preview.previewContent).toContain('<img src=');
      // pixelated image-rendering is part of the inscription image preview template
      expect(preview.previewContent).toContain('image-rendering: pixelated');
    });

    it('returns image preview HTML for image/jpeg', async () => {
      const inscription = firstInscription(JPEG_INSCRIPTION_TXID);
      expect(inscription.contentType).toBe('image/jpeg');

      const preview = await InscriptionPreviewService.getPreview(inscription);
      expect(preview.renderDirectly).toBe(false);
      expect(preview.previewContent).toContain('data:image/jpeg;base64,');
    });
  });

  describe('getPreview — iframe MIME types -> renderDirectly=true', () => {
    it('returns renderDirectly=true with empty body for text/html', async () => {
      const inscription = firstInscription(HTML_INSCRIPTION_TXID);
      expect(inscription.contentType).toBe('text/html;charset=utf-8');

      const preview = await InscriptionPreviewService.getPreview(inscription);
      expect(preview.instructionsFor).toBe(inscription.inscriptionId);
      expect(preview.renderDirectly).toBe(true);
      expect(preview.previewContent).toBe('');
    });

    it('returns renderDirectly=true with empty body for image/svg+xml', async () => {
      const inscription = firstInscription(SVG_INSCRIPTION_TXID);
      expect(inscription.contentType).toBe('image/svg+xml');

      const preview = await InscriptionPreviewService.getPreview(inscription);
      expect(preview.renderDirectly).toBe(true);
      expect(preview.previewContent).toBe('');
    });
  });

  describe('getPreview — text/plain valid JSON -> getPreviewText json branch', () => {
    it('returns text-json template with formatted JSON in dataUri for valid JSON content', async () => {
      // Inscription 49cbc5cb... is text/plain BRC-20 deploy JSON
      const inscription = firstInscription(TXT_JSON_INSCRIPTION_TXID);
      expect(inscription.contentType).toBe('text/plain');

      const preview = await InscriptionPreviewService.getPreview(inscription);
      expect(preview.renderDirectly).toBe(false);
      // The json branch wires preview-text-json.js, not preview-text.js
      expect(preview.previewContent).toContain('preview-text-json.js');
      expect(preview.previewContent).toContain('window.textBase64');
      // The dataUri MIME type matches the inscription's content type
      expect(preview.previewContent).toContain('data:text/plain;base64,');
    });

    it('falls back to plain text-template when text/plain content is NOT valid JSON', async () => {
      // 430901... is text/plain "ob🤝cpfp" -- not JSON
      const inscription = firstInscription(TXT_NONJSON_INSCRIPTION_TXID);
      expect(inscription.contentType).toBe('text/plain;charset=utf-8');

      const preview = await InscriptionPreviewService.getPreview(inscription);
      expect(preview.renderDirectly).toBe(false);
      // Falls through to the generic preview-text.js template (not -json or -code)
      expect(preview.previewContent).toContain('preview-text.js');
      expect(preview.previewContent).not.toContain('preview-text-json.js');
      expect(preview.previewContent).not.toContain('preview-text-code.js');
    });
  });

  describe('getPreview — text/javascript -> getPreviewText code branch', () => {
    it('returns text-code template for text/javascript', async () => {
      const inscription = firstInscription(JS_INSCRIPTION_TXID);
      expect(inscription.contentType).toBe('text/javascript');

      const preview = await InscriptionPreviewService.getPreview(inscription);
      expect(preview.renderDirectly).toBe(false);
      // The code branch wires preview-text-code.js
      expect(preview.previewContent).toContain('preview-text-code.js');
    });
  });

  describe('getContentTypeInstructions', () => {
    it('returns whatToShow=json for valid-JSON text/plain content', async () => {
      const inscription = firstInscription(TXT_JSON_INSCRIPTION_TXID);
      const result = await InscriptionPreviewService.getContentTypeInstructions(inscription);
      expect(result.whatToShow).toBe('json');
      // Must be parseable as JSON; pin the deploy fields exactly
      const parsed = JSON.parse(result.content!);
      expect(parsed).toEqual({
        p: 'brc-20', op: 'deploy', tick: 'SYMM', max: '21000000', lim: '1000', dec: '8',
      });
    });

    it('returns whatToShow=preview for text/plain content that is NOT valid JSON', async () => {
      const inscription = firstInscription(TXT_NONJSON_INSCRIPTION_TXID);
      const result = await InscriptionPreviewService.getContentTypeInstructions(inscription);
      // Non-JSON text/plain -- code branch only triggers for yaml/css/js, so this
      // ends up in the default preview branch with content=undefined.
      expect(result).toEqual({ content: undefined, whatToShow: 'preview' });
    });

    it('returns whatToShow=code for text/javascript content', async () => {
      const inscription = firstInscription(JS_INSCRIPTION_TXID);
      const result = await InscriptionPreviewService.getContentTypeInstructions(inscription);
      expect(result.whatToShow).toBe('code');
      expect(typeof result.content).toBe('string');
    });

    it('returns whatToShow=preview with content=undefined for image/png', async () => {
      const inscription = firstInscription(PNG_INSCRIPTION_TXID);
      const result = await InscriptionPreviewService.getContentTypeInstructions(inscription);
      // Images are not text-displayable -- defaults to preview, with content untouched (undefined)
      expect(result).toEqual({ content: undefined, whatToShow: 'preview' });
    });

    it('returns whatToShow=preview with content=undefined for image/svg+xml', async () => {
      const inscription = firstInscription(SVG_INSCRIPTION_TXID);
      const result = await InscriptionPreviewService.getContentTypeInstructions(inscription);
      expect(result).toEqual({ content: undefined, whatToShow: 'preview' });
    });
  });

  describe('validateJson', () => {
    it('returns true for valid JSON object', () => {
      expect(validateJson('{"a":1,"b":[2,3]}')).toBe(true);
    });

    it('returns true for valid JSON primitive', () => {
      expect(validateJson('"hello"')).toBe(true);
      expect(validateJson('42')).toBe(true);
      expect(validateJson('null')).toBe(true);
    });

    it('returns false for invalid JSON', () => {
      expect(validateJson('{not json}')).toBe(false);
      expect(validateJson('')).toBe(false);
    });
  });

  describe('formatJSON', () => {
    it('pretty-prints with default indentation 2', () => {
      expect(formatJSON('{"a":1,"b":2}')).toBe('{\n  "a": 1,\n  "b": 2\n}');
    });

    it('respects custom indentation', () => {
      expect(formatJSON('{"a":1}', 4)).toBe('{\n    "a": 1\n}');
    });

    it('throws on invalid JSON (caller is expected to gate on validateJson first)', () => {
      expect(() => formatJSON('not json')).toThrow();
    });
  });
});
