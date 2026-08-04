import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function key() {
  const secret = process.env.PROVIDER_CREDENTIALS_KEY;
  if (!secret || secret.length < 32) throw new Error("PROVIDER_CREDENTIALS_KEY doit contenir au moins 32 caractères.");
  return createHash("sha256").update(secret).digest();
}

export function encryptCredential(value: string | null) {
  if (!value || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")}`;
}

export function decryptCredential(value: string | null) {
  if (!value || !value.startsWith(PREFIX)) return value;
  const payload = Buffer.from(value.slice(PREFIX.length), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}
