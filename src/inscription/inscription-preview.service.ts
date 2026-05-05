import { INVALID_COMPRESSED_DATA_MESSAGE, MAX_DECOMPRESSED_SIZE, MAX_DECOMPRESSED_SIZE_MESSAGE } from '../lib/brotli-decode';
import { binaryStringToBase64, bytesToBinaryString, unicodeStringToBytes } from '../lib/conversions';
import { ParsedInscription } from '../types/parsed-inscription';

export interface PreviewInstructions {
  instructionsFor: string | undefined;
  previewContent: string;
  renderDirectly: boolean;
}

export type DecodeFailureReason = 'invalid-data' | 'size-limit';

/**
 * If `content` is one of the decoder's failure sentinels (returned by
 * brotliDecodeUint8Array / gzipDecode when the inscription's compressed
 * body cannot be decoded or would exceed the size limit), report which
 * one. Otherwise null. Used by the preview pipeline to short-circuit
 * downstream rendering -- e.g. avoid embedding 30 bytes of "Error:
 * invalid compressed data" as a base64 data URI inside an `<img>` tag.
 */
export function isDecodeFailureSentinel(content: string): DecodeFailureReason | null {
  if (content === INVALID_COMPRESSED_DATA_MESSAGE) return 'invalid-data';
  if (content === MAX_DECOMPRESSED_SIZE_MESSAGE) return 'size-limit';
  return null;
}

/**
 * Takes a parsed inscription and returns a preview HTML
 * It tries to embed the dataUri of the inscription to save one network-request
 * For Iframe preview types (eg SVG or HTML) directContent is true, so the request can be directly rendered (without preview)
 *
 * Note: The webserver must serve additional assets from /resources/inscription-assets/
 *
 * all templates from here: https://github.com/ordinals/ord/tree/2c7f15cb6dc0ce0135e1c67676d75b687b5ee0ca/templates
 * see media-types here: https://github.com/ordinals/ord/blob/2c7f15cb6dc0ce0135e1c67676d75b687b5ee0ca/src/media.rs
 * see newer version of media-types here: https://github.com/ordinals/ord/blob/bf37836667a9c58f74f1889f95b71d5a08bc1d77/src/media.rs#L50
 */
export class InscriptionPreviewService {

  static async getPreview(inscription: ParsedInscription | undefined): Promise<PreviewInstructions> {

    if (!inscription) {
      return {
        instructionsFor: undefined,
        previewContent: await getPreviewUnknown(),
        renderDirectly: false
      }
    }

    // Decode-failure check first. If the body can't be decoded (corrupt
    // brotli/gzip stream) or would exceed the decompression size limit,
    // we must NOT continue into the per-content-type preview functions:
    // they call getDataUri() which would embed the sentinel string as a
    // base64 image/audio/etc, producing broken-icon previews. Show a
    // dedicated failure page instead, regardless of declared contentType.
    // Same outcome for renderDirectly types (image/svg+xml, text/html) --
    // we replace the would-be iframe-src with the failure page.
    const decodedContent = await inscription.getContent();
    const failureReason = isDecodeFailureSentinel(decodedContent);
    if (failureReason) {
      return {
        instructionsFor: inscription.inscriptionId,
        previewContent: getPreviewDecodeFailure(failureReason),
        renderDirectly: false
      };
    }

    let previewFunction: (inscription: ParsedInscription) => Promise<string> = getPreviewUnknown;
    if (inscription.contentType && table[inscription.contentType]) {
      previewFunction = table[inscription.contentType];
    }

    if (previewFunction === getPreviewIframe) {
      return {
        instructionsFor: inscription.inscriptionId,
        previewContent: '',
        renderDirectly: true
      }
    }

    if (previewFunction === getPreviewUnknown) {
      return {
        instructionsFor: inscription.inscriptionId,
        previewContent: await previewFunction(inscription),
        renderDirectly: false
      }
    }

    return {
      instructionsFor: inscription.inscriptionId,
      previewContent: await previewFunction(inscription),
      renderDirectly: false
    }
  }

  /**
   * Determines how to display the content of an inscription based on its content type.
   *
   * @param inscription - The parsed inscription object, which includes metadata and content.
   *
   * @returns A Promise resolving to an object with:
   *  - `content`: The content of the inscription if it is valid JSON or code; `undefined` otherwise.
   *  - `whatToShow`: A string indicating the recommended way to display the content:
   *      - `'json'`: The content is valid JSON and can be rendered in a JSON viewer.
   *      - `'code'`: The content should be rendered as code (e.g., YAML, CSS, or JavaScript).
   *      - `'preview'`: The content should be displayed in the preview mode (default case for all other types).
   *
   * @remarks
   * - This function handles content types such as `text/plain`, `application/json`, `application/yaml`, `text/css`, and JavaScript variants.
   * - If the content type is `text/plain` or `application/json`, it attempts to parse the content as JSON. If valid, it returns `json` as `whatToShow`.
   * - For content types such as YAML, CSS, or JavaScript, it returns `code` as `whatToShow`.
   * - For other content types, it defaults to returning `preview`.
   */
  static async getContentTypeInstructions(inscription: ParsedInscription): Promise<{
    content: string | undefined,
    whatToShow: 'json' | 'code' | 'preview' | 'decode-failure',
    reason?: DecodeFailureReason
  }> {

    let content: string | undefined = undefined;

    if (inscription.contentType?.startsWith('text/plain') ||
      inscription.contentType?.startsWith('application/json')) {

        content = await inscription.getContent();

        // Short-circuit on decode failure -- the sentinel string is not
        // valid JSON anyway, but if we let it fall through to the 'preview'
        // branch below (or to the 'code' branch for yaml/css/js) the
        // frontend would render the literal "Error: ..." text as the
        // inscription's content. Route to a dedicated failure UI instead.
        const failureReason = isDecodeFailureSentinel(content);
        if (failureReason) {
          return {
            content: undefined,
            whatToShow: 'decode-failure',
            reason: failureReason
          };
        }

        const isValidJson = validateJson(content);

        if (isValidJson) {
          return {
            content,
            whatToShow: 'json'
          };
        }
    }

    if (inscription.contentType?.startsWith('application/yaml') ||
      inscription.contentType?.startsWith('text/css') ||
      inscription.contentType?.startsWith('text/javascript') ||
      inscription.contentType?.startsWith('application/javascript') || // not mapped by ord, but valid as per RFC 4329
      inscription.contentType?.startsWith('application/x-javascript')) {

      content = content || await inscription.getContent();

      const failureReason = isDecodeFailureSentinel(content);
      if (failureReason) {
        return {
          content: undefined,
          whatToShow: 'decode-failure',
          reason: failureReason
        };
      }

      return {
        content,
        whatToShow: 'code'
      };
    }

    // avoids unnecessary await
    return {
      content: undefined,
      whatToShow: 'preview'
    };
  }
}

const table: { [key: string]: (inscription: ParsedInscription) => Promise<string> } = {
  'application/cbor': getPreviewUnknown,
  'application/json': getPreviewText,
  'application/octet-stream': getPreviewUnknown,
  'application/pdf': getPreviewPdf,
  'application/pgp-signature': getPreviewText,
  'application/protobuf': getPreviewUnknown,
  'application/x-javascript': getPreviewText,
  'application/javascript': getPreviewText, // not mapped by ord, but valid as per RFC 4329
  'application/yaml': getPreviewText,
  'audio/flac': getPreviewAudio,
  'audio/mpeg': getPreviewAudio,
  'audio/wav': getPreviewAudio,
  'font/otf': getPreviewUnknown, // TODO: implement preview-font, maybe, one day...
  'font/ttf': getPreviewUnknown,
  'font/woff': getPreviewUnknown,
  'font/woff2': getPreviewUnknown,
  'image/apng': getPreviewImage,
  'image/avif': getPreviewImage,
  'image/gif': getPreviewImage,
  'image/jpeg': getPreviewImage,
  'image/png': getPreviewImage,
  'image/svg+xml': getPreviewIframe,
  'image/webp': getPreviewImage,
  'model/gltf+json': getPreviewModel,
  'model/gltf-binary': getPreviewModel,
  'model/stl': getPreviewUnknown,
  'text/css': getPreviewText,
  'text/html': getPreviewIframe,
  'text/html;charset=utf-8': getPreviewIframe,
  'text/javascript': getPreviewText,
  'text/markdown': getPreviewMarkdown,
  'text/markdown;charset=utf-8': getPreviewMarkdown,
  'text/plain': getPreviewText,
  'text/plain;charset=utf-8': getPreviewText,
  'text/x-python': getPreviewText,
  'video/mp4': getPreviewVideo,
  'video/webm': getPreviewVideo,
};



// test here: https://ordpool.space/tx/751007cf3090703f241894af5c057fc8850d650a577a800447d4f21f5d2cecde
async function getPreviewIframe(_inscription: ParsedInscription): Promise<string> {
  // return decodeDataURI(dataUri);
  return ''
}

// test here: https://ordpool.space/tx/ad99172fce60028406f62725b91b5c508edd95bf21310de5afeb0966ddd89be3
async function getPreviewAudio(inscription: ParsedInscription): Promise<string> {

  const dataUri = await inscription.getDataUri();
  return `<!doctype html>
<html lang='en'>
  <head>
    <meta charset=utf-8>
    <link rel='stylesheet' href='/resources/inscription-assets/preview-audio.css'>
  </head>
  <body>
    <audio controls>
      <source src='${dataUri}'>
    </audio>
  </body>
</html>`;
}

// test here https://ordpool.space/tx/6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799
async function getPreviewImage(inscription: ParsedInscription): Promise<string> {

  const dataUri = await inscription.getDataUri();
  return `<!doctype html>
<html lang='en'>
  <head>
    <meta charset='utf-8'>
    <meta name='format-detection' content='telephone=no'>
    <style>
      html {
        background-color: #131516;
        height: 100%;
      }

      body {
        background-image: url('${dataUri}');
        background-position: center;
        background-repeat: no-repeat;
        background-size: contain;
        height: 100%;
        image-rendering: pixelated;
        margin: 0;
      }

      img {
        height: 100%;
        opacity: 0;
        width: 100%;
      }
    </style>
  </head>
  <body>
    <img src='${dataUri}'></img>
  </body>
</html>`;
}

// test here: https://ordpool.space/tx/c133c03e2ed44bb8ada79b1640b6649129de75a8f31d8e6ad573ede442f91cdb
async function getPreviewMarkdown(inscription: ParsedInscription): Promise<string> {

  const dataUri = await inscription.getDataUri();
  return `<!doctype html>
<html lang='en'>
  <head>
    <meta charset='utf-8'>
    <link rel='stylesheet' href='/resources/inscription-assets/preview-markdown.css'></link>
    <script>window.markdownBase64 = '${dataUri}'</script>
    <script src='/resources/inscription-assets/preview-markdown.js' type=module defer></script>
  </head>
  <body>
  </body>
</html>`;
}

// test here: https://ordpool.space/tx/25013a3ab212e0ca5b3ccbd858ff988f506b77080c51963c948c055028af2051
async function getPreviewModel(inscription: ParsedInscription): Promise<string> {

  const dataUri = await inscription.getDataUri();
  return `<!doctype html>
<html lang='en'>
  <head>
    <meta charset='utf-8'>
    <script src='/resources/inscription-assets/preview-model-viewer.js' type='module'></script>
    <style>
      model-viewer {
        position: fixed;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <model-viewer src='${dataUri}' auto-rotate='true' camera-controls='true' shadow-intensity='1'></model-viewer>
  </body>
</html>`;
}

// test here: https://ordpool.space/tx/85b10531435304cbe47d268106b58b57a4416c76573d4b50fa544432597ad670i0
// (shows only the first page)
async function getPreviewPdf(inscription: ParsedInscription): Promise<string> {

  const dataUri = await inscription.getDataUri();
  return `<!doctype html>
<html lang='en'>
  <head>
    <meta charset='utf-8'>
    <link rel='stylesheet' href='/resources/inscription-assets/preview-pdf.css'>
    <script>window.pdfBase64 = '${dataUri}'</script>
    <script src='/resources/inscription-assets/preview-pdf.js' defer type='module'></script>
  </head>
  <body>
    <canvas></canvas>
  </body>
</html>`;
}

// test here: https://ordpool.space/tx/430901147831e41111aced3895ee4b9742cf72ac3cffa132624bd38c551ef379
async function getPreviewText(inscription: ParsedInscription): Promise<string> {

  const instructions = await InscriptionPreviewService.getContentTypeInstructions(inscription);


  if (instructions.whatToShow === 'json') {
    const formatedText = instructions.content ? formatJSON(instructions.content) : '';

    const bytes = unicodeStringToBytes(formatedText);
    const content = bytesToBinaryString(bytes);
    const fullBase64Data = binaryStringToBase64(content);
    const dataUri = `data:${inscription.contentType};base64,${fullBase64Data}`;

    // TODO: format with highlight.js
    return `<!doctype html>
<html lang='en'>
  <head>
    <meta charset='utf-8'>
    <link href='/resources/inscription-assets/preview-text.css' rel='stylesheet'>

    <script>window.textBase64 = '${dataUri}'</script>
    <script src='/resources/inscription-assets/preview-text-json.js' defer type='module'></script>  </head>
  <body>
    <pre><code></code></pre>
  </body>
</html>`
  }

  // TODO: format with prettier
  if (instructions.whatToShow === 'code') {

    const formatedText = instructions.content || '';
    const bytes = unicodeStringToBytes(formatedText);
    const content = bytesToBinaryString(bytes);
    const fullBase64Data = binaryStringToBase64(content);
    const dataUri = `data:${inscription.contentType};base64,${fullBase64Data}`;

    return `<!doctype html>
<html lang='en'>
  <head>
    <meta charset='utf-8'>
    <link href='/resources/inscription-assets/preview-text.css' rel='stylesheet'>

    <script>window.textBase64 = '${dataUri}'</script>
    <script src='/resources/inscription-assets/preview-text-code.js' defer type='module'></script>
  </head>
  <body>
    <pre><code></code></pre>
  </body>
</html>`
  }



  const dataUri = await inscription.getDataUri();
  return `<!doctype html>
<html lang='en'>
  <head>
    <meta charset='utf-8'>
    <meta name='format-detection' content='telephone=no'>
    <link href='/resources/inscription-assets/preview-text.css' rel='stylesheet'>

    <script>window.textBase64 = '${dataUri}'</script>
    <script src='/resources/inscription-assets/preview-text.js' defer type='module'></script>
  </head>
  <body>
    <pre></pre>
  </body>
</html>`;
}

// test here: https://ordpool.space/tx/06158001c0be9d375c10a56266d8028b80ebe1ef5e2a9c9a4904dbe31b72e01c
async function getPreviewUnknown(_inscription?: ParsedInscription): Promise<string> {

  return `<!doctype html>
<html lang='en'>
  <head>
    <meta charset='utf-8'>
  </head>
  <body>
    <h1 style="color:white;font-family: sans-serif;text-align:center;">?</h1>
  </body>
</html>
`;
}

/**
 * Iframe HTML shown when an inscription's compressed body cannot be
 * decoded (or would exceed the decompression size limit). Used by both
 * the parser's getPreview() and the frontend's `<app-preview-viewer>`
 * (via getContentTypeInstructions returning 'decode-failure', which
 * routes to the same component that renders this HTML).
 *
 * Self-contained -- no external CSS or fonts -- because it has to render
 * inside the sandboxed iframe used by `<app-preview-viewer>` AND inside
 * the backend's `/preview/:id` response. Two distinct messages so the
 * user knows whether it's a malformed inscription or a too-large one.
 *
 * test here (invalid-data: Content-Encoding: br body that is actually gzip):
 *   https://ordpool.space/tx/5125c1269bd9c4605764fe76d253078d4c35897646004b8fa9837ad41e94a634
 * test here (size-limit): no real-data fixture yet -- a >1 MB-decompressing
 *   brotli body is needed to exercise this branch via the live UI.
 */
function getPreviewDecodeFailure(reason: DecodeFailureReason): string {
  const headline = reason === 'size-limit'
    ? 'Inscription too large to decode'
    : 'Inscription content cannot be decoded';

  const detail = reason === 'size-limit'
    ? `The decompressed content exceeds the ${MAX_DECOMPRESSED_SIZE / 1024 / 1024}&#160;MB safety limit. The data is preserved on chain and remains accessible via the raw content link.`
    : `The inscription declares a brotli or gzip Content-Encoding that doesn't match its actual body. The data is preserved on chain and remains accessible via the raw content link.`;

  return `<!doctype html>
<html lang='en'>
  <head>
    <meta charset='utf-8'>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #131516; color: #d3d4d5; font-family: system-ui, -apple-system, sans-serif; }
      .wrap { display: flex; align-items: center; justify-content: center; height: 100%; padding: 1.5rem; box-sizing: border-box; }
      .panel { max-width: 32rem; text-align: center; }
      .panel h1 { margin: 0 0 0.6rem; font-size: 1.05rem; font-weight: 600; color: #ff9f43; }
      .panel p { margin: 0; line-height: 1.5; font-size: 0.9rem; color: #b1b3b5; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="panel">
        <h1>${headline}</h1>
        <p>${detail}</p>
      </div>
    </div>
  </body>
</html>`;
}

// test here: https://ordpool.space/tx/700f348e1acef6021cdee8bf09e4183d6a3f4d573b4dc5585defd54009a0148c
async function getPreviewVideo(inscription: ParsedInscription): Promise<string> {

  const dataUri = await inscription.getDataUri();
  return `<!doctype html>
<html lang='en'>
  <head>
    <meta charset='utf-8'>
    <link rel='stylesheet' href='/resources/inscription-assets/preview-video.css'>
  </head>
  <body>
    <video controls loop muted autoplay>
      <source src="${dataUri}">
    </video>
  </body>
</html>`;
}

/**
 * Checks if a given string is valid JSON.
 *
 * @param str - The string to be tested.
 * @returns Returns true if the string is valid JSON, otherwise false.
 */
export function validateJson(str: string) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Formats a JSON string with indentation for better readability.
 *
 * @param jsonString - The JSON string to be formatted.
 * @param [indentation=2] - The number of spaces to use for indentation. Default is 4.
 * @returns The formatted JSON string, or an error message if the input is not valid JSON.
 */
export function formatJSON(jsonString: string, indentation = 2) {
  const parsed = JSON.parse(jsonString);
  return JSON.stringify(parsed, null, indentation);
}
