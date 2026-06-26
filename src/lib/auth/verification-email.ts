import { debugLog } from "@/lib/utils/debug";

export class EmailDeliveryError extends Error {
  constructor(message = "Email delivery failed") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export async function sendVerificationEmail(email: string, code: string) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpUrl = process.env.SMTP_URL;

  if (resendApiKey) {
    if (!from) throw new EmailDeliveryError("EMAIL_FROM is required for Resend delivery");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Your UseClevr verification code",
        text: buildTextEmail(code),
        html: buildHtmlEmail(code),
      }),
    });

    if (!response.ok) {
      throw new EmailDeliveryError("Resend rejected the verification email");
    }

    return;
  }

  if (smtpUrl) {
    throw new EmailDeliveryError(
      "SMTP_URL is configured, but no SMTP sender implementation is installed",
    );
  }

  if (process.env.NODE_ENV !== "production" || process.env.EMAIL_PROVIDER === "console") {
    debugLog(`[Email] UseClevr verification code for ${email}: ${code}`);
    return;
  }

  throw new EmailDeliveryError("Email delivery is not configured");
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
