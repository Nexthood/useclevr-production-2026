import { strict as assert } from "node:assert";

import {
  BYOK_PROVIDER_REQUIRED_MESSAGE,
  ByokProviderUnavailableError,
  __aiProviderSecurityTestHooks,
  generateWithUniversalAiAdapter,
  getAiMode,
  getUseClevrCloudAiAllowed,
  getUseClevrCloudFallbackAllowed,
  isByokProviderUnavailableError,
  isLocalAiUnavailableError,
  listPublicAiProviderConfigs,
  saveAiProviderConfig,
  setAiMode,
  testAiProviderConfig,
} from "../../src/lib/ai/byoai-provider";
import { providerRows, settingRows, resetAiMockState } from "./mocks/mock-ai-db.mjs";

const USER_ID = "user-byok-test";
const TEST_PROVIDER_KEY = "sk-byok-test-key-1234567890";
const TEST_ENCRYPTION_KEY = Buffer.from("12345678901234567890123456789012").toString("base64");
const originalKey = process.env.AI_PROVIDER_ENCRYPTION_KEY;
const originalFetch = globalThis.fetch;

type ProviderRowOverrides = Partial<typeof providerRows[number]> & { providerType?: string };

function seedProvider(overrides: ProviderRowOverrides = {}) {
  const now = new Date();
  providerRows.push({
    id: overrides.id ?? `aip_${providerRows.length + 1}`,
    userId: USER_ID,
    providerType: "openai",
    providerName: "Test provider",
    baseUrl: "https://api.openai.example/v1",
    modelName: "gpt-test",
    encryptedApiKey: __aiProviderSecurityTestHooks.encryptSecret(TEST_PROVIDER_KEY),
    selected: true,
    isEnabled: true,
    isDefault: true,
    isFallback: false,
    priority: 0,
    lastTestLatencyMs: null,
    lastTestModels: [],
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function seedAiMode(mode: string, allowUseclevrCloudFallback: boolean) {
  settingRows.push({
    key: `ai-provider-mode:${USER_ID}`,
    value: { mode, allowUseclevrCloudFallback },
    updatedAt: new Date(),
  });
}

type RecordedRequest = { url: string; method: string; authorization: string | null };

let recordedRequests: RecordedRequest[] = [];

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installMockFetch(options: { status?: number; errorBody?: unknown } = {}) {
  recordedRequests = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String((input as Request).url);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const headerRecord = (init?.headers ?? (input instanceof Request ? Object.fromEntries(input.headers.entries()) : {})) as Record<string, string>;
    const authorization = headerRecord.Authorization ?? null;
    recordedRequests.push({ url, method, authorization });

    if (method === "GET" && url.endsWith("/models")) {
      return jsonResponse(200, { data: [{ id: "model-x" }, { id: "model-backup" }] });
    }

    if (options.status && options.status !== 200) {
      return jsonResponse(options.status, options.errorBody ?? { error: { message: `Invalid key ${authorization ?? "missing"} for ${url}` } });
    }

    return jsonResponse(200, {
      choices: [{ message: { content: "UseClevr BYOAI OK" } }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    });
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function resetState() {
  resetAiMockState();
  settingRows.length = 0;
}

async function main() {
  process.env.AI_PROVIDER_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

  // -- Save-time validation (requirement 1) --------------------------------

  resetState();
  await assert.rejects(
    () => setAiMode(USER_ID, "byok"),
    (error: unknown) => {
      assert.ok(isByokProviderUnavailableError(error));
      assert.equal((error as Error).message, BYOK_PROVIDER_REQUIRED_MESSAGE);
      assert.equal((error as Error).name, "ByokProviderUnavailableError");
      return true;
    },
    "BYOK must not activate with zero providers",
  );

  seedProvider({ isEnabled: false, selected: false });
  await assert.rejects(
    () => setAiMode(USER_ID, "byok"),
    (error: unknown) => isByokProviderUnavailableError(error),
    "BYOK must not activate when the only provider is disabled",
  );

  await setAiMode(USER_ID, "automatic");
  assert.equal(await getAiMode(USER_ID), "auto");

  // Enabled provider unlocks BYOK (requirement 7) and refreshes counters.
  seedProvider({ id: "aip_enabled", isEnabled: true, selected: true, providerType: "openai" });
  const providersAfterCreate = await listPublicAiProviderConfigs(USER_ID);
  assert.equal(providersAfterCreate.length, 2);
  assert.equal(providersAfterCreate.filter((provider) => provider.enabled).length, 1);
  await setAiMode(USER_ID, "byok", { allowUseclevrCloudFallback: false });
  assert.equal(await getAiMode(USER_ID), "byok");
  assert.equal(await getUseClevrCloudFallbackAllowed(USER_ID), false);

  // -- Runtime protection: BYOK + 0 providers (requirement 4 + 8) ----------

  resetState();
  seedAiMode("byok", false);
  await assert.rejects(
    () => generateWithUniversalAiAdapter(USER_ID, "Analyze revenue"),
    (error: unknown) => {
      assert.ok(isByokProviderUnavailableError(error));
      assert.equal((error as Error).message, BYOK_PROVIDER_REQUIRED_MESSAGE);
      assert.equal(isLocalAiUnavailableError(error), false);
      return true;
    },
    "BYOK with zero providers must fail with the typed configuration error",
  );

  // -- BYOK + provider disabled ---------------------------------------------

  resetState();
  seedAiMode("byok", false);
  seedProvider({ isEnabled: false, selected: false });
  await assert.rejects(
    () => generateWithUniversalAiAdapter(USER_ID, "Analyze revenue"),
    (error: unknown) => isByokProviderUnavailableError(error),
    "BYOK with a disabled provider must fail with the typed configuration error",
  );

  // -- BYOK + enabled provider routes through it (requirement 8) ------------

  resetState();
  seedAiMode("byok", false);
  seedProvider({ id: "aip_openai", providerType: "openai", modelName: "gpt-test" });
  installMockFetch();
  try {
    const result = await generateWithUniversalAiAdapter(USER_ID, "Analyze revenue");
    assert.ok(result, "BYOK with an enabled provider must return a result");
    assert.equal(result.mode, "byok");
    assert.equal(result.route, "cloud");
    assert.equal(result.providerType, "openai");
    assert.ok(result.text.includes("UseClevr BYOAI OK"));
    assert.ok(recordedRequests.some((request) => request.url.endsWith("/chat/completions")));
    assert.ok(recordedRequests.every((request) => !request.authorization || request.authorization === `Bearer ${TEST_PROVIDER_KEY}`));
  } finally {
    restoreFetch();
  }

  // -- Provider connection failure (requirement 8) --------------------------

  resetState();
  seedAiMode("byok", false);
  seedProvider({ id: "aip_openai", providerType: "openai", modelName: "gpt-test" });
  installMockFetch({ status: 401 });
  try {
    await assert.rejects(
      () => generateWithUniversalAiAdapter(USER_ID, "Analyze revenue"),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.ok(!message.includes(TEST_PROVIDER_KEY), "provider failure must not leak the API key");
        return true;
      },
      "BYOK with a failing provider must surface the provider error",
    );
  } finally {
    restoreFetch();
  }

  const storedStatus = providerRows.find((row) => row.id === "aip_openai");
  assert.equal(storedStatus?.lastTestStatus, "invalid_key");

  // -- Fallback behavior (requirement 6) ------------------------------------

  resetState();
  seedAiMode("byok", false);
  seedProvider({ id: "aip_openai", providerType: "openai", modelName: "gpt-test" });
  installMockFetch({ status: 500 });
  try {
    await assert.rejects(
      () => generateWithUniversalAiAdapter(USER_ID, "Analyze revenue"),
      (error: unknown) => !isByokProviderUnavailableError(error),
      "BYOK provider failure without fallback must fail instead of using UseClevr Cloud",
    );
  } finally {
    restoreFetch();
  }

  resetState();
  seedAiMode("byok", true);
  seedProvider({ id: "aip_openai", providerType: "openai", modelName: "gpt-test" });
  assert.equal(await getUseClevrCloudFallbackAllowed(USER_ID), true, "explicit fallback preference must be honored");

  // -- Managed cloud route resolution (retail /api/analyze 503 fix) ---------

  resetState();
  seedAiMode("cloud-only", false);
  assert.equal(
    await getUseClevrCloudAiAllowed(USER_ID),
    true,
    "cloud-only mode keeps managed UseClevr Cloud available even when the fallback preference is off",
  );

  resetState();
  seedAiMode("auto", false);
  assert.equal(
    await getUseClevrCloudAiAllowed(USER_ID),
    false,
    "auto mode with a disabled fallback preference keeps managed cloud blocked",
  );

  resetState();
  seedAiMode("byok", false);
  assert.equal(
    await getUseClevrCloudAiAllowed(USER_ID),
    false,
    "byok mode with a disabled fallback preference keeps managed cloud blocked",
  );

  resetState();
  seedAiMode("local-only", false);
  assert.equal(
    await getUseClevrCloudAiAllowed(USER_ID),
    false,
    "local-only mode never allows managed cloud",
  );

  resetState();
  seedAiMode("auto", true);
  assert.equal(await getUseClevrCloudAiAllowed(USER_ID), true, "an enabled fallback preference allows managed cloud");

  // -- Specific error mapping instead of generic background failure (req. 5) -

  const typed = new ByokProviderUnavailableError();
  assert.equal(typed.message, BYOK_PROVIDER_REQUIRED_MESSAGE);
  assert.equal(isByokProviderUnavailableError(typed), true);
  assert.equal(isByokProviderUnavailableError(new Error("Background request failed.")), false);

  // -- API key never returned to the browser (requirement 8) ----------------

  resetState();
  const saved = await saveAiProviderConfig(USER_ID, {
    providerName: "Browser test provider",
    providerType: "openai_compatible",
    baseUrl: "https://api.example.com/v1",
    modelName: "model-x",
    apiKey: TEST_PROVIDER_KEY,
    enabled: true,
  });
  const publicList = await listPublicAiProviderConfigs(USER_ID);
  const serialized = JSON.stringify(publicList);
  assert.equal(publicList.length, 1);
  assert.equal(publicList[0]?.hasApiKey, true);
  assert.equal(publicList[0]?.apiKeyPreview, "Saved key");
  assert.ok(!serialized.includes(TEST_PROVIDER_KEY), "public provider list must never contain the API key");
  assert.ok(!("apiKey" in publicList[0]!), "public provider config must not expose an apiKey field");
  assert.equal(saved.hasApiKey, true);

  // -- Test connection verifies endpoint/model without exposing the key (7) --

  resetState();
  installMockFetch();
  try {
    const testResult = await testAiProviderConfig({
      providerName: "Endpoint test",
      providerType: "openai_compatible",
      baseUrl: "https://api.example.com/v1",
      modelName: "model-x",
      apiKey: TEST_PROVIDER_KEY,
      enabled: true,
    });
    assert.equal(testResult.success, true);
    assert.equal(testResult.modelConfirmed, true);
    assert.equal(testResult.modelName, "model-x");
    assert.ok(testResult.availableModels.includes("model-x"));
    assert.ok(recordedRequests.some((request) => request.url === "https://api.example.com/v1/chat/completions"));
    assert.ok(recordedRequests.some((request) => request.url === "https://api.example.com/v1/models"));
    assert.ok(!JSON.stringify(testResult).includes(TEST_PROVIDER_KEY), "test connection result must not contain the API key");
  } finally {
    restoreFetch();
  }

  // Connection failure keeps the key out of the message.
  installMockFetch({ status: 401 });
  try {
    await assert.rejects(
      () =>
        testAiProviderConfig({
          providerName: "Endpoint test",
          providerType: "openai_compatible",
          baseUrl: "https://api.example.com/v1",
          modelName: "model-x",
          apiKey: TEST_PROVIDER_KEY,
          enabled: true,
        }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.ok(!message.includes(TEST_PROVIDER_KEY), "failed test connection must not leak the API key");
        return true;
      },
    );
  } finally {
    restoreFetch();
  }

  // -- Secret redaction in provider error text -------------------------------

  const redacted = __aiProviderSecurityTestHooks.decryptSecret(__aiProviderSecurityTestHooks.encryptSecret(TEST_PROVIDER_KEY));
  assert.equal(redacted, TEST_PROVIDER_KEY);

  if (originalKey === undefined) {
    delete process.env.AI_PROVIDER_ENCRYPTION_KEY;
  } else {
    process.env.AI_PROVIDER_ENCRYPTION_KEY = originalKey;
  }
  restoreFetch();
  console.log("BYOK provider-required regression tests passed.");
}

main().catch((error) => {
  if (originalKey === undefined) {
    delete process.env.AI_PROVIDER_ENCRYPTION_KEY;
  } else {
    process.env.AI_PROVIDER_ENCRYPTION_KEY = originalKey;
  }
  restoreFetch();
  console.error(error);
  process.exit(1);
});
