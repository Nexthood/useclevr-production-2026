/**
 * Regression tests for the Microsoft OAuth state primitive:
 * HMAC integrity, session binding, expiry, replay protection,
 * connector-type validation, and safe return-to clamping.
 *
 * Run: pnpm test:clevrsync-microsoft-oauth-state
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  createMicrosoftOAuthState,
  verifyMicrosoftOAuthState,
} from "@/services/clevrsync/microsoft-oauth-state";

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-auth-secret-for-microsoft-oauth-state";

function sign(encoded: string) {
  return createHmac("sha256", process.env.AUTH_SECRET!).update(encoded).digest("base64url");
}

function craftState(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function testRoundTrip() {
  const state = createMicrosoftOAuthState({
    userId: "user_1",
    connectorType: "onedrive",
    returnTo: "/app/settings/data-connections",
  });
  const verified = verifyMicrosoftOAuthState(state, "user_1");
  assert.equal(verified.userId, "user_1");
  assert.equal(verified.connectorType, "onedrive");
  assert.equal(verified.returnTo, "/app/settings/data-connections");
  assert.ok(verified.nonce.length >= 16, "states must carry a nonce");
  assert.ok(verified.expiresAt > Date.now());
}

function testSharePointConnectorTypeRoundTrip() {
  const state = createMicrosoftOAuthState({ userId: "user_1", connectorType: "sharepoint" });
  const verified = verifyMicrosoftOAuthState(state, "user_1");
  assert.equal(verified.connectorType, "sharepoint");
}

function testInvalidSignatureRejected() {
  const state = createMicrosoftOAuthState({ userId: "user_1", connectorType: "onedrive" });
  const tampered = `${state.slice(0, -4)}AAAA`;
  assert.throws(
    () => verifyMicrosoftOAuthState(tampered, "user_1"),
    /OAuth state is invalid/,
    "signature tampering must be rejected",
  );
  assert.throws(() => verifyMicrosoftOAuthState("garbage", "user_1"));
  assert.throws(() => verifyMicrosoftOAuthState("payload.only", "user_1"));
}

function testTamperedPayloadRejected() {
  const state = createMicrosoftOAuthState({ userId: "user_1", connectorType: "onedrive" });
  const [, signature] = state.split(".");
  const forgedEncoded = Buffer.from(
    JSON.stringify({
      userId: "user_attacker",
      connectorType: "onedrive",
      returnTo: "/app/settings/data-connections",
      nonce: "forged-nonce",
      expiresAt: Date.now() + 60_000,
    }),
  ).toString("base64url");
  assert.throws(
    () => verifyMicrosoftOAuthState(`${forgedEncoded}.${signature}`, "user_attacker"),
    /OAuth state is invalid/,
    "payload substitution without the server secret must fail signature verification",
  );
}

function testCrossUserRejected() {
  const state = createMicrosoftOAuthState({ userId: "user_1", connectorType: "onedrive" });
  assert.throws(
    () => verifyMicrosoftOAuthState(state, "user_2"),
    /does not match this session/,
    "states minted for another session must be rejected",
  );
}

function testExpiredStateRejected() {
  const state = craftState({
    userId: "user_1",
    connectorType: "onedrive",
    returnTo: "/app/settings/data-connections",
    nonce: `expired-${Date.now()}`,
    expiresAt: Date.now() - 1000,
  });
  assert.throws(() => verifyMicrosoftOAuthState(state, "user_1"), /OAuth state expired/);
}

function testReplayedStateRejected() {
  const state = createMicrosoftOAuthState({ userId: "user_1", connectorType: "sharepoint" });
  verifyMicrosoftOAuthState(state, "user_1");
  assert.throws(
    () => verifyMicrosoftOAuthState(state, "user_1"),
    /already used/,
    "a redeemed state nonce must not verify twice (replay protection)",
  );
}

function testUnsupportedConnectorTypeRejected() {
  const state = craftState({
    userId: "user_1",
    connectorType: "excel",
    returnTo: "/app/settings/data-connections",
    nonce: `bad-type-${Date.now()}`,
    expiresAt: Date.now() + 60_000,
  });
  assert.throws(
    () => verifyMicrosoftOAuthState(state, "user_1"),
    /unsupported connector type/,
    "the local Excel connector must never be OAuth-connectable",
  );
}

function testReturnToClamped() {
  const state = createMicrosoftOAuthState({
    userId: "user_1",
    connectorType: "onedrive",
    returnTo: "https://evil.example/app/settings/data-connections",
  });
  const verified = verifyMicrosoftOAuthState(state, "user_1");
  assert.equal(
    verified.returnTo,
    "/app/settings/data-connections",
    "returnTo must stay locked to the data-connections surface",
  );
}

function testMissingSecretFailsClosed() {
  const secret = process.env.AUTH_SECRET;
  delete process.env.AUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  try {
    assert.throws(
      () => createMicrosoftOAuthState({ userId: "user_1", connectorType: "onedrive" }),
      /signing is not configured/,
      "state creation must fail closed without a signing secret",
    );
  } finally {
    process.env.AUTH_SECRET = secret!;
  }
}

function testEveryStateHasUniqueNonce() {
  const first = createMicrosoftOAuthState({ userId: "user_1", connectorType: "onedrive" });
  const second = createMicrosoftOAuthState({ userId: "user_1", connectorType: "onedrive" });
  assert.notEqual(first, second);
}

async function main() {
  testRoundTrip();
  testSharePointConnectorTypeRoundTrip();
  testInvalidSignatureRejected();
  testTamperedPayloadRejected();
  testCrossUserRejected();
  testExpiredStateRejected();
  testReplayedStateRejected();
  testUnsupportedConnectorTypeRejected();
  testReturnToClamped();
  testMissingSecretFailsClosed();
  testEveryStateHasUniqueNonce();
  console.log("Microsoft OAuth state regression tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
