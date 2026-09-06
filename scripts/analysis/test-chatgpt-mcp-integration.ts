import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

const MCP_WWW_AUTHENTICATE_META_KEY = "mcp/www_authenticate";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.CHATGPT_MCP_OAUTH_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
process.env.CHATGPT_MCP_OAUTH_KEY_ID = "test-chatgpt-mcp-key";
process.env.CHATGPT_MCP_OAUTH_ISSUER = "https://app.useclevr.com";
process.env.CHATGPT_MCP_RESOURCE_URL = "https://app.useclevr.com/api/chatgpt/mcp";
process.env.CHATGPT_MCP_ALLOWED_CLIENT_IDS = "https://chatgpt.com/useclevr-client.json";
process.env.CHATGPT_MCP_ALLOWED_REDIRECT_URIS = "https://chatgpt.com/connector_platform_oauth_redirect";
process.env.AUTH_SECRET ||= "test-chatgpt-mcp-auth-secret";
process.env.NEXTAUTH_SECRET ||= "test-chatgpt-mcp-auth-secret";

async function main() {
  const [
    { GET: getAuthorizationServer },
    { GET: getProtectedResource },
    { GET: getMcp, POST: postMcp },
    {
      createPkceS256Challenge,
      issueChatGptAccessToken,
      validateAuthorizationRequest,
      verifyChatGptAccessToken,
      verifyPkceS256,
    },
    { getDb },
    { datasetRows, datasets, users },
    { default: proxy },
    { NextRequest },
    { eq },
  ] = await Promise.all([
    import("../../src/app/.well-known/oauth-authorization-server/route"),
    import("../../src/app/.well-known/oauth-protected-resource/route"),
    import("../../src/app/api/chatgpt/mcp/route"),
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
  assert.equal(metadata.resource, "https://app.useclevr.com/api/chatgpt/mcp");
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
  assert.ok(authorizationServer.code_challenge_methods_supported.includes("S256"));

  const codeVerifier = "A".repeat(43);
  const codeChallenge = createPkceS256Challenge(codeVerifier);
  assert.equal(verifyPkceS256(codeVerifier, codeChallenge), true);
  assert.equal(verifyPkceS256("B".repeat(43), codeChallenge), false);

  const authorizationRequestUrl = new URL("https://app.useclevr.com/api/chatgpt/oauth/authorize");
  authorizationRequestUrl.searchParams.set("response_type", "code");
  authorizationRequestUrl.searchParams.set("client_id", "https://chatgpt.com/useclevr-client.json");
  authorizationRequestUrl.searchParams.set("redirect_uri", "https://chatgpt.com/connector_platform_oauth_redirect");
  authorizationRequestUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationRequestUrl.searchParams.set("code_challenge_method", "S256");
  authorizationRequestUrl.searchParams.set("scope", "dataset:read dataset:write");
  authorizationRequestUrl.searchParams.set("resource", "https://app.useclevr.com/api/chatgpt/mcp");
  authorizationRequestUrl.searchParams.set("state", "test-state");
  const parsedAuthorization = validateAuthorizationRequest(new NextRequest(authorizationRequestUrl));
  assert.equal(parsedAuthorization.clientId, "https://chatgpt.com/useclevr-client.json");
  assert.deepEqual(parsedAuthorization.scopes, ["dataset:read", "dataset:write"]);

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
    clientId: "https://chatgpt.com/useclevr-client.json",
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
      clientId: "https://chatgpt.com/useclevr-client.json",
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
