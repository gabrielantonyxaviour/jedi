import { webcrypto } from "crypto";

// Polyfill for crypto in ES modules
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto as any;
}

export const crypto = globalThis.crypto;
