import { debugLog } from "@/lib/utils/debug";

export class EmailDeliveryError extends Error {
  constructor(message = "Email delivery failed") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export type ResendStatus = {
  status:
    | "configured"
    | "sent"
    | "not_configured"
    | "domain_unverified"
    | "api_error"
    | "delivery_failed";
  configured: boolean;
  sent: boolean;
  config: SanitizedResendConfig | null;
  domain?: ResendDomainStatus;
  error?: ReturnType<typeof getResendErrorDetails>;
  messageId?: string;
};

type ResendConfig = NonNullable<ReturnType<typeof getResendConfig>>;
type SanitizedResendConfig = {
  RESEND_API_KEY_SET: boolean;
  EMAIL_FROM_SET: boolean;
  EMAIL_FROM_DOMAIN: string;
};

type ResendEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type VerificationEmailContext = {
  traceId?: string;
  source?: "signup" | "login" | "resend";
  requestHost?: string;
};

type ResendDomainStatus = {
  checked: boolean;
  name: string;
  verified: boolean;
  status?: string;
  error?: ReturnType<typeof getResendErrorDetails>;
};

export async function sendVerificationEmail(
  email: string,
  code: string,
  context: VerificationEmailContext = {},
) {
  const config = getResendConfig();

  if (!config) {
    if (process.env.NODE_ENV !== "production" && process.env.EMAIL_PROVIDER === "console") {
      debugLog("[Email] Verification email requested", {
        ...sanitizeVerificationEmailContext(context),
        to: maskEmail(email),
        codeGenerated: Boolean(code),
        provider: "console",
      });
      return;
    }

    console.error("[Email] Resend verification email delivery failed", {
      ...sanitizeVerificationEmailContext(context),
      error: { message: "RESEND_API_KEY is not configured" },
      resend: null,
      to: maskEmail(email),
    });
    throw new EmailDeliveryError("Email delivery failed. Please try again.");
  }

  try {
    const domain = await checkResendDomainStatus(config);
    if (domain.checked && !domain.verified) {
      throw new ResendApiError(422, {
        message: "EMAIL_FROM domain is not verified in Resend",
        domain: domain.name,
        status: domain.status,
      });
    }

    console.warn("[Email] Resend verification email send starting", {
      ...sanitizeVerificationEmailContext(context),
      resend: sanitizeResendConfig(config),
      domain,
      to: maskEmail(email),
    });

    const result = await sendResendEmail(config, {
      to: email,
      subject: "Your UseClevr verification code",
      text: buildTextEmail(code),
      html: buildHtmlEmail(code),
    }, context);

    console.warn("[Email] Resend verification email sent", {
      ...sanitizeVerificationEmailContext(context),
      resend: sanitizeResendConfig(config),
      domain,
      to: maskEmail(email),
      messageIdReturned: Boolean(result.id),
    });
  } catch (error) {
    logResendEmailFailure(error, config, email, context);
    throw new EmailDeliveryError("Email delivery failed. Please try again.");
  }
}

export async function checkResendStatus({ sendTest = false }: { sendTest?: boolean } = {}): Promise<ResendStatus> {
  const config = getResendConfig();
  if (!config) {
    return {
      status: "not_configured",
      configured: false,
      sent: false,
      config: null,
    };
  }

  if (!sendTest) {
    const domain = await checkResendDomainStatus(config);

    return {
      status: getConfiguredResendStatus(domain),
      configured: true,
      sent: false,
      config: sanitizeResendConfig(config),
      domain,
    };
  }

  try {
    const domain = await checkResendDomainStatus(config);
    if (domain.checked && !domain.verified) {
      return {
        status: "domain_unverified",
        configured: true,
        sent: false,
        config: sanitizeResendConfig(config),
        domain,
      };
    }

    console.warn("[Email] Resend status test send starting", {
      resend: sanitizeResendConfig(config),
      domain,
      to: maskEmail(getResendStatusRecipient()),
    });

    const result = await sendResendEmail(config, {
      to: getResendStatusRecipient(),
      subject: "UseClevr Resend status test",
      text: "UseClevr Resend status test email.",
      html: "<p>UseClevr Resend status test email.</p>",
    });

    console.warn("[Email] Resend status test sent", {
      resend: sanitizeResendConfig(config),
      domain,
      to: maskEmail(getResendStatusRecipient()),
      messageId: result.id,
    });

    return {
      status: "sent",
      configured: true,
      sent: true,
      config: sanitizeResendConfig(config),
      domain,
      messageId: result.id,
    };
  } catch (error) {
    logResendEmailFailure(error, config, getResendStatusRecipient());
    return {
      status: "delivery_failed",
      configured: true,
      sent: false,
      config: sanitizeResendConfig(config),
      error: getResendErrorDetails(error),
    };
  }
}

function getConfiguredResendStatus(domain: ResendDomainStatus): ResendStatus["status"] {
  if (!domain.checked) return "api_error";
  if (!domain.verified) return "domain_unverified";
  return "configured";
}

async function checkResendDomainStatus(config: ResendConfig): Promise<ResendDomainStatus> {
  const senderDomain = getSenderDomain(config.from);
  if (!senderDomain) {
    return {
      checked: true,
      name: "",
      verified: false,
      status: "missing_sender_domain",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ResendApiError(response.status, body);
    }

    const domains = extractResendDomains(body);
    const domain = domains.find((entry) => entry.name.toLowerCase() === senderDomain);
    const status = domain?.status || "not_found";

    return {
      checked: true,
      name: senderDomain,
      verified: status === "verified",
      status,
    };
  } catch (error) {
    console.error("[Email] Resend domain verification check failed", {
      error: getResendErrorDetails(error),
      resend: sanitizeResendConfig(config),
    });

    return {
      checked: false,
      name: senderDomain,
      verified: false,
      error: getResendErrorDetails(error),
    };
  }
}

function extractResendDomains(body: unknown): Array<{ name: string; status: string }> {
  if (!body || typeof body !== "object") return [];

  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  return data
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const domain = entry as { name?: unknown; status?: unknown };
      const name = typeof domain.name === "string" ? domain.name : "";
      const status = typeof domain.status === "string" ? domain.status : "";
      if (!name) return null;
      return { name, status };
    })
    .filter((entry): entry is { name: string; status: string } => Boolean(entry));
}

async function sendResendEmail(
  config: ResendConfig,
  payload: ResendEmailPayload,
  context: VerificationEmailContext = {},
): Promise<{ id?: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });

  const body = await response.json().catch(() => ({}));
  const messageId = typeof body?.id === "string" ? body.id : "";

  console.warn("[Email] Resend verification email provider response", {
    ...sanitizeVerificationEmailContext(context),
    status: response.status,
    ok: response.ok,
    messageIdReturned: Boolean(messageId),
    responseShape: getSafeResponseShape(body),
  });

  if (!response.ok) {
    throw new ResendApiError(response.status, body);
  }

  if (!messageId) {
    throw new ResendApiError(response.status, {
      message: "Resend accepted the request without returning a message id",
      responseShape: getSafeResponseShape(body),
    });
  }

  return { id: messageId };
}

class ResendApiError extends Error {
  status: number;
  response: unknown;

  constructor(status: number, response: unknown) {
    super(getResendApiErrorMessage(response) || `Resend API request failed with ${status}`);
    this.name = "ResendApiError";
    this.status = status;
    this.response = response;
  }
}

function getResendApiErrorMessage(response: unknown) {
  if (!response || typeof response !== "object") return null;
  const body = response as { message?: unknown; error?: unknown; name?: unknown };
  return stringifyLogValue(body.message) || stringifyLogValue(body.error) || stringifyLogValue(body.name);
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  const from = (process.env.EMAIL_FROM || "UseClevr <auth@useclevr.com>").trim();
  return { apiKey, from };
}

function sanitizeResendConfig(config: ResendConfig): SanitizedResendConfig {
  return {
    RESEND_API_KEY_SET: Boolean(config.apiKey),
    EMAIL_FROM_SET: Boolean(config.from),
    EMAIL_FROM_DOMAIN: getSenderDomain(config.from),
  };
}

function logResendEmailFailure(
  error: unknown,
  config: ResendConfig,
  email: string,
  context: VerificationEmailContext = {},
) {
  console.error("[Email] Resend verification email delivery failed", {
    ...sanitizeVerificationEmailContext(context),
    error: getResendErrorDetails(error),
    resend: sanitizeResendConfig(config),
    to: maskEmail(email),
  });
}

function getResendErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      message: String(error),
      status: undefined,
      response: undefined,
      stack: undefined,
    };
  }

  const resendError = error as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    response?: unknown;
    stack?: unknown;
  };

  return {
    name: stringifyLogValue(resendError.name),
    message: stringifyLogValue(resendError.message),
    status: stringifyLogValue(resendError.status),
    response: redactSensitiveLogText(safeStringify(resendError.response)),
  };
}

function stringifyLogValue(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function safeStringify(value: unknown) {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getSafeResponseShape(value: unknown) {
  if (!value || typeof value !== "object") return typeof value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      Array.isArray(entry) ? "array" : typeof entry,
    ]),
  );
}

function sanitizeVerificationEmailContext(context: VerificationEmailContext) {
  return {
    traceId: context.traceId,
    source: context.source,
    requestHost: context.requestHost,
  };
}

function redactSensitiveLogText(value?: string) {
  if (!value) return undefined;
  return value
    .replace(/\b\d{6}\b/g, "[CODE]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL]");
}

function getResendStatusRecipient() {
  return (
    process.env.RESEND_STATUS_TO ||
    process.env.ADMIN_AUTH_BYPASS_EMAIL ||
    "superadmin@useclevr.com"
  ).trim();
}

function getSenderDomain(from: string) {
  const match = from.match(/<[^@<>]+@([^<>]+)>/) || from.match(/^[^@<>]+@([^<>]+)$/);
  return match?.[1]?.trim().toLowerCase() || "";
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[invalid-email]";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

function buildTextEmail(code: string) {
  return [
    "UseClevr email verification",
    "",
    `Your 6-digit code is ${code}.`,
    "This code expires in 10 minutes and can be used once.",
  ].join("\n");
}

function buildHtmlEmail(code: string) {
  return `
    <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h1 style="font-size: 20px; margin: 0 0 12px;">UseClevr email verification</h1>
      <p style="margin: 0 0 16px;">Enter this 6-digit code to continue:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 0 0 16px;">${code}</p>
      <p style="margin: 0; color: #475569;">This code expires in 10 minutes and can be used once.</p>
    </div>
  `;
}
