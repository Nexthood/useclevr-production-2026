import { randomInt } from "node:crypto";
import { v4 as uuidv4 } from "uuid";

import { emailVerificationCodes, users } from "@/lib/db/schema";
import { debugError } from "@/lib/utils/debug";
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
    await sendVerificationEmail(normalizedEmail, code);
    return { success: true };
  } catch (error) {
    debugError("[Auth] Verification email delivery failed:", error);
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
    return { success: false, reason: "invalid" };
  }

  if (latest.attempts >= MAX_ATTEMPTS) {
    return { success: false, reason: "too_many_attempts" };
  }

  if (new Date(latest.expiresAt).getTime() <= Date.now()) {
    await db
      .update(emailVerificationCodes)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationCodes.id, latest.id));
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

    return { success: false, reason: attempts >= MAX_ATTEMPTS ? "too_many_attempts" : "invalid" };
  }

  const usedAt = new Date();
  await db
    .update(emailVerificationCodes)
    .set({ usedAt })
    .where(eq(emailVerificationCodes.id, latest.id));

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
    return false;
  }

  await db
    .update(emailVerificationCodes)
    .set({ attempts: PROOF_ATTEMPTS_SENTINEL })
    .where(eq(emailVerificationCodes.id, record.id));

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
