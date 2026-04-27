# Next.js 14 Header Errors Guide

## Understanding "Cannot append headers after they are sent to the client"

This error occurs when your code tries to modify HTTP headers after the response has already been sent to the client. In Next.js 14 with the App Router, this commonly happens when:

1. Multiple `redirect()` calls in the same execution path
2. Calling `next()` in middleware after already returning a response
3. Sending multiple responses from API routes
4. Calling `redirect()` in Server Components after data has been streamed
5. Mixing `useRouter().push()` with `redirect()` in the same flow

---

## Critical Patterns to Prevent Header Errors

### 1. Middleware Response Flow

**❌ WRONG - Multiple returns with potential conflicts:**
```typescript
// middleware.ts
export default auth((request) => {
  const isLoggedIn = !!request.auth
  
  if (isOnProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  
  // BUG: This might execute even after redirect in some edge cases
  return NextResponse.next()
})
```

**✅ CORRECT - Single clear exit path:**
```typescript
// middleware.ts
export default auth((request) => {
  const isLoggedIn = !!request.auth
  const pathname = request.nextUrl.pathname
  
  // Early return for protected routes
  if (pathname.startsWith("/app") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  
  // Early return for auth pages
  if ((pathname === "/login" || pathname === "/signup") && isLoggedIn) {
    return NextResponse.redirect(new URL("/app", request.url))
  }
  
  // Single exit point for all other cases
  return NextResponse.next()
})
```

**Key Points:**
- Return immediately after `redirect()` - no code after
- Use `request.nextUrl.clone()` or `new URL()` to create redirect URLs
- Never call `next()` after returning a response

---

### 2. Server Component Redirect Pattern

**❌ WRONG - Multiple response patterns:**
```typescript
// app/page.tsx
export default async function Page() {
  const session = await auth()
  
  if (!session) {
    redirect("/login") // This sends response
  }
  
  // BUG: Trying to render after redirect
  return <Dashboard />
}
```

**✅ CORRECT - Single redirect point:**
```typescript
// app/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function ProtectedPage() {
  // CRITICAL: Check auth FIRST, before any rendering
  const session = await auth()
  
  if (!session) {
    // CRITICAL: Only ONE redirect, then stop
    redirect("/login")
  }
  
  // This code only runs if authenticated
  return (
    <div>
      <h1>Protected Content</h1>
      <p>Welcome, {session.user?.email}</p>
    </div>
  )
}
```

**Key Points:**
- Call `redirect()` immediately in Server Components
- Never call `redirect()` after rendering any JSX
- Use `redirect()` from `next/navigation`, not `next/router`

---

### 3. Client Component Navigation Pattern

**❌ WRONG - Mixing navigation methods:**
```typescript
"use client"
import { useRouter } from "next/navigation"

export default function LoginForm() {
  const router = useRouter()
  
  async function handleSubmit(formData: FormData) {
    const result = await login(formData)
    
    if (result.success) {
      router.push("/app") // Uses client-side navigation
      router.refresh() // BUG: Can cause header conflicts
    }
  }
}
```

**✅ CORRECT - Consistent navigation:**
```typescript
"use client"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

export default function LoginForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  async function handleSubmit(formData: FormData) {
    const result = await login(formData)
    
    if (result.success) {
      // Use startTransition for navigation after mutations
      startTransition(() => {
        router.push("/app")
        router.refresh() // Safe inside transition
      })
    }
  }
}
```

**Key Points:**
- Use `useTransition()` for navigation after data mutations
- Don't mix `router.push()` with server-side redirects
- Use `router.replace()` instead of `push()` when you don't want history

---

### 4. API Route Response Pattern

**❌ WRONG - Multiple responses:**
```typescript
export async function POST(request: Request) {
  const data = await request.json()
  
  if (!data.email) {
    return Response.json({ error: "Email required" }, { status: 400 })
  }
  
  // BUG: Sending another response
  return Response.json({ success: true })
}
```

**✅ CORRECT - Single response path:**
```typescript
export async function POST(request: Request) {
  try {
    const data = await request.json()
    
    // Validate and return early on error
    if (!data.email) {
      return Response.json({ error: "Email required" }, { status: 400 })
    }
    
    // Process data...
    const result = await processData(data)
    
    // Single success response
    return Response.json({ success: true, data: result })
    
  } catch (error) {
    // Centralized error handling
    console.error("API error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

**Key Points:**
- Use try-catch for all async operations
- Return early on validation errors
- Single return statement for success path

---

### 5. NextAuth v5 (Auth.js) Callback Pattern

**❌ WRONG - Undefined returns:**
```typescript
async session({ session, token }) {
  if (token.id) {
    session.user.id = token.id
  }
  // BUG: Implicitly returns undefined if no token.id
}
```

**✅ CORRECT - Always return session:**
```typescript
async session({ session, token }) {
  if (token.id && session.user) {
    session.user.id = token.id as string
  }
  // Always return session, even if unchanged
  return session
}

async jwt({ token, user }) {
  if (user) {
    token.id = user.id
  }
  // Always return token
  return token
}
```

**Key Points:**
- Callbacks must always return a value
- Never throw in callbacks after partial processing
- Use type guards to check object existence

---

## Prisma Client Pattern for Next.js

**❌ WRONG - Multiple instances:**
```typescript
import { PrismaClient } from '@prisma/client'

// Creates new connection on every import
const prisma = new PrismaClient()
export default prisma
```

**✅ CORRECT - Singleton pattern:**
```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

// Global type for preventing multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Reuse existing instance in development, create new in production
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

// Store in global to prevent hot-reload from creating new instances
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
```

**Why this prevents errors:**
- Prevents connection pool exhaustion
- Reduces connection overhead
- Works correctly with Next.js server components

---

## Environment Setup

### 1. Neon.tech PostgreSQL Setup

1. Create account at https://console.neon.tech
2. Create a new project
3. Go to "Connection Details"
4. Copy the connection string
5. Add `?sslmode=require` to the end for production

### 2. Environment Variables

```bash
# .env.local
DATABASE_URL="postgresql://user:password@ep-xxx.region.neon.tech/database?sslmode=require"
NEXTAUTH_SECRET="your-secret-key-at-least-32-characters"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Database Setup

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Open Prisma Studio (optional, for debugging)
npm run db:studio
```

---

## Deployment to Vercel

### 1. Environment Variables

Add these in Vercel Dashboard:
- `DATABASE_URL` - Neon.tech connection string
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` - Your Vercel domain (e.g., https://your-app.vercel.app)

### 2. Neon.tech Vercel Integration

1. Go to Neon Dashboard > Settings > Integrations
2. Connect to Vercel
3. Select your project
4. Neon will automatically set environment variables

### 3. Build Settings

Next.js automatic settings work correctly:
```bash
# Build command
npm run build

# Output directory
.next

# Install command (for Prisma)
npm run postinstall
```

---

## Troubleshooting

### Error: "Cannot append headers after they are sent to the client"

**Checklist:**
1. [ ] Only one `redirect()` call per execution path in middleware
2. [ ] No code after `redirect()` in Server Components
3. [ ] Not mixing `router.push()` with server redirects
4. [ ] API routes return only one response
5. [ ] NextAuth callbacks always return values

### Error: "NEXT_REDIRECT" in console

This is expected behavior - it's how Next.js handles redirects internally. The actual redirect still works correctly.

### Session not persisting

1. Check `NEXTAUTH_SECRET` is set and consistent
2. Verify `trustHost: true` in NextAuth config
3. Ensure cookies are not being blocked

---

## Complete File Structure

```
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts      # NextAuth API handlers
│   ├── app/                      # Protected routes
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Public homepage
├── components/
│   └── providers/
│       └── auth-provider.tsx     # Client-side auth
├── lib/
│   ├── auth.ts                   # NextAuth configuration
│   └── prisma.ts                 # Prisma singleton
├── middleware.ts                 # Route protection
├── prisma/
│   └── schema.prisma             # Database schema
├── .env.local                     # Environment variables
├── next.config.mjs
├── package.json
└── tsconfig.json
```

---

## Quick Reference

| Pattern | Do | Don't |
|---------|-----|-------|
| Middleware | Return immediately after redirect | Call next() after redirect |
| Server Component | Check auth before rendering | Call redirect() after JSX |
| Client Component | Use useTransition() for navigation | Mix router.push() with redirect() |
| API Route | Single return path | Multiple Response.json() calls |
| NextAuth | Always return in callbacks | Throw after partial processing |
| Prisma | Use singleton pattern | Create new client on every import |
