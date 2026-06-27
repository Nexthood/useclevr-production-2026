import { debugLog } from "@/lib/utils/debug";
import nodemailer from "nodemailer";

export class EmailDeliveryError extends Error {
  constructor(message = "Email delivery failed") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export async function sendVerificationEmail(email: string, code: string) {
  const provider = getVerificationEmailProvider();

  if (provider) {
    await provider.send(email, code);
    return;
  }

  if (process.env.NODE_ENV !== "production" || process.env.EMAIL_PROVIDER === "console") {
    debugLog(`[Email] UseClevr verification code for ${email}: ${code}`);
    return;
  }

  throw new EmailDeliveryError("Email delivery is not configured");
}

type VerificationEmailProvider = {
  send: (email: string, code: string) => Promise<void>;
};

export type SmtpStatus = {
  status: "connected" | "authentication_failed" | "tls_failed" | "connection_timeout" | "sender_rejected" | "send_failed" | "not_configured";
  connected: boolean;
  authenticated: boolean;
  startTls: boolean;
  senderAccepted: boolean | null;
  config: SanitizedSmtpConfig | null;
  error?: ReturnType<typeof getSmtpErrorDetails>;
};

type SmtpConfig = NonNullable<ReturnType<typeof getSmtpConfig>>;
type SanitizedSmtpConfig = {
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  EMAIL_FROM: string;
  STARTTLS_REQUIRED: boolean;
  SMTP_PASSWORD_SET: boolean;
};

function getVerificationEmailProvider(): VerificationEmailProvider | null {
  const smtp = getSmtpConfig();
  if (!smtp) return null;

  return {
    async send(email, code) {
      const transporter = createSmtpTransport(smtp);

      try {
        console.warn("[Email] SMTP verification email preflight starting", {
          smtp: sanitizeSmtpConfig(smtp),
        });
        await verifySmtpConnection(transporter, smtp);
        console.warn("[Email] SMTP verification email preflight passed", {
          smtp: sanitizeSmtpConfig(smtp),
        });

        await transporter.sendMail({
          from: smtp.from,
          to: email,
          subject: "Your UseClevr verification code",
          text: buildTextEmail(code),
          html: buildHtmlEmail(code),
        });
        console.warn("[Email] SMTP verification email sent", {
          smtp: sanitizeSmtpConfig(smtp),
          to: maskEmail(email),
        });
      } catch (error) {
        logSmtpEmailFailure(error, smtp);
        throw new EmailDeliveryError("Email delivery failed. Please try again.");
      } finally {
        transporter.close();
      }
    },
  };
}

export async function checkSmtpStatus({ sendTest = false }: { sendTest?: boolean } = {}): Promise<SmtpStatus> {
  const smtp = getSmtpConfig();
  if (!smtp) {
    return {
      status: "not_configured",
      connected: false,
      authenticated: false,
      startTls: false,
      senderAccepted: null,
      config: null,
    };
  }

  const transporter = createSmtpTransport(smtp);
  let verified = false;

  try {
    console.warn("[Email] SMTP status check starting", {
      smtp: sanitizeSmtpConfig(smtp),
      sendTest,
    });
    await verifySmtpConnection(transporter, smtp);
    verified = true;

    if (sendTest) {
      await transporter.sendMail({
        from: smtp.from,
        to: getSmtpStatusRecipient(),
        subject: "UseClevr SMTP status test",
        text: "UseClevr SMTP status test email.",
        html: "<p>UseClevr SMTP status test email.</p>",
      });
    }

    console.warn("[Email] SMTP status check passed", {
      smtp: sanitizeSmtpConfig(smtp),
      sendTest,
    });

    return {
      status: "connected",
      connected: true,
      authenticated: true,
      startTls: smtp.requireTLS,
      senderAccepted: sendTest ? true : null,
      config: sanitizeSmtpConfig(smtp),
    };
  } catch (error) {
    const status = classifySmtpFailure(error);
    logSmtpEmailFailure(error, smtp);
    return {
      status,
      connected: verified,
      authenticated: verified,
      startTls: smtp.requireTLS,
      senderAccepted: status === "sender_rejected" ? false : null,
      config: sanitizeSmtpConfig(smtp),
      error: getSmtpErrorDetails(error),
    };
  } finally {
    transporter.close();
  }
}

function createSmtpTransport(smtp: SmtpConfig) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: smtp.requireTLS,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
    tls: {
      minVersion: "TLSv1.2",
      servername: smtp.host,
      rejectUnauthorized: true,
    },
  });
}

async function verifySmtpConnection(
  transporter: ReturnType<typeof nodemailer.createTransport>,
  smtp: SmtpConfig,
) {
  try {
    await transporter.verify();
  } catch (error) {
    console.error("[Email] SMTP connection/authentication preflight failed", {
      error: getSmtpErrorDetails(error),
      smtp: sanitizeSmtpConfig(smtp),
    });
    throw error;
  }
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || "UseClevr <auth@useclevr.com>";
  const port = Number(process.env.SMTP_PORT || "587");
  const secure = resolveSmtpSecure(port);
  const requireTLS = !secure && port === 587;

  if (!host && !user && !password) return null;

  if (!host || !user || !password || !Number.isInteger(port) || port <= 0) {
    throw new EmailDeliveryError(
      "SMTP email delivery requires SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD",
    );
  }

  return { host, port, secure, requireTLS, user, password, from };
}

function logSmtpEmailFailure(error: unknown, smtp: SmtpConfig) {
  const details = getSmtpErrorDetails(error);

  console.error("[Email] SMTP verification email delivery failed", {
    error: details,
    smtp: sanitizeSmtpConfig(smtp),
  });
}

function getSmtpErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      message: String(error),
      code: undefined,
      command: undefined,
      response: undefined,
      responseCode: undefined,
    };
  }

  const smtpError = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    command?: unknown;
    response?: unknown;
    responseCode?: unknown;
    stack?: unknown;
  };

  return {
    name: stringifyLogValue(smtpError.name),
    message: stringifyLogValue(smtpError.message),
    code: stringifyLogValue(smtpError.code),
    command: stringifyLogValue(smtpError.command),
    response: stringifyLogValue(smtpError.response),
    responseCode: stringifyLogValue(smtpError.responseCode),
    stack: stringifyLogValue(smtpError.stack),
  };
}

function stringifyLogValue(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function resolveSmtpSecure(port: number) {
  const configured = process.env.SMTP_SECURE;
  if (configured) return configured === "true";
  return port === 465;
}

function sanitizeSmtpConfig(smtp: SmtpConfig): SanitizedSmtpConfig {
  return {
    SMTP_HOST: smtp.host,
    SMTP_PORT: smtp.port,
    SMTP_SECURE: smtp.secure,
    SMTP_USER: smtp.user,
    EMAIL_FROM: smtp.from,
    STARTTLS_REQUIRED: smtp.requireTLS,
    SMTP_PASSWORD_SET: Boolean(smtp.password),
  };
}

function classifySmtpFailure(error: unknown): SmtpStatus["status"] {
  const details = getSmtpErrorDetails(error);
  const combined = [
    details.code,
    details.command,
    details.response,
    details.message,
  ].join(" ").toLowerCase();

  if (combined.includes("auth") || combined.includes("535") || combined.includes("534")) {
    return "authentication_failed";
  }

  if (combined.includes("tls") || combined.includes("starttls") || combined.includes("certificate")) {
    return "tls_failed";
  }

  if (combined.includes("timeout") || combined.includes("etimedout")) {
    return "connection_timeout";
  }

  if (
    combined.includes("sender") ||
    combined.includes("mail from") ||
    combined.includes("envelope") ||
    combined.includes("553") ||
    combined.includes("550")
  ) {
    return "sender_rejected";
  }

  return "send_failed";
}

function getSmtpStatusRecipient() {
  return (
    process.env.SMTP_STATUS_TO ||
    process.env.ADMIN_AUTH_BYPASS_EMAIL ||
    "superadmin@useclevr.com"
  ).trim();
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
