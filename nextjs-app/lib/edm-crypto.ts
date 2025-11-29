import * as crypto from "crypto";

const ENC_ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bitów recommended for GCM

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function encryptToken(plain: string) {
  const keyBase64 = process.env.EDM_TOKEN_ENC_KEY;
  if (!keyBase64) throw new Error("EDM_TOKEN_ENC_KEY is not set");
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("EDM_TOKEN_ENC_KEY must be 32 bytes (base64)");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(enc: string) {
  const keyBase64 = process.env.EDM_TOKEN_ENC_KEY;
  if (!keyBase64) throw new Error("EDM_TOKEN_ENC_KEY is not set");
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("EDM_TOKEN_ENC_KEY must be 32 bytes (base64)");
  const data = Buffer.from(enc, "base64");
  const iv = data.slice(0, IV_LENGTH);
  const tag = data.slice(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = data.slice(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}