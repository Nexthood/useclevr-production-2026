import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";

const MCP_WWW_AUTHENTICATE_META_KEY = "mcp/www_authenticate";
const CHATGPT_CIMD_CLIENT_ID = "https://chatgpt.com/oauth/client.json";
const CHATGPT_REDIRECT_URI = "https://chatgpt.com/connector_platform_oauth_redirect";
const CHATGPT_MCP_RESOURCE = "https://app.useclevr.com/api/chatgpt/mcp";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.CHATGPT_MCP_OAUTH_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
process.env.CHATGPT_MCP_OAUTH_KEY_ID = "test-chatgpt-mcp-key";
process.env.CHATGPT_MCP_OAUTH_ISSUER = "https://app.useclevr.com";
process.env.CHATGPT_MCP_RESOURCE_URL = CHATGPT_MCP_RESOURCE;
process.env.CHATGPT_MCP_ALLOWED_CLIENT_IDS = CHATGPT_CIMD_CLIENT_ID;
process.env.CHATGPT_MCP_ALLOWED_REDIRECT_URIS = CHATGPT_REDIRECT_URI;
process.env.AUTH_SECRET ||= "test-chatgpt-mcp-auth-secret";
process.env.NEXTAUTH_SECRET ||= "test-chatgpt-mcp-auth-secret";

async function main() {
  const [
    { GET: getAuthorizationServer },
    { GET: getProtectedResource },
    { GET: getMcp, POST: postMcp },
    { POST: postOAuthToken },
    {
      CHATGPT_OAUTH_CONSENT_REDIRECT_STATUS,
      buildChatGptAuthorizationResponseRedirect,
      createChatGptAuthorizationCode,
      createConsentToken,
      createPkceS256Challenge,
      issueChatGptAccessToken,
      validateAuthorizationRequest,
      verifyChatGptAccessToken,
      verifyConsentToken,
      verifyPkceS256,
    },
    { getDb },
    { chatGptMcpOAuthCodes, datasetRows, datasets, users },
    { default: proxy },
    { NextRequest, NextResponse },
    { eq },
  ] = await Promise.all([
    import("../../src/app/.well-known/oauth-authorization-server/route"),
    import("../../src/app/.well-known/oauth-protected-resource/route"),
    import("../../src/app/api/chatgpt/mcp/route"),
    import("../../src/app/api/chatgpt/oauth/token/route"),
    import("../../src/lib/chatgpt/oauth"),
    import("../../src/lib/db"),
    import("../../src/lib/db/schema"),
    import("../../src/proxy"),
    import("next/server"),
    import("drizzle-orm"),
  ]);

  const proxyResponse = proxy(
    new NextRequest("https://mcp-test.useclevr.com/api/chatgpt/mcp", {
      method: "POST",
      headers: { host: "mcp-test.useclevr.com" },
    }),
  );
  assert.notEqual(proxyResponse.status, 404);

  const blockedProxyResponse = proxy(
    new NextRequest("https://mcp-test.useclevr.com/app/dashboard", {
      method: "GET",
      headers: { host: "mcp-test.useclevr.com" },
    }),
  );
  assert.equal(blockedProxyResponse.status, 404);

  const oauthProxyResponse = proxy(
    new NextRequest("https://mcp-test.useclevr.com/api/chatgpt/oauth/authorize", {
      method: "GET",
      headers: { host: "mcp-test.useclevr.com" },
    }),
  );
  assert.notEqual(oauthProxyResponse.status, 404);

  const webAuthProxyResponse = proxy(
    new NextRequest("https://app.useclevr.com/api/auth/session", {
      method: "GET",
      headers: { host: "app.useclevr.com" },
    }),
  );
  assert.notEqual(webAuthProxyResponse.status, 401);

  const metadataResponse = await getProtectedResource(
    new NextRequest("https://app.useclevr.com/.well-known/oauth-protected-resource"),
  );
  assert.equal(metadataResponse.status, 200);
  const metadata = await metadataResponse.json();
  assert.equal(metadata.resource, CHATGPT_MCP_RESOURCE);
  assert.deepEqual(metadata.bearer_methods_supported, ["header"]);
  assert.ok(metadata.scopes_supported.includes("dataset:read"));
  assert.deepEqual(metadata.authorization_servers, ["https://app.useclevr.com"]);
  assert.equal(metadata.resource_documentation, "https://useclevr.com/security");

  const authorizationServerResponse = await getAuthorizationServer(
    new NextRequest("https://app.useclevr.com/.well-known/oauth-authorization-server"),
  );
  assert.equal(authorizationServerResponse.status, 200);
  const authorizationServer = await authorizationServerResponse.json();
  assert.equal(authorizationServer.issuer, "https://app.useclevr.com");
  assert.equal(authorizationServer.token_endpoint_auth_methods_supported[0], "none");
  assert.equal(authorizationServer.authorization_response_iss_parameter_supported, true);
  assert.equal(authorizationServer.client_id_metadata_document_supported, true);
  assert.ok(authorizationServer.code_challenge_methods_supported.includes("S256"));

  const codeVerifier = "A".repeat(43);
  const codeChallenge = createPkceS256Challenge(codeVerifier);
  assert.equal(verifyPkceS256(codeVerifier, codeChallenge), true);
  assert.equal(verifyPkceS256("B".repeat(43), codeChallenge), false);

  const rawState = "test-state%20with%2bencoded%3Dbytes";
  const authorizationRequestUrl = new URL(
    `https://app.useclevr.com/api/chatgpt/oauth/authorize?${[
      ["response_type", "code"],
      ["client_id", CHATGPT_CIMD_CLIENT_ID],
      ["redirect_uri", CHATGPT_REDIRECT_URI],
      ["code_challenge", codeChallenge],
      ["code_challenge_method", "S256"],
      ["scope", "dataset:read dataset:write"],
      ["resource", CHATGPT_MCP_RESOURCE],
    ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}&state=${rawState}`,
  );
  const parsedAuthorization = validateAuthorizationRequest(new NextRequest(authorizationRequestUrl));
  assert.equal(parsedAuthorization.clientId, CHATGPT_CIMD_CLIENT_ID);
  assert.equal(parsedAuthorization.redirectUri, CHATGPT_REDIRECT_URI);
  assert.equal(parsedAuthorization.resource, CHATGPT_MCP_RESOURCE);
  assert.equal(parsedAuthorization.codeChallenge, codeChallenge);
  assert.equal(parsedAuthorization.codeChallengeMethod, "S256");
  assert.equal(parsedAuthorization.state, "test-state with+encoded=bytes");
  assert.equal(parsedAuthorization.stateParam, rawState);
  assert.deepEqual(parsedAuthorization.scopes, ["dataset:read", "dataset:write"]);
  const consentAuthorization = verifyConsentToken(
    createConsentToken("chatgpt_mcp_consent_user", parsedAuthorization),
    "chatgpt_mcp_consent_user",
  );
  const authorizationRedirect = buildChatGptAuthorizationResponseRedirect({
    request: new NextRequest("https://app.useclevr.com/api/chatgpt/oauth/authorize"),
    authorization: consentAuthorization,
    code: "test-code",
  });
  const allowRedirectResponse = NextResponse.redirect(
    authorizationRedirect,
    CHATGPT_OAUTH_CONSENT_REDIRECT_STATUS,
  );
  assert.equal(CHATGPT_OAUTH_CONSENT_REDIRECT_STATUS, 303);
  assert.equal(allowRedirectResponse.status, 303);
  const allowLocation = new URL(requireHeader(allowRedirectResponse, "location"));
  assert.equal(allowLocation.origin + allowLocation.pathname, CHATGPT_REDIRECT_URI);
  assert.equal(allowLocation.searchParams.get("code"), "test-code");
  assert.equal(allowLocation.searchParams.get("iss"), "https://app.useclevr.com");
  assert.match(allowLocation.toString(), new RegExp(`[?&]state=${rawState}(?:&|$)`));

  const cancelRedirectResponse = NextResponse.redirect(
    buildChatGptAuthorizationResponseRedirect({
      request: new NextRequest("https://app.useclevr.com/api/chatgpt/oauth/authorize"),
      authorization: consentAuthorization,
      error: "access_denied",
    }),
    CHATGPT_OAUTH_CONSENT_REDIRECT_STATUS,
  );
  assert.equal(cancelRedirectResponse.status, 303);
  const cancelLocation = new URL(requireHeader(cancelRedirectResponse, "location"));
  assert.equal(cancelLocation.origin + cancelLocation.pathname, CHATGPT_REDIRECT_URI);
  assert.equal(cancelLocation.searchParams.get("error"), "access_denied");
  assert.equal(cancelLocation.searchParams.get("iss"), "https://app.useclevr.com");
  assert.match(cancelLocation.toString(), new RegExp(`[?&]state=${rawState}(?:&|$)`));
  await assertPost303RedirectUsesGet();

  const wrongPkceMethodUrl = new URL(authorizationRequestUrl);
  wrongPkceMethodUrl.searchParams.set("code_challenge_method", "plain");
  assert.throws(() => validateAuthorizationRequest(new NextRequest(wrongPkceMethodUrl)), /PKCE S256/);

  const unauthorizedGet = await getMcp(
    new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
      method: "GET",
    }),
  );
  assert.equal(unauthorizedGet.status, 401);
  assertMcpAuthChallenge(unauthorizedGet, await unauthorizedGet.json(), "invalid_token");

  const unauthorizedPost = await postMcp(
    new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    }),
  );
  assert.equal(unauthorizedPost.status, 401);
  assertMcpAuthChallenge(unauthorizedPost, await unauthorizedPost.json(), "invalid_token");

  const invalidBearerResponse = await postMcp(
    new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer malformed-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "invalid-bearer",
        method: "tools/list",
      }),
    }),
  );
  assert.equal(invalidBearerResponse.status, 401);
  assertMcpAuthChallenge(invalidBearerResponse, await invalidBearerResponse.json(), "invalid_token");

  const validToken = await issueChatGptAccessToken({
    request: new NextRequest("https://app.useclevr.com/api/chatgpt/mcp"),
    userId: "chatgpt_mcp_valid_user",
    scopes: ["dataset:read", "dataset:write"],
    clientId: CHATGPT_CIMD_CLIENT_ID,
  });
  const validAuth = await verifyChatGptAccessToken(
    new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
      headers: { authorization: `Bearer ${validToken}` },
    }),
  );
  assert.equal(validAuth.userId, "chatgpt_mcp_valid_user");
  assert.ok(validAuth.scopes.includes("dataset:read"));

  const validListResponse = await postMcp(
    new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${validToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      }),
    }),
  );
  assert.equal(validListResponse.status, 200);

  const expiredToken = await issueChatGptAccessToken({
    request: new NextRequest("https://app.useclevr.com/api/chatgpt/mcp"),
    userId: "chatgpt_mcp_valid_user",
    scopes: ["dataset:read"],
    expiresInSeconds: -120,
  });
  await assert.rejects(
    () => verifyChatGptAccessToken(new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
      headers: { authorization: `Bearer ${expiredToken}` },
    })),
    /expired/,
  );

  const wrongResourceToken = await issueChatGptAccessToken({
    request: new NextRequest("https://app.useclevr.com/api/chatgpt/mcp"),
    userId: "chatgpt_mcp_valid_user",
    scopes: ["dataset:read"],
    resource: "https://app.useclevr.com/api/other-mcp",
  });
  await assert.rejects(
    () => verifyChatGptAccessToken(new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
      headers: { authorization: `Bearer ${wrongResourceToken}` },
    })),
    /audience|resource/,
  );

  const readOnlyToken = await issueChatGptAccessToken({
    request: new NextRequest("https://app.useclevr.com/api/chatgpt/mcp"),
    userId: "chatgpt_mcp_valid_user",
    scopes: ["dataset:read"],
  });
  await assert.rejects(
    () => verifyChatGptAccessToken(
      new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
        headers: { authorization: `Bearer ${readOnlyToken}` },
      }),
      ["dataset:write"],
    ),
    /scope/,
  );

  const insufficientScopeResponse = await postMcp(
    new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${readOnlyToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "insufficient-scope",
        method: "tools/call",
        params: {
          name: "useclevr_upload_dataset",
          arguments: {
            fileName: "scope-check.csv",
            fileBase64: "Y29sCnZhbHVlCg==",
          },
        },
      }),
    }),
  );
  assert.equal(insufficientScopeResponse.status, 403);
  assertMcpAuthChallenge(
    insufficientScopeResponse,
    await insufficientScopeResponse.json(),
    "insufficient_scope",
  );

  await assert.rejects(
    () => verifyChatGptAccessToken(new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
      headers: { authorization: "Bearer malformed-token" },
    })),
    /malformed/,
  );

  const db = getDb();
  assert.ok(db, "DATABASE_URL is required for ChatGPT MCP tenant isolation smoke coverage.");
  const oauthUserId = `chatgpt_mcp_oauth_user_${Date.now()}`;
  try {
    const authorizationCode = await createChatGptAuthorizationCode(oauthUserId, parsedAuthorization);
    const tokenParams = new URLSearchParams();
    tokenParams.set("grant_type", "authorization_code");
    tokenParams.set("code", authorizationCode);
    tokenParams.set("redirect_uri", CHATGPT_REDIRECT_URI);
    tokenParams.set("client_id", CHATGPT_CIMD_CLIENT_ID);
    tokenParams.set("code_verifier", codeVerifier);

    const tokenResponse = await postOAuthToken(
      new NextRequest("https://app.useclevr.com/api/chatgpt/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      }),
    );
    assert.equal(tokenResponse.status, 200);
    const tokenBody = await tokenResponse.json();
    assert.equal(tokenBody.token_type, "Bearer");
    assert.equal(tokenBody.scope, "dataset:read dataset:write");
    assert.equal(typeof tokenBody.access_token, "string");
    const tokenAuth = await verifyChatGptAccessToken(
      new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
        headers: { authorization: `Bearer ${tokenBody.access_token}` },
      }),
    );
    assert.equal(tokenAuth.userId, oauthUserId);
    assert.equal(tokenAuth.clientId, CHATGPT_CIMD_CLIENT_ID);

    const reusedCodeResponse = await postOAuthToken(
      new NextRequest("https://app.useclevr.com/api/chatgpt/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      }),
    );
    assert.equal(reusedCodeResponse.status, 400);
    assert.equal((await reusedCodeResponse.json()).error, "invalid_grant");

    const wrongClientCode = await createChatGptAuthorizationCode(oauthUserId, parsedAuthorization);
    const wrongClientParams = new URLSearchParams(tokenParams);
    wrongClientParams.set("code", wrongClientCode);
    wrongClientParams.set("client_id", "https://chatgpt.com/oauth/other-client.json");
    const wrongClientResponse = await postOAuthToken(
      new NextRequest("https://app.useclevr.com/api/chatgpt/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: wrongClientParams.toString(),
      }),
    );
    assert.equal(wrongClientResponse.status, 400);
    assert.equal((await wrongClientResponse.json()).error, "invalid_grant");

    const wrongRedirectCode = await createChatGptAuthorizationCode(oauthUserId, parsedAuthorization);
    const wrongRedirectParams = new URLSearchParams(tokenParams);
    wrongRedirectParams.set("code", wrongRedirectCode);
    wrongRedirectParams.set("redirect_uri", "https://chatgpt.com/connector/oauth/other-callback");
    const wrongRedirectResponse = await postOAuthToken(
      new NextRequest("https://app.useclevr.com/api/chatgpt/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: wrongRedirectParams.toString(),
      }),
    );
    assert.equal(wrongRedirectResponse.status, 400);
    assert.equal((await wrongRedirectResponse.json()).error, "invalid_grant");

    const wrongVerifierCode = await createChatGptAuthorizationCode(oauthUserId, parsedAuthorization);
    const wrongVerifierParams = new URLSearchParams(tokenParams);
    wrongVerifierParams.set("code", wrongVerifierCode);
    wrongVerifierParams.set("code_verifier", "B".repeat(43));
    const wrongVerifierResponse = await postOAuthToken(
      new NextRequest("https://app.useclevr.com/api/chatgpt/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: wrongVerifierParams.toString(),
      }),
    );
    assert.equal(wrongVerifierResponse.status, 400);
    assert.equal((await wrongVerifierResponse.json()).error, "invalid_grant");

    const wrongResourceCode = await createChatGptAuthorizationCode(oauthUserId, parsedAuthorization);
    const wrongResourceParams = new URLSearchParams(tokenParams);
    wrongResourceParams.set("code", wrongResourceCode);
    wrongResourceParams.set("resource", "https://app.useclevr.com/api/other-mcp");
    const wrongResourceResponse = await postOAuthToken(
      new NextRequest("https://app.useclevr.com/api/chatgpt/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: wrongResourceParams.toString(),
      }),
    );
    assert.equal(wrongResourceResponse.status, 400);
    assert.equal((await wrongResourceResponse.json()).error, "invalid_target");

    const omittedResourceCode = await createChatGptAuthorizationCode(oauthUserId, parsedAuthorization);
    const omittedResourceParams = new URLSearchParams(tokenParams);
    omittedResourceParams.set("code", omittedResourceCode);
    omittedResourceParams.delete("resource");
    const omittedResourceResponse = await postOAuthToken(
      new NextRequest("https://app.useclevr.com/api/chatgpt/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: omittedResourceParams.toString(),
      }),
    );
    assert.equal(omittedResourceResponse.status, 200);
    assert.equal((await omittedResourceResponse.json()).token_type, "Bearer");

    const expiredCode = await createChatGptAuthorizationCode(oauthUserId, parsedAuthorization);
    await db.update(chatGptMcpOAuthCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(chatGptMcpOAuthCodes.userId, oauthUserId));
    const expiredParams = new URLSearchParams(tokenParams);
    expiredParams.set("code", expiredCode);
    const expiredCodeResponse = await postOAuthToken(
      new NextRequest("https://app.useclevr.com/api/chatgpt/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: expiredParams.toString(),
      }),
    );
    assert.equal(expiredCodeResponse.status, 400);
    assert.equal((await expiredCodeResponse.json()).error, "invalid_grant");
  } finally {
    await db.delete(chatGptMcpOAuthCodes).where(eq(chatGptMcpOAuthCodes.userId, oauthUserId));
  }

  const userAId = `chatgpt_mcp_user_a_${Date.now()}`;
  const userBId = `chatgpt_mcp_user_b_${Date.now()}`;
  const datasetBId = `chatgpt_mcp_dataset_b_${Date.now()}`;
  try {
    await db.insert(users).values([
      {
        id: userAId,
        email: `${userAId}@example.test`,
        name: "ChatGPT MCP User A",
      },
      {
        id: userBId,
        email: `${userBId}@example.test`,
        name: "ChatGPT MCP User B",
      },
    ]);
    await db.insert(datasets).values({
      id: datasetBId,
      userId: userBId,
      name: "ChatGPT MCP Tenant Isolation Dataset",
      fileName: "tenant-isolation.csv",
      rowCount: 1,
      columnCount: 2,
      columns: ["revenue", "cost"],
      data: [{ revenue: 100, cost: 40 }],
      analysisStatus: "completed",
      status: "completed",
      analysis: {},
    });
    await db.insert(datasetRows).values({
      id: `${datasetBId}_row_0`,
      datasetId: datasetBId,
      rowIndex: 0,
      data: { revenue: 100, cost: 40 },
    });

    const userAToken = await issueChatGptAccessToken({
      request: new NextRequest("https://app.useclevr.com/api/chatgpt/mcp"),
      userId: userAId,
      scopes: ["dataset:read"],
      clientId: CHATGPT_CIMD_CLIENT_ID,
    });
    const crossTenantResponse = await postMcp(
      new NextRequest("https://app.useclevr.com/api/chatgpt/mcp", {
        method: "POST",
        headers: {
          authorization: `Bearer ${userAToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "useclevr_analyze_dataset",
            arguments: { datasetId: datasetBId },
          },
        }),
      }),
    );
    assert.equal(crossTenantResponse.status, 403);
    const crossTenantBody = await crossTenantResponse.json();
    assert.equal(crossTenantBody.error.code, -32003);
  } finally {
    await db.delete(datasetRows).where(eq(datasetRows.datasetId, datasetBId));
    await db.delete(datasets).where(eq(datasets.id, datasetBId));
    await db.delete(users).where(eq(users.id, userAId));
    await db.delete(users).where(eq(users.id, userBId));
  }

  console.log("ChatGPT MCP OAuth integration test passed.");
  process.exit(0);
}

function assertMcpAuthChallenge(response: Response, body: unknown, expectedError: string) {
  const headerChallenge = response.headers.get("www-authenticate");
  assert.ok(headerChallenge, "WWW-Authenticate header is required.");
  assert.ok(headerChallenge.includes("resource_metadata=\"https://app.useclevr.com/.well-known/oauth-protected-resource\""));
  assert.ok(headerChallenge.includes(`error="${expectedError}"`));
  assert.ok(headerChallenge.includes("error_description="));

  const metaChallenge = readMcpAuthChallenge(body);
  assert.equal(metaChallenge, headerChallenge);
}

function readMcpAuthChallenge(body: unknown) {
  assert.ok(body && typeof body === "object", "MCP auth response body is required.");
  const record = body as Record<string, unknown>;
  const meta = record._meta || (record.result && typeof record.result === "object"
    ? (record.result as Record<string, unknown>)._meta
    : undefined);
  assert.ok(meta && typeof meta === "object", "MCP _meta is required.");
  const challenge = (meta as Record<string, unknown>)[MCP_WWW_AUTHENTICATE_META_KEY];
  assert.ok(Array.isArray(challenge), "mcp/www_authenticate must be an array.");
  assert.equal(challenge.length, 1);
  assert.equal(typeof challenge[0], "string");
  return challenge[0];
}

function requireHeader(response: Response, name: string) {
  const value = response.headers.get(name);
  assert.ok(value, `${name} header is required.`);
  return value;
}

async function assertPost303RedirectUsesGet() {
  const requests: Array<{ method?: string; url?: string }> = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    if (request.url?.startsWith("/start")) {
      const host = request.headers.host;
      response.writeHead(303, { Location: `http://${host}/callback?ok=1` });
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("ok");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object", "mock callback server must bind a port.");
    const response = await fetch(`http://127.0.0.1:${address.port}/start`, {
      method: "POST",
      body: "consent=approved",
      redirect: "follow",
    });
    assert.equal(response.status, 200);
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "/start");
    assert.equal(requests[1]?.method, "GET");
    assert.equal(requests[1]?.url, "/callback?ok=1");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
