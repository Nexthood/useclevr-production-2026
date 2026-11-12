import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { partnerContractArtifacts } from "@/lib/db/schema";
import { ContractError, sha256, runtimePolicy } from "./domain";
import { MAX_DOCUMENT_BYTES } from "./provider";
import type { ContractDb } from "./types";
function encryptionKey(id?: string) {
  let keys: Record<string, string>;
  try {
    keys = JSON.parse(process.env.PARTNER_CONTRACT_ENCRYPTION_KEYS || "{}");
  } catch {
    throw new ContractError("document_encryption_configuration_invalid");
  }
  const keyId = id || process.env.PARTNER_CONTRACT_ENCRYPTION_KEY_ID || "";
  const key = Buffer.from(keys[keyId] || "", "base64");
  if (!keyId || key.length !== 32) throw new ContractError("document_encryption_key_missing");
  return { keyId, key };
}
// Versioned encryption envelope: IV (12), authentication tag (16), ciphertext.
export function sealArtifact(bytes: Buffer, contractId: string, checksum: string) {
  const { keyId, key } = encryptionKey();
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${contractId}:${checksum}:${keyId}`));
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { keyId, encryptedBytes: Buffer.concat([iv, cipher.getAuthTag(), encrypted]) };
}
export async function saveArtifact(
  db: ContractDb,
  contractId: string,
  kind: "source" | "signed" | "audit",
  bytes: Buffer,
) {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES)
    throw new ContractError("document_size_invalid");
  if (kind !== "audit" && bytes.subarray(0, 5).toString() !== "%PDF-")
    throw new ContractError("document_is_not_pdf");
  const checksum = sha256(bytes);
  const previous = await db.query.partnerContractArtifacts.findFirst({
    where: and(
      eq(partnerContractArtifacts.contractId, contractId),
      eq(partnerContractArtifacts.kind, kind),
      eq(partnerContractArtifacts.checksum, checksum),
    ),
  });
  if (previous) return previous;
  const retention = runtimePolicy().retentionDays;
  const rows = await db
    .insert(partnerContractArtifacts)
    .values({
      id: randomUUID(),
      contractId,
      kind,
      mediaType: kind === "audit" ? "application/json" : "application/pdf",
      checksum,
      ...sealArtifact(bytes, contractId, checksum),
      byteLength: bytes.length,
      retainUntil:
        Number.isInteger(retention) && retention > 0
          ? new Date(Date.now() + retention * 86400000)
          : null,
    })
    .returning();
  return rows[0];
}
export async function readArtifact(
  db: ContractDb,
  id: string,
  contractId: string,
  expectedChecksum: string,
) {
  const a = await db.query.partnerContractArtifacts.findFirst({
    where: and(
      eq(partnerContractArtifacts.id, id),
      eq(partnerContractArtifacts.contractId, contractId),
    ),
  });
  if (!a || a.checksum !== expectedChecksum) throw new ContractError("document_not_found", 404);
  try {
    const { key } = encryptionKey(a.keyId);
    const raw = Buffer.from(a.encryptedBytes);
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    decipher.setAAD(Buffer.from(`${contractId}:${a.checksum}:${a.keyId}`));
    const bytes = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    if (bytes.length !== a.byteLength || sha256(bytes) !== expectedChecksum)
      throw new Error("checksum");
    return { bytes, mediaType: a.mediaType };
  } catch {
    throw new ContractError("document_integrity_check_failed", 503);
  }
}
