// ---------------------------------------------------------------------------
// Safe operational diagnostics for the Usy contact handoff.
//
// Diagnostics describe only configuration shape and transport metadata. They
// never contain the webhook secret, the Authorization header, the request
// payload, or any customer-identifying field. Exception messages are
// sanitized to a single line with URLs, bearer tokens, and the configured
// secret redacted before they reach logs.
// ---------------------------------------------------------------------------

export const usyContactWebhookExpectedHost = "useclevr.app.n8n.cloud";
export const usyContactWebhookExpectedPath = "/webhook/usy-contact";

export type UsyContactHandoffFailureCode =
  | "webhook_not_configured"
  | "invalid_webhook_url"
  | "dns_failure"
  | "connection_failure"
  | "tls_failure"
  | "timeout"
  | "n8n_http_400"
  | "n8n_http_401"
  | "n8n_http_404"
  | "n8n_http_5xx"
  | "n8n_http_other"
  | "invalid_n8n_response"
  | "unexpected_error";

export type UsyContactHandoffDiagnostic = {
  event: "usy_contact_handoff_failed" | "usy_contact_handoff_delivered";
  stage: "configuration" | "url_validation" | "webhook_request";
  failureCode: UsyContactHandoffFailureCode | null;
  webhookConfigured: boolean;
  webhookHost: string | null;
  webhookPath: string | null;
  urlProtocolOk: boolean | null;
  urlHostOk: boolean | null;
  urlPathOk: boolean | null;
  webhookTestPath: boolean | null;
  httpStatus: number | null;
  responseContentType: string | null;
  errorType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number;
};

export function sanitizeUsyContactDiagnosticMessage(value: unknown, secret?: string): string | null {
  if (value === null || value === undefined) return null;
  let text = typeof value === "string" ? value : String(value);
  if (secret) {
    text = text.split(secret).join("[redacted-secret]");
  }
  text = text.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, "[redacted-url]");
  text = text.replace(/bearer\s+\S+/gi, "[redacted-authorization]");
  text = text.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return text ? text.slice(0, 300) : null;
}

export type UsyContactWebhookUrlInspection = {
  parsed: boolean;
  host: string | null;
  path: string | null;
  protocolOk: boolean;
  hostOk: boolean;
  pathOk: boolean;
  testPath: boolean;
};

export function inspectUsyContactWebhookUrl(webhookUrl: string | null | undefined): UsyContactWebhookUrlInspection {
  if (!webhookUrl) {
    return { parsed: false, host: null, path: null, protocolOk: false, hostOk: false, pathOk: false, testPath: false };
  }
  let parsed: URL | null = null;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return { parsed: false, host: null, path: null, protocolOk: false, hostOk: false, pathOk: false, testPath: false };
  }
  return {
    parsed: true,
    host: parsed.hostname || null,
    path: parsed.pathname || null,
    protocolOk: parsed.protocol === "https:",
    hostOk: parsed.hostname === usyContactWebhookExpectedHost,
    pathOk: parsed.pathname === usyContactWebhookExpectedPath,
    testPath: /^\/webhook-test(\/|$)/i.test(parsed.pathname),
  };
}

type UsyContactErrorChainEntry = {
  name: string;
  code: string | null;
  message: string;
};

function collectUsyContactErrorChain(error: unknown): UsyContactErrorChainEntry[] {
  const chain: UsyContactErrorChainEntry[] = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Object && depth < 5; depth += 1) {
    const entry = current as { name?: unknown; code?: unknown; message?: unknown; cause?: unknown };
    chain.push({
      name: typeof entry.name === "string" ? entry.name : "",
      code: typeof entry.code === "string" ? entry.code : null,
      message: typeof entry.message === "string" ? entry.message : "",
    });
    current = entry.cause;
  }
  return chain;
}

const usyContactDnsCodes = ["ENOTFOUND", "EAI_AGAIN"];
const usyContactTimeoutCodes = ["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "ABORT_ERR"];
const usyContactTlsCodes = [
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "ERR_SSL_SSLV3_ALERT_CERTIFICATE_EXPIRED",
];
const usyContactConnectionCodes = [
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENETDOWN",
  "EADDRNOTAVAIL",
  "UND_ERR_SOCKET",
];

export function classifyUsyContactWebhookException(error: unknown): UsyContactHandoffFailureCode {
  const chain = collectUsyContactErrorChain(error);
  if (chain.some((entry) => entry.name === "AbortError" || entry.name === "TimeoutError")) {
    return "timeout";
  }
  for (const entry of chain) {
    if (!entry.code) continue;
    if (usyContactDnsCodes.includes(entry.code)) return "dns_failure";
    if (usyContactTimeoutCodes.includes(entry.code)) return "timeout";
    if (usyContactTlsCodes.includes(entry.code)) return "tls_failure";
    if (usyContactConnectionCodes.includes(entry.code)) return "connection_failure";
  }
  const text = chain.map((entry) => `${entry.name} ${entry.message}`).join(" ");
  if (/invalid url|failed to parse url/i.test(text)) return "invalid_webhook_url";
  if (/getaddrinfo|enotfound|eai_again/i.test(text)) return "dns_failure";
  if (/connect timeout|headers timeout|body timeout|aborted|etimedout/i.test(text)) return "timeout";
  if (/certificate|tls|ssl/i.test(text)) return "tls_failure";
  if (/econn(refused|reset|aborted)|epipe|ehostunreach|enetunreach|enetdown|socket/i.test(text)) return "connection_failure";
  return "unexpected_error";
}

export function classifyUsyContactWebhookHttpStatus(status: number): UsyContactHandoffFailureCode {
  if (status === 400) return "n8n_http_400";
  if (status === 401) return "n8n_http_401";
  if (status === 404) return "n8n_http_404";
  if (status >= 500 && status < 600) return "n8n_http_5xx";
  if (status >= 300 && status < 400) return "invalid_n8n_response";
  return "n8n_http_other";
}

export type UsyContactHandoffDiagnosticInput = {
  event: "usy_contact_handoff_failed" | "usy_contact_handoff_delivered";
  stage: "configuration" | "url_validation" | "webhook_request";
  failureCode: UsyContactHandoffFailureCode | null;
  webhookConfigured: boolean;
  webhookUrl?: string | null;
  httpStatus?: number | null;
  responseContentType?: string | null;
  error?: unknown;
  errorMessage?: string | null;
  redactionSecret?: string | null;
  durationMs: number;
};

export function buildUsyContactHandoffDiagnostic(input: UsyContactHandoffDiagnosticInput): UsyContactHandoffDiagnostic {
  const inspection = inspectUsyContactWebhookUrl(input.webhookUrl ?? null);
  const chain = input.error === null || input.error === undefined ? [] : collectUsyContactErrorChain(input.error);
  const rawMessage =
    input.errorMessage !== undefined && input.errorMessage !== null
      ? input.errorMessage
      : chain[0]?.message ?? (typeof input.error === "string" ? input.error : null);
  return {
    event: input.event,
    stage: input.stage,
    failureCode: input.failureCode,
    webhookConfigured: input.webhookConfigured,
    webhookHost: inspection.host,
    webhookPath: inspection.path,
    urlProtocolOk: input.webhookUrl ? inspection.protocolOk : null,
    urlHostOk: input.webhookUrl ? inspection.hostOk : null,
    urlPathOk: input.webhookUrl ? inspection.pathOk : null,
    webhookTestPath: input.webhookUrl ? inspection.testPath : null,
    httpStatus: typeof input.httpStatus === "number" ? input.httpStatus : null,
    responseContentType: input.responseContentType ?? null,
    errorType: chain[0]?.name || (input.error !== null && input.error !== undefined ? typeof input.error : null),
    errorCode: chain.find((entry) => entry.code)?.code ?? null,
    errorMessage: sanitizeUsyContactDiagnosticMessage(rawMessage, input.redactionSecret ?? undefined),
    durationMs: input.durationMs,
  };
}

export function buildUsyContactMissingConfigDiagnostic(webhookUrl?: string | null): UsyContactHandoffDiagnostic {
  return buildUsyContactHandoffDiagnostic({
    event: "usy_contact_handoff_failed",
    stage: "configuration",
    failureCode: "webhook_not_configured",
    webhookConfigured: false,
    webhookUrl: webhookUrl ?? null,
    durationMs: 0,
  });
}

export function logUsyContactHandoffDiagnostic(diagnostic: UsyContactHandoffDiagnostic): void {
  const line = JSON.stringify(diagnostic);
  if (diagnostic.event === "usy_contact_handoff_failed") {
    console.error(line);
    return;
  }
  console.log(line);
}
