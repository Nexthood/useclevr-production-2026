import assert from "node:assert/strict";

import { sendVerificationEmail } from "../../src/lib/auth/verification-email";

type FetchCall = {
  url: string;
  method: string;
};

const originalFetch = globalThis.fetch;
const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
};

async function main() {
  await rejectsProductionConsoleDelivery();
  await acceptsResendEmailSend();
  await acceptsMissingResendMessageId();
  console.log("Verification email delivery checks passed.");
}

async function rejectsProductionConsoleDelivery() {
  setEnv({
    NODE_ENV: "production",
    RESEND_API_KEY: "",
    EMAIL_FROM: "UseClevr <auth@useclevr.com>",
    EMAIL_PROVIDER: "console",
  });

  await assert.rejects(
    () => sendVerificationEmail("user@example.com", "123456"),
    /Email delivery failed/,
  );
}

async function acceptsResendEmailSend() {
  setEnv({
    NODE_ENV: "production",
    RESEND_API_KEY: "test_resend_key",
    EMAIL_FROM: "UseClevr <auth@useclevr.com>",
    EMAIL_PROVIDER: "",
  });

  const calls: FetchCall[] = [];
  globalThis.fetch = mockResendFetch(calls, { emailBody: { id: "email_test_id" } });

  await sendVerificationEmail("user@example.com", "123456");
  assert.deepEqual(calls.map((call) => call.url), [
    "https://api.resend.com/emails",
  ]);
}

async function acceptsMissingResendMessageId() {
  setEnv({
    NODE_ENV: "production",
    RESEND_API_KEY: "test_resend_key",
    EMAIL_FROM: "UseClevr <auth@useclevr.com>",
    EMAIL_PROVIDER: "",
  });

  const calls: FetchCall[] = [];
  globalThis.fetch = mockResendFetch(calls, { emailBody: { name: "email" } });

  await sendVerificationEmail("user@example.com", "123456");
  assert.deepEqual(calls.map((call) => call.url), [
    "https://api.resend.com/emails",
  ]);
}

function mockResendFetch(calls: FetchCall[], options: { emailBody: Record<string, unknown> }) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method || "GET" });

    if (url === "https://api.resend.com/emails") {
      return jsonResponse(200, options.emailBody);
    }

    return jsonResponse(404, { message: "not found" });
  }) as typeof fetch;
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setEnv(next: Record<keyof typeof originalEnv, string>) {
  for (const [key, value] of Object.entries(next)) {
    if (value) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  globalThis.fetch = originalFetch;
}

main()
  .catch((error) => {
    console.error("Verification email delivery checks failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(restoreEnv);
