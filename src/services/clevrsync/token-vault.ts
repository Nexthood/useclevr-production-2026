import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const TOKEN_KEY_VERSION = 1;

export function encryptClevrSyncToken(token: string) {
  const iv = randomBytes(12);
  const key = getTokenEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: TOKEN_KEY_VERSION,
    alg: "aes-256-gcm",
    key: "CLEVRSYNC_TOKEN_ENCRYPTION_KEY",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  });
}

export function decryptClevrSyncToken(payload: string) {
  try {
    const parsed = JSON.parse(payload) as { iv: string; tag: string; data: string };
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getTokenEncryptionKey(),
      Buffer.from(parsed.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(parsed.data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Stored ClevrSync token cannot be decrypted.");
  }
}

function getTokenEncryptionKey() {
  const secret = process.env.CLEVRSYNC_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error("ClevrSync token encryption is not configured.");
  }

  const base64 = decodeBase64Key(secret);
  if (base64) return base64;

  const raw = Buffer.from(secret, "utf8");
  if (raw.length === 32) return raw;

  throw new Error("ClevrSync token encryption key is invalid.");
}

function decodeBase64Key(secret: string) {
  try {
    const decoded = Buffer.from(secret, "base64");
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
}
