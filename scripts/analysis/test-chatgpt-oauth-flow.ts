import assert from "node:assert/strict";
import { createHash, createHmac, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { mock } from "node:test";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { assertChatGptTestEnvironment } from "./chatgpt-test-environment.mjs";
import { prepareChatGptTestDatabase } from "./chatgpt-test-db";

// Only the runner's fresh Unix socket cluster can supply database configuration.
const databaseUrl = assertChatGptTestEnvironment("oauth");
const sessionSecret = randomBytes(48).toString("base64url");
process.env.AUTH_SECRET = sessionSecret;
process.env.NEXTAUTH_SECRET = sessionSecret;
process.env.AUTH_URL = "https://app.useclevr.com";
process.env.NEXTAUTH_URL = process.env.AUTH_URL;
process.env.CHATGPT_MCP_OAUTH_ISSUER = process.env.AUTH_URL;
const resource = "https://app.useclevr.com/api/chatgpt/mcp";
process.env.CHATGPT_MCP_RESOURCE_URL = resource;
const clientId = "https://chatgpt.com/oauth/client.json";
const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";
const otherRedirect = "https://chatgpt.com/connector/oauth/another-test-callback";
process.env.CHATGPT_MCP_ALLOWED_CLIENT_IDS = clientId;
process.env.CHATGPT_MCP_ALLOWED_REDIRECT_URIS = `${redirectUri},${otherRedirect}`;
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.CHATGPT_MCP_OAUTH_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
process.env.CHATGPT_MCP_OAUTH_KEY_ID = "isolated-oauth-flow";

// Emulate only the Next.js request context. Auth.js session verification and all
// OAuth handlers, database operations, JWT checks, and MCP handlers remain real.
let requestHeaders = new Headers({ host: "app.useclevr.com", "x-forwarded-proto": "https" });
mock.module("next/headers", {
  exports: {
    headers: async () => requestHeaders,
    cookies: async () => ({ getAll: () => [] }),
  },
});
const validMetadata = {
  client_id: clientId,
  client_name: "Isolated ChatGPT fixture",
  redirect_uris: [redirectUri],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "private_key_jwt",
  token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
};
let metadataResponse = () => Response.json(validMetadata);
let metadataFetches = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  assert.equal(String(input), clientId, "Unexpected outbound HTTP request in isolated test");
  assert.equal(init?.redirect, "manual");
  assert.equal(init?.cache, "no-store");
  assert.ok(init?.signal);
  metadataFetches++;
  return metadataResponse();
};

const pool = new Pool({ connectionString: databaseUrl });
let applicationPool: { end(): Promise<void> } | undefined;
const fixtureUser = `oauth_fixture_${randomUUID()}`;
const otherUser = `oauth_fixture_${randomUUID()}`;
const fixturePassword = randomBytes(32).toString("base64url");
let passed = 0;

async function main() {
  await prepareChatGptTestDatabase("oauth");
  await pool.query('INSERT INTO "User" (id, email, name) VALUES ($1, $2, $3), ($4, $5, $6)',
    [fixtureUser, "oauth-a@example.test", "OAuth Fixture A", otherUser, "oauth-b@example.test", "OAuth Fixture B"]);
  await pool.query('UPDATE "User" SET password=$1, "emailVerified"=NOW() WHERE id=$2', [await bcrypt.hash(fixturePassword, 10), fixtureUser]);
  await pool.query('INSERT INTO "Dataset" (id, "userId", name, "fileName", "rowCount", "columnCount", "datasetType", "analysisStatus", "createdAt") VALUES ($1,$2,$3,$4,1,1,$5,$6,NOW()), ($7,$8,$9,$10,1,1,$5,$6,NOW())',
    [`${fixtureUser}_dataset`, fixtureUser, "Owned synthetic dataset", "synthetic.csv", "standard", "completed", `${otherUser}_dataset`, otherUser, "Other synthetic dataset", "other.csv"]);

  const [{ NextRequest }, oauth, authorize, token, mcp, { encode }, { getDb }] = await Promise.all([
    import("next/server"), import("../../src/lib/chatgpt/oauth"),
    import("../../src/app/api/chatgpt/oauth/authorize/route"),
    import("../../src/app/api/chatgpt/oauth/token/route"),
    import("../../src/app/api/chatgpt/mcp/route"), import("next-auth/jwt"), import("../../src/lib/db"),
  ]);
  applicationPool = (getDb() as unknown as { $client: { end(): Promise<void> } }).$client;
  const verifier = randomBytes(32).toString("base64url");
  const authorizationUrl = new URL("https://app.useclevr.com/api/chatgpt/oauth/authorize");
  for (const [key, value] of Object.entries({
    response_type: "code", client_id: clientId, redirect_uri: redirectUri,
    code_challenge: oauth.createPkceS256Challenge(verifier), code_challenge_method: "S256",
    scope: "dataset:read dataset:write", resource, state: "isolated state+bytes",
  })) authorizationUrl.searchParams.set(key, value);
  const authorizeRequest = (url = authorizationUrl) => new NextRequest(url);
  const check = async (name: string, run: () => Promise<void>) => {
    await run(); passed++; console.log(`PASS ${name}`);
  };
  const loggedIn = async (userId: string) => {
    const cookieName = "__Secure-authjs.session-token";
    const session = await encode({
      token: { id: userId, email: "oauth@example.test", name: "Synthetic session", role: "user" },
      secret: sessionSecret, salt: cookieName, maxAge: 3600,
    });
    requestHeaders.set("cookie", `${cookieName}=${session}`);
  };
  const consentRequest = (consentToken: string, approved = "yes") => new NextRequest(authorizationUrl, {
    method: "POST", body: new URLSearchParams({ consentToken, approved }),
  });
  const getConsent = async () => {
    const response = await authorize.GET(authorizeRequest());
    assert.equal(response.status, 200);
    const html = await response.text();
    const consentToken = html.match(/name="consentToken" value="([^"]+)"/)?.[1];
    assert.ok(consentToken); return consentToken;
  };
  const grant = async () => {
    const response = await authorize.POST(consentRequest(await getConsent()));
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.origin + location.pathname, redirectUri);
    assert.equal(location.searchParams.get("iss"), process.env.AUTH_URL);
    assert.equal(location.searchParams.get("state"), "isolated state+bytes");
    const code = location.searchParams.get("code"); assert.ok(code); return code;
  };
  const exchange = (code: string, overrides: Record<string, string> = {}) => token.POST(new NextRequest(
    "https://app.useclevr.com/api/chatgpt/oauth/token", {
      method: "POST", body: new URLSearchParams({
        grant_type: "authorization_code", code, client_id: clientId, redirect_uri: redirectUri,
        code_verifier: verifier, resource, ...overrides,
      }),
    },
  ));
  const rpc = (accessToken: string, method: string, params?: unknown) => mcp.POST(new NextRequest(resource, {
    method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
  }));

  await check("CIMD is fetched and plural methods negotiate none despite the legacy private_key_jwt preference", async () => {
    const before = metadataFetches;
    const parsed = await oauth.validateAuthorizationRequest(authorizeRequest());
    assert.equal(metadataFetches, before + 1); assert.equal(parsed.clientId, clientId);
  });
  for (const [name, metadata] of [
    ["mismatched client_id", { ...validMetadata, client_id: "https://chatgpt.com/oauth/other.json" }],
    ["missing client_name", { ...validMetadata, client_name: "" }],
    ["redirect not bound to client", { ...validMetadata, redirect_uris: [otherRedirect] }],
    ["incompatible token authentication", { ...validMetadata, token_endpoint_auth_methods_supported: ["private_key_jwt"] }],
    ["unsupported grant", { ...validMetadata, grant_types: ["client_credentials"] }],
    ["unsupported response type", { ...validMetadata, response_types: ["token"] }],
  ] as const) await check(`reject ${name}`, async () => {
    metadataResponse = () => Response.json(metadata);
    await assert.rejects(() => oauth.validateAuthorizationRequest(authorizeRequest()));
    metadataResponse = () => Response.json(validMetadata);
  });
  for (const [name, response] of [
    ["metadata redirect", () => new Response(null, { status: 302, headers: { location: "https://internal.invalid" } })],
    ["metadata HTTP failure", () => new Response(null, { status: 503 })],
    ["invalid JSON", () => new Response("{", { headers: { "content-type": "application/json" } })],
    ["oversized metadata stream", () => new Response(" ".repeat(65537), { headers: { "content-type": "application/json" } })],
    ["non-JSON content", () => new Response("<html>login</html>")],
    ["fetch timeout", () => { throw new DOMException("fixture timeout", "TimeoutError"); }],
  ] as const) await check(`reject ${name}`, async () => {
    metadataResponse = response;
    await assert.rejects(() => oauth.validateAuthorizationRequest(authorizeRequest()));
    metadataResponse = () => Response.json(validMetadata);
  });
  await check("reject private metadata URL before fetching even when allowlisted", async () => {
    const before = metadataFetches;
    const url = new URL(authorizationUrl); url.searchParams.set("client_id", "https://127.0.0.1/client.json");
    process.env.CHATGPT_MCP_ALLOWED_CLIENT_IDS = "https://127.0.0.1/client.json";
    await assert.rejects(() => oauth.validateAuthorizationRequest(authorizeRequest(url)));
    assert.equal(metadataFetches, before); process.env.CHATGPT_MCP_ALLOWED_CLIENT_IDS = clientId;
  });
  await check("production fails closed without the configured client allowlist", async () => {
    Object.assign(process.env, { NODE_ENV: "production" }); delete process.env.CHATGPT_MCP_ALLOWED_CLIENT_IDS;
    await assert.rejects(() => oauth.validateAuthorizationRequest(authorizeRequest()));
    Object.assign(process.env, { NODE_ENV: "test" }); process.env.CHATGPT_MCP_ALLOWED_CLIENT_IDS = clientId;
  });
  await check("reject malformed PKCE and plain challenge method", async () => {
    for (const [key, value] of [["code_challenge", "short"], ["code_challenge_method", "plain"]]) {
      const url = new URL(authorizationUrl); url.searchParams.set(key!, value!);
      await assert.rejects(() => oauth.validateAuthorizationRequest(authorizeRequest(url)), /PKCE S256/);
    }
  });
  await check("unauthenticated login handover retains the complete authorization request", async () => {
    const response = await authorize.GET(authorizeRequest()); assert.equal(response.status, 307);
    const login = new URL(response.headers.get("location")!); assert.equal(login.pathname, "/login");
    assert.equal(login.searchParams.get("callbackUrl"), authorizationUrl.pathname + authorizationUrl.search);
  });
  await check("real password and email-proof login returns the OAuth callback and a verified Auth.js session", async () => {
    const email = "oauth-a@example.test";
    const emailCode = "123456";
    await pool.query('INSERT INTO "EmailVerificationCode" (id, "userId", email, purpose, "codeHash", "expiresAt", attempts, "createdAt") VALUES ($1,$2,$3,$4,$5,NOW()+INTERVAL \'10 minutes\',0,NOW())',
      [randomUUID(), fixtureUser, email, "login", await bcrypt.hash(`${email}:login:${emailCode}`, 10)]);
    const { verifyEmailCode } = await import("../../src/lib/auth/email-verification-codes");
    const verification = await verifyEmailCode({ email, code: emailCode, purpose: "login" });
    assert.equal(verification.success, true);
    assert.ok(verification.success);
    const { handlers } = await import("../../src/lib/auth/auth");
    const csrfResponse = await handlers.GET(new NextRequest("https://app.useclevr.com/api/auth/csrf"));
    assert.equal(csrfResponse.status, 200);
    const { csrfToken } = await csrfResponse.json();
    const csrfCookies = csrfResponse.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
    const login = (password: string) => handlers.POST(new NextRequest("https://app.useclevr.com/api/auth/callback/credentials", {
      method: "POST", headers: { cookie: csrfCookies },
      body: new URLSearchParams({ csrfToken, email, password, verificationProof: verification.proof,
        verificationPurpose: "login", callbackUrl: authorizationUrl.toString() }),
    }));
    const wrong = await login("incorrect-synthetic-password");
    assert.ok(!wrong.headers.getSetCookie().some((cookie) => cookie.startsWith("__Secure-authjs.session-token=")));
    const response = await login(fixturePassword);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), authorizationUrl.toString());
    const sessionCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("__Secure-authjs.session-token="));
    assert.ok(sessionCookie, "Password login must issue its own real Auth.js session cookie");
    requestHeaders.set("cookie", sessionCookie.split(";")[0]!);
  });
  await check("real Auth.js test session renders consent for the isolated user", async () => {
    const consent = await getConsent();
    const parsed = oauth.verifyConsentToken(consent, fixtureUser); assert.equal(parsed.clientId, clientId);
  });
  await check("cancel consent returns access_denied without issuing a code", async () => {
    const response = await authorize.POST(consentRequest(await getConsent(), "no")); assert.equal(response.status, 303);
    const url = new URL(response.headers.get("location")!); assert.equal(url.searchParams.get("error"), "access_denied");
    assert.equal(url.searchParams.get("code"), null);
    assert.equal((await pool.query('SELECT * FROM "ChatGptMcpOAuthCode"')).rowCount, 0);
  });
  await check("reject altered, expired, and cross-session consent", async () => {
    const consent = await getConsent();
    assert.equal((await authorize.POST(consentRequest(`altered.${consent.split(".")[1]}`))).status, 400);
    const payload = JSON.parse(Buffer.from(consent.split(".")[0]!, "base64url").toString()); payload.exp = 0;
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const expired = `${body}.${createHmac("sha256", sessionSecret).update(body).digest("base64url")}`;
    assert.equal((await authorize.POST(consentRequest(expired))).status, 400);
    await loggedIn(otherUser);
    const crossedSession = await authorize.POST(consentRequest(consent));
    assert.equal(crossedSession.status, 400);
    assert.equal((await crossedSession.json()).error, "access_denied");
    await loggedIn(fixtureUser);
  });
  await check("metadata withdrawal between consent and grant fails closed", async () => {
    const consent = await getConsent(); metadataResponse = () => Response.json({ ...validMetadata, redirect_uris: [otherRedirect] });
    assert.equal((await authorize.POST(consentRequest(consent))).status, 400);
    metadataResponse = () => Response.json(validMetadata);
  });
  let accessToken = "";
  await check("consent issues a hashed code; S256 exchange returns a bound RS256 access token", async () => {
    const code = await grant();
    const rows = await pool.query('SELECT * FROM "ChatGptMcpOAuthCode" WHERE "codeHash"=$1', [createHash("sha256").update(code).digest("hex")]);
    assert.equal(rows.rowCount, 1); assert.equal(rows.rows[0].userId, fixtureUser); assert.notEqual(rows.rows[0].codeHash, code);
    const response = await exchange(code); assert.equal(response.status, 200);
    const result = await response.json(); accessToken = result.access_token; assert.equal(result.token_type, "Bearer");
    const verified = await oauth.verifyChatGptAccessToken(new NextRequest(resource, { headers: { authorization: `Bearer ${accessToken}` } }));
    assert.equal(verified.userId, fixtureUser); assert.equal(verified.clientId, clientId);
    assert.deepEqual(verified.scopes, ["dataset:read", "dataset:write"]);
    assert.equal((await exchange(code)).status, 400);
  });
  await check("reject wrong verifier, client, callback, and resource without consuming the valid code", async () => {
    const code = await grant();
    const bindingOverrides: Array<Record<string, string>> = [
      { code_verifier: randomBytes(32).toString("base64url") }, { client_id: "wrong-isolated-client" },
      { redirect_uri: otherRedirect }, { resource: "https://app.useclevr.com/other-resource" },
    ];
    for (const overrides of bindingOverrides) assert.equal((await exchange(code, overrides)).status, 400);
    assert.equal((await exchange(code)).status, 200);
  });
  await check("concurrent code exchanges have exactly one winner", async () => {
    const code = await grant();
    // Hold the first UPDATE briefly so both requests can read the unused code.
    // This reproduces the SELECT-then-unconditional-UPDATE race deterministically.
    await pool.query(`CREATE OR REPLACE FUNCTION oauth_test_delay() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.2); RETURN NEW; END $$`);
    await pool.query('CREATE TRIGGER oauth_test_delay BEFORE UPDATE ON "ChatGptMcpOAuthCode" FOR EACH ROW EXECUTE FUNCTION oauth_test_delay()');
    try {
      const responses = await Promise.all([exchange(code), exchange(code)]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
    } finally {
      await pool.query('DROP TRIGGER oauth_test_delay ON "ChatGptMcpOAuthCode"');
      await pool.query('DROP FUNCTION oauth_test_delay()');
    }
  });
  await check("expired code cannot be exchanged", async () => {
    const code = await grant();
    await pool.query('UPDATE "ChatGptMcpOAuthCode" SET "expiresAt"=NOW()-INTERVAL \'1 minute\' WHERE "codeHash"=$1', [createHash("sha256").update(code).digest("hex")]);
    assert.equal((await exchange(code)).status, 400);
  });
  await check("OAuth token lists MCP tools and only the connected user's synthetic datasets", async () => {
    requestHeaders.delete("cookie");
    assert.equal((await rpc(accessToken, "tools/list")).status, 200);
    const response = await rpc(accessToken, "tools/call", { name: "useclevr_list_datasets", arguments: {} });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.result.structuredContent.datasets.map((dataset: { id: string }) => dataset.id), [`${fixtureUser}_dataset`]);
    const denied = await rpc(accessToken, "tools/call", { name: "useclevr_analyze_dataset", arguments: { datasetId: `${otherUser}_dataset` } });
    assert.equal(denied.status, 403);
    assert.equal((await rpc("invalid-bearer", "tools/list")).status, 401);
  });
  console.log(`OAuth-to-MCP isolated integration: ${passed} checks passed; no production connections.`);
}

main().finally(async () => {
  globalThis.fetch = originalFetch;
  await Promise.all([applicationPool?.end(), pool.end()]);
}).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
