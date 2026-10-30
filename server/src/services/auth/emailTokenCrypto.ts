import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("AUTH_JWT_SECRET must contain at least 32 bytes");
  return createHash("sha256").update("irontrack:auth-email-token:v1\0").update(secret).digest();
}

export function encryptEmailToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString("base64url")).join(".");
}

export function decryptEmailToken(value: string) {
  const [ivValue, tagValue, ciphertextValue, extra] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue || extra !== undefined) throw new Error("Invalid encrypted email token");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}
