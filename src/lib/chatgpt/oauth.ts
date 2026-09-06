import { auth } from "@/lib/auth/auth";
import { config } from "@/lib/config";
import { getDb } from "@/lib/db";
import { chatGptMcpOAuthCodes, type McpTokenScope } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  type KeyObject,
} from "node:crypto";
import type { NextRequest } from "next/server";

export const CHATGPT_MCP_REQUIRED_SCOPE: McpTokenScope = "dataset:read";
export const CHATGPT_MCP_SUPPORTED_SCOPES: McpTokenScope[] = ["dataset:read", "dataset:write"];

const DEFAULT_ACCESS_TOKEN_SECONDS = 60 * 60;
const AUTHORIZATION_CODE_SECONDS = 10 * 60;
const CONSENT_TOKEN_SECONDS = 10 * 60;
const CLOCK_SKEW_SECONDS = 60;
const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

type AuthorizationRequest = {
  responseType: "code";
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scopes: McpTokenScope[];
  state?: string;
  resource: string;
};

type AccessTokenClaims = {
  iss: string;
  sub: string;
  aud: string | string[];
  resource: string;
  scope: string;
  client_id?: string;
  iat: number;
  nbf?: number;
  exp: number;
  jti: string;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type SigningJwk = Record<string, unknown> & {
  kid: string;
  alg: "RS256";
  use: "sig";
};

export type VerifiedChatGptAccessToken = {
  userId: string;
  scopes: McpTokenScope[];
  tokenId: string;
  clientId?: string;
};

export class ChatGptOAuthError extends Error {
  status: number;
  code: string;

  constructor(code: string, description: string, status = 400) {
    super(description);
    this.name = "ChatGptOAuthError";
    this.code = code;
    this.status = status;
  }
}

export function getChatGptOAuthIssuer(request: NextRequest) {
  return trimTrailingSlash(process.env.CHATGPT_MCP_OAUTH_ISSUER || request.nextUrl.origin);
}

export function getChatGptMcpResource(request: NextRequest) {
  return process.env.CHATGPT_MCP_RESOURCE_URL ||
    new URL("/api/chatgpt/mcp", request.nextUrl.origin).toString();
}

export function getAuthorizationServerMetadata(request: NextRequest) {
  const issuer = getChatGptOAuthIssuer(request);
  return {
    issuer,
    authorization_endpoint: `${issuer}/api/chatgpt/oauth/authorize`,
    token_endpoint: `${issuer}/api/chatgpt/oauth/token`,
    jwks_uri: `${issuer}/api/chatgpt/oauth/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: CHATGPT_MCP_SUPPORTED_SCOPES,
    authorization_response_iss_parameter_supported: true,
    client_id_metadata_document_supported: true,
  };
}

export function getProtectedResourceMetadata(request: NextRequest) {
  const resource = getChatGptMcpResource(request);
  return {
    resource,
    resource_name: "UseClevr ChatGPT MCP",
    authorization_servers: [getChatGptOAuthIssuer(request)],
    bearer_methods_supported: ["header"],
    scopes_supported: CHATGPT_MCP_SUPPORTED_SCOPES,
    resource_documentation: process.env.CHATGPT_MCP_DOCUMENTATION_URL || "https://useclevr.com/security",
    documentation_uri: process.env.CHATGPT_MCP_DOCUMENTATION_URL || "https://useclevr.com/security",
  };
}

export function validateAuthorizationRequest(request: NextRequest): AuthorizationRequest {
  const params = request.nextUrl.searchParams;
  const responseType = params.get("response_type");
  if (responseType !== "code") {
    throw new ChatGptOAuthError("unsupported_response_type", "Only authorization code flow is supported.");
  }

  const clientId = requireParam(params, "client_id");
  if (!isAllowedClientId(clientId)) {
    throw new ChatGptOAuthError("unauthorized_client", "OAuth client is not allowed.");
  }

  const redirectUri = requireParam(params, "redirect_uri");
  if (!isAllowedRedirectUri(redirectUri)) {
    throw new ChatGptOAuthError("invalid_request", "OAuth redirect URI is not allowed.");
  }

  const codeChallenge = requireParam(params, "code_challenge");
  if (!codeChallenge || params.get("code_challenge_method") !== "S256") {
    throw new ChatGptOAuthError("invalid_request", "PKCE S256 is required.");
  }

  const resource = requireParam(params, "resource");
  if (resource !== getChatGptMcpResource(request)) {
    throw new ChatGptOAuthError("invalid_target", "OAuth resource does not match this MCP server.");
  }

  return {
    responseType: "code",
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod: "S256",
    scopes: parseRequestedScopes(params.get("scope")),
    state: params.get("state") || undefined,
    resource,
  };
}

export async function getChatGptConsentUser() {
  const session = await auth();
  return session?.user?.id
    ? {
        id: session.user.id,
        email: session.user.email || undefined,
        name: session.user.name || undefined,
      }
    : null;
}

export function buildLoginRedirect(request: NextRequest) {
  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return loginUrl;
}

export function createConsentToken(userId: string, authorization: AuthorizationRequest) {
  const payload = {
    userId,
    authorization,
    exp: Math.floor(Date.now() / 1000) + CONSENT_TOKEN_SECONDS,
  };
  const body = base64urlJson(payload);
  const signature = signHmac(body);
  return `${body}.${signature}`;
}

export function verifyConsentToken(token: string, userId: string): AuthorizationRequest {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) {
    throw new ChatGptOAuthError("invalid_request", "Consent token is malformed.");
  }
  assertTimingSafeEqual(signature, signHmac(body));
  const payload = parseBase64urlJson(body) as {
    userId?: unknown;
    authorization?: unknown;
    exp?: unknown;
  };
  if (payload.userId !== userId) {
    throw new ChatGptOAuthError("access_denied", "Consent session changed.");
  }
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new ChatGptOAuthError("invalid_request", "Consent token expired.");
  }
  return validateStoredAuthorizationRequest(payload.authorization);
}

export async function createChatGptAuthorizationCode(userId: string, authorization: AuthorizationRequest) {
  const db = getDb();
  if (!db) {
    throw new ChatGptOAuthError("server_error", "Database unavailable.", 500);
  }

  const code = randomBytes(32).toString("base64url");
  await db.insert(chatGptMcpOAuthCodes).values({
    id: randomUUID(),
    codeHash: hashSecret(code),
    userId,
    clientId: authorization.clientId,
    redirectUri: authorization.redirectUri,
    resource: authorization.resource,
    scopes: authorization.scopes,
    codeChallenge: authorization.codeChallenge,
    codeChallengeMethod: "S256",
    expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_SECONDS * 1000),
  });
  return code;
}

export async function consumeChatGptAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  codeVerifier: string;
}) {
  const db = getDb();
  if (!db) {
    throw new ChatGptOAuthError("server_error", "Database unavailable.", 500);
  }

  const codeHash = hashSecret(input.code);
  const storedCode = await db.query.chatGptMcpOAuthCodes.findFirst({
    where: and(eq(chatGptMcpOAuthCodes.codeHash, codeHash), isNull(chatGptMcpOAuthCodes.usedAt)),
  });

  if (!storedCode || storedCode.expiresAt < new Date()) {
    throw new ChatGptOAuthError("invalid_grant", "Authorization code is invalid or expired.");
  }
  if (
    storedCode.clientId !== input.clientId ||
    storedCode.redirectUri !== input.redirectUri ||
    storedCode.resource !== input.resource
  ) {
    throw new ChatGptOAuthError("invalid_grant", "Authorization code binding failed.");
  }
  if (!verifyPkceS256(input.codeVerifier, storedCode.codeChallenge)) {
    throw new ChatGptOAuthError("invalid_grant", "PKCE verification failed.");
  }

  await db.update(chatGptMcpOAuthCodes)
    .set({ usedAt: new Date() })
    .where(eq(chatGptMcpOAuthCodes.id, storedCode.id));

  return {
    userId: storedCode.userId,
    scopes: normalizeAllowedScopes(storedCode.scopes),
    clientId: storedCode.clientId,
    resource: storedCode.resource,
  };
}

export async function issueChatGptAccessToken(input: {
  request: NextRequest;
  userId: string;
  scopes: McpTokenScope[];
  clientId?: string;
  resource?: string;
  expiresInSeconds?: number;
}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresIn = input.expiresInSeconds ?? DEFAULT_ACCESS_TOKEN_SECONDS;
  const resource = input.resource || getChatGptMcpResource(input.request);
  const claims: AccessTokenClaims = {
    iss: getChatGptOAuthIssuer(input.request),
    sub: input.userId,
    aud: resource,
    resource,
    scope: normalizeAllowedScopes(input.scopes).join(" "),
    client_id: input.clientId,
    iat: issuedAt,
    nbf: issuedAt - CLOCK_SKEW_SECONDS,
    exp: issuedAt + expiresIn,
    jti: randomUUID(),
  };
  return signJwt(claims);
}

export async function verifyChatGptAccessToken(
  request: NextRequest,
  requiredScopes: McpTokenScope[] = [CHATGPT_MCP_REQUIRED_SCOPE],
): Promise<VerifiedChatGptAccessToken> {
  const token = getBearerToken(request);
  if (!token) {
    throw new ChatGptOAuthError("invalid_token", "Bearer token is required.", 401);
  }

  const claims = verifyJwt(token);
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== getChatGptOAuthIssuer(request)) {
    throw new ChatGptOAuthError("invalid_token", "Token issuer is invalid.", 401);
  }
  if (!audienceIncludes(claims.aud, getChatGptMcpResource(request))) {
    throw new ChatGptOAuthError("invalid_token", "Token audience is invalid.", 401);
  }
  if (claims.resource !== getChatGptMcpResource(request)) {
    throw new ChatGptOAuthError("invalid_token", "Token resource is invalid.", 401);
  }
  if (typeof claims.exp !== "number" || claims.exp <= now - CLOCK_SKEW_SECONDS) {
    throw new ChatGptOAuthError("invalid_token", "Token is expired.", 401);
  }
  if (typeof claims.nbf === "number" && claims.nbf > now + CLOCK_SKEW_SECONDS) {
    throw new ChatGptOAuthError("invalid_token", "Token is not active.", 401);
  }
  if (!claims.sub || typeof claims.sub !== "string") {
    throw new ChatGptOAuthError("invalid_token", "Token subject is missing.", 401);
  }

  const scopes = parseTokenScopes(claims.scope);
  if (!requiredScopes.every((scope) => scopes.includes(scope) || scopes.includes("admin"))) {
    throw new ChatGptOAuthError("insufficient_scope", "Token scope is insufficient.", 403);
  }

  return {
    userId: claims.sub,
    scopes,
    tokenId: claims.jti,
    clientId: claims.client_id,
  };
}

export function createPkceS256Challenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export function verifyPkceS256(codeVerifier: string, codeChallenge: string) {
  if (!PKCE_VERIFIER_PATTERN.test(codeVerifier)) return false;
  const expected = createPkceS256Challenge(codeVerifier);
  return safeEqual(expected, codeChallenge);
}

export function getChatGptJwks() {
  const publicJwk = getPublicKey().export({ format: "jwk" }) as Record<string, unknown>;
  return {
    keys: [
      {
        ...publicJwk,
        kid: getKeyId(),
        alg: "RS256",
        use: "sig",
      } satisfies SigningJwk,
    ],
  };
}

export function getTokenExpiresInSeconds() {
  return DEFAULT_ACCESS_TOKEN_SECONDS;
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function parseRequestedScopes(scope: string | null) {
  const requested = scope?.trim()
    ? scope.trim().split(/\s+/)
    : [CHATGPT_MCP_REQUIRED_SCOPE];
  const unknown = requested.filter((item) => !CHATGPT_MCP_SUPPORTED_SCOPES.includes(item as McpTokenScope));
  if (unknown.length > 0) {
    throw new ChatGptOAuthError("invalid_scope", "Requested scope is not supported.");
  }
  const scopes = normalizeAllowedScopes(requested as McpTokenScope[]);
  if (!scopes.includes(CHATGPT_MCP_REQUIRED_SCOPE)) {
    throw new ChatGptOAuthError("invalid_scope", "dataset:read scope is required.");
  }
  return scopes;
}

function parseTokenScopes(scope: unknown) {
  if (typeof scope !== "string") return [];
  return normalizeAllowedScopes(scope.split(/\s+/) as McpTokenScope[]);
}

function normalizeAllowedScopes(scopes: McpTokenScope[]) {
  return [...new Set(scopes.filter((scope) => CHATGPT_MCP_SUPPORTED_SCOPES.includes(scope)))];
}

function validateStoredAuthorizationRequest(value: unknown): AuthorizationRequest {
  if (!value || typeof value !== "object") {
    throw new ChatGptOAuthError("invalid_request", "Stored authorization request is malformed.");
  }
  const record = value as Partial<AuthorizationRequest>;
  if (
    record.responseType !== "code" ||
    typeof record.clientId !== "string" ||
    typeof record.redirectUri !== "string" ||
    typeof record.codeChallenge !== "string" ||
    record.codeChallengeMethod !== "S256" ||
    typeof record.resource !== "string" ||
    !Array.isArray(record.scopes)
  ) {
    throw new ChatGptOAuthError("invalid_request", "Stored authorization request is malformed.");
  }
  return {
    responseType: "code",
    clientId: record.clientId,
    redirectUri: record.redirectUri,
    codeChallenge: record.codeChallenge,
    codeChallengeMethod: "S256",
    scopes: normalizeAllowedScopes(record.scopes as McpTokenScope[]),
    state: typeof record.state === "string" ? record.state : undefined,
    resource: record.resource,
  };
}

function signJwt(payload: AccessTokenClaims) {
  const encodedHeader = base64urlJson({ alg: "RS256", typ: "JWT", kid: getKeyId() });
  const encodedPayload = base64urlJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .end()
    .sign(getPrivateKey(), "base64url");
  return `${signingInput}.${signature}`;
}

function verifyJwt(token: string): AccessTokenClaims {
  const [encodedHeader, encodedPayload, signature, extra] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature || extra) {
    throw new ChatGptOAuthError("invalid_token", "Token is malformed.", 401);
  }

  const header = parseBase64urlJson(encodedHeader) as JwtHeader;
  if (header.alg !== "RS256" || header.kid !== getKeyId()) {
    throw new ChatGptOAuthError("invalid_token", "Token signature metadata is invalid.", 401);
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const verified = createVerify("RSA-SHA256")
    .update(signingInput)
    .end()
    .verify(getPublicKeyFromJwks(header.kid), signature, "base64url");
  if (!verified) {
    throw new ChatGptOAuthError("invalid_token", "Token signature is invalid.", 401);
  }

  const payload = parseBase64urlJson(encodedPayload) as AccessTokenClaims;
  if (
    typeof payload.iss !== "string" ||
    typeof payload.sub !== "string" ||
    typeof payload.resource !== "string" ||
    typeof payload.scope !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number" ||
    typeof payload.jti !== "string"
  ) {
    throw new ChatGptOAuthError("invalid_token", "Token claims are malformed.", 401);
  }
  return payload;
}

function getPublicKeyFromJwks(kid: string | undefined) {
  const jwk = getChatGptJwks().keys.find((key) => key.kid === kid);
  if (!jwk) {
    throw new ChatGptOAuthError("invalid_token", "JWKS key is unavailable.", 401);
  }
  return createPublicKey({ key: jwk, format: "jwk" });
}

function getPrivateKey() {
  return createPrivateKey(readPrivateKeyPem());
}

function getPublicKey(): KeyObject {
  return createPublicKey(getPrivateKey());
}

function readPrivateKeyPem() {
  const raw = process.env.CHATGPT_MCP_OAUTH_PRIVATE_KEY;
  if (!raw) {
    throw new ChatGptOAuthError("server_error", "OAuth signing key is not configured.", 500);
  }
  if (raw.includes("BEGIN")) {
    return raw.replace(/\\n/g, "\n");
  }
  return Buffer.from(raw, "base64").toString("utf8");
}

function getKeyId() {
  return process.env.CHATGPT_MCP_OAUTH_KEY_ID || "useclevr-chatgpt-mcp";
}

function requireParam(params: URLSearchParams, name: string) {
  const value = params.get(name);
  if (!value) {
    throw new ChatGptOAuthError("invalid_request", `${name} is required.`);
  }
  return value;
}

function isAllowedClientId(clientId: string) {
  const allowed = splitEnvList(process.env.CHATGPT_MCP_ALLOWED_CLIENT_IDS);
  if (allowed.length > 0) return allowed.includes(clientId);
  if (process.env.NODE_ENV === "production") return false;
  return clientId.startsWith("https://chatgpt.com/") ||
    clientId.startsWith("https://chat.openai.com/");
}

function isAllowedRedirectUri(redirectUri: string) {
  const allowed = splitEnvList(process.env.CHATGPT_MCP_ALLOWED_REDIRECT_URIS);
  if (allowed.length > 0) return allowed.includes(redirectUri);
  if (process.env.NODE_ENV === "production") return false;
  return redirectUri === "https://chatgpt.com/connector_platform_oauth_redirect" ||
    redirectUri.startsWith("https://chatgpt.com/connector/");
}

function splitEnvList(value: string | undefined) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) || [];
}

function signHmac(body: string) {
  return createHmac("sha256", getConsentSecret()).update(body).digest("base64url");
}

function getConsentSecret() {
  const secret = config.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new ChatGptOAuthError("server_error", "OAuth consent secret is not configured.", 500);
  }
  return secret;
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function base64urlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseBase64urlJson(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new ChatGptOAuthError("invalid_token", "Encoded OAuth value is malformed.", 401);
  }
}

function assertTimingSafeEqual(left: string, right: string) {
  if (!safeEqual(left, right)) {
    throw new ChatGptOAuthError("invalid_request", "OAuth request signature is invalid.");
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function audienceIncludes(audience: string | string[], expected: string) {
  return Array.isArray(audience)
    ? audience.includes(expected)
    : audience === expected;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
