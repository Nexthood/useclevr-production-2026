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

function getVerificationEmailProvider(): VerificationEmailProvider | null {
  const smtp = getSmtpConfig();
  if (!smtp) return null;

  return {
    async send(email, code) {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.password,
        },
      });

      try {
        await transporter.sendMail({
          from: smtp.from,
          to: email,
          subject: "Your UseClevr verification code",
          text: buildTextEmail(code),
          html: buildHtmlEmail(code),
        });
      } catch (error) {
        logSmtpEmailFailure(error, smtp);
        throw new EmailDeliveryError("Email delivery failed. Please try again.");
      }
    },
  };
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || "UseClevr <start@useclevr.com>";
  const port = Number(process.env.SMTP_PORT || "465");
  const secure = resolveSmtpSecure(port);

  if (!host && !user && !password) return null;

  if (!host || !user || !password || !Number.isInteger(port) || port <= 0) {
    throw new EmailDeliveryError(
      "SMTP email delivery requires SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD",
    );
  }

  return { host, port, secure, user, password, from };
}

function logSmtpEmailFailure(error: unknown, smtp: NonNullable<ReturnType<typeof getSmtpConfig>>) {
  const details = getSmtpErrorDetails(error);

  console.error("[Email] SMTP verification email delivery failed", {
    error: details,
    smtp: {
      SMTP_HOST: smtp.host,
      SMTP_PORT: smtp.port,
      SMTP_SECURE: smtp.secure,
      SMTP_USER: smtp.user,
      EMAIL_FROM: smtp.from,
    },
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
    message?: unknown;
    code?: unknown;
    command?: unknown;
    response?: unknown;
    responseCode?: unknown;
  };

  return {
    message: stringifyLogValue(smtpError.message),
    code: stringifyLogValue(smtpError.code),
    command: stringifyLogValue(smtpError.command),
    response: stringifyLogValue(smtpError.response),
    responseCode: stringifyLogValue(smtpError.responseCode),
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
