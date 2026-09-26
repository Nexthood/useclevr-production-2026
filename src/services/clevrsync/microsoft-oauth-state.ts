import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { parseMicrosoftConnectorType, type MicrosoftConnectorType } from "@/services/clevrsync/connectors/microsoft-graph";

const STATE_TTL_MS = 10 * 60 * 1000;
const REPLAY_WINDOW_MS = STATE_TTL_MS + 60_000;
const MAX_TRACKED_NONCES = 10_000;

type MicrosoftOAuthState = {
  userId: string;
  connectorType: MicrosoftConnectorType;
  returnTo: string;
  nonce: string;
  expiresAt: number;
};

/**
 * Single-process replay guard: a verified state nonce cannot be redeemed a
 * second time. Entries expire with the state TTL and the store stays bounded.
 */
const usedNonces = new Map<string, number>();

export function createMicrosoftOAuthState(input: {
  userId: string;
  connectorType: MicrosoftConnectorType;
  returnTo?: string | null;
}) {
  const state: MicrosoftOAuthState = {
    userId: input.userId,
    connectorType: input.connectorType,
    returnTo: safeReturnTo(input.returnTo),
    nonce: randomBytes(16).toString("base64url"),
    expiresAt: Date.now() + STATE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyMicrosoftOAuthState(
  value: string,
  expectedUserId: string,
): MicrosoftOAuthState {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) throw new Error("OAuth state is malformed.");
  const expectedSignature = sign(encoded);
  if (!safeEqual(signature, expectedSignature)) throw new Error("OAuth state is invalid.");

  let state: MicrosoftOAuthState;
  try {
    state = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as MicrosoftOAuthState;
  } catch {
    throw new Error("OAuth state is malformed.");
  }
  if (state.userId !== expectedUserId) throw new Error("OAuth state does not match this session.");
  if (parseMicrosoftConnectorType(state.connectorType) === null) {
    throw new Error("OAuth state has an unsupported connector type.");
  }
  if (state.expiresAt < Date.now()) throw new Error("OAuth state expired.");
  if (usedNonces.has(state.nonce)) throw new Error("OAuth state was already used.");
  trackNonce(state.nonce, state.expiresAt);
  return state;
}

function trackNonce(nonce: string, stateExpiresAt: number) {
  const now = Date.now();
  for (const [key, expiry] of usedNonces) {
    if (expiry < now) usedNonces.delete(key);
  }
  if (usedNonces.size >= MAX_TRACKED_NONCES) {
    const oldestKey = usedNonces.keys().next().value;
    if (oldestKey !== undefined) usedNonces.delete(oldestKey);
  }
  usedNonces.set(nonce, Math.max(stateExpiresAt, now) + REPLAY_WINDOW_MS);
}

function sign(value: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("OAuth state signing is not configured.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function safeReturnTo(value?: string | null) {
  if (!value || !value.startsWith("/app/settings/data-connections")) {
    return "/app/settings/data-connections";
  }
  return value;
}
