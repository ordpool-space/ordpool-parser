import { decodeDataURI } from './decode-data-uri';

describe('decodeDataURI', () => {
  it('should decode a valid text/plain data URI', () => {
    const dataURI = 'data:text/plain;base64,' + btoa('Hello World');
    expect(decodeDataURI(dataURI)).toBe('Hello World');
  });

  it('should decode a valid image/svg+xml data URI', () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const dataURI = 'data:image/svg+xml;base64,' + btoa(svgContent);
    expect(decodeDataURI(dataURI)).toBe(svgContent);
  });

  it('should decode a valid application/pdf data URI', () => {
    const binaryContent = 'Fake PDF Binary'; // Simulated binary content
    const encodedContent = btoa(unescape(encodeURIComponent(binaryContent)));
    const dataURI = 'data:application/pdf;base64,' + encodedContent;
    expect(decodeDataURI(dataURI)).toBe(binaryContent);
  });

  it('should decode a valid audio/mpeg data URI', () => {
    const binaryContent = 'Fake Audio Binary'; // Simulated binary content
    const encodedContent = btoa(unescape(encodeURIComponent(binaryContent)));
    const dataURI = 'data:audio/mpeg;base64,' + encodedContent;
    expect(decodeDataURI(dataURI)).toBe(binaryContent);
  });

  it('should decode a valid image/jpeg data URI', () => {
    const binaryContent = 'Fake JPEG Binary'; // Simulated binary content
    const encodedContent = btoa(unescape(encodeURIComponent(binaryContent)));
    const dataURI = 'data:image/jpeg;base64,' + encodedContent;
    expect(decodeDataURI(dataURI)).toBe(binaryContent);
  });

  it('should throw an error for invalid data URI format', () => {
    const invalidDataURI = 'this is not a data URI';
    expect(() => decodeDataURI(invalidDataURI)).toThrow('Invalid data URI format');
  });

  it('should throw an error for data URI with missing Base64 section', () => {
    const invalidDataURI = 'data:text/plain;base64,';
    expect(() => decodeDataURI(invalidDataURI)).toThrow('Invalid data URI format');
  });

  it('should throw an error for data URI with no MIME type', () => {
    const invalidDataURI = 'data:;base64,' + btoa('Hello World');
    expect(() => decodeDataURI(invalidDataURI)).toThrow('Invalid data URI format');
  });

  it('should handle a data URI with non-standard charset', () => {
    const dataURI = 'data:text/plain;charset=ISO-8859-1;base64,' + btoa('Hello World');
    expect(decodeDataURI(dataURI)).toBe('Hello World');
  });

  it('should decode a data URI with UTF-8 charset', () => {
    const dataURI = 'data:text/plain;charset=utf-8;base64,' + btoa('Hello World');
    expect(decodeDataURI(dataURI)).toBe('Hello World');
  });

  it('should decode a data URI with text content containing special characters', () => {
    const specialCharContent = 'Hello 😊';
    const dataURI = 'data:text/plain;base64,' + btoa(unescape(encodeURIComponent(specialCharContent)));
    expect(decodeDataURI(dataURI)).toBe(specialCharContent);
  });

  it('should throw an error for empty data URI', () => {
    const emptyDataURI = '';
    expect(() => decodeDataURI(emptyDataURI)).toThrow('Invalid data URI format');
  });
});
