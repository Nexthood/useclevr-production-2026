import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { debugError, debugWarn } from "@/lib/utils/debug";

type EncryptedPayload = {
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

export function encryptRetailSecret(secret: string) {
  const iv = randomBytes(12);
  const key = getRetailEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  } satisfies EncryptedPayload);
}

export function decryptRetailSecret(payload: string) {
  try {
    const parsed = JSON.parse(payload) as EncryptedPayload;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getRetailEncryptionKey(),
      Buffer.from(parsed.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (error) {
    debugError("[RETAIL_POS] Failed to decrypt provider token", error);
    throw new Error("Stored retail provider token cannot be decrypted.");
  }
}

function getRetailEncryptionKey() {
  const secret =
    process.env.RETAIL_TOKEN_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    debugWarn("[RETAIL_POS] Missing RETAIL_TOKEN_ENCRYPTION_KEY/AUTH_SECRET for token encryption.");
    throw new Error("Retail token encryption is not configured.");
  }
  return createHash("sha256").update(secret).digest();
}
