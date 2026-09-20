import { strict as assert } from "node:assert";

import {
  __governanceTestHooks,
  type AiGovernanceSettings,
  type GovernanceProviderRuntime,
} from "../../src/lib/ai-governance/governance-service";
import {
  classifyAuditFailureCategory,
} from "../../src/lib/ai/ai-request-audit";
import { redactProviderSecretText, safeProviderErrorMessage } from "../../src/lib/ai/byoai-provider";
import {
  getManagedCloudApiKey,
  isManagedCloudConfigured,
} from "../../src/lib/ai/managed-cloud-provider";

type AuditEntryLike = Parameters<typeof __governanceTestHooks.buildProviderRuntime>[0]["auditEntries"][number];
type PublicProviderLike = Parameters<typeof __governanceTestHooks.buildMonitoredProviderEntries>[0][number];

const managedProviderName = "UseClevr Cloud Analysis";
const managedModel = "gemini-2.5-flash";

const baseSettings: AiGovernanceSettings = {
  preferredProviderId: null,
  preferredModel: null,
  mode: "automatic",
  fallbackProviderId: null,
  temperature: 0.2,
  maxTokens: 4096,
  loggingEnabled: true,
  retentionDays: 90,
};

function makeAuditEntry(overrides: Partial<Record<string, unknown>> = {}): AuditEntryLike {
  const now = new Date("2026-09-20T12:00:00Z");
  return {
    id: "aia_test",
    userId: "user_1",
    datasetId: null,
    providerName: managedProviderName,
    providerType: "default-cloud",
    modelName: managedModel,
    mode: "auto",
    executionLocation: "cloud",
    fallbackUsed: false,
    routingReason: null,
    latencyMs: 120,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    purpose: "dataset_analysis",
    success: true,
    errorReason: null,
    createdAt: now,
    ...overrides,
  } as unknown as AuditEntryLike;
}

function makeProvider(overrides: Partial<PublicProviderLike> = {}): PublicProviderLike {
  return {
    id: "aip_byok",
    providerType: "openai_compatible",
    providerName: "Tenant OpenAI-compatible",
    baseUrl: "https://api.example.com/v1",
    modelName: "gpt-test",
    hasApiKey: true,
    apiKeyPreview: "Saved key",
    selected: true,
    enabled: true,
    isDefault: true,
    isFallback: false,
    priority: 0,
    lastTestStatus: "connected",
    lastTestMessage: "Connection successful. Model confirmed.",
    lastTestLatencyMs: 80,
    lastTestModels: [],
    lastTestedAt: new Date("2026-09-20T11:00:00Z").toISOString(),
    ...overrides,
  } as unknown as PublicProviderLike;
}

function buildRuntime(input: {
  auditEntries?: AuditEntryLike[];
  managedConfigured?: boolean;
} = {}): GovernanceProviderRuntime {
  return __governanceTestHooks.buildProviderRuntime({
    providers: [],
    auditEntries: input.auditEntries ?? [],
    traces: [],
    allowUseclevrCloudFallback: true,
  });
}

function withManagedKey<T>(value: string | null, run: () => T): T {
  const previousGoogle = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const previousGemini = process.env.GEMINI_API_KEY;
  try {
    if (value === null) {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = value;
      delete process.env.GEMINI_API_KEY;
    }
    return run();
  } finally {
    if (previousGoogle === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = previousGoogle;
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGemini;
  }
}

async function main() {
  let passed = 0;

  // ── Managed cloud credential resolution (§4) ─────────────────────────────
  withManagedKey(null, () => {
    assert.equal(isManagedCloudConfigured(), false, "managed cloud must be unconfigured without credentials");
    assert.equal(getManagedCloudApiKey(), null, "no key material may be derived without env credentials");
  });
  withManagedKey("test-key-123", () => {
    assert.equal(isManagedCloudConfigured(), true, "GOOGLE_GENERATIVE_AI_API_KEY must configure managed cloud");
    assert.equal(getManagedCloudApiKey(), "test-key-123");
  });
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  process.env.GEMINI_API_KEY = "alt-key-456";
  try {
    assert.equal(isManagedCloudConfigured(), true, "GEMINI_API_KEY must be accepted as the existing alternative");
  } finally {
    delete process.env.GEMINI_API_KEY;
  }
  passed += 1;

  // ── Safe failure categories (§8) ──────────────────────────────────────────
  assert.equal(classifyAuditFailureCategory("Google Generative AI API key is missing. Pass it using the 'apiKey' parameter or the GOOGLE_GENERATIVE_AI_API_KEY environment variable."), "credential_missing");
  assert.equal(classifyAuditFailureCategory("Provider returned 401: invalid api key"), "credential_invalid");
  assert.equal(classifyAuditFailureCategory("Provider returned 429: rate limit exceeded"), "rate_limited");
  assert.equal(classifyAuditFailureCategory("Connection timed out."), "timeout");
  assert.equal(classifyAuditFailureCategory("fetch failed ECONNREFUSED"), "provider_unavailable");
  assert.equal(classifyAuditFailureCategory("Provider returned 500: internal"), "provider_error");
  assert.equal(classifyAuditFailureCategory(null), "provider_error");
  assert.equal(
    redactProviderSecretText("request failed with key=short1234 and Bearer sk-123456789"),
    "request failed with key=[redacted] and Bearer [redacted]",
  );
  assert.equal(safeProviderErrorMessage("api key=shortvalue12"), "api key=[redacted]");
  passed += 1;

  // ── Matrix A1/A13: no tenant provider, managed credential missing (§6, §7) ─
  withManagedKey(null, () => {
    const runtime = buildRuntime({
      auditEntries: [
        makeAuditEntry({ success: false, errorReason: "Google Generative AI API key is missing. Pass it using the 'apiKey' parameter or the GOOGLE_GENERATIVE_AI_API_KEY environment variable.", fallbackUsed: false, latencyMs: 5 }),
      ],
    });
    const entries = __governanceTestHooks.buildMonitoredProviderEntries([], runtime);
    assert.equal(entries.length, 1, "managed route must be represented as a monitored provider");
    const managed = entries[0];
    assert.equal(managed.provider, managedProviderName);
    assert.equal(managed.model, managedModel);
    assert.equal(managed.managed, true);
    assert.equal(managed.status, "Missing Key", "missing managed credential must not be Ready");

    const stats = __governanceTestHooks.summarizeProviders([], runtime);
    assert.equal(stats.total, 1, "active providers denominator must count the managed monitored route");
    assert.equal(stats.online, 0);
    assert.equal(stats.missingCredential, 1);
    assert.equal(stats.invalidKey, 0, "a missing credential is not an invalid key");

    // Cross-page: privacy, risk, transparency from the same runtime (§11, §13, §27)
    const privacy = __governanceTestHooks.buildPrivacyPosture(baseSettings, [], runtime);
    const cloud = privacy.items.find((item) => item.label === "Cloud processing?");
    assert.equal(cloud?.value, "No cloud provider configured");
    assert.equal(cloud?.status, "Needs setup", "unavailable cloud processing must not be Ready");
    const used = privacy.items.find((item) => item.label === "Provider used?");
    assert.equal(used?.status, "Needs data");
    assert.ok(!String(used?.value).includes("fallback"), "provider-used must not claim fallback when fallbackUsed=false");

    const auditStats = { aiRequests: 1, feedbackCount: 0 };
    const risk = __governanceTestHooks.buildRiskPosture(
      auditStats as never,
      stats as never,
      privacy,
      runtime,
    );
    const providerFailureRisk = risk.risks.find((item) => item.label === "Provider failures");
    assert.equal(providerFailureRisk?.level, "Elevated", "recent provider failures must not show as Managed/Ready");

    assert.equal(runtime.executionOrigin, null, "no successful generation may exist after failed attempts");
    assert.equal(runtime.latestManagedAttempt?.failureCategory, "credential_missing");

    const compliance = __governanceTestHooks.buildComplianceScore({
      auditLogged: true,
      providerMonitoring: stats.total > 0,
      humanOversight: false,
      privacyConfigured: privacy.items.every((item) => item.status !== "Needs setup"),
      feedbackAvailable: false,
      policiesAvailable: true,
    });
    assert.equal(compliance.checks.find((check) => check.label === "Provider monitoring")?.complete, true, "monitored managed route counts as provider monitoring");
    assert.equal(compliance.checks.find((check) => check.label === "Privacy")?.complete, false, "privacy must stay truthful when cloud processing needs setup");
  });
  passed += 1;

  // ── Matrix A2/A5/A7: healthy tenant provider + managed configured (§13, §26) ─
  withManagedKey("test-key-123", () => {
    const successEntry = makeAuditEntry({ success: true, latencyMs: 850, totalTokens: 320 });
    const runtime = buildRuntime({ auditEntries: [successEntry] });
    const providers = [makeProvider()];
    const entries = __governanceTestHooks.buildMonitoredProviderEntries(providers, runtime);
    assert.equal(entries.length, 2);
    const managed = entries.find((entry) => entry.managed);
    assert.equal(managed?.status, "Online", "successful managed request must report Online");
    const stats = __governanceTestHooks.summarizeProviders(providers, runtime);
    assert.equal(stats.online, 2, "healthy tenant provider plus managed route must both count as online");
    assert.equal(runtime.executionOrigin?.route, "managed_cloud");
    assert.equal(runtime.executionOrigin?.providerName, managedProviderName);
    assert.equal(runtime.executionOrigin?.fallbackUsed, false);
    const risk = __governanceTestHooks.buildRiskPosture(
      { aiRequests: 1, feedbackCount: 0 } as never,
      stats as never,
      __governanceTestHooks.buildPrivacyPosture(baseSettings, providers, runtime),
      runtime,
    );
    assert.equal(risk.risks.find((item) => item.label === "Provider failures")?.level, "Managed", "successful requests must not fabricate provider failure risk");
    passed += 1;

    // ── Matrix B: export uses the same normalized facts (§19) ────────────────
    const privacy = __governanceTestHooks.buildPrivacyPosture(baseSettings, providers, runtime);
    const cloudValue = privacy.items.find((item) => item.label === "Cloud processing?")?.value;
    assert.match(String(cloudValue), /UseClevr-managed cloud available/, "managed cloud must be named as the available cloud route");
    assert.equal(privacy.items.find((item) => item.label === "Provider used?")?.value, `${managedProviderName} (UseClevr-managed cloud)`);
  });
  passed += 1;

  // ── Matrix A4: invalid credential on tenant provider (§7) ─────────────────
  {
    const runtime = buildRuntime({ auditEntries: [] });
    const providers = [makeProvider({ lastTestStatus: "invalid_key" })];
    const stats = __governanceTestHooks.summarizeProviders(providers, runtime);
    assert.equal(stats.invalidKey, 1);
    assert.equal(stats.online, 0);
    const risk = __governanceTestHooks.buildRiskPosture(
      { aiRequests: 0, feedbackCount: 0 } as never,
      stats as never,
      __governanceTestHooks.buildPrivacyPosture(baseSettings, providers, runtime),
      runtime,
    );
    assert.equal(risk.risks.find((item) => item.label === "Provider failures")?.level, "Elevated", "invalid-key providers must not leave provider-failure risk Ready");
  }
  passed += 1;

  // ── Matrix A8: fallback configured but unused (§12) ────────────────────────
  {
    const runtime = buildRuntime({
      auditEntries: [makeAuditEntry({ providerName: "Primary", providerType: "openai_compatible", success: true, fallbackUsed: false })],
    });
    const providers = [makeProvider({ isDefault: true, isFallback: false }), makeProvider({ id: "aip_fb", isDefault: false, isFallback: true })];
    const stats = __governanceTestHooks.summarizeProviders(providers, runtime);
    assert.equal(stats.fallbackConfigured, 1);
    assert.equal(runtime.recentFallbackUses, 0, "configured fallback without usage must not count as used");
    assert.equal(runtime.executionOrigin?.fallbackUsed, false);
  }
  passed += 1;

  // ── Matrix A9/§28: primary fails, fallback succeeds ────────────────────────
  {
    const runtime = buildRuntime({
      auditEntries: [
        makeAuditEntry({ id: "aia_fb_success", providerName: "Fallback Provider", providerType: "openai_compatible", success: true, fallbackUsed: true, latencyMs: 240, totalTokens: 180, createdAt: new Date("2026-09-20T12:01:00Z") }),
        makeAuditEntry({ id: "aia_primary_fail", providerName: "Primary Provider", providerType: "openai_compatible", success: false, fallbackUsed: false, errorReason: "Provider returned 503: unavailable", createdAt: new Date("2026-09-20T12:00:30Z") }),
      ],
    });
    assert.equal(runtime.executionOrigin?.providerName, "Fallback Provider");
    assert.equal(runtime.executionOrigin?.fallbackUsed, true, "execution origin must identify the fallback route");
    assert.equal(runtime.recentFailures, 1, "the primary failure must remain visible");
    assert.equal(runtime.latestAttempt?.success, true, "the final fallback attempt succeeded");
    const privacy = __governanceTestHooks.buildPrivacyPosture(baseSettings, [], runtime);
    assert.match(String(privacy.items.find((item) => item.label === "Provider used?")?.value), /fallback route/);
    const stats = __governanceTestHooks.summarizeProviders([], runtime);
    const risk = __governanceTestHooks.buildRiskPosture({ aiRequests: 2, feedbackCount: 0 } as never, stats as never, privacy, runtime);
    assert.equal(risk.risks.find((item) => item.label === "Provider failures")?.level, "Elevated", "primary failure must warn without marking the final output failed");
  }
  passed += 1;

  // ── Matrix A10/§28: primary fails, fallback fails → request stays failed ───
  {
    const runtime = buildRuntime({
      auditEntries: [
        makeAuditEntry({ id: "aia_fb_fail", providerName: "Fallback Provider", providerType: "openai_compatible", success: false, fallbackUsed: true, errorReason: "Connection timed out.", createdAt: new Date("2026-09-20T12:01:00Z") }),
        makeAuditEntry({ id: "aia_primary_fail", providerName: "Primary Provider", providerType: "openai_compatible", success: false, errorReason: "Provider returned 503: unavailable", createdAt: new Date("2026-09-20T12:00:30Z") }),
      ],
    });
    assert.equal(runtime.executionOrigin, null, "no origin may exist when every route failed");
    assert.equal(runtime.recentFailures, 2);
    assert.equal(runtime.latestAttempt?.success, false);
  }
  passed += 1;

  // ── Matrix A11/§20: deterministic direct data analysis (§9, §30) ───────────
  {
    const runtime = buildRuntime({
      auditEntries: [makeAuditEntry({ providerName: "Direct data analysis", providerType: "none", modelName: "deterministic-result", success: true, latencyMs: 3, totalTokens: 0 })],
    });
    assert.equal(runtime.executionOrigin?.route, "deterministic");
    assert.equal(runtime.executionOrigin?.modelName, "deterministic-result");
    assert.equal(runtime.recentFailures, 0, "deterministic analysis is not a provider failure");
    const privacy = __governanceTestHooks.buildPrivacyPosture(baseSettings, [], runtime);
    assert.match(String(privacy.items.find((item) => item.label === "Provider used?")?.value), /direct data analysis/);
  }
  passed += 1;

  // ── Privacy: local mode posture (§11) ──────────────────────────────────────
  {
    const runtime = buildRuntime({ auditEntries: [] });
    const privacy = __governanceTestHooks.buildPrivacyPosture({ ...baseSettings, mode: "local" }, [], runtime);
    const cloud = privacy.items.find((item) => item.label === "Cloud processing?");
    assert.equal(cloud?.value, "Disabled by selected mode");
    assert.equal(cloud?.status, "Limited", "intentionally disabled cloud must differ from broken configuration");
  }
  passed += 1;

  console.log(`AI governance consistency tests passed (${passed} groups).`);
}

main().catch((error) => {
  console.error("AI governance consistency tests failed:", error);
  process.exit(1);
});
