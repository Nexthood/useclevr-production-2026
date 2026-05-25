# Migrate to Payload CMS

## Overview

Integrate Payload CMS into the existing UseClevr Next.js app while preserving current functionality.

## Current State (Before Migration)

- Homepage at `/` (public/marketing)
- App at `/app` (dashboard, settings, AI analyst)
- Next.js 16.2.4, React 19, pnpm
- Stripe for payments, Neon Postgres database

## Target State

- `/` - Homepage unchanged
- `/alpha` - Existing app experience
- `/admin` - Payload CMS admin panel
- `/api/payload/*` - Payload API routes
- Payments remain with Stripe (source of truth)
- Payload stores CMS content + minimal billing metadata

---

## Phase 1: Next.js & Project Setup

### Task 1.1: Verify Current Setup

- [ ] Check `package.json` for current versions
- [ ] Check `next.config.*` for existing config
- [ ] Check `app/` structure
- [ ] Check if `pages/` directory exists

### Task 1.2: Next.js Version Check

- [ ] Current version is already latest stable (per user confirmation)
- [ ] No immediate upgrade required

---

## Phase 2: Routing Restructure

### Task 2.1: Create `/alpha` Route Structure

- [ ] Move `app/(dashboard)` content to `app/(alpha)`
- [ ] Update imports to use shared components
- [ ] Ensure `app/page.tsx` (homepage) stays at `/`

### Task 2.2: Verify Routes

- `/` - Homepage (unchanged)
- `/alpha` - App experience
- `/admin` - Payload admin (to be added)

---

## Phase 3: Payload Integration

### Task 3.1: Install Payload

```bash
pnpm add payload @payloadcms/plugin-cloud-storage
```

### Task 3.2: Create Payload Config

- [ ] Create `src/payload/payload.config.ts`
- [ ] Set `serverURL` from `NEXT_PUBLIC_SERVER_URL`
- [ ] Configure Neon Postgres in `DATABASE_URL`

### Task 3.3: Add Collections

- [ ] FAQ items collection
- [ ] Blog posts collection
- [ ] Changelog entries collection
- [ ] Static page sections
- [ ] Legal pages

### Task 3.4: Create Admin Route

- [ ] Add `app/admin/` route with Payload admin panel
- [ ] Add `app/api/payload/[...path]/route.ts` for API

---

## Phase 4: Environment Variables

Add to `.env.example`:

- `PAYLOAD_SECRET` - Secret for Payload sessions
- `NEXT_PUBLIC_SERVER_URL` - Server URL (for payload links)

---

## Phase 5: Railway Deployment

### Task 5.1: Verify Single Service

- [ ] Payload runs in same Railway service
- [ ] No separate Railway service needed

### Task 5.2: Build/Start Commands

- Build command: `pnpm build`
- Start command: `pnpm start`

---

## Phase 6: Documentation

Create `docs/Developer_Guides/PAYLOAD_INTEGRATION.md`:

- What was added
- Where Payload config lives (`src/payload/`)
- How `/admin` works
- How `/alpha` routing works
- Required env vars
- What was NOT changed

---

## Acceptance Criteria

- [ ] `pnpm install` succeeds
- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` passes (or issues documented)
- [ ] Homepage `/` loads unchanged
- [ ] App works at `/alpha`
- [ ] `/admin` loads Payload admin
- [ ] Payload uses Neon Postgres
- [ ] Stripe checkout still works
- [ ] Static assets load correctly
- [ ] No Railway disk storage for CMS media

---

## Risks & Constraints

- DO NOT refactor existing code unnecessarily
- DO NOT redesign UI
- DO NOT break Stripe checkout/webhooks
- DO NOT use Railway disk for persistent media uploads
