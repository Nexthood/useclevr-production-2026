"use server";

import { v4 as uuidv4 } from "uuid";
import { debugError } from "@/lib/utils/debug";

import { recordActivity } from "@/lib/activity/activity-store";
import {
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
import { z } from "zod";

export async function signup(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = formData.get("password") as string;
  const isDemo = formData.get("demo") === "true";

  // Demo mode signup - no database required
  if (isDemo) {
    return { success: true, isDemo: true };
  }

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
        return { error: getVerificationErrorMessage(delivery.reason) };
      }

      return { success: true, verificationRequired: true, email, purpose: "signup" as const };
    }

    return { error: "If this email can be used, we sent a verification code." };
  }

  // Handle existing OAuth user - automatically link password before email code verification
  if (existingUser && !existingUser.password) {
    // Automatically add password to existing OAuth user
    try {
      const hashedPassword = await bcrypt.hash(password, 12);
      await db
        .update(users)
        .set({ password: hashedPassword, name: name || existingUser.name, emailVerified: null })
        .where(eq(users.id, existingUser.id));

      const delivery = await createAndSendVerificationCode({
        userId: existingUser.id,
        email,
        purpose: "signup",
      });

      if (!delivery.success) {
        return { error: getVerificationErrorMessage(delivery.reason) };
      }

      return {
        success: true,
        linked: true,
        verificationRequired: true,
        email,
        purpose: "signup" as const,
      };
    } catch (dbError) {
      debugError("Error linking password to OAuth user:", dbError);
      return { error: "Failed to link account. Please try again." };
    }
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
  const email = emailInput.trim().toLowerCase();
  const password = String(passwordInput || "");

  if (!z.string().email().safeParse(email).success || password.length < 1) {
    return { error: "Sign-in failed. Check your email and password." };
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

    if (!user?.password) {
      return { error: "Sign-in failed. Check your email and password." };
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return { error: "Sign-in failed. Check your email and password." };
    }

    const purpose: EmailVerificationPurpose = user.emailVerified ? "login" : "signup";
    const delivery = await createAndSendVerificationCode({
      userId: user.id,
      email,
      purpose,
    });

    if (!delivery.success) {
      return { error: getVerificationErrorMessage(delivery.reason) };
    }

    return { success: true, verificationRequired: true, email, purpose };
  } catch (error) {
    debugError("Email-password login verification setup failed:", error);
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

export async function resendEmailOtp(emailInput: string, purposeInput: EmailVerificationPurpose) {
  const email = emailInput.trim().toLowerCase();
  const purpose = purposeInput === "login" ? "login" : "signup";

  if (!z.string().email().safeParse(email).success) {
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

  if (!user?.password) {
    return { success: true };
  }

  const delivery = await createAndSendVerificationCode({
    userId: user.id,
    email,
    purpose,
    enforceCooldown: true,
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
