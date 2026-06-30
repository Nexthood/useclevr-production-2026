import { v4 as uuidv4 } from "uuid";
import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";

import {
  BUILTIN_DEMO_USER,
  findBuiltinUserByCredentials,
  isBuiltinUserId,
  type BuiltinUserRole,
} from "@/lib/auth/builtin-users";
import { ensureBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { consumeVerifiedAuthProof } from "@/lib/auth/email-verification-codes";
import { isLocalAuthOrigin, resolveAuthRedirect } from "@/lib/auth/redirect-origin";
import { recordActivity } from "@/lib/activity/activity-store";
import { getDb } from "@/lib/db";
import { accounts, profiles, users } from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import { z } from "zod";
import { config } from "@/lib/config";

// DIAGNOSTIC: Log when auth module is loaded
debugLog("[Auth] Module loading - initializing NextAuth v5");
debugLog("[Auth] Drizzle client available:", !!getDb());

// Helper to get db with null safety
const getDbClient = () => {
  const client = getDb();
  if (!client) {
    debugWarn("[Auth] Database client is null - using demo mode only");
    return null;
  }
  return client;
};

/**
 * NextAuth v5 (Auth.js) Configuration
 *
 * CRITICAL PATTERNS TO PREVENT HEADER ERRORS:
 *
 * 1. Never throw errors after sending a response
 * 2. Always return null or throw in authorize(), never both
 * 3. Use try-catch in callbacks to prevent unhandled rejections
 * 4. The callbacks should return the session object, not modify and return undefined
 */

// Input validation schema to prevent malformed data
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  verificationProof: z.string().min(10).optional(),
  verificationPurpose: z.enum(["signup", "login"]).optional(),
});

const googleClientId = firstEnvValue("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID", "GOOGLE_ID");
const googleClientSecret = firstEnvValue(
  "AUTH_GOOGLE_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_SECRET",
);
const linkedinClientId = firstEnvValue("AUTH_LINKEDIN_ID", "LINKEDIN_CLIENT_ID", "LINKEDIN_ID");
const linkedinClientSecret = firstEnvValue(
  "AUTH_LINKEDIN_SECRET",
  "LINKEDIN_CLIENT_SECRET",
  "LINKEDIN_SECRET",
);
const authSecret = config.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
const googleProviderId = "google";
const linkedinProviderId = "linkedin";

normalizeLocalAuthUrlEnv();
logOAuthProviderConfig();

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  // Use a simple JWT adapter-like configuration without PrismaAdapter
  // to avoid database connections during module initialization
  providers: [
    // Demo login provider - no database required
    Credentials({
      id: "demo",
      name: "Demo Account",
      credentials: {
        // No credentials required for demo
      },
      async authorize() {
        // Return demo user directly - no database lookup
        debugLog("[Demo] Demo login authenticated");
        return {
          id: BUILTIN_DEMO_USER.id,
          email: BUILTIN_DEMO_USER.email,
          name: BUILTIN_DEMO_USER.name,
          image: null,
          role: BUILTIN_DEMO_USER.role,
        };
      },
    }),
    // Regular credentials provider for real users
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        verificationProof: { label: "Verification proof", type: "text" },
        verificationPurpose: { label: "Verification purpose", type: "text" },
      },
      async authorize(credentials) {
        try {
          const rawEmail = typeof credentials?.email === "string" ? credentials.email : "";
          const rawPassword = typeof credentials?.password === "string" ? credentials.password : "";

          const builtinUser = findBuiltinUserByCredentials(rawEmail, rawPassword);
          if (builtinUser) {
            debugLog(`[Auth] Built-in ${builtinUser.role} credentials authenticated`);
            return {
              id: builtinUser.id,
              email: builtinUser.email,
              name: builtinUser.name,
              image: null,
              role: builtinUser.role,
            };
          }

          // Validate input first
          const validatedFields = loginSchema.safeParse(credentials);

          if (!validatedFields.success) {
            return null;
          }

          const { email, password, verificationProof, verificationPurpose } = validatedFields.data;
          const dbClient = getDbClient();

          if (!dbClient) {
            return null;
          }

          // Query database
          let user;
          try {
            const userResult = await dbClient.query.users.findFirst({
              where: eq(users.email, email),
            });
            user = userResult;
          } catch (dbError) {
            debugError("Database connection error during auth:", dbError);
            return null;
          }

          // User not found or no password
          if (!user || !user.password) {
            logCredentialsAuthEvent("user_not_found_or_no_password", { email });
            return null;
          }

          // Verify password
          const isValid = await bcrypt.compare(password, user.password);

          if (!isValid) {
            logCredentialsAuthEvent("invalid_password", { email });
            return null;
          }

          if (!verificationProof || !verificationPurpose) {
            logCredentialsAuthEvent("missing_verification_proof", { email: user.email });
            return null;
          }

          if (!user.emailVerified && verificationPurpose !== "signup") {
            logCredentialsAuthEvent("unverified_email_wrong_purpose", {
              email: user.email,
              verificationPurpose,
            });
            return null;
          }

          const proofIsValid = await consumeVerifiedAuthProof({
            email,
            proof: verificationProof,
            purpose: verificationPurpose,
          });

          if (!proofIsValid) {
            logCredentialsAuthEvent("invalid_verification_proof", {
              email: user.email,
              verificationPurpose,
            });
            return null;
          }

          logCredentialsAuthEvent("authorized", { email: user.email, verificationPurpose });
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: resolveCredentialsRole(user.email),
          };
        } catch (error) {
          logCredentialsAuthError("authorize_exception", error);
          return null;
        }
      },
    }),
    ...(googleClientId && googleClientSecret
      ? [
          Google({
            id: googleProviderId,
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            authorization: {
              params: {
                scope: "openid email profile",
              },
            },
          }),
        ]
      : []),
    ...(linkedinClientId && linkedinClientSecret
      ? [
          LinkedIn({
            id: linkedinProviderId,
            clientId: linkedinClientId,
            clientSecret: linkedinClientSecret,
            authorization: {
              params: {
                scope: "openid profile email",
              },
            },
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login", // Redirect auth errors to login page
  },
  callbacks: {
    /**
     * JWT Callback
     * CRITICAL: Always return the token, even if unchanged
     */
    async jwt({ token, user }) {
      // Add user ID to token on initial sign in
      if (user) {
        token.id = user.id;
        token.role = ("role" in user ? user.role : "user") as BuiltinUserRole;
      }
      // Always return the token
      return token;
    },
    /**
     * Session Callback
     * CRITICAL: Always return the session object, never undefined
     *
     * Pattern: Check if data exists, add it, then return session
     */
    async session({ session, token }) {
      // Add user ID to session if available
      if (token.id && session.user) {
        const userId = token.id as string;
        session.user.id = userId;
        session.user.role = (token.role || "user") as BuiltinUserRole;

        if (!isBuiltinUserId(userId)) {
          const dbClient = getDbClient();

          if (dbClient) {
            try {
              const user = await dbClient.query.users.findFirst({
                where: eq(users.id, userId),
                columns: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              });
              const profile = await dbClient.query.profiles.findFirst({
                where: eq(profiles.userId, userId),
                columns: {
                  fullName: true,
                  email: true,
                  avatarUrl: true,
                },
              });

              if (user) {
                session.user.name = profile?.fullName || user.name;
                session.user.email = profile?.email || user.email || session.user.email;
                session.user.image = profile?.avatarUrl || user.image;
              }
            } catch (error) {
              debugWarn("[Auth] Session refresh from database failed:", error);
            }
          }
        }
      }
      // Always return session - even if no changes
      return session;
    },
    /**
     * SignIn Callback
     * CRITICAL: Return boolean, not redirect
     */
    async signIn({ user, account }) {
      if (account?.provider === "credentials" || account?.provider === "demo") {
        if (isBuiltinUserId(user.id)) {
          try {
            await ensureBuiltinUserRecord(user.id);
          } catch (error) {
            debugWarn("[Auth] Built-in database identity sync failed:", error);
          }
        }
        return true;
      }

      if (account?.provider && account.providerAccountId) {
        if (!user.email || !isOAuthEmailVerified(account.provider, account.id_token)) {
          debugWarn("[Auth] Blocked OAuth sign-in without verified provider email:", {
            provider: account.provider,
            hasEmail: Boolean(user.email),
          });
          return false;
        }

        await ensureOAuthUserRecord({
          user,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          accountType: account.type,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          tokenType: account.token_type,
          scope: account.scope,
          idToken: account.id_token,
          sessionState:
            typeof account.session_state === "string" ? account.session_state : undefined,
        });
      }

      return true;
    },
    /**
     * Redirect Callback
     * CRITICAL: Return the redirect URL string, not a Response object
     */
    async redirect({ url, baseUrl }) {
      const redirectUrl = resolveAuthRedirect(url, baseUrl);
      if (redirectUrl !== url && !url.startsWith("/")) {
        debugWarn("[Auth] Replaced untrusted redirect URL:", { baseUrl });
      }
      return redirectUrl;
    },
  },
  events: {
    /**
     * Create User Event
     * CRITICAL: Use Drizzle properly to avoid connection issues
     */
    async createUser({ user }) {
      debugLog("New user created:", user.email);
      if (user.id && !isBuiltinUserId(user.id)) {
        await recordActivity({
          userId: user.id,
          userEmail: user.email,
          type: "register",
          feature: "account",
          title: "Account registered",
          description: "Account access was created.",
        });
      }
    },
    /**
     * Sign In Event
     * CRITICAL: Log for debugging, don't throw
     */
    async signIn({ user, isNewUser }) {
      debugLog(`User signed in: ${user.email}, isNewUser: ${isNewUser}`);
      // Login events are intentionally not shown in the product activity feed.
      // They happen often and drown out rarer account, billing, and dataset events.
    },
  },
  debug: process.env.NODE_ENV === "development",
  logger: {
    error: (error) => {
      debugError("NextAuth error:", error);
    },
    warn: (warning) => {
      debugWarn("NextAuth warning:", warning);
    },
  },
  /**
   * CRITICAL: Trust host for production deployments
   */
  trustHost: true,
});

function normalizeLocalAuthUrlEnv() {
  if (process.env.NODE_ENV === "production") return;

  const configuredUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!configuredUrl || isLocalAuthUrl(configuredUrl)) return;

  debugWarn("[Auth] Ignoring non-local auth URL during local development.");
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
  process.env.AUTH_TRUST_HOST ||= "true";
}

function resolveCredentialsRole(email?: string | null): BuiltinUserRole {
  const adminEmail = (process.env.ADMIN_AUTH_BYPASS_EMAIL || "superadmin@useclevr.com")
    .trim()
    .toLowerCase();
  return email?.trim().toLowerCase() === adminEmail ? "superadmin" : "user";
}

function logCredentialsAuthEvent(
  event: string,
  details: { email?: string | null; verificationPurpose?: string },
) {
  console.warn("[Auth] Credentials sign-in event", {
    event,
    email: maskEmail(details.email),
    verificationPurpose: details.verificationPurpose,
  });
}

function logCredentialsAuthError(event: string, error: unknown) {
  console.error("[Auth] Credentials sign-in failure", {
    event,
    error: getAuthErrorLogDetails(error),
  });
}

function getAuthErrorLogDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const cause = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    stack?: unknown;
  };

  return {
    name: stringifyAuthLogValue(cause.name),
    message: stringifyAuthLogValue(cause.message),
    code: stringifyAuthLogValue(cause.code),
    stack: stringifyAuthLogValue(cause.stack),
  };
}

function stringifyAuthLogValue(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function maskEmail(email?: string | null) {
  if (!email) return undefined;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[invalid-email]";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

function firstEnvValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function isOAuthEmailVerified(provider?: string, idToken?: string) {
  if (!idToken) return true;

  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1] || "", "base64url").toString("utf8"),
    ) as {
      email_verified?: boolean;
    };
    if (payload.email_verified === false) return false;
    if (provider === linkedinProviderId) return true;
    return true;
  } catch {
    return true;
  }
}

function isLocalAuthUrl(value: string) {
  try {
    return isLocalAuthOrigin(new URL(value));
  } catch {
    return false;
  }
}

function logOAuthProviderConfig() {
  if (process.env.NODE_ENV !== "development") return;

  const origin = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "request-origin";
  const callbackBase =
    origin === "request-origin"
      ? `${origin}/api/auth/callback`
      : `${origin.replace(/\/$/, "")}/api/auth/callback`;

  if (!authSecret) {
    debugWarn(
      "[Auth] Missing AUTH_SECRET/NEXTAUTH_SECRET. OAuth callbacks fail with Configuration until one is set.",
    );
  }

  debugLog("[Auth] OAuth provider configuration:", {
    google: {
      enabled: Boolean(googleClientId && googleClientSecret),
      providerId: googleProviderId,
      callbackUrl: `${callbackBase}/${googleProviderId}`,
      env: "AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET",
      aliases: "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET",
    },
    linkedin: {
      enabled: Boolean(linkedinClientId && linkedinClientSecret),
      providerId: linkedinProviderId,
      callbackUrl: `${callbackBase}/${linkedinProviderId}`,
      env: "AUTH_LINKEDIN_ID/AUTH_LINKEDIN_SECRET",
      aliases: "LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET",
    },
    authUrlEnv: process.env.AUTH_URL
      ? "AUTH_URL"
      : process.env.NEXTAUTH_URL
        ? "NEXTAUTH_URL"
        : "request host",
    secretEnv: process.env.AUTH_SECRET
      ? "AUTH_SECRET"
      : process.env.NEXTAUTH_SECRET
        ? "NEXTAUTH_SECRET"
        : "missing",
  });
}

async function ensureOAuthUserRecord({
  user,
  provider,
  providerAccountId,
  accountType,
  accessToken,
  refreshToken,
  expiresAt,
  tokenType,
  scope,
  idToken,
  sessionState,
}: {
  user: { id?: string; email?: string | null; name?: string | null; image?: string | null };
  provider: string;
  providerAccountId: string;
  accountType?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
  idToken?: string;
  sessionState?: string;
}) {
  const dbClient = getDbClient();
  const email = user.email?.trim().toLowerCase();

  if (!dbClient || !email) return;

  const existingUser = await dbClient.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });

  // Use consistent ID format: user_{uuid} for new users
  const userId = existingUser?.id || `user_${uuidv4()}`;
  user.id = userId;

  if (existingUser) {
    await dbClient
      .update(users)
      .set({
        name: user.name || null,
        image: user.image || null,
      })
      .where(eq(users.id, userId));
  } else {
    await dbClient.insert(users).values({
      id: userId,
      email,
      name: user.name || null,
      image: user.image || null,
      emailVerified: new Date(),
    });

    await recordActivity({
      userId,
      userEmail: email,
      type: "register",
      feature: "account",
      title: "Account registered",
      description: "Account access was created.",
    });
  }

  await dbClient
    .insert(accounts)
    .values({
      id: uuidv4(),
      userId,
      type: accountType || "oauth",
      provider,
      providerAccountId,
      accessToken: accessToken || null,
      refreshToken: refreshToken || null,
      expiresAt: expiresAt || null,
      tokenType: tokenType || null,
      scope: scope || null,
      idToken: idToken || null,
      sessionState: sessionState || null,
    })
    .onConflictDoUpdate({
      target: [accounts.provider, accounts.providerAccountId],
      set: {
        userId,
        accessToken: accessToken || null,
        refreshToken: refreshToken || null,
        expiresAt: expiresAt || null,
        tokenType: tokenType || null,
        scope: scope || null,
        idToken: idToken || null,
        sessionState: sessionState || null,
      },
    });

  const existingProfile = await dbClient.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { id: true },
  });

  if (existingProfile) {
    await dbClient
      .update(profiles)
      .set({
        email,
        firstName: getFirstName(user.name || null),
        fullName: user.name || null,
        avatarUrl: user.image || null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId));
  } else {
    await dbClient.insert(profiles).values({
      id: uuidv4(),
      userId,
      email,
      firstName: getFirstName(user.name || null),
      fullName: user.name || null,
      avatarUrl: user.image || null,
      role: "owner",
    });
  }
}

function getFirstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || null;
}
