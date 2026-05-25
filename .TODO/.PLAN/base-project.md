# Base Project Setup Plan

## P-1 Overview
Create stripped-down versions of useclevr-2026 for future _ai-base-project repository. Focus on internal branches first, external repo sync later.

---

## P-2 Branch Strategy

### S-1 Five Branches to Create
- **base-layer3** - Full features smoketest (mock implementations)
- **base-layer2** - Auth + demo, local cache
- **base-layer1** - Static welcome only
- **config-files** - Infrastructure files from beta
- **content-manager** - Future Payload CMS integration

### S-2 Stripping Order
Start with full features (layer3), then progressively strip down.

---

## P-3 Stage 1: Strip useclevr-2026

### S-1 Layer 3 (Full - Smoketest)
- Keep all features: social auth, AI, S3, upload
- Simplify to smoketest: mock/demo implementations
- Remove database: localStorage or mock storage
- Add demo accounts: pre-configured test users
- Commit to base-layer3 branch

### S-2 Layer 2 (Auth - Local Cache)
- Strip to auth only: sign-in/up page
- Remove AI/S3: keep authentication
- Local storage: no database, use localStorage/sessionStorage
- Demo click button: one-click demo login
- Commit to base-layer2 branch

### S-3 Layer 1 (Static Welcome)
- Remove all auth: no login
- Static page only: single welcome page
- No dependencies: minimal Next.js
- Commit to base-layer1 branch

---

## P-4 Stage 2: Strip Content Checklist

### S-1 Pages and Routes
- [ ] Remove all pages from `src/app/` except root page
- [ ] Remove `src/app/api/chat/route.ts`
- [ ] Remove `src/app/api/query/route.ts`
- [ ] Remove `src/app/api/upload/route.ts`
- [ ] Remove all dashboard, analytics, and business intelligence pages

### S-2 Business Logic
- [ ] Remove entire `src/lib/business/` directory
- [ ] Remove entire `src/lib/ai/` directory
- [ ] Remove `src/lib/queryEngine.ts`
- [ ] Remove `src/lib/queryIntentPrompt.ts`
- [ ] Remove `src/lib/data/` directory

### S-3 Components
- [ ] Remove UI components except minimal Card components
- [ ] Remove all specialized components (charts, filters, upload components)

### S-4 Authentication
- [ ] Remove Auth.js configuration and providers
- [ ] Remove authentication middleware and session handling

### S-5 Database
- [ ] Remove Drizzle ORM configuration
- [ ] Remove Neon PostgreSQL schema and migrations
- [ ] Remove `src/lib/db/` directory

### S-6 Assets
- [ ] Remove all files from `src/assets/` except favicon
- [ ] Remove `src/app/assets/` route handler
- [ ] Keep only default Next.js favicon

### S-7 CI/CD and Deploy Config
- [ ] Remove `dist-root/` directory entirely
- [ ] Remove `.github/workflows/` directory entirely
- [ ] Remove `scripts/package-dist/` and `scripts/server/` directories
- [ ] Keep only essential package.json scripts

### S-8 Configuration Files
- [ ] Remove `AGENTS.md`
- [ ] Remove `ai-chat-behavior.config.ts`
- [ ] Remove `gemini-behavior.config.ts`
- [ ] Remove `CHANGELOG.md`
- [ ] Remove `.TODO/` directory

### S-9 Documentation
- [ ] Replace `README.md` with minimal content
- [ ] Remove project-specific markdown documentation

### S-10 Hello Frontpage
- [ ] Modify `src/app/page.tsx` to show welcome message
- [ ] Ensure favicon is present

---

## P-5 config-files Branch

### S-1 Infrastructure Files (from beta)
- [ ] package.json with pnpm scripts
- [ ] tsconfig.json
- [ ] tailwind.config.js
- [ ] prettier.config.js
- [ ] husky hooks
- [ ] dist scripts
- [ ] eslint config

---

## P-6 External Repo (Future)
**Nexthood/_ai-base-project** sync happens after branches are ready and verified.

---

## [suggestions]

T-272: Create test script to verify each layer builds successfully
T-273: Add dist packaging validation for stripped layers
T-274: Document migration path from useclevr-2026 base to _ai-base-project