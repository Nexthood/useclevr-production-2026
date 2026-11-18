import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { canonical, ContractError, hashObject, sha256 } from "./domain";

export type NativeSignaturePayload = {
  version: 1;
  contractId: string;
  role: "partner" | "company";
  sourceChecksum: string;
  snapshotChecksum: string;
  signerReference: string;
  legalName: string;
  typedName: string;
  verifiedEmail: string;
  verifiedAt: string;
  documentPresentedAt: string;
  signedAt: string;
  consentVersion: string;
  consentText: string;
  affirmativeAction: "sign_agreement";
  previousEvidenceHash: string | null;
  security: { userAgentHash: string; reportedAddressHash: string };
};
export type NativeAttestation<T> = {
  payload: T;
  checksum: string;
  keyId: string;
  signature: string;
};
export type NativeManifest = {
  version: 1;
  contractId: string;
  sourceChecksum: string;
  signedChecksum: string;
  snapshotChecksum: string;
  completedAt: string;
  receipts: NativeAttestation<NativeSignaturePayload>[];
};
export function verifyNativeFiles(
  envelope: NativeAttestation<NativeManifest>,
  signedPdf: Uint8Array,
  sourcePdf: Uint8Array,
) {
  const manifest = verifyNativeAttestation(envelope);
  if (
    manifest.version !== 1 ||
    sha256(signedPdf) !== manifest.signedChecksum ||
    sha256(sourcePdf) !== manifest.sourceChecksum ||
    manifest.receipts.length !== 2
  )
    throw new ContractError("native_archive_binding_invalid", 503);
  for (const [index, receipt] of manifest.receipts.entries()) {
    const p = verifyNativeAttestation(receipt);
    if (
      p.contractId !== manifest.contractId ||
      p.sourceChecksum !== manifest.sourceChecksum ||
      p.snapshotChecksum !== manifest.snapshotChecksum ||
      p.role !== (index === 0 ? "partner" : "company") ||
      p.previousEvidenceHash !== (index === 0 ? null : manifest.receipts[0].checksum)
    )
      throw new ContractError("native_archive_binding_invalid", 503);
  }
  return manifest;
}

function publicKey(keyId: string) {
  try {
    const encoded = JSON.parse(process.env.PARTNER_CONTRACT_NATIVE_PUBLIC_KEYS || "{}")[keyId];
    const key = createPublicKey({
      key: Buffer.from(encoded, "base64"),
      type: "spki",
      format: "der",
    });
    if (key.asymmetricKeyType !== "ed25519") throw new Error("algorithm");
    return key;
  } catch {
    throw new ContractError("native_attestation_public_key_invalid", 503);
  }
}
export function attestNative<T>(payload: T): NativeAttestation<T> {
  const keyId = process.env.PARTNER_CONTRACT_NATIVE_KEY_ID || "";
  try {
    const key = createPrivateKey({
      key: Buffer.from(process.env.PARTNER_CONTRACT_NATIVE_PRIVATE_KEY || "", "base64"),
      type: "pkcs8",
      format: "der",
    });
    if (!keyId || key.asymmetricKeyType !== "ed25519") throw new Error("algorithm");
    const signature = sign(null, Buffer.from(canonical(payload)), key).toString("base64");
    const result = { payload, checksum: hashObject(payload), keyId, signature };
    verifyNativeAttestation(result);
    return result;
  } catch {
    throw new ContractError("native_attestation_configuration_invalid", 503);
  }
}
export function verifyNativeAttestation<T>(envelope: NativeAttestation<T>) {
  try {
    if (
      envelope.checksum !== hashObject(envelope.payload) ||
      !verify(
        null,
        Buffer.from(canonical(envelope.payload)),
        publicKey(envelope.keyId),
        Buffer.from(envelope.signature, "base64"),
      )
    )
      throw new Error("integrity");
  } catch {
    throw new ContractError("native_evidence_integrity_check_failed", 503);
  }
  return envelope.payload;
}
