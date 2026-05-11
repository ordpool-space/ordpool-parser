// Adds support for TextEncoder and TextDecoder
// see https://stackoverflow.com/a/68468204
// see https://github.com/jsdom/jsdom/issues/2524

// It patches the global objects TextEncoder, TextDecoder, and Uint8Array
// which are missing, or improperly implemented (Uint8Array is a node Buffer) in the JSDOM environment.
// This should ensure full compatibility with browser global objects in our Jest testing environment.

const util = require('util');

global.TextEncoder = util.TextEncoder;
global.TextDecoder = util.TextDecoder;

// add this too
global.Uint8Array = Uint8Array;

const { DecompressionStream } = require('stream/web');
global.DecompressionStream = DecompressionStream;

// WebCrypto polyfill for jsdom -- the OTS verifier uses crypto.subtle.digest
// for SHA-1 / SHA-256. Real browsers expose this; jsdom doesn't, so we
// borrow Node's webcrypto and bind it to globalThis.crypto.
//
// jsdom installs its own `globalThis.crypto` that's a partial polyfill
// (e.g. randomUUID) but lacks .subtle. We replace it wholesale via
// Object.defineProperty because it's a getter on jsdom's window/global.
const { webcrypto } = require('crypto');
Object.defineProperty(global, 'crypto', { value: webcrypto, configurable: true, writable: true });
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true, writable: true });

