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
        previewContent: getPreviewUnknown(''),
        renderDirectly: false
      }
    }

    let previewFunction: (dataUri: string) => string = getPreviewUnknown;
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
        previewContent: getPreviewUnknown(''),
        renderDirectly: false
      }
    }

    const dataUri = await inscription.getDataUri();

    return {
      instructionsFor: inscription.inscriptionId,
      previewContent: previewFunction(dataUri),
      renderDirectly: false
    }
  }
}

const table: { [key: string]: (dataUri: string) => string } = {
  'application/cbor': getPreviewUnknown,
  'application/json': getPreviewText,
  'application/octet-stream': getPreviewUnknown,
  'application/pdf': getPreviewPdf,
  'application/pgp-signature': getPreviewText,
  'application/protobuf': getPreviewUnknown,
  'application/x-javascript': getPreviewText,
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
function getPreviewIframe(_dataUri: string): string {
  // return decodeDataURI(dataUri);
  return ''
}

// test here: http://localhost:4200/tx/ad99172fce60028406f62725b91b5c508edd95bf21310de5afeb0966ddd89be3
function getPreviewAudio(dataUri: string): string {

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
function getPreviewImage(dataUri: string): string {

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
function getPreviewMarkdown(dataUri: string): string {

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
function getPreviewModel(dataUri: string): string {

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
function getPreviewPdf(dataUri: string): string {

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
function getPreviewText(dataUri: string): string {

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
function getPreviewUnknown(_dataUri: string): string {

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
function getPreviewVideo(dataUri: string): string {

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
