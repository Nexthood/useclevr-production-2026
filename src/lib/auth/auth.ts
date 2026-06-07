import { v4 as uuidv4 } from "uuid";
import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";

import {
  BUILTIN_DEMO_USER,
  findBuiltinUserByCredentials,
  isBuiltinUserId,
  type BuiltinUserRole,
} from "@/lib/auth/builtin-users";
import { recordActivity } from "@/lib/activity/activity-store";
import { getDb } from "@/lib/db";
import { accounts, profiles, users } from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import LinkedIn from "next-auth/providers/linkedin"
import { z } from "zod"
import "@/lib/config"

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
});

const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
const linkedinClientId = process.env.AUTH_LINKEDIN_ID;
const linkedinClientSecret = process.env.AUTH_LINKEDIN_SECRET;

normalizeLocalAuthUrlEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
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

          const { email, password } = validatedFields.data;
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
            return null;
          }

          // Verify password
          const isValid = await bcrypt.compare(password, user.password);

          if (!isValid) {
            return null;
          }

           return {
             id: user.id,
             email: user.email,
             name: user.name,
             image: user.image,
             role: "user",
           };
        } catch (error) {
          debugError("Auth error:", error);
          return null;
        }
      },
    }),
    ...(googleClientId && googleClientSecret
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : []),
    ...(linkedinClientId && linkedinClientSecret
      ? [
          LinkedIn({
            clientId: linkedinClientId,
            clientSecret: linkedinClientSecret,
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
        // Credentials provider already validated in authorize()
        return true;
      }

      if (account?.provider && account.providerAccountId) {
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
          sessionState: typeof account.session_state === "string" ? account.session_state : undefined,
        });
      }

      return true;
    },
    /**
     * Redirect Callback
     * CRITICAL: Return the redirect URL string, not a Response object
     */
    async redirect({ url, baseUrl }) {
      try {
        if (url.startsWith("/")) return `${baseUrl}${url}`;

        const targetUrl = new URL(url);
        if (targetUrl.origin === baseUrl || isLocalAuthOrigin(targetUrl)) {
          return targetUrl.toString();
        }

        debugWarn("[Auth] Blocked cross-origin redirect:", {
          targetOrigin: targetUrl.origin,
          baseUrl,
        });
      } catch (error) {
        debugWarn("[Auth] Ignoring invalid redirect URL:", error);
      }

      return `${baseUrl}/login`;
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

  const configuredUrl = process.env.AUTH_URL;
  if (!configuredUrl || isLocalAuthUrl(configuredUrl)) return;

  debugWarn("[Auth] Ignoring non-local auth URL during local development.");
  delete process.env.AUTH_URL;
  process.env.AUTH_TRUST_HOST ||= "true";
}

function isLocalAuthUrl(value: string) {
  try {
    return isLocalAuthOrigin(new URL(value));
  } catch {
    return false;
  }
}

function isLocalAuthOrigin(url: URL) {
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
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
    await dbClient.update(users)
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

  await dbClient.insert(accounts)
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
    await dbClient.update(profiles)
      .set({
        email,
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
      fullName: user.name || null,
      avatarUrl: user.image || null,
    });
  }
}
