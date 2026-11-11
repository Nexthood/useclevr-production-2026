import { createHmac } from "node:crypto";
import {
  ContractError,
  safeEqual,
  sha256,
  type ContractMode,
  type ContractSnapshot,
  type ProviderSnapshot,
} from "./domain";

export type SendInput = {
  contractId: string;
  sourceChecksum: string;
  pdf: Uint8Array;
  snapshot: ContractSnapshot;
  expiresAt: Date;
};
export interface SignatureProvider {
  send(input: SendInput): Promise<ProviderSnapshot>;
  get(reference: string): Promise<ProviderSnapshot>;
  find(contractId: string): Promise<ProviderSnapshot | null>;
  files(reference: string): Promise<Buffer>;
  remind(reference: string, email: string): Promise<void>;
  cancel(reference: string): Promise<void>;
}
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export async function boundedBytes(response: Response, limit: number) {
  if (Number(response.headers.get("content-length") || 0) > limit)
    throw new ContractError("provider_response_too_large", 502);
  const reader = response.body?.getReader();
  if (!reader) throw new ContractError("provider_response_missing", 502);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new ContractError("provider_response_too_large", 502);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
type RawSignature = {
  signature_id: string;
  signer_email_address: string;
  signer_name: string;
  order: number;
  status_code: string;
  signed_at: number | null;
};
type RawRequest = {
  signature_request_id: string;
  test_mode: boolean;
  is_complete: boolean;
  is_declined: boolean;
  has_error: boolean;
  metadata: Record<string, string>;
  signatures: RawSignature[];
};
export function normalizeDropbox(value: RawRequest): ProviderSnapshot {
  if (
    !value ||
    typeof value.signature_request_id !== "string" ||
    typeof value.test_mode !== "boolean" ||
    !Array.isArray(value.signatures) ||
    !value.metadata
  )
    throw new ContractError("invalid_provider_response", 502);
  return {
    reference: value.signature_request_id,
    contractId: value.metadata.contract_id,
    sourceChecksum: value.metadata.source_sha256,
    testMode: value.test_mode,
    complete: value.is_complete === true,
    declined:
      value.is_declined === true || value.signatures.some((x) => x.status_code === "declined"),
    cancelled: value.signatures.some((x) => ["canceled", "cancelled"].includes(x.status_code)),
    expired: value.signatures.some((x) => x.status_code === "expired"),
    hasError: value.has_error === true,
    signers: value.signatures.map((x) => ({
      role: x.order === 0 ? "partner" : "company",
      reference: x.order === 0 ? value.metadata.partner_ref : value.metadata.company_ref,
      name: x.signer_name,
      email: x.signer_email_address,
      order: x.order,
      signedAt:
        x.status_code === "signed" && x.signed_at
          ? new Date(x.signed_at * 1000).toISOString()
          : null,
      providerSignatureId: x.signature_id,
    })),
    observedAt: new Date().toISOString(),
  };
}
export class DropboxSignProvider implements SignatureProvider {
  private key: string;
  constructor(private mode: "dropbox_test" | "dropbox_live") {
    this.key = process.env.DROPBOX_SIGN_API_KEY || "";
    if (!this.key || !process.env.DROPBOX_SIGN_CLIENT_ID || !process.env.DROPBOX_SIGN_ACCOUNT_ID)
      throw new ContractError("provider_credentials_missing");
  }
  private async request(path: string, form?: FormData) {
    const r = await fetch(`https://api.hellosign.com/v3/${path}`, {
      method: form ? "POST" : "GET",
      headers: { Authorization: `Basic ${Buffer.from(this.key + ":").toString("base64")}` },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    }).catch(() => {
      throw new ContractError("provider_network_uncertain", 502);
    });
    if (!r.ok) throw new ContractError(`provider_http_${r.status}`, 502);
    return r;
  }
  private async json(path: string, form?: FormData) {
    return JSON.parse(
      (await boundedBytes(await this.request(path, form), 1024 * 1024)).toString(),
    ) as {
      signature_request: RawRequest;
      signature_requests: RawRequest[];
      account: { account_id: string };
    };
  }
  private reference(value: string) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(value))
      throw new ContractError("invalid_provider_reference");
    return encodeURIComponent(value);
  }
  async send(input: SendInput) {
    const account = (await this.json("account")).account;
    if (account?.account_id !== process.env.DROPBOX_SIGN_ACCOUNT_ID)
      throw new ContractError("provider_account_mismatch", 502);
    if (this.mode === "dropbox_test") {
      const allowed = (process.env.PARTNER_CONTRACT_TEST_RECIPIENTS || "")
        .split(",")
        .map((x) => x.trim().toLowerCase());
      if (
        ![input.snapshot.partnerEmail, input.snapshot.companySigner.email].every((x) =>
          allowed.includes(x.toLowerCase()),
        )
      )
        throw new ContractError("test_signer_not_allowlisted");
    }
    const f = new FormData();
    f.set(
      "files[0]",
      new Blob([new Uint8Array(input.pdf)], { type: "application/pdf" }),
      "partner-agreement.pdf",
    );
    f.set(
      "title",
      `${this.mode === "dropbox_test" ? "TEST - " : ""}${input.snapshot.documentTitle}`,
    );
    f.set(
      "subject",
      `${this.mode === "dropbox_test" ? "NON-BINDING TEST - " : ""}UseClevr partner agreement for signature`,
    );
    f.set(
      "message",
      "Review the complete agreement and schedules. Partner signs first; the authorized Atlas Mega Ventures LLC representative countersigns. Signing does not activate commercial privileges.",
    );
    f.set("client_id", process.env.DROPBOX_SIGN_CLIENT_ID!);
    f.set("test_mode", this.mode === "dropbox_test" ? "1" : "0");
    f.set("allow_decline", "1");
    f.set("allow_reassign", "0");
    f.set("expires_at", String(Math.floor(input.expiresAt.getTime() / 3600000) * 3600));
    const signers = [
      { email: input.snapshot.partnerEmail, name: input.snapshot.identity.signerName },
      { email: input.snapshot.companySigner.email, name: input.snapshot.companySigner.name },
    ];
    signers.forEach((s, i) => {
      f.set(`signers[${i}][email_address]`, s.email);
      f.set(`signers[${i}][name]`, s.name);
      f.set(`signers[${i}][order]`, String(i));
    });
    for (const [k, v] of Object.entries({
      contract_id: input.contractId,
      source_sha256: input.sourceChecksum,
      partner_ref: input.snapshot.userId,
      company_ref: input.snapshot.companySigner.reference,
      runtime_hash: input.snapshot.runtimeHash,
    }))
      f.set(`metadata[${k}]`, v);
    return normalizeDropbox((await this.json("signature_request/send", f)).signature_request);
  }
  async get(reference: string) {
    return normalizeDropbox(
      (await this.json(`signature_request/${this.reference(reference)}`)).signature_request,
    );
  }
  async find(contractId: string) {
    const matches: RawRequest[] = [];
    for (let page = 1; page <= 10; page++) {
      const body = await this.json(`signature_request/list?page=${page}&page_size=100`);
      const rows = body.signature_requests || [];
      matches.push(...rows.filter((x) => x.metadata?.contract_id === contractId));
      if (rows.length < 100) break;
    }
    if (matches.length > 1) throw new ContractError("ambiguous_provider_requests");
    return matches[0] ? normalizeDropbox(matches[0]) : null;
  }
  async files(reference: string) {
    const bytes = await boundedBytes(
      await this.request(`signature_request/files/${this.reference(reference)}?file_type=pdf`),
      MAX_DOCUMENT_BYTES,
    );
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new ContractError("provider_document_is_not_pdf", 502);
    return bytes;
  }
  async remind(reference: string, email: string) {
    const f = new FormData();
    f.set("email_address", email);
    await this.request(`signature_request/remind/${this.reference(reference)}`, f);
  }
  async cancel(reference: string) {
    await this.request(`signature_request/cancel/${this.reference(reference)}`, new FormData());
  }
}
// A mock is a deterministic test double, not an electronic-signature implementation.
export class MockSignatureProvider implements SignatureProvider {
  constructor(
    private load: (id: string) => Promise<{ snapshot: ProviderSnapshot; pdf: Buffer } | null>,
    private save: (id: string, s: ProviderSnapshot, pdf: Buffer) => Promise<void>,
  ) {
    if (process.env.NODE_ENV === "production")
      throw new ContractError("mock_signatures_forbidden_in_production");
  }
  async send(i: SendInput) {
    const existing = await this.load(i.contractId);
    if (existing) return existing.snapshot;
    const s: ProviderSnapshot = {
      reference: i.contractId,
      contractId: i.contractId,
      sourceChecksum: i.sourceChecksum,
      testMode: true,
      complete: false,
      declined: false,
      cancelled: false,
      expired: false,
      hasError: false,
      observedAt: new Date().toISOString(),
      signers: [
        {
          role: "partner",
          reference: i.snapshot.userId,
          email: i.snapshot.partnerEmail,
          name: i.snapshot.identity.signerName,
          order: 0,
          signedAt: null,
          providerSignatureId: `mock-partner-${i.contractId}`,
        },
        {
          role: "company",
          reference: i.snapshot.companySigner.reference,
          email: i.snapshot.companySigner.email,
          name: i.snapshot.companySigner.name,
          order: 1,
          signedAt: null,
          providerSignatureId: `mock-company-${i.contractId}`,
        },
      ],
    };
    await this.save(i.contractId, s, Buffer.from(i.pdf));
    return s;
  }
  async get(id: string) {
    const s = await this.load(id);
    if (!s) throw new ContractError("mock_request_missing");
    return s.snapshot;
  }
  async find(id: string) {
    return (await this.load(id))?.snapshot || null;
  }
  async files(id: string) {
    const s = await this.load(id);
    if (!s) throw new ContractError("mock_request_missing");
    return s.pdf;
  }
  async remind() {}
  async cancel(id: string) {
    const s = await this.load(id);
    if (s) await this.save(id, { ...s.snapshot, cancelled: true }, s.pdf);
  }
}
export function verifyDropboxCallback(
  json: string,
  contentSignature: string | null,
  now = Date.now(),
) {
  const key = process.env.DROPBOX_SIGN_API_KEY;
  if (!key || !contentSignature) throw new ContractError("invalid_callback_signature", 401);
  const mac = createHmac("sha256", key).update(json).digest();
  if (
    !safeEqual(contentSignature, mac.toString("base64")) &&
    !safeEqual(contentSignature, Buffer.from(mac.toString("hex")).toString("base64"))
  )
    throw new ContractError("invalid_callback_signature", 401);
  let body: {
    event: {
      event_type: string;
      event_time: string;
      event_hash: string;
      event_metadata?: {
        reported_for_account_id?: string;
        reported_for_app_id?: string;
        related_signature_id?: string;
      };
    };
    signature_request?: { signature_request_id: string };
    account?: { account_id: string };
  };
  try {
    body = JSON.parse(json);
  } catch {
    throw new ContractError("invalid_callback_json", 400);
  }
  const e = body.event;
  if (
    !e ||
    !/^\d{10}$/.test(String(e.event_time)) ||
    typeof e.event_type !== "string" ||
    typeof e.event_hash !== "string"
  )
    throw new ContractError("invalid_callback_event", 400);
  const time = Number(e.event_time) * 1000;
  if (time > now + 120000 || time < now - 72 * 3600000)
    throw new ContractError("callback_outside_replay_window", 401);
  if (
    !safeEqual(
      e.event_hash,
      createHmac("sha256", key)
        .update(String(e.event_time) + e.event_type)
        .digest("hex"),
    )
  )
    throw new ContractError("invalid_callback_signature", 401);
  const account = e.event_metadata?.reported_for_account_id || body.account?.account_id;
  if (
    account !== process.env.DROPBOX_SIGN_ACCOUNT_ID ||
    e.event_metadata?.reported_for_app_id !== process.env.DROPBOX_SIGN_CLIENT_ID
  )
    throw new ContractError("callback_account_mismatch", 401);
  const reference = body.signature_request?.signature_request_id;
  return {
    reference: reference || null,
    eventType: e.event_type,
    eventTime: new Date(time),
    eventKey: sha256(
      `${account}:${process.env.DROPBOX_SIGN_CLIENT_ID}:${e.event_time}:${e.event_type}:${reference || "setup"}:${e.event_metadata?.related_signature_id || ""}`,
    ),
    bodyChecksum: sha256(json),
  };
}
export function providerFor(
  mode: ContractMode,
  mock: () => MockSignatureProvider,
): SignatureProvider {
  if (mode === "draft") throw new ContractError("contract_signing_disabled");
  return mode === "mock" ? mock() : new DropboxSignProvider(mode);
}
