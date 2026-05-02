import { debugLog, debugError, debugWarn } from "@/lib/debug"

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { getDb } from "@/lib/db"
import { profiles, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { z } from "zod"
import {
  BUILTIN_DEMO_USER,
  type BuiltinUserRole,
  findBuiltinUserByCredentials,
  isBuiltinUserId,
} from "@/lib/auth/builtin-users"

// DIAGNOSTIC: Log when auth module is loaded
debugLog('[Auth] Module loading - initializing NextAuth v5')
debugLog('[Auth] Drizzle client available:', !!getDb())

// Helper to get db with null safety
const getDbClient = () => {
  const client = getDb()
  if (!client) {
    debugWarn('[Auth] Database client is null - using demo mode only')
    return null
  }
  return client
}

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
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
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
        debugLog('[Demo] Demo login authenticated')
        return {
          id: BUILTIN_DEMO_USER.id,
          email: BUILTIN_DEMO_USER.email,
          name: BUILTIN_DEMO_USER.name,
          image: null,
          role: BUILTIN_DEMO_USER.role,
        }
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
          const rawEmail = typeof credentials?.email === "string" ? credentials.email : ""
          const rawPassword = typeof credentials?.password === "string" ? credentials.password : ""

          const builtinUser = findBuiltinUserByCredentials(rawEmail, rawPassword)
          if (builtinUser) {
            debugLog(`[Auth] Built-in ${builtinUser.role} credentials authenticated`)
            return {
              id: builtinUser.id,
              email: builtinUser.email,
              name: builtinUser.name,
              image: null,
              role: builtinUser.role,
            }
          }

          // Validate input first
          const validatedFields = loginSchema.safeParse(credentials)
          
          if (!validatedFields.success) {
            return null
          }

          const { email, password } = validatedFields.data
          const dbClient = getDbClient()

          if (!dbClient) {
            return null
          }

          // Query database
          let user
          try {
            const userResult = await dbClient.query.users.findFirst({
              where: eq(users.email, email),
            })
            user = userResult
          } catch (dbError) {
            debugError("Database connection error during auth:", dbError)
            return null
          }

          // User not found or no password
          if (!user || !user.password) {
            return null
          }

          // Verify password
          const isValid = await bcrypt.compare(password, user.password)

          if (!isValid) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          }
        } catch (error) {
          debugError("Auth error:", error)
          return null
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
        token.id = user.id
        token.role = ("role" in user ? user.role : "user") as BuiltinUserRole
      }
      // Always return the token
      return token
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
        const userId = token.id as string
        session.user.id = userId
        session.user.role = (token.role || "user") as BuiltinUserRole

        if (!isBuiltinUserId(userId)) {
          const dbClient = getDbClient()

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
              })
              const profile = await dbClient.query.profiles.findFirst({
                where: eq(profiles.userId, userId),
                columns: {
                  fullName: true,
                  email: true,
                  avatarUrl: true,
                },
              })

              if (user) {
                session.user.name = profile?.fullName || user.name
                session.user.email = profile?.email || user.email || session.user.email
                session.user.image = profile?.avatarUrl || user.image
              }
            } catch (error) {
              debugWarn("[Auth] Session refresh from database failed:", error)
            }
          }
        }
      }
      // Always return session - even if no changes
      return session
    },
    /**
     * SignIn Callback
     * CRITICAL: Return boolean, not redirect
     */
    async signIn({ user, account }) {
      // Allow OAuth sign in
      if (account?.provider === "credentials") {
        // Credentials provider already validated in authorize()
        return true
      }
      // Allow OAuth providers
      return true
    },
    /**
     * Redirect Callback
     * CRITICAL: Return the redirect URL string, not a Response object
     */
    async redirect({ url, baseUrl }) {
      try {
        // Allows relative URLs
        if (url.startsWith("/")) return `${baseUrl}${url}`
        // Allows URLs on the same origin
        if (new URL(url).origin === baseUrl) return url
      } catch (error) {
        debugWarn("[Auth] Ignoring invalid redirect URL:", error)
      }

      return `${baseUrl}/login`
    },
  },
  events: {
    /**
     * Create User Event
     * CRITICAL: Use Drizzle properly to avoid connection issues
     */
    async createUser({ user }) {
      debugLog("New user created:", user.email)
      // You could send welcome email here
    },
    /**
     * Sign In Event
     * CRITICAL: Log for debugging, don't throw
     */
    async signIn({ user, isNewUser }) {
      debugLog(`User signed in: ${user.email}, isNewUser: ${isNewUser}`)
    },
  },
  debug: process.env.NODE_ENV === "development",
  logger: {
    error: (error) => {
      debugError("NextAuth error:", error)
    },
    warn: (warning) => {
      debugWarn("NextAuth warning:", warning)
    },
  },
  /**
   * CRITICAL: Trust host for production deployments
   */
  trustHost: true,
})
