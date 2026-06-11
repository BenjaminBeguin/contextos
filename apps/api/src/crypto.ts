import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "./env.js";

// Derive a 32-byte key. Prefer a dedicated ENCRYPTION_KEY; fall back to the JWT
// secret. Rotating either invalidates stored tokens (users simply reconnect).
const key = scryptSync(process.env.ENCRYPTION_KEY ?? env.jwtSecret, "cortex-integration", 32);

/** AES-256-GCM encrypt → "iv:tag:ciphertext" (base64 parts). */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptToken(blob: string): string | null {
  try {
    const [ivB, tagB, dataB] = blob.split(":");
    if (!ivB || !tagB || !dataB) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
