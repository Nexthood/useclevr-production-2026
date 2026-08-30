import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";

import {
  BUILTIN_DEMO_USER,
  BUILTIN_SUPER_ADMIN_USER,
  findBuiltinUserByCredentials,
  isBuiltinUserId,
  isSuperadmin,
  type BuiltinUserRole,
} from "@/lib/auth/builtin-users";
import { ensureBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { consumeVerifiedAuthProof } from "@/lib/auth/email-verification-codes";
import { config } from "@/lib/config";
import { normalizePublicAuthBaseUrl, resolveAuthRedirect } from "@/lib/auth/redirect-origin";
import { recordActivity } from "@/lib/activity/activity-store";
import { getDb } from "@/lib/db";
import { profiles, users } from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

// DIAGNOSTIC: Log when auth module is loaded
debugLog("[Auth] Module loading - initializing NextAuth v5");
debugLog("[Auth] Drizzle client available:", !!getDb());

// Helper to get db with null safety
const getDbClient = () => {
  const client = getDb();
  if (!client) {
    debugWarn("[Auth] Database client is null - built-in credentials only");
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

normalizePublicAuthUrlEnv();
const authSecret = config.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  // Use a simple JWT adapter-like configuration without PrismaAdapter
  // to avoid database connections during module initialization
  providers: [
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

          const profile = await dbClient.query.profiles.findFirst({
            where: eq(profiles.userId, user.id),
            columns: { role: true },
          })
          const role = (isSuperadmin({ email: user.email, role: profile?.role }) ? "superadmin" : profile?.role || "user") as BuiltinUserRole

          logCredentialsAuthEvent("authorized", { email: user.email, verificationPurpose });
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role,
          };
        } catch (error) {
          logCredentialsAuthError("authorize_exception", error);
          return null;
        }
      },
    }),
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
      if (token.id && session.user) {
        const userId = token.id as string;
        session.user.id = userId;
        session.user.role = (token.role || "user") as BuiltinUserRole;

        if (isBuiltinUserId(userId)) {
          const builtinUser = userId === BUILTIN_SUPER_ADMIN_USER.id
            ? BUILTIN_SUPER_ADMIN_USER
            : userId === BUILTIN_DEMO_USER.id
              ? BUILTIN_DEMO_USER
              : null;

          if (builtinUser) {
            session.user.name = builtinUser.name;
            session.user.email = builtinUser.email;
          }
        }

        if (userId === BUILTIN_SUPER_ADMIN_USER.id) {
          session.user.role = "superadmin" as BuiltinUserRole;
          session.user.name = BUILTIN_SUPER_ADMIN_USER.name;
        } else if (!isBuiltinUserId(userId)) {
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
                  role: true,
                },
              });

              if (user || profile) {
                session.user.name = profile?.fullName || user?.name || session.user.name;
                session.user.email = profile?.email || user?.email || session.user.email;
                session.user.image = profile?.avatarUrl || user?.image;
                const sessionIsSuperadmin =
                  isSuperadmin({ id: userId, email: profile?.email, role: profile?.role || String(token.role || "") }) ||
                  isSuperadmin({ id: userId, email: user?.email, role: profile?.role || String(token.role || "") }) ||
                  isSuperadmin({ id: userId, email: session.user.email, role: profile?.role || String(token.role || "") })
                session.user.role = (sessionIsSuperadmin ? "superadmin" : profile?.role || token.role || "user") as BuiltinUserRole;
              }
            } catch (error) {
              debugWarn("[Auth] Session refresh from database failed:", error);
            }
          }
        }
      }
      return session;
    },
    /**
     * SignIn Callback
     * CRITICAL: Return boolean, not redirect
     */
    async signIn({ user, account }) {
      if (account?.provider === "credentials") {
        if (isBuiltinUserId(user.id)) {
          try {
            await ensureBuiltinUserRecord(user.id);
          } catch (error) {
            debugWarn("[Auth] Built-in database identity sync failed:", error);
          }
        }
        return true;
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

function normalizePublicAuthUrlEnv() {
  const configuredUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  const publicUrl = normalizePublicAuthBaseUrl(configuredUrl || getAuthUrlFallback());

  if (configuredUrl && configuredUrl !== publicUrl) {
    debugWarn("[Auth] Normalized public auth URL to avoid exposing an unsafe bind host.");
  }

  process.env.AUTH_URL = publicUrl;
  process.env.NEXTAUTH_URL = publicUrl;
  process.env.AUTH_TRUST_HOST ||= "true";
}

function getAuthUrlFallback() {
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;
  if (railwayDomain) return `https://${railwayDomain}`;
  if (process.env.RAILWAY_ENVIRONMENT_ID) return "https://app.useclevr.com";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || "8080"}`;
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
