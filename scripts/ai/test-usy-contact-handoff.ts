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
import {
  classifyUsyContactWebhookException,
  classifyUsyContactWebhookHttpStatus,
  inspectUsyContactWebhookUrl,
  sanitizeUsyContactDiagnosticMessage,
} from "@/lib/usy/contact-diagnostics";

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
    assert.equal(result.ok, true, "a configured n8n that accepts the handoff reports success");
    assert.equal(result.diagnostic.event, "usy_contact_handoff_delivered", "success emits the delivered diagnostic event");
    assert.equal(result.diagnostic.httpStatus, 202);
    assert.equal(result.diagnostic.failureCode, null);
    assert.equal(result.diagnostic.webhookHost, "n8n.example.com");
    assert.equal(result.diagnostic.webhookPath, "/webhook/usy-contact");
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
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  const serverErrorFetch = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
  const unauthorizedFetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;

  return (async () => {
    const config = {
      webhookUrl: "https://n8n.example.com/webhook/usy-contact",
      webhookSecret: "secret-value-123",
    };
    const networkFailure = await sendUsyContactWebhook(confirmedPayload, config, rejectingFetch);
    assert.equal(networkFailure.ok, false, "network failure is a safe retryable error");
    assert.equal(networkFailure.retryable, true);
    assert.equal(networkFailure.diagnostic.failureCode, "unexpected_error");
    assert.equal(networkFailure.diagnostic.httpStatus, null, "a thrown fetch never reports an HTTP status");

    const serverFailure = await sendUsyContactWebhook(confirmedPayload, config, serverErrorFetch);
    assert.equal(serverFailure.ok, false, "n8n server error is a safe retryable error");
    assert.equal(serverFailure.diagnostic.failureCode, "n8n_http_5xx");
    assert.equal(serverFailure.diagnostic.httpStatus, 500);

    const unauthorized = await sendUsyContactWebhook(confirmedPayload, config, unauthorizedFetch);
    assert.equal(unauthorized.ok, false, "an n8n rejection is a safe retryable error");
    assert.equal(unauthorized.diagnostic.failureCode, "n8n_http_401");
    assert.equal(unauthorized.diagnostic.httpStatus, 401);
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
// Published n8n response (HTTP 200 {"ok":true}) → successful handoff
// ---------------------------------------------------------------------------

function testPublishedN8nResponseIsSuccess() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;

  return (async () => {
    const publishedUrl = "https://useclevr.app.n8n.cloud/webhook/usy-contact";
    const result = await sendUsyContactWebhook(confirmedPayload, {
      webhookUrl: publishedUrl,
      webhookSecret: "secret-value-123",
    }, fetchImpl);
    assert.equal(result.ok, true, 'a published n8n response of HTTP 200 {"ok":true} is a successful handoff');
    assert.equal(result.diagnostic.event, "usy_contact_handoff_delivered");
    assert.equal(result.diagnostic.httpStatus, 200, "the published HTTP 200 status is reported");
    assert.equal(result.diagnostic.responseContentType, "application/json");
    assert.equal(result.diagnostic.webhookHost, "useclevr.app.n8n.cloud");
    assert.equal(result.diagnostic.webhookPath, "/webhook/usy-contact");
    assert.equal(result.diagnostic.urlProtocolOk, true);
    assert.equal(result.diagnostic.urlHostOk, true);
    assert.equal(result.diagnostic.urlPathOk, true);
    assert.equal(result.diagnostic.webhookTestPath, false);
    assert.equal(result.diagnostic.errorMessage, null);
    assert.equal(calls.length, 1, "the published webhook receives exactly one call");
    assert.equal(calls[0].url, publishedUrl, "the handoff posts to the published /webhook/ endpoint");
  })();
}

// ---------------------------------------------------------------------------
// Deployed configuration must target the published n8n webhook, never the
// manual-test endpoint
// ---------------------------------------------------------------------------

function testDeployedConfigurationNeverUsesWebhookTestUrl() {
  // Runtime code and environment examples carry the deployed configuration:
  // none of them may reference the n8n manual-test webhook path in any form.
  const strictFiles = [
    "src/lib/usy/contact.ts",
    "src/app/api/usy/contact/route.ts",
    ".env.railway.example",
    ".env.local.example",
  ];
  for (const file of strictFiles) {
    const content = readProjectFile(file);
    assert.doesNotMatch(content, /webhook[-_]test/i, `${file} must not reference the n8n manual-test webhook path`);
  }

  // The diagnostics detector legitimately names the manual-test path only to
  // report it at runtime; a hardcoded manual-test URL is still banned
  // everywhere in deployed configuration.
  const urlShapedFiles = [
    "src/lib/usy/contact.ts",
    "src/lib/usy/contact-diagnostics.ts",
    "src/app/api/usy/contact/route.ts",
    ".env.railway.example",
    ".env.local.example",
  ];
  for (const file of urlShapedFiles) {
    const content = readProjectFile(file);
    assert.doesNotMatch(content, /https?:\/\/[^\s"'`]*webhook[-_]test/i, `${file} must not hardcode an n8n manual-test webhook URL`);
  }
  const diagnosticsLib = readProjectFile("src/lib/usy/contact-diagnostics.ts");
  assert.match(diagnosticsLib, /webhook[-_]test/i, "runtime reports a manual-test path when one is configured");

  // The runtime config reads only USY_CONTACT_N8N_WEBHOOK_URL and passes the
  // value through unchanged: no fallback URL, no rewriting toward a test path.
  const publishedUrl = "https://useclevr.app.n8n.cloud/webhook/usy-contact";
  const config = getUsyContactWebhookConfig({
    USY_CONTACT_N8N_WEBHOOK_URL: publishedUrl,
    USY_CONTACT_N8N_WEBHOOK_SECRET: "secret-value-123",
  });
  assert.equal(config.missing, false, "a full production configuration is complete");
  assert.equal(config.webhookUrl, publishedUrl, "the configured URL is used exactly as provided");
  assert.equal(config.webhookSecret, "secret-value-123", "the configured secret is used exactly as provided");

  // The handoff guide must keep instructing the published production path.
  const guide = readProjectFile("docs/AI-interaction/developer-guides/usy-contact-handoff.md");
  assert.match(guide, /\/webhook\/usy-contact/, "the handoff guide names the published production webhook path");
  assert.match(guide, /must never use it|never use it/, "the handoff guide forbids the manual-test path for deployed environments");
}

// ---------------------------------------------------------------------------
// 502 diagnostics: every failure class is distinguishable without exposing
// secrets or customer data
// ---------------------------------------------------------------------------

function failingFetch(error: unknown) {
  return (async () => {
    throw error;
  }) as unknown as typeof fetch;
}

function statusFetch(status: number, contentType?: string) {
  return (async () => new Response(null, {
    status,
    headers: contentType ? { "Content-Type": contentType } : undefined,
  })) as unknown as typeof fetch;
}

function testHandoffFailureClassificationMatrix() {
  const config = {
    webhookUrl: "https://useclevr.app.n8n.cloud/webhook/usy-contact",
    webhookSecret: "secret-value-123",
  };

  const dnsError = Object.assign(new TypeError("fetch failed"), {
    cause: Object.assign(new Error("getaddrinfo ENOTFOUND useclevr.app.n8n.cloud"), { code: "ENOTFOUND" }),
  });
  const connectionError = Object.assign(new TypeError("fetch failed"), {
    cause: Object.assign(new Error("connect ECONNREFUSED 18.194.90.31:443"), { code: "ECONNREFUSED" }),
  });
  const tlsError = Object.assign(new TypeError("fetch failed"), {
    cause: Object.assign(new Error("unable to verify the first certificate"), { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" }),
  });
  const abortError = Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
  const connectTimeoutError = Object.assign(new TypeError("fetch failed"), {
    cause: Object.assign(new Error("Connect Timeout Error"), { code: "UND_ERR_CONNECT_TIMEOUT" }),
  });

  const expectedExceptionClasses: Array<[unknown, string]> = [
    [dnsError, "dns_failure"],
    [connectionError, "connection_failure"],
    [tlsError, "tls_failure"],
    [abortError, "timeout"],
    [connectTimeoutError, "timeout"],
    [Object.assign(new TypeError("Failed to parse URL from not-a-url"), { cause: new TypeError("Invalid URL") }), "invalid_webhook_url"],
    ["a thrown string", "unexpected_error"],
  ];

  const expectedStatusClasses: Array<[number, string]> = [
    [400, "n8n_http_400"],
    [401, "n8n_http_401"],
    [404, "n8n_http_404"],
    [403, "n8n_http_other"],
    [429, "n8n_http_other"],
    [302, "invalid_n8n_response"],
    [500, "n8n_http_5xx"],
    [502, "n8n_http_5xx"],
    [503, "n8n_http_5xx"],
  ];

  return (async () => {
    for (const [error, failureCode] of expectedExceptionClasses) {
      assert.equal(classifyUsyContactWebhookException(error), failureCode, `${failureCode} classifies its exception shape`);
    }

    for (const [status, failureCode] of expectedStatusClasses) {
      assert.equal(classifyUsyContactWebhookHttpStatus(status), failureCode, `HTTP ${status} classifies as ${failureCode}`);
    }

    for (const [error, failureCode] of expectedExceptionClasses) {
      const result = await sendUsyContactWebhook(confirmedPayload, config, failingFetch(error));
      assert.equal(result.ok, false);
      assert.equal(result.retryable, true);
      assert.equal(result.diagnostic.failureCode, failureCode, `thrown ${failureCode} reaches the full sender path`);
      assert.equal(result.diagnostic.event, "usy_contact_handoff_failed");
      assert.equal(result.diagnostic.stage, "webhook_request");
      assert.equal(result.diagnostic.webhookConfigured, true);
      assert.equal(result.diagnostic.httpStatus, null);
      assert.equal(typeof result.diagnostic.durationMs, "number");
      assert.ok(result.diagnostic.durationMs >= 0);
    }

    for (const [status, failureCode] of expectedStatusClasses) {
      const result = await sendUsyContactWebhook(confirmedPayload, config, statusFetch(status, "text/html"));
      assert.equal(result.ok, false);
      assert.equal(result.diagnostic.failureCode, failureCode, `HTTP ${status} classifies through the sender path`);
      assert.equal(result.diagnostic.httpStatus, status, "any received HTTP response reports its status");
      assert.equal(result.diagnostic.responseContentType, "text/html");
      assert.equal(result.diagnostic.event, "usy_contact_handoff_failed");
    }

    // Invalid and non-https URLs are classified before any request is sent.
    for (const badUrl of ["not-a-url", "http://useclevr.app.n8n.cloud/webhook/usy-contact", "ftp://useclevr.app.n8n.cloud/webhook"]) {
      const calls: unknown[] = [];
      const countingFetch = (async (url: string | URL | Request) => {
        calls.push(String(url));
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch;
      const result = await sendUsyContactWebhook(confirmedPayload, { ...config, webhookUrl: badUrl }, countingFetch);
      assert.equal(result.ok, false);
      assert.equal(result.diagnostic.failureCode, "invalid_webhook_url");
      assert.equal(result.diagnostic.stage, "url_validation");
      assert.equal(calls.length, 0, "an invalid webhook URL never produces an outbound request");
    }
  })();
}

function testWebhookTestPathIsReportedNotUsed() {
  const calls: Array<{ url: string }> = [];
  const fetchImpl = (async (url: string | URL | Request) => {
    calls.push({ url: String(url) });
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;

  return (async () => {
    const testPathUrl = "https://useclevr.app.n8n.cloud/webhook-test/usy-contact";
    const result = await sendUsyContactWebhook(confirmedPayload, {
      webhookUrl: testPathUrl,
      webhookSecret: "secret-value-123",
    }, fetchImpl);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostic.failureCode, "n8n_http_404", "a manual-test URL outside test mode answers HTTP 404");
    assert.equal(result.diagnostic.webhookTestPath, true, "the manual-test path is detected and reported");
    assert.equal(result.diagnostic.webhookHost, "useclevr.app.n8n.cloud");
    assert.equal(result.diagnostic.webhookPath, "/webhook-test/usy-contact");
    assert.equal(result.diagnostic.urlPathOk, false, "the configured path deviates from the published path");
    assert.equal(result.diagnostic.urlHostOk, true);

    const inspection = inspectUsyContactWebhookUrl("https://useclevr.app.n8n.cloud/webhook-test/other-flow");
    assert.equal(inspection.testPath, true, "any /webhook-test/ path is detected, not just usy-contact");

    const published = inspectUsyContactWebhookUrl("https://useclevr.app.n8n.cloud/webhook/usy-contact");
    assert.equal(published.testPath, false);
    assert.equal(published.pathOk, true);
  })();
}

function testHandoffDiagnosticsNeverLeakSecretsOrCustomerData() {
  const fixtureSecret = "u7-SUPER-SECRET-VALUE-42";
  const customerMessage = "Our invoice VAT number is wrong, please contact billing.";
  const customerEmail = "alex@example.com";
  const customerName = "Alex Rivera";
  const payloadWithCustomerData: UsyWebhookPayload = {
    ...confirmedPayload,
    message: customerMessage,
    senderName: customerName,
    replyEmail: customerEmail,
  };

  // The exception message embeds the authorization header, the secret, and
  // the full webhook URL including a query token — the worst case a real
  // fetch exception can produce (request bodies never appear in exceptions).
  const hostileError = Object.assign(new TypeError("fetch failed"), {
    cause: new Error(
      `POST https://useclevr.app.n8n.cloud/webhook/usy-contact?token=abc failed with Authorization: Bearer ${fixtureSecret} and X-UseClevr-Event: usy.contact_request`,
    ),
  });

  return (async () => {
    const failed = await sendUsyContactWebhook(payloadWithCustomerData, {
      webhookUrl: "https://useclevr.app.n8n.cloud/webhook/usy-contact",
      webhookSecret: fixtureSecret,
    }, failingFetch(hostileError));
    assert.equal(failed.ok, false);

    const delivered = await sendUsyContactWebhook(payloadWithCustomerData, {
      webhookUrl: "https://useclevr.app.n8n.cloud/webhook/usy-contact",
      webhookSecret: fixtureSecret,
    }, statusFetch(200, "application/json"));
    assert.equal(delivered.ok, true);

    for (const result of [failed, delivered]) {
      const serialized = JSON.stringify(result.diagnostic);
      assert.ok(serialized, "the diagnostic serializes to one searchable log line");
      assert.ok(!serialized.includes(fixtureSecret), "the webhook secret never appears in diagnostics");
      assert.doesNotMatch(serialized, /bearer\s/i, "no authorization header value appears in diagnostics");
      assert.doesNotMatch(serialized, /https?:\/\//, "no raw URL (with possible query tokens) appears in diagnostics");
      assert.ok(!serialized.includes(customerMessage), "the customer message never appears in diagnostics");
      assert.ok(!serialized.includes(customerEmail), "the customer email never appears in diagnostics");
      assert.ok(!serialized.includes(customerName), "the customer name never appears in diagnostics");
      assert.ok(!serialized.includes("usy.contact_request"), "the payload event header value stays out of diagnostics");
      assert.ok(!serialized.includes("userId") && !serialized.includes("organizationId"), "no identity fields appear in diagnostics");
    }

    // The sanitizer is directly pinned: URLs, bearer tokens, secrets, and
    // control characters are all neutralized.
    const sanitized = sanitizeUsyContactDiagnosticMessage(
      `GET https://host/path failed\nBearer ${fixtureSecret}\r\ncause: ${fixtureSecret}`,
      fixtureSecret,
    );
    assert.ok(sanitized);
    assert.ok(!sanitized.includes("https://"));
    assert.ok(!sanitized.includes(fixtureSecret));
    assert.ok(!sanitized.includes("\n") && !sanitized.includes("\r"));
    assert.match(sanitized, /\[redacted-url\]/);
    assert.match(sanitized, /\[redacted-authorization\]/);
    assert.match(sanitized, /\[redacted-secret\]/);
  })();
}

function testRouteLogsSafeHandoffEvents() {
  const route = readProjectFile("src/app/api/usy/contact/route.ts");
  assert.ok(
    route.includes("logUsyContactHandoffDiagnostic(result.diagnostic)"),
    "the 502/202 paths log the structured sender diagnostic",
  );
  assert.ok(
    route.includes("logUsyContactHandoffDiagnostic(buildUsyContactMissingConfigDiagnostic(config.webhookUrl))"),
    "the not-configured path logs the webhook_not_configured event",
  );
  assert.ok(
    route.includes('status: 502'),
    "the retryable 502 response is preserved",
  );
  assert.ok(route.includes('status: 503'), "the not-configured 503 response is preserved");
  assert.ok(route.includes("submissionGuard.release(fingerprint)"), "failed handoffs still release the fingerprint for retry");
  assert.ok(route.includes("submissionGuard.confirm(fingerprint)"), "successful handoffs still mark the fingerprint delivered");
  assert.ok(!route.includes("JSON.stringify"), "diagnostics reach logs only through the shared safe logger");
  const diagnosticsLib = readProjectFile("src/lib/usy/contact-diagnostics.ts");
  for (const forbidden of ["Authorization", "webhookSecret", "senderName", "replyEmail", "message", "userId", "organizationId"]) {
    assert.ok(
      !diagnosticsLib.includes(`input.${forbidden}`) && !diagnosticsLib.includes(`payload.${forbidden}`),
      `diagnostics never read ${forbidden} from the request context`,
    );
  }
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

function testWebhookPayloadCarriesExactTypedMessage() {
  // The request contains a natural marker word; the payload must deliver the
  // exact typed request, not an extraction fragment cut at "about" or the
  // 120-character extraction cap.
  const typed = "Our invoice 4471 shows 21% VAT but we are exempt as a charity. Please correct the last two invoices and confirm our billing email. I have a question about the VAT certificate you need.";

  const parsed = validateUsyContactPayload({
    category: "billing",
    message: typed,
    senderName: "Alex Rivera",
    replyEmail: "alex@example.com",
    language: "english",
    confirmed: true,
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const payload = buildConfirmedUsyContactPayload(parsed.data, { timestamp: "2026-09-20T12:00:00.000Z" });
  assert.equal(payload.message, typed, "the n8n payload message is byte-identical to the typed request");
  assert.equal(payload.message.length, typed.length, "the payload message is not truncated");

  const fingerprintA = fingerprintUsyContactSubmission("user:payload-check", payload);
  const payloadWithDifferentTail = { ...payload, message: `${typed.slice(0, -1)}!` };
  assert.notEqual(
    fingerprintUsyContactSubmission("user:payload-check", payloadWithDifferentTail),
    fingerprintA,
    "payload differences change the fingerprint so distinct requests never dedupe together",
  );
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
testPublishedN8nResponseIsSuccess();
testHandoffFailureClassificationMatrix();
testWebhookTestPathIsReportedNotUsed();
testHandoffDiagnosticsNeverLeakSecretsOrCustomerData();
testRouteLogsSafeHandoffEvents();
testDeployedConfigurationNeverUsesWebhookTestUrl();
testDuplicateConfirmationDoesNotResubmit();
testSubmissionGuardWindowExpires();
testFingerprintSeparatesIdentitiesAndPayloads();
testDepartmentRoutingInPayload();
testGuestSubmissionPayload();
testWebhookPayloadCarriesExactTypedMessage();
testAuthenticatedSubmissionPayload();
testNoWebhookSecretExposedClientSide();

console.warn("Usy contact handoff tests passed");

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}
