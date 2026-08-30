"use server";

import { timingSafeEqual } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { debugError, debugWarn } from "@/lib/utils/debug";

import { recordActivity } from "@/lib/activity/activity-store";
import { canUseBuiltinDirectCredentials, findBuiltinUserByCredentials } from "@/lib/auth/builtin-users";
import { ensureBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import {
  createVerifiedAuthProof,
  createAndSendVerificationCode,
  getEmailVerificationLimits,
  markEmailVerified,
  verifyEmailCode,
  type EmailVerificationPurpose,
} from "@/lib/auth/email-verification-codes";
import { validatePasswordPolicy } from "@/lib/auth/password-policy";
import { db } from "@/lib/db";
import { profiles, users } from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

export async function signup(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (!z.string().email().safeParse(email).success) {
    return { error: "Enter a valid email address" };
  }

  const passwordPolicy = validatePasswordPolicy(password, { email, name });
  if (!passwordPolicy.passed) {
    return { error: passwordPolicy.message };
  }

  // Check if user already exists with error handling
  let existingUser;
  try {
    existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
  } catch (dbError) {
    debugError("Database connection error during signup:", dbError);
    return { error: "Database connection failed. Please check your configuration." };
  }

  if (existingUser?.password) {
    const isExistingPasswordValid = await bcrypt.compare(password, existingUser.password);
    if (!existingUser.emailVerified && isExistingPasswordValid) {
      const delivery = await createAndSendVerificationCode({
        userId: existingUser.id,
        email,
        purpose: "signup",
      });

      if (!delivery.success) {
        if (canUseAdminAuthBypass(email)) {
          return adminBypassVerificationRequired(
            email,
            "signup",
            getVerificationErrorMessage(delivery.reason),
          );
        }

        return { error: getVerificationErrorMessage(delivery.reason) };
      }

      return { success: true, verificationRequired: true, email, purpose: "signup" as const };
    }

    return { error: "If this email can be used, we sent a verification code." };
  }

  if (existingUser) {
    return { error: "An account with this email already exists" };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user with error handling
  let user;
  try {
    const result = await db
      .insert(users)
      .values({
        id: `user_${uuidv4()}`,
        name,
        email,
        password: hashedPassword,
        emailVerified: null,
      })
      .returning();
    user = result[0];
  } catch (dbError) {
    debugError("Database connection error creating user:", dbError);
    return { error: "Database connection failed. Please check your configuration." };
  }

  // Create profile for the user
  try {
    await db.insert(profiles).values({
      id: `profile_${uuidv4()}`,
      userId: user.id,
      email: user.email,
      fullName: name,
      firstName: getFirstName(name),
      role: "owner",
    });
  } catch (dbError) {
    debugError("Database connection error creating profile:", dbError);
    try {
      await db.delete(users).where(eq(users.id, user.id));
    } catch (cleanupError) {
      debugError("Database cleanup error after failed profile creation:", cleanupError);
    }
    return { error: "Account setup failed. Please try again." };
  }

  const delivery = await createAndSendVerificationCode({
    userId: user.id,
    email: user.email || email,
    purpose: "signup",
  });

  if (!delivery.success) {
    if (canUseAdminAuthBypass(email)) {
      return adminBypassVerificationRequired(
        email,
        "signup",
        getVerificationErrorMessage(delivery.reason),
      );
    }

    return { error: getVerificationErrorMessage(delivery.reason) };
  }

  await recordActivity({
    userId: user.id,
    userEmail: user.email,
    type: "register",
    feature: "account",
    title: "Account registered",
    description: "Account access was created with email signup.",
  });

  revalidatePath("/app/datasets");
  return { success: true, verificationRequired: true, email, purpose: "signup" as const };
}

export async function beginEmailPasswordLogin(emailInput: string, passwordInput: string) {
  const traceId = createAuthTraceId();
  const request = await getSafeAuthRequestMetadata();
  const email = emailInput.trim().toLowerCase();
  const password = String(passwordInput || "");

  logEmailPasswordFlow("request_received", {
    traceId,
    email,
    request,
    action: "login",
  });

  if (!z.string().email().safeParse(email).success || password.length < 1) {
    logEmailPasswordFlow("request_rejected_invalid_input", {
      traceId,
      email,
      request,
      action: "login",
    });
    return { error: "Sign-in failed. Check your email and password." };
  }

  const builtinUser = findBuiltinUserByCredentials(email, password);
  if (canUseBuiltinDirectCredentials(builtinUser)) {
    try {
      await ensureBuiltinUserRecord(builtinUser.id);
    } catch (error) {
      debugWarn("Built-in account identity sync failed during login:", error);
    }

    return {
      success: true,
      email: builtinUser.email,
      purpose: "login" as const,
      builtInCredentials: true,
    };
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: {
        id: true,
        email: true,
        password: true,
        emailVerified: true,
      },
    });

    logEmailPasswordFlow("account_lookup_complete", {
      traceId,
      email,
      request,
      action: "login",
      userId: user?.id,
      accountFound: Boolean(user),
      hasPassword: Boolean(user?.password),
      emailVerified: Boolean(user?.emailVerified),
    });

    if (!user?.password) {
      return { error: "Sign-in failed. Check your email and password." };
    }

    const isValid = await bcrypt.compare(password, user.password);
    logEmailPasswordFlow("password_verified", {
      traceId,
      email,
      request,
      action: "login",
      userId: user.id,
      passwordValid: isValid,
    });

    if (!isValid) {
      return { error: "Sign-in failed. Check your email and password." };
    }

    const purpose: EmailVerificationPurpose = user.emailVerified ? "login" : "signup";
    const delivery = await createAndSendVerificationCode({
      userId: user.id,
      email,
      purpose,
      traceId,
      source: "login",
      requestHost: request.host,
    });

    if (!delivery.success) {
      if (canUseAdminAuthBypass(email)) {
        return adminBypassVerificationRequired(
          email,
          purpose,
          getVerificationErrorMessage(delivery.reason),
        );
      }

      return { error: getVerificationErrorMessage(delivery.reason) };
    }

    return { success: true, verificationRequired: true, email, purpose };
  } catch (error) {
    debugError("Email-password login verification setup failed:", {
      traceId,
      email: maskEmail(email),
      request,
      error: getSafeErrorLogDetails(error),
    });
    return { error: "Sign-in failed. Please try again." };
  }
}

export async function verifyEmailOtp(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const token = String(formData.get("token") || "").replace(/\D/g, "");
  const purpose = String(formData.get("purpose") || "") as EmailVerificationPurpose;

  if (!email || !token) {
    return { error: "Enter the confirmation code from your email." };
  }

  if (!z.string().email().safeParse(email).success) {
    return { error: "Enter a valid email address." };
  }

  if (token.length !== 6) {
    return { error: "Enter the 6-digit confirmation code." };
  }

  if (purpose !== "signup" && purpose !== "login") {
    return { error: "Start verification again and request a new code." };
  }

  const result = await verifyEmailCode({
    email,
    code: token,
    purpose,
  });

  if (!result.success) {
    return { error: getVerificationErrorMessage(result.reason) };
  }

  if (purpose === "signup") {
    await markEmailVerified(email);
  }

  return { success: true, proof: result.proof, purpose };
}

export async function verifyAdminAuthBypass(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const code = String(formData.get("code") || "");
  const purpose = String(formData.get("purpose") || "") as EmailVerificationPurpose;

  if (purpose !== "signup" && purpose !== "login") {
    return { error: "Start verification again and request a new code." };
  }

  if (!canUseAdminAuthBypass(email)) {
    logAdminBypassAttempt("blocked_unavailable", email);
    return { error: "Admin fallback is not available." };
  }

  if (!password || !code) {
    logAdminBypassAttempt("missing_credentials", email);
    return { error: "Enter the admin fallback code." };
  }

  const configuredCode = process.env.ADMIN_AUTH_BYPASS_CODE || "";
  if (!configuredCode) {
    logAdminBypassAttempt("missing_server_code", email);
    return { error: "Admin fallback is not configured." };
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: {
        id: true,
        email: true,
        password: true,
      },
    });

    if (!user?.password) {
      logAdminBypassAttempt("missing_password_account", email);
      return { error: "Admin fallback failed." };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logAdminBypassAttempt("invalid_password", email);
      return { error: "Admin fallback failed." };
    }

    if (!safeCodeEquals(code, configuredCode)) {
      logAdminBypassAttempt("invalid_code", email);
      return { error: "Admin fallback code is invalid." };
    }

    if (purpose === "signup") {
      await markEmailVerified(email);
    }

    const proof = await createVerifiedAuthProof({
      email,
      userId: user.id,
      purpose,
      source: "admin_bypass",
    });

    logAdminBypassAttempt("success", email);
    return { success: true, proof, purpose };
  } catch (error) {
    logAdminBypassAttempt("server_error", email, error);
    return { error: "Admin fallback failed. Please try again." };
  }
}

export async function resendEmailOtp(emailInput: string, purposeInput: EmailVerificationPurpose) {
  const traceId = createAuthTraceId();
  const request = await getSafeAuthRequestMetadata();
  const email = emailInput.trim().toLowerCase();
  const purpose = purposeInput === "login" ? "login" : "signup";

  logEmailPasswordFlow("request_received", {
    traceId,
    email,
    request,
    action: "resend",
    purpose,
  });

  if (!z.string().email().safeParse(email).success) {
    logEmailPasswordFlow("request_rejected_invalid_input", {
      traceId,
      email,
      request,
      action: "resend",
      purpose,
    });
    return { error: "Enter a valid email address." };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: {
      id: true,
      email: true,
      password: true,
    },
  });

  logEmailPasswordFlow("account_lookup_complete", {
    traceId,
    email,
    request,
    action: "resend",
    purpose,
    userId: user?.id,
    accountFound: Boolean(user),
    hasPassword: Boolean(user?.password),
  });

  if (!user?.password) {
    return { success: true };
  }

  const delivery = await createAndSendVerificationCode({
    userId: user.id,
    email,
    purpose,
    enforceCooldown: true,
    traceId,
    source: "resend",
    requestHost: request.host,
  });

  if (!delivery.success) {
    return { error: getVerificationErrorMessage(delivery.reason) };
  }

  return { success: true };
}

function getVerificationErrorMessage(reason: string) {
  const limits = getEmailVerificationLimits();
  const messages: Record<string, string> = {
    invalid: "Invalid code. Check the 6 digits and try again.",
    expired: "Code expired. Request a new code and try again.",
    too_many_attempts: "Too many attempts. Request a new code and try again.",
    delivery_failed: "Email delivery failed. Please try again.",
    cooldown: `Wait ${limits.resendCooldownSeconds} seconds before requesting another code.`,
  };

  return messages[reason] || "Verification failed. Please try again.";
}

function adminBypassVerificationRequired(
  email: string,
  purpose: EmailVerificationPurpose,
  deliveryError: string,
) {
  logAdminBypassAttempt("available_after_delivery_failure", email);
  return {
    success: true,
    verificationRequired: true,
    email,
    purpose,
    adminBypassAvailable: true,
    message: `${deliveryError} Use the secure superadmin fallback code to continue.`,
  };
}

function canUseAdminAuthBypass(email: string) {
  if (process.env.ADMIN_AUTH_BYPASS_ENABLED !== "true") return false;
  const bypassEmail = (process.env.ADMIN_AUTH_BYPASS_EMAIL || "").trim().toLowerCase();
  return Boolean(bypassEmail) && email.trim().toLowerCase() === bypassEmail;
}

function safeCodeEquals(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  if (inputBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(inputBuffer, expectedBuffer);
}

function logAdminBypassAttempt(event: string, email: string, error?: unknown) {
  const payload = {
    event,
    email: maskEmail(email),
    error: error instanceof Error ? { name: error.name, message: error.message } : undefined,
  };

  if (event === "success" || event === "available_after_delivery_failure") {
    console.warn("[Auth] Admin bypass event", payload);
    return;
  }

  console.error("[Auth] Admin bypass event", payload);
}

function createAuthTraceId() {
  return `auth_${uuidv4().slice(0, 8)}`;
}

async function getSafeAuthRequestMetadata() {
  try {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || undefined;
    const protocol = headerStore.get("x-forwarded-proto") || undefined;
    return {
      host,
      protocol,
      serverAction: Boolean(headerStore.get("next-action")),
    };
  } catch {
    return {
      host: undefined,
      protocol: undefined,
      serverAction: undefined,
    };
  }
}

function logEmailPasswordFlow(
  event: string,
  details: {
    traceId: string;
    email: string;
    request: Awaited<ReturnType<typeof getSafeAuthRequestMetadata>>;
    action: "login" | "resend";
    purpose?: EmailVerificationPurpose;
    userId?: string | null;
    accountFound?: boolean;
    hasPassword?: boolean;
    emailVerified?: boolean;
    passwordValid?: boolean;
  },
) {
  debugWarn("[Auth] Email-password verification flow", {
    event,
    traceId: details.traceId,
    action: details.action,
    email: maskEmail(details.email),
    purpose: details.purpose,
    userId: details.userId,
    accountFound: details.accountFound,
    hasPassword: details.hasPassword,
    emailVerified: details.emailVerified,
    passwordValid: details.passwordValid,
    request: details.request,
  });
}

function getSafeErrorLogDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const cause = error as { name?: unknown; message?: unknown; code?: unknown };
  return {
    name: stringifyLogValue(cause.name),
    message: stringifyLogValue(cause.message),
    code: stringifyLogValue(cause.code),
  };
}

function stringifyLogValue(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[invalid-email]";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || null;
}
