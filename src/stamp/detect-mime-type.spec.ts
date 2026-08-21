import { detectMimeType } from './stamp-parser.service.helper';

// Magic-byte MIME sniffing used by the STAMPS parser and, going forward,
// by the ordpool inscription minter to derive a content-type from an
// uploaded file's bytes.

function bytes(...b: number[]): Uint8Array {
  return new Uint8Array(b);
}

function textBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe('detectMimeType', () => {
  it('returns null for too-short input', () => {
    expect(detectMimeType(bytes(0x25, 0x50))).toBeNull();
  });

  it('detects PNG', () => {
    expect(detectMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a))).toBe('image/png');
  });

  it('detects GIF', () => {
    expect(detectMimeType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('image/gif');
  });

  it('detects JPEG', () => {
    expect(detectMimeType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  });

  it('detects WebP', () => {
    // RIFF....WEBP
    expect(detectMimeType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe('image/webp');
  });

  it('detects gzip', () => {
    expect(detectMimeType(bytes(0x1f, 0x8b, 0x08, 0x00))).toBe('application/gzip');
  });

  it('detects PDF (%PDF magic)', () => {
    expect(detectMimeType(textBytes('%PDF-1.7\n%âãÏÓ'))).toBe('application/pdf');
  });

  it('detects SVG', () => {
    expect(detectMimeType(textBytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe('image/svg+xml');
  });

  it('detects XML-prefixed SVG', () => {
    expect(detectMimeType(textBytes('<?xml version="1.0"?><svg></svg>'))).toBe('image/svg+xml');
  });

  it('detects HTML', () => {
    expect(detectMimeType(textBytes('<!doctype html><html></html>'))).toBe('text/html');
  });

  it('detects JSON object', () => {
    expect(detectMimeType(textBytes('{"a":1}'))).toBe('application/json');
  });

  it('detects JSON array', () => {
    expect(detectMimeType(textBytes('[1,2,3]'))).toBe('application/json');
  });

  it('does not misclassify a PDF as text (branch ordering)', () => {
    // A PDF whose header region also contains an XML stream must still
    // resolve to application/pdf, not image/svg+xml — the binary %PDF
    // branch runs before the UTF-8 text sniffer.
    expect(detectMimeType(textBytes('%PDF-1.4\n<?xml stream inside?>'))).toBe('application/pdf');
  });

  it('returns null for unknown binary', () => {
    expect(detectMimeType(bytes(0x00, 0x01, 0x02, 0x03, 0x04))).toBeNull();
  });
});
