# Next.js 14 + NextAuth v5 + Drizzle + Neon.tech + Railway Setup Guide

> **Note**: This guide is updated for Railway Node.js deployment. Legacy Vercel docs are preserved for reference only.

## Prerequisites

- Node.js 18+ 
- npm or yarn or pnpm
- Neon.tech account (free tier works)
- Git

---

## Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd useclever-2026

# Install dependencies
npm install

# If you see any peer dependency warnings, run:
npm install --legacy-peer-deps
```

---

## Step 2: Set Up Neon.tech Database

### Option A: Create New Project

1. Go to https://console.neon.tech
2. Click "Create a new project"
3. Name: `useclever`
4. Select region closest to your users
5. Click "Create project"

### Option B: Use Existing Project

1. Go to https://console.neon.tech
2. Select your project
3. Go to "Connection Details"
4. Copy the connection string

### Configure Connection String

Your Neon.tech connection string looks like:
```
postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/database
```

Add `?sslmode=require` for production:
```
postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/database?sslmode=require
```

---

## Step 3: Configure Environment Variables

```bash
# Copy example env file
cp .env.local.example .env.local

# Edit with your values
nano .env.local
```

**Required variables:**
```env
# DATABASE_URL - From Neon.tech Console > Connection Details
DATABASE_URL="postgresql://user:pass@ep-xxx.region.neon.tech/db?sslmode=require"

# NEXTAUTH_SECRET - Generate with:
# openssl rand -base64 32
NEXTAUTH_SECRET="your-secret-key-minimum-32-characters"

# NEXTAUTH_URL - Your development or production URL
NEXTAUTH_URL="http://localhost:3000"
```

---

## Step 4: Set Up Database Schema

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push

# Optional: Open Prisma Studio to view data
npm run db:studio
```

---

## Step 5: Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

---

## Step 6: Test Authentication

1. Go to `/signup` to create an account
2. Check your database in Prisma Studio - user should appear
3. Go to `/login` to sign in
4. Visit `/app` - should redirect to dashboard

---

## Development Workflow

### Database Changes

```bash
# Make changes to prisma/schema.prisma

# Push changes to database
npm run db:push

# Regenerate Prisma Client
npm run db:generate
```

### Adding New Models

1. Edit `prisma/schema.prisma`
2. Run `npm run db:push`
3. Run `npm run db:generate`
4. Import new types in your code

---

## Production Deployment

### 1. Vercel Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### 2. Environment Variables in Vercel

Add these in Vercel Dashboard > Settings > Environment Variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon.tech connection string |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Vercel domain (e.g., https://your-app.vercel.app) |

### 3. Neon.tech Vercel Integration

1. Go to Neon Dashboard > Settings > Integrations
2. Click "Connect to Vercel"
3. Select your Vercel project
4. Environment variables are set automatically

### 4. Build Command

Vercel automatically detects Next.js and uses:
```
npm run build
```

The `postinstall` script in package.json runs `prisma generate` automatically.

---

## Common Issues

### "Cannot append headers after they are sent to the client"

**Solution:**
- Don't call `redirect()` after JSX in Server Components
- Don't call `next()` after returning from middleware
- Don't mix `router.push()` with server redirects

See `docs/HEADER_ERRORS_GUIDE.md` for detailed solutions.

### Demo User Not Found

**Error:** "Demo user not found. Please run database seed"

**Solution:**
```bash
# Seed the database with demo user
npx prisma db seed

# Or manually create the demo user in Prisma Studio
npm run db:studio
```

**Demo user email:** `demo@useclever.app`

### Demo Mode Not Working

**Check the following:**
1. `DEMO_MODE=true` is set in `.env.local`
2. Database is running and accessible
3. Demo user exists in the database
4. Check browser console for `[UPLOAD-DEBUG]` logs

### Authentication Not Working

**Check the following:**
1. `NEXTAUTH_SECRET` is set in `.env.local`
2. `NEXTAUTH_URL` is set correctly
3. `DATABASE_URL` is accessible
4. Check browser console for auth errors
5. Run: `curl http://localhost:3000/api/auth/session`

### AI Features Not Working

**Error:** "No AI API key configured"

**Solution:**
Add one of the following to `.env.local`:
```env
# DeepSeek (recommended - cheaper)
DEEPSEEK_API_KEY="sk-..."

# OpenAI (fallback)
OPENAI_API_KEY="sk-..."
```

### Prisma Client Connection Issues

**Solution:**
- Use the singleton pattern in `lib/prisma.ts`
- Don't create new PrismaClient instances
- Use `npm run db:generate` after installing dependencies

### Session Not Persisting

**Solution:**
- Check `NEXTAUTH_SECRET` is set correctly
- Ensure cookies aren't blocked
- Add `trustHost: true` in NextAuth config

### Database Connection Refused

**Solution:**
- Check `DATABASE_URL` format
- Ensure Neon.tech IP allowlist includes your IP
- Add `?sslmode=require` to connection string

---

## Project Structure

```
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts      # NextAuth handlers
│   ├── app/                      # Protected routes
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── signup/
│   │   └── page.tsx
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Public homepage
├── components/
│   ├── providers/
│   │   └── auth-provider.tsx     # Session provider
│   └── ui/                       # UI components
├── lib/
│   ├── auth.ts                   # NextAuth config
│   ├── prisma.ts                 # Prisma singleton
│   └── products.ts               # Product definitions
├── prisma/
│   └── schema.prisma             # Database schema
├── middleware.ts                 # Route protection
├── .env.local                    # Environment variables
├── next.config.mjs
├── package.json
└── tsconfig.json
```

---

## NextAuth v5 vs v4

| Feature | v4 | v5 (Auth.js) |
|---------|-----|--------------|
| Config file | `pages/api/auth/[...nextauth].ts` | `lib/auth.ts` |
| API route | Required | Optional (handlers auto-created) |
| Middleware | Custom | Built-in `auth()` function |
| Session | Callback-based | JWT by default |
| Redirects | In callbacks | In middleware |

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema changes
npm run db:studio        # Open Prisma Studio
npm run db:reset         # Reset database (careful!)

# Debugging
curl http://localhost:3000/api/auth/session  # Check session
```

---

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is at least 32 characters
- [ ] `NEXTAUTH_SECRET` is not committed to git
- [ ] `DATABASE_URL` is not committed to git
- [ ] Passwords are hashed with bcrypt
- [ ] Rate limiting on auth endpoints
- [ ] CSRF protection enabled (default)
- [ ] HTTPS in production
- [ ] Secure cookies (handled by NextAuth)
