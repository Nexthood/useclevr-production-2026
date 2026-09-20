import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildConfirmedUsyContactPayload,
  createUsyContactSubmissionGuard,
  fingerprintUsyContactSubmission,
  getUsyContactWebhookConfig,
  sendUsyContactWebhook,
  validateUsyContactPayload,
  type UsyWebhookPayload,
} from "@/lib/usy/contact";

const repoRoot = resolve(import.meta.dirname, "../..");

const confirmedPayload: UsyWebhookPayload = {
  category: "billing",
  message: "Please correct the VAT number on invoice 4471.",
  senderName: "Alex Rivera",
  replyEmail: "alex@example.com",
  language: "english",
  timestamp: "2026-09-20T12:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Configured n8n → successful submission (single webhook call)
// ---------------------------------------------------------------------------

function testConfiguredWebhookSucceeds() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(null, { status: 202 });
  }) as unknown as typeof fetch;

  return (async () => {
    const result = await sendUsyContactWebhook(confirmedPayload, {
      webhookUrl: "https://n8n.example.com/webhook/usy-contact",
      webhookSecret: "secret-value-123",
    }, fetchImpl);
    assert.deepEqual(result, { ok: true }, "a configured n8n that accepts the handoff reports success");
    assert.equal(calls.length, 1, "the confirmed request posts exactly one webhook call");
    assert.equal(calls[0].url, "https://n8n.example.com/webhook/usy-contact");
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["Content-Type"], "application/json");
    assert.equal(headers.Authorization, "Bearer secret-value-123");
    assert.equal(headers["X-UseClevr-Event"], "usy.contact_request");
    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(body.category, "billing", "department survives into the webhook payload");
    assert.equal(body.message, confirmedPayload.message);
    assert.equal(body.senderName, confirmedPayload.senderName);
    assert.equal(body.replyEmail, confirmedPayload.replyEmail);
    assert.equal(body.language, confirmedPayload.language);
    assert.equal(body.timestamp, confirmedPayload.timestamp);
  })();
}

// ---------------------------------------------------------------------------
// Invalid / failed webhook → safe retryable failure, never a false delivery
// ---------------------------------------------------------------------------

function testFailedWebhookIsRetryableFailure() {
  const rejectingFetch = (async () => {
    throw new TypeError("network down");
  }) as unknown as typeof fetch;
  const serverErrorFetch = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
  const unauthorizedFetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;

  return (async () => {
    const config = {
      webhookUrl: "https://n8n.example.com/webhook/usy-contact",
      webhookSecret: "secret-value-123",
    };
    const networkFailure = await sendUsyContactWebhook(confirmedPayload, config, rejectingFetch);
    assert.deepEqual(networkFailure, { ok: false, retryable: true }, "network failure is a safe retryable error");

    const serverFailure = await sendUsyContactWebhook(confirmedPayload, config, serverErrorFetch);
    assert.deepEqual(serverFailure, { ok: false, retryable: true }, "n8n server error is a safe retryable error");

    const unauthorized = await sendUsyContactWebhook(confirmedPayload, config, unauthorizedFetch);
    assert.deepEqual(unauthorized, { ok: false, retryable: true }, "an n8n rejection is a safe retryable error");
  })();
}

// ---------------------------------------------------------------------------
// Missing configuration → safe failure before any webhook call
// ---------------------------------------------------------------------------

function testMissingConfigurationFailsSafely() {
  const config = getUsyContactWebhookConfig({});
  assert.equal(config.missing, true, "missing env values mark the handoff as not configured");
  assert.equal(config.webhookUrl, undefined);
  assert.equal(config.webhookSecret, undefined);

  const urlOnly = getUsyContactWebhookConfig({ USY_CONTACT_N8N_WEBHOOK_URL: "https://n8n.example.com/webhook" });
  assert.equal(urlOnly.missing, true, "a URL without a secret still fails safely");
  const secretOnly = getUsyContactWebhookConfig({ USY_CONTACT_N8N_WEBHOOK_SECRET: "secret" });
  assert.equal(secretOnly.missing, true, "a secret without a URL fails safely");
}

// ---------------------------------------------------------------------------
// Duplicate confirmation → no duplicate handoff
// ---------------------------------------------------------------------------

function testDuplicateConfirmationDoesNotResubmit() {
  const guard = createUsyContactSubmissionGuard(undefined, () => 1_000_000);
  const fingerprint = fingerprintUsyContactSubmission("user:test-1", confirmedPayload);

  assert.equal(guard.begin(fingerprint), "accepted", "first confirmation starts the submission");
  guard.confirm(fingerprint);
  assert.equal(guard.begin(fingerprint), "delivered", "a duplicate confirmation sees the delivered fingerprint and must not call n8n again");

  const failedFingerprint = fingerprintUsyContactSubmission("user:test-2", confirmedPayload);
  assert.equal(guard.begin(failedFingerprint), "accepted");
  guard.release(failedFingerprint);
  assert.equal(guard.begin(failedFingerprint), "accepted", "a failed attempt frees the fingerprint for a retry");

  const pendingFingerprint = fingerprintUsyContactSubmission("user:test-3", confirmedPayload);
  assert.equal(guard.begin(pendingFingerprint), "accepted");
  assert.equal(guard.begin(pendingFingerprint), "pending", "a concurrent duplicate sees the submission as pending");
}

function testSubmissionGuardWindowExpires() {
  let currentTime = 1_000_000;
  const guard = createUsyContactSubmissionGuard(undefined, () => currentTime);
  const fingerprint = fingerprintUsyContactSubmission("user:window", confirmedPayload);

  assert.equal(guard.begin(fingerprint), "accepted");
  guard.confirm(fingerprint);
  currentTime += 10 * 60 * 1000 + 1;
  assert.equal(guard.begin(fingerprint), "accepted", "an expired delivered fingerprint can be submitted again after the window");
}

function testFingerprintSeparatesIdentitiesAndPayloads() {
  const base = fingerprintUsyContactSubmission("user:a", confirmedPayload);
  assert.equal(fingerprintUsyContactSubmission("user:a", confirmedPayload), base, "the same request and identity produce the same fingerprint");
  assert.notEqual(
    fingerprintUsyContactSubmission("user:b", confirmedPayload),
    base,
    "a different identity produces a different fingerprint",
  );
  assert.notEqual(
    fingerprintUsyContactSubmission("user:a", { ...confirmedPayload, message: "Different message" }),
    base,
    "a different message produces a different fingerprint",
  );
  assert.notEqual(
    fingerprintUsyContactSubmission("user:a", { ...confirmedPayload, category: "sales" }),
    base,
    "a different department produces a different fingerprint",
  );
}

// ---------------------------------------------------------------------------
// Department routing stays intact through the structured payload
// ---------------------------------------------------------------------------

function testDepartmentRoutingInPayload() {
  const cases = [
    { category: "sales" as const },
    { category: "technical_support" as const },
    { category: "billing" as const },
    { category: "management" as const },
    { category: "executive" as const },
  ];

  for (const item of cases) {
    const parsed = validateUsyContactPayload({
      category: item.category,
      message: "Please help with an ongoing request about my account.",
      senderName: "Alex Rivera",
      replyEmail: "alex@example.com",
      language: "english",
      confirmed: true,
    });
    assert.equal(parsed.success, true, `${item.category} is a valid department`);
    if (!parsed.success) continue;

    const payload = buildConfirmedUsyContactPayload(parsed.data, { timestamp: "2026-09-20T12:00:00.000Z" });
    assert.equal(payload.category, item.category, `${item.category} routing survives into the handoff`);
    assert.equal(payload.timestamp, "2026-09-20T12:00:00.000Z");
  }
}

// ---------------------------------------------------------------------------
// Guest and authenticated submissions keep the structured payload contract
// ---------------------------------------------------------------------------

function testGuestSubmissionPayload() {
  const parsed = validateUsyContactPayload({
    category: "technical_support",
    message: "My upload fails when importing a CSV file.",
    senderName: "Sam Guest",
    replyEmail: "sam@example.com",
    language: "english",
    confirmed: true,
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const payload = buildConfirmedUsyContactPayload(parsed.data, { timestamp: "2026-09-20T12:00:00.000Z" });
  assert.equal(payload.category, "technical_support", "guest Technical Support requests keep their department");
  assert.equal(payload.userId, undefined, "guest handoff carries no user id");
  assert.equal(payload.organizationId, undefined, "guest handoff carries no organization id");
  assert.equal(payload.company, undefined, "omitted company stays out of the payload");
}

function testAuthenticatedSubmissionPayload() {
  const parsed = validateUsyContactPayload({
    category: "billing",
    message: "Please correct the VAT number on invoice 4471.",
    senderName: "Alex Rivera",
    company: "Delta Labs",
    replyEmail: "alex@example.com",
    language: "german",
    confirmed: true,
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const payload = buildConfirmedUsyContactPayload(parsed.data, {
    timestamp: "2026-09-20T12:00:00.000Z",
    userId: "user_123",
    organizationId: "business_123",
  });
  assert.equal(payload.category, "billing", "authenticated Billing requests keep their department");
  assert.equal(payload.userId, "user_123", "authenticated handoff keeps the server-derived user id");
  assert.equal(payload.organizationId, "business_123", "authenticated handoff keeps the server-derived organization id");
  assert.equal(payload.company, "Delta Labs", "a supplied company reaches the handoff");
}

// ---------------------------------------------------------------------------
// Secrets stay server-side only (source assertions)
// ---------------------------------------------------------------------------

function testNoWebhookSecretExposedClientSide() {
  const chatbox = readProjectFile("src/components/ui/help-chatbox.tsx");
  assert.doesNotMatch(chatbox, /USY_CONTACT|webhookSecret|webhookUrl|n8n/i, "the chat UI never touches webhook config");
  const contactRoute = readProjectFile("src/app/api/usy/contact/route.ts");
  assert.ok(
    contactRoute.includes('Authorization: `Bearer ${config.webhookSecret}`') || contactRoute.includes("sendUsyContactWebhook"),
    "the bearer secret is only applied inside the server route path",
  );
  assert.doesNotMatch(contactRoute, /NEXT_PUBLIC.*USY|USY.*NEXT_PUBLIC/, "no contact env var is exposed as NEXT_PUBLIC");
  const webhookSender = readProjectFile("src/lib/usy/contact.ts");
  assert.ok(
    webhookSender.includes('"X-UseClevr-Event": "usy.contact_request"'),
    "the central n8n webhook sender keeps the event contract",
  );
  const clientSubmit = readProjectFile("src/components/ui/help-chatbox.tsx");
  assert.ok(
    clientSubmit.includes("if (response.ok) {") && clientSubmit.includes("setContactDraft(null)"),
    "the client clears the confirmed draft only on success so failures stay retryable",
  );
  const routeGuard = readProjectFile("src/app/api/usy/contact/route.ts");
  assert.ok(routeGuard.includes("submissionGuard.begin(fingerprint)"), "duplicate confirmations are checked before the webhook call");
  assert.ok(routeGuard.includes("submissionGuard.release(fingerprint)"), "failed handoffs release the fingerprint for retry");
  assert.ok(routeGuard.includes("submissionGuard.confirm(fingerprint)"), "successful handoffs mark the fingerprint delivered");
  assert.ok(routeGuard.includes("createUsyContactSubmissionGuard()"), "the route owns one process-level submission guard");
}

testMissingConfigurationFailsSafely();
testConfiguredWebhookSucceeds();
testFailedWebhookIsRetryableFailure();
testDuplicateConfirmationDoesNotResubmit();
testSubmissionGuardWindowExpires();
testFingerprintSeparatesIdentitiesAndPayloads();
testDepartmentRoutingInPayload();
testGuestSubmissionPayload();
testAuthenticatedSubmissionPayload();
testNoWebhookSecretExposedClientSide();

console.warn("Usy contact handoff tests passed");

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}
