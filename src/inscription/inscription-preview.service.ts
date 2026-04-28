import { binaryStringToBase64, bytesToBinaryString, unicodeStringToBytes } from '../lib/conversions';
import { ParsedInscription } from '../types/parsed-inscription';

export interface PreviewInstructions {
  instructionsFor: string | undefined;
  previewContent: string;
  renderDirectly: boolean;
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
    whatToShow: 'json' | 'code' | 'preview'
  }> {

    let content: string | undefined = undefined;

    if (inscription.contentType?.startsWith('text/plain') ||
      inscription.contentType?.startsWith('application/json')) {

        content = await inscription.getContent();
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



// test here: http://localhost:4200/tx/751007cf3090703f241894af5c057fc8850d650a577a800447d4f21f5d2cecde
async function getPreviewIframe(_inscription: ParsedInscription): Promise<string> {
  // return decodeDataURI(dataUri);
  return ''
}

// test here: http://localhost:4200/tx/ad99172fce60028406f62725b91b5c508edd95bf21310de5afeb0966ddd89be3
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

// test here http://localhost:4200/tx/6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799
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

// test here: http://localhost:4200/tx/c133c03e2ed44bb8ada79b1640b6649129de75a8f31d8e6ad573ede442f91cdb
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

// test here: http://localhost:4200/tx/25013a3ab212e0ca5b3ccbd858ff988f506b77080c51963c948c055028af2051
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

// test here: http://localhost:4200/tx/85b10531435304cbe47d268106b58b57a4416c76573d4b50fa544432597ad670i0
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

// test here: http://localhost:4200/tx/430901147831e41111aced3895ee4b9742cf72ac3cffa132624bd38c551ef379
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

// test here: http://localhost:4200/tx/06158001c0be9d375c10a56266d8028b80ebe1ef5e2a9c9a4904dbe31b72e01c
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

// test here: http://localhost:4200/tx/700f348e1acef6021cdee8bf09e4183d6a3f4d573b4dc5585defd54009a0148c
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
