import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db, getDb } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { z } from "zod"

// DIAGNOSTIC: Log when auth module is loaded
console.log('[Auth] Module loading - initializing NextAuth v5')
console.log('[Auth] Drizzle client available:', !!getDb())

// Helper to get db with null safety
const getDbClient = () => {
  const client = getDb()
  if (!client) {
    console.warn('[Auth] Database client is null - using demo mode only')
    return null
  }
  return client
}

// Demo user - no database required
const DEMO_USER = {
  id: "demo-user-id",
  email: "demo@useclever.app",
  name: "Demo User",
  image: null,
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
        console.log('[Demo] Demo login authenticated')
        return DEMO_USER
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
          // Validate input first
          const validatedFields = loginSchema.safeParse(credentials)
          
          if (!validatedFields.success) {
            return null
          }

          const { email, password } = validatedFields.data

          // Query database
          let user
          try {
            const userResult = await db.query.users.findFirst({
              where: eq(users.email, email),
            })
            user = userResult
          } catch (dbError) {
            console.error("Database connection error during auth:", dbError)
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
          console.error("Auth error:", error)
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
        session.user.id = token.id as string
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
      // Allows relative URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      // Default to dashboard
      return `${baseUrl}/app`
    },
  },
  events: {
    /**
     * Create User Event
     * CRITICAL: Use Drizzle properly to avoid connection issues
     */
    async createUser({ user }) {
      console.log("New user created:", user.email)
      // You could send welcome email here
    },
    /**
     * Sign In Event
     * CRITICAL: Log for debugging, don't throw
     */
    async signIn({ user, isNewUser }) {
      console.log(`User signed in: ${user.email}, isNewUser: ${isNewUser}`)
    },
  },
  debug: process.env.NODE_ENV === "development",
  logger: {
    error: (error) => {
      console.error("NextAuth error:", error)
    },
    warn: (warning) => {
      console.warn("NextAuth warning:", warning)
    },
  },
  /**
   * CRITICAL: Trust host for production deployments
   */
  trustHost: true,
})
