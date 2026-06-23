// Encryption for marketplace credentials at rest (migration 020).
//
// Marketplace tokens (Reverb personal access tokens, eBay user tokens) are
// secrets — they must not sit in the DB in plaintext. We encrypt with
// AES-256-GCM and store `iv:authTag:ciphertext` (all base64).
//
// Key source, in order:
//   1. MARKETPLACE_ENC_KEY — 32 bytes as base64 or hex (preferred; lets you
//      rotate independently of auth).
//   2. Derived from NEXTAUTH_SECRET via scrypt with a fixed salt, so existing
//      deployments work with no new env var. NEXTAUTH_SECRET is always set in
//      any environment that can sign in a user, so a credential encrypted on
//      one boot decrypts on the next.
//
// If neither is available the module throws on first use — callers surface a
// 503 rather than silently storing plaintext.

import crypto from "crypto";

const ALGO = "aes-256-gcm";
// Pin the GCM authentication tag to the full 16 bytes. Passing authTagLength to
// both cipher and decipher (and rejecting any other length on decrypt) stops a
// truncated-tag forgery — a shorter tag is far easier to brute-force.
const AUTH_TAG_LENGTH = 16;
let cachedKey: Buffer | null = null;

function resolveKey(): Buffer {
  if (cachedKey) return cachedKey;

  const explicit = process.env.MARKETPLACE_ENC_KEY;
  if (explicit) {
    // Accept base64 or hex; must decode to exactly 32 bytes.
    let buf: Buffer | null = null;
    try {
      const b64 = Buffer.from(explicit, "base64");
      if (b64.length === 32) buf = b64;
    } catch { /* not base64 */ }
    if (!buf) {
      try {
        const hex = Buffer.from(explicit, "hex");
        if (hex.length === 32) buf = hex;
      } catch { /* not hex */ }
    }
    if (!buf) {
      throw new Error("MARKETPLACE_ENC_KEY must decode to 32 bytes (base64 or hex)");
    }
    cachedKey = buf;
    return cachedKey;
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("No encryption key: set MARKETPLACE_ENC_KEY or NEXTAUTH_SECRET");
  }
  // Deterministic 32-byte key derived from the auth secret. Fixed salt is fine
  // here — the secret itself is the entropy, and we need stable derivation
  // across restarts to decrypt previously-stored credentials.
  cachedKey = crypto.scryptSync(secret, "vault1-marketplace-creds", 32);
  return cachedKey;
}

export function encryptToken(plaintext: string): string {
  const key = resolveKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce, standard for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptToken(stored: string): string {
  const key = resolveKey();
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted token");
  }
  const tag = Buffer.from(tagB64, "base64");
  if (tag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Malformed encrypted token (bad auth tag length)");
  }
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"), { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

// True when an encryption key is configured — used by the credentials route to
// 503 cleanly instead of throwing mid-request.
export function encryptionAvailable(): boolean {
  try {
    resolveKey();
    return true;
  } catch {
    return false;
  }
}
