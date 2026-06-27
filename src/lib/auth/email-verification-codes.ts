import { randomInt } from "node:crypto";
import { v4 as uuidv4 } from "uuid";

import { emailVerificationCodes, users } from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/auth/verification-email";

export type EmailVerificationPurpose = "signup" | "login";
export type EmailVerificationFailure =
  | "invalid"
  | "expired"
  | "too_many_attempts"
  | "delivery_failed"
  | "cooldown";

const CODE_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const PROOF_ATTEMPTS_SENTINEL = 999;

export function getEmailVerificationLimits() {
  return {
    codeExpiryMinutes: CODE_EXPIRY_MINUTES,
    resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
    maxAttempts: MAX_ATTEMPTS,
  };
}

export async function createAndSendVerificationCode({
  userId,
  email,
  purpose,
  enforceCooldown = false,
}: {
  userId?: string | null;
  email: string;
  purpose: EmailVerificationPurpose;
  enforceCooldown?: boolean;
}): Promise<{ success: true } | { success: false; reason: EmailVerificationFailure }> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  if (enforceCooldown) {
    const latest = await findLatestActiveCode(normalizedEmail, purpose);
    const createdAt = latest?.createdAt ? new Date(latest.createdAt) : null;
    if (createdAt && now.getTime() - createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
      return { success: false, reason: "cooldown" };
    }
  }

  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(`${normalizedEmail}:${purpose}:${code}`, 12);
  const expiresAt = new Date(now.getTime() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await db
    .update(emailVerificationCodes)
    .set({ usedAt: now })
    .where(
      and(
        eq(emailVerificationCodes.email, normalizedEmail),
        eq(emailVerificationCodes.purpose, purpose),
        isNull(emailVerificationCodes.usedAt),
      ),
    );

  await db.insert(emailVerificationCodes).values({
    id: uuidv4(),
    userId: userId || null,
    email: normalizedEmail,
    purpose,
    codeHash,
    expiresAt,
  });

  try {
    logVerificationEvent("send_start", { email: normalizedEmail, purpose, userId });
    await sendVerificationEmail(normalizedEmail, code);
    logVerificationEvent("send_success", { email: normalizedEmail, purpose, userId });
    return { success: true };
  } catch (error) {
    logVerificationError("send_failed", error, { email: normalizedEmail, purpose, userId });
    await db
      .update(emailVerificationCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerificationCodes.email, normalizedEmail),
          eq(emailVerificationCodes.purpose, purpose),
          isNull(emailVerificationCodes.usedAt),
        ),
      );
    return { success: false, reason: "delivery_failed" };
  }
}

export async function verifyEmailCode({
  email,
  code,
  purpose,
}: {
  email: string;
  code: string;
  purpose: EmailVerificationPurpose;
}): Promise<
  | { success: true; userId: string | null; proof: string }
  | { success: false; reason: EmailVerificationFailure }
> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.replace(/\D/g, "");
  const latest = await findLatestActiveCode(normalizedEmail, purpose);

  if (!latest) {
    logVerificationEvent("verify_no_active_code", { email: normalizedEmail, purpose });
    return { success: false, reason: "invalid" };
  }

  if (latest.attempts >= MAX_ATTEMPTS) {
    logVerificationEvent("verify_too_many_attempts", {
      email: normalizedEmail,
      purpose,
      attempts: latest.attempts,
    });
    return { success: false, reason: "too_many_attempts" };
  }

  if (new Date(latest.expiresAt).getTime() <= Date.now()) {
    await db
      .update(emailVerificationCodes)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationCodes.id, latest.id));
    logVerificationEvent("verify_expired", { email: normalizedEmail, purpose });
    return { success: false, reason: "expired" };
  }

  const isValid = await bcrypt.compare(
    `${normalizedEmail}:${purpose}:${normalizedCode}`,
    latest.codeHash,
  );

  if (!isValid) {
    const attempts = latest.attempts + 1;
    await db
      .update(emailVerificationCodes)
      .set({
        attempts,
        usedAt: attempts >= MAX_ATTEMPTS ? new Date() : null,
      })
      .where(eq(emailVerificationCodes.id, latest.id));

    logVerificationEvent("verify_invalid_code", {
      email: normalizedEmail,
      purpose,
      attempts,
    });
    return { success: false, reason: attempts >= MAX_ATTEMPTS ? "too_many_attempts" : "invalid" };
  }

  const usedAt = new Date();
  await db
    .update(emailVerificationCodes)
    .set({ usedAt })
    .where(eq(emailVerificationCodes.id, latest.id));

  logVerificationEvent("verify_success", { email: normalizedEmail, purpose, userId: latest.userId });
  return { success: true, userId: latest.userId, proof: latest.id };
}

export async function consumeVerifiedAuthProof({
  email,
  proof,
  purpose,
}: {
  email: string;
  proof: string;
  purpose: EmailVerificationPurpose;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const record = await db.query.emailVerificationCodes.findFirst({
    where: and(
      eq(emailVerificationCodes.id, proof),
      eq(emailVerificationCodes.email, normalizedEmail),
      eq(emailVerificationCodes.purpose, purpose),
      gt(emailVerificationCodes.expiresAt, new Date()),
    ),
  });

  if (!record?.usedAt || record.attempts >= PROOF_ATTEMPTS_SENTINEL) {
    logVerificationEvent("proof_rejected", { email: normalizedEmail, purpose });
    return false;
  }

  await db
    .update(emailVerificationCodes)
    .set({ attempts: PROOF_ATTEMPTS_SENTINEL })
    .where(eq(emailVerificationCodes.id, record.id));

  logVerificationEvent("proof_consumed", { email: normalizedEmail, purpose });
  return true;
}

export async function markEmailVerified(email: string) {
  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.email, email.trim().toLowerCase()));
}

async function findLatestActiveCode(email: string, purpose: EmailVerificationPurpose) {
  return db.query.emailVerificationCodes.findFirst({
    where: and(
      eq(emailVerificationCodes.email, email),
      eq(emailVerificationCodes.purpose, purpose),
      isNull(emailVerificationCodes.usedAt),
    ),
    orderBy: [desc(emailVerificationCodes.createdAt)],
  });
}

function generateVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function logVerificationEvent(
  event: string,
  details: { email?: string; purpose?: EmailVerificationPurpose; userId?: string | null; attempts?: number },
) {
  console.warn("[Auth] Email verification event", {
    event,
    email: maskEmail(details.email),
    purpose: details.purpose,
    userId: details.userId,
    attempts: details.attempts,
  });
}

function logVerificationError(
  event: string,
  error: unknown,
  details: { email?: string; purpose?: EmailVerificationPurpose; userId?: string | null },
) {
  console.error("[Auth] Email verification failure", {
    event,
    email: maskEmail(details.email),
    purpose: details.purpose,
    userId: details.userId,
    error: getErrorLogDetails(error),
  });
}

function getErrorLogDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const cause = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    command?: unknown;
    response?: unknown;
    responseCode?: unknown;
  };

  return {
    name: stringifyLogValue(cause.name),
    message: stringifyLogValue(cause.message),
    code: stringifyLogValue(cause.code),
    command: stringifyLogValue(cause.command),
    response: stringifyLogValue(cause.response),
    responseCode: stringifyLogValue(cause.responseCode),
  };
}

function stringifyLogValue(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function maskEmail(email?: string) {
  if (!email) return undefined;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[invalid-email]";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}
