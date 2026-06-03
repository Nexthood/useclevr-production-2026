# Payload Migration Transformation Prompts

Planning-only document. Provides practical prompts for another AI to implement Payload CMS integration.

---

## Prompt Set 1: Current State Analysis

**Prompt for AI:** Analyze the existing UseClevr codebase and identify all content that should migrate to Payload CMS.

**Expected Output:**
- List of static/marketing content files in `/src/app/` (homepage, FAQ, pricing)
- List of editable content sources (FAQ items, blog posts, legal pages)
- Database tables suitable for Payload Collections (referralStats, supportTickets, waitlist, appSettings)
- Routes to preserve vs routes to restructure (`/`, `/app`, `/admin`)

---

## Prompt Set 2: Payload Installation Tasks

**Prompt for AI:** Install Payload CMS and configure for Neon Postgres integration.

**Actions:**
1. Run: `pnpm add payload @payloadcms/plugin-cloud-storage`
2. Create `src/payload/payload.config.ts` with:
   - `serverURL` from `NEXT_PUBLIC_SERVER_URL` env var
   - Neon Postgres connection via `DATABASE_URL`
   - Collections: FAQ, blog posts, changelog entries
3. Add environment variables to `.env.example`:
   - `PAYLOAD_SECRET`
   - `NEXT_PUBLIC_SERVER_URL`

---

## Prompt Set 3: Content Collection Migration

**Prompt for AI:** Migrate editable content to Payload Collections.

**Mapping Guide:**
| Current Source | Payload Collection | Notes |
|---------------|-------------------|-------|
| `src/lib/content/faq.ts` | `faqs` collection | Static FAQ → editable |
| `src/lib/content/dashboard-faq.ts` | `dashboardFaqs` collection | In-app help |
| Homepage sections | `pages` collection | Hero, features, CTAs |
| Legal content | `legalPages` collection | Terms, privacy |
| Pricing tiers | `appSettings` key | Keep in DB, expose via Payload |

**Tasks:**
- Create `src/payload/collections/FaqCollection.ts`
- Create `src/payload/collections/BlogCollection.ts`  
- Create `src/payload/collections/LegalPagesCollection.ts`
- Create `src/payload/collections/SettingsCollection.ts`

---

## Prompt Set 4: API Route Creation

**Prompt for AI:** Create Payload API integration routes.

**Files to Create:**
- `src/app/api/payload/[...path]/route.ts` - Main API handler
- `src/app/api/payload/preview/route.ts` - Draft preview for authenticated users
- `src/app/api/payload/search/route.ts` - Public content search endpoint

**Configuration Required:**
- Express compatibility mode for Next.js
- Access control: public read, admin write
- Draft preview for authenticated beta users

---

## Prompt Set 5: Admin Panel Integration

**Prompt for AI:** Add Payload admin panel to existing Next.js app.

**Steps:**
1. Create `src/app/admin/layout.tsx` - Admin layout with auth guard
2. Create `src/app/admin/page.tsx` - Redirect to `/admin/collections`
3. Configure admin access:
   - Superadmin role only
   - Session validation via existing Auth.js
   - No public access

---

## Prompt Set 6: Homepage Restructure

**Prompt for AI:** Restructure routing to isolate Payload content.

**Current:**
- `/` - Homepage with hardcoded content

**Target:**
- `/` - Homepage fetching content from Payload
- `/admin` - Payload admin panel

**Implementation:**
- Modify `src/app/page.tsx` to fetch homepage content from Payload
- Keep existing homepage UI components
- Add fallback for Payload unavailability

---

## Prompt Set 7: Database Schema Mapping

**Prompt for AI:** Map current Drizzle schema to Payload Collections.

**Tables to Migrate:**
| Drizzle Table | Payload Collection | Access Pattern |
|---------------|------------------|----------------|
| `appSettings` | `Settings` | Key-value, admin write |
| `waitlist` | `WaitlistEntries` | Admin read/write |
| `supportTickets` | `Tickets` | User create, admin reply |
| `referralStats` | `Referrals` | Admin read |

**Tables to Keep:**
- `users`, `sessions`, `accounts` - NextAuth (DO NOT migrate)
- `datasets`, `businesses` - Application data (DO NOT migrate)
- `aiInteractionTraces` - Operational (DO NOT migrate)

---

## Prompt Set 8: Build & Deployment

**Prompt for AI:** Verify Payload integration works with existing Railway deployment.

**Verification Steps:**
1. Run `pnpm build` - Must succeed
2. Run `pnpm lint` - Must pass
3. Check `/admin` route loads Payload admin
4. Check `/` homepage loads with Payload content
5. Verify Stripe endpoints still function
6. Confirm no disk storage for CMS media

---

## Prompt Set 9: Documentation Update

**Prompt for AI:** Create documentation for Payload integration.

**Create `docs/Developer_Guides/PAYLOAD_INTEGRATION.md` covering:**
- What was added (Collections, admin route)
- Where Payload config lives (`src/payload/`)
- How `/admin` works (superadmin only)
- How homepage content is fetched
- Required environment variables
- What was NOT changed (core app, Stripe, datasets)

---

## Acceptance Checklist

**Verify before marking complete:**
- [ ] `pnpm install` succeeds
- [ ] `pnpm build` succeeds  
- [ ] `pnpm lint` passes
- [ ] Homepage loads with Payload content
- [ ] `/admin` loads Payload admin panel
- [ ] Payload uses Neon Postgres
- [ ] Stripe checkout still works
- [ ] No Railway disk storage for CMS media
- [ ] Documentation created