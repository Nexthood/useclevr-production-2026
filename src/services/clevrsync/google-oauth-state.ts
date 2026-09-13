import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

type GoogleOAuthState = {
  userId: string;
  returnTo: string;
  nonce: string;
  expiresAt: number;
};

export function createGoogleOAuthState(input: { userId: string; returnTo?: string | null }) {
  const state: GoogleOAuthState = {
    userId: input.userId,
    returnTo: safeReturnTo(input.returnTo),
    nonce: randomBytes(16).toString("base64url"),
    expiresAt: Date.now() + STATE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyGoogleOAuthState(value: string, expectedUserId: string) {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) throw new Error("OAuth state is malformed.");
  const expectedSignature = sign(encoded);
  if (!safeEqual(signature, expectedSignature)) throw new Error("OAuth state is invalid.");

  const state = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as GoogleOAuthState;
  if (state.userId !== expectedUserId) throw new Error("OAuth state does not match this session.");
  if (state.expiresAt < Date.now()) throw new Error("OAuth state expired.");
  return state;
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
