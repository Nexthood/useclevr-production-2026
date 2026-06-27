import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import {
  consumeVerifiedAuthProof,
  createAndSendVerificationCode,
  markEmailVerified,
  verifyEmailCode,
  type EmailVerificationPurpose,
} from "../../src/lib/auth/email-verification-codes";
import { validatePasswordPolicy } from "../../src/lib/auth/password-policy";
import { db } from "../../src/lib/db";
import { profiles, users } from "../../src/lib/db/schema";

type Command = "signup-send" | "signup-verify" | "login-send" | "login-verify";

function readArg(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];

  return undefined;
}

function readCommand(): Command {
  const command = process.argv.find((arg) =>
    ["signup-send", "signup-verify", "login-send", "login-verify"].includes(arg),
  );

  if (!command) {
    throw new Error("Pass one command: signup-send, signup-verify, login-send, or login-verify.");
  }

  return command as Command;
}

function readEmail() {
  const email = (readArg("--email") || process.env.AUTH_FLOW_TEST_EMAIL || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Set AUTH_FLOW_TEST_EMAIL or pass --email test@example.com.");
  }
  return email;
}

function readPassword() {
  const password = readArg("--password") || process.env.AUTH_FLOW_TEST_PASSWORD || "";
  if (!password) {
    throw new Error("Set AUTH_FLOW_TEST_PASSWORD or pass --password.");
  }
  return password;
}

function readCode() {
  const code = (readArg("--code") || process.env.AUTH_FLOW_TEST_CODE || "").replace(/\D/g, "");
  if (code.length !== 6) {
    throw new Error("Set AUTH_FLOW_TEST_CODE or pass --code with the 6-digit email code.");
  }
  return code;
}

async function main() {
  const command = readCommand();
  const email = readEmail();

  if (command === "signup-send") {
    await signupSend(email);
    return;
  }

  if (command === "signup-verify") {
    await verifyAndConsume(email, readPassword(), readCode(), "signup");
    await markEmailVerified(email);
    console.log("[AuthFlow] Signup verification completed", { email: maskEmail(email) });
    return;
  }

  if (command === "login-send") {
    await loginSend(email, readPassword());
    return;
  }

  await verifyAndConsume(email, readPassword(), readCode(), "login");
  console.log("[AuthFlow] Login verification completed", { email: maskEmail(email) });
}

async function signupSend(email: string) {
  const name = readArg("--name") || process.env.AUTH_FLOW_TEST_NAME || "UseClevr Auth Test";
  const password = readPassword();
  const policy = validatePasswordPolicy(password, { email, name });
  if (!policy.passed) {
    throw new Error(policy.message);
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing?.password && existing.emailVerified) {
    throw new Error("A verified password account already exists for this email.");
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const userId = existing?.id || `user_${randomUUID()}`;

  if (existing) {
    await db
      .update(users)
      .set({ name, password: hashedPassword, emailVerified: null })
      .where(eq(users.id, userId));
  } else {
    await db.insert(users).values({
      id: userId,
      name,
      email,
      password: hashedPassword,
      emailVerified: null,
    });
  }

  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { id: true },
  });

  if (existingProfile) {
    await db.update(profiles).set({ email, fullName: name }).where(eq(profiles.userId, userId));
  } else {
    await db.insert(profiles).values({
      id: `profile_${randomUUID()}`,
      userId,
      email,
      fullName: name,
    });
  }

  const delivery = await createAndSendVerificationCode({ userId, email, purpose: "signup" });
  if (!delivery.success) {
    throw new Error(`Signup verification email failed: ${delivery.reason}`);
  }

  console.log("[AuthFlow] Signup verification code sent", {
    email: maskEmail(email),
    userId,
  });
}

async function loginSend(email: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user?.password) {
    throw new Error("Password account not found.");
  }

  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    throw new Error("Password authentication failed.");
  }

  const purpose: EmailVerificationPurpose = user.emailVerified ? "login" : "signup";
  const delivery = await createAndSendVerificationCode({ userId: user.id, email, purpose });
  if (!delivery.success) {
    throw new Error(`Login verification email failed: ${delivery.reason}`);
  }

  console.log("[AuthFlow] Login verification code sent", {
    email: maskEmail(email),
    userId: user.id,
    purpose,
  });
}

async function verifyAndConsume(
  email: string,
  password: string,
  code: string,
  purpose: EmailVerificationPurpose,
) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user?.password) {
    throw new Error("Password account not found.");
  }

  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    throw new Error("Password authentication failed.");
  }

  const verified = await verifyEmailCode({ email, code, purpose });
  if (!verified.success) {
    throw new Error(`Verification code failed: ${verified.reason}`);
  }

  if (purpose === "signup") {
    await markEmailVerified(email);
  }

  const proofValid = await consumeVerifiedAuthProof({
    email,
    proof: verified.proof,
    purpose,
  });

  if (!proofValid) {
    throw new Error("Verified auth proof could not be consumed.");
  }
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[invalid-email]";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

main().catch((error) => {
  console.error("[AuthFlow] Test failed", {
    message: error instanceof Error ? error.message : String(error),
    code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
  });
  process.exitCode = 1;
});
