import { strict as assert } from "node:assert";

import {
  __aiProviderSecurityTestHooks,
  classifyProviderError,
  safeProviderErrorMessage,
  testAiProviderConfig,
} from "../../src/lib/ai/byoai-provider";

const originalKey = process.env.AI_PROVIDER_ENCRYPTION_KEY;
const originalAuthSecret = process.env.AUTH_SECRET;
const testKey = Buffer.from("12345678901234567890123456789012").toString("base64");

function resetEnv() {
  if (originalKey === undefined) {
    delete process.env.AI_PROVIDER_ENCRYPTION_KEY;
  } else {
    process.env.AI_PROVIDER_ENCRYPTION_KEY = originalKey;
  }
  if (originalAuthSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = originalAuthSecret;
  }
}

async function main() {
  process.env.AI_PROVIDER_ENCRYPTION_KEY = testKey;
  const encrypted = __aiProviderSecurityTestHooks.encryptSecret("sk-test-provider-key");
  const payload = JSON.parse(encrypted) as { v?: number; key?: string; data?: string };
  assert.equal(payload.v, 2);
  assert.equal(payload.key, "AI_PROVIDER_ENCRYPTION_KEY");
  assert.ok(payload.data);
  assert.equal(__aiProviderSecurityTestHooks.decryptSecret(encrypted), "sk-test-provider-key");

  delete process.env.AI_PROVIDER_ENCRYPTION_KEY;
  assert.throws(
    () => __aiProviderSecurityTestHooks.encryptSecret("sk-test-provider-key"),
    /AI provider encryption is not configured/,
  );

  process.env.AI_PROVIDER_ENCRYPTION_KEY = "too-short";
  assert.throws(
    () => __aiProviderSecurityTestHooks.encryptSecret("sk-test-provider-key"),
    /AI provider encryption key is invalid/,
  );

  process.env.AI_PROVIDER_ENCRYPTION_KEY = testKey;
  assert.equal(
    __aiProviderSecurityTestHooks.normalizeBaseUrl("http://localhost:11434", "ollama"),
    "http://localhost:11434/v1",
  );
  assert.equal(
    __aiProviderSecurityTestHooks.normalizeBaseUrl("https://api.openai.com/v1", "openai"),
    "https://api.openai.com/v1",
  );
  await assert.rejects(
    () =>
      testAiProviderConfig({
        providerName: "OpenAI-compatible",
        providerType: "openai_compatible",
        baseUrl: "https://api.example.com/v1",
        modelName: "test-model",
      }),
    /requires an API key/,
  );
  assert.equal(classifyProviderError(new Error("Provider returned 401: unauthorized")), "invalid_key");
  assert.equal(classifyProviderError(new Error("Provider returned 404: model not found")), "model_unavailable");
  assert.equal(classifyProviderError(new Error("Provider returned 429: rate limit")), "rate_limited");
  assert.equal(classifyProviderError(new Error("fetch failed ECONNREFUSED")), "endpoint_unreachable");
  assert.equal(
    safeProviderErrorMessage("request failed key=sk-secret1234567890abcdef Authorization=Bearer sk-testsecret123456"),
    "request failed key=[redacted] Authorization=Bearer [redacted]",
  );

  for (const blocked of [
    "file:///tmp/model",
    "ftp://example.com/v1",
    "http://localhost:8000/v1",
    "http://127.0.0.1:8000/v1",
    "http://[::1]:8000/v1",
    "http://[::ffff:127.0.0.1]:8000/v1",
    "http://10.0.0.5/v1",
    "http://169.254.169.254/latest/meta-data",
    "https://user:pass@example.com/v1",
  ]) {
    assert.throws(
      () => __aiProviderSecurityTestHooks.normalizeBaseUrl(blocked, "openai-compatible"),
      /Base URL/,
      `expected ${blocked} to be rejected`,
    );
  }

  resetEnv();
  console.log("AI provider security tests passed.");
}

main().catch((error) => {
  resetEnv();
  console.error(error);
  process.exit(1);
});
