# todo-base-project.md - Three-Layer Base Project Setup

## Table of Contents
- [Overview](#overview)
- [Step 0: Feature Documentation](#step-0-feature-documentation)
- [Branch Setup](#branch-setup)
- [Layer Priority: Layer 3 → Layer 2 → Layer 1](#layer-priority-layer-3--layer-2--layer-1)
- [Layer Specifications](#layer-specifications)
- [config-files Branch](#config-files-branch)

---

## Overview
Create 5 branches within useclevr-2026: content-manager, base-build, base-layer1, base-layer2, base-layer3. Focus on internal branches first, external repo sync later.

---

## Step 0: Feature Documentation

### Prerequisite: Document All Features Before Stripping
1. [ ] Create `docs/UseClevr-Features-User.md` - user business impact/usage
2. [ ] Create `docs/UseClevr-Features-Dev.md` - dev setup and role documentation

---

## Branch Setup

### Five Branches to Create
- [ ] **content-manager** - future Payload CMS integration
- [ ] **base-build** - intermediate build branch
- [ ] **base-layer1** - static welcome only
- [ ] **base-layer2** - auth with local cache
- [ ] **base-layer3** - full features smoketest
- [ ] **config-files** - infrastructure files from beta

### Branch Creation Flow
Create all branches from main → Strip/documentation on each → Push all

---

## Layer Priority: Layer 3 → Layer 2 → Layer 1

**Stripping Order:** Start with full features (layer3), then progressively strip down

### Layer 3 (Full - Smoketest)
- [ ] Keep all features: social auth, AI, S3, upload
- [ ] Simplify to smoketest: mock/demo implementations
- [ ] Remove database: localStorage or mock storage
- [ ] Add demo accounts: pre-configured test users
- [ ] Commit to base-layer3

### Layer 2 (Auth - Local Cache)
- [ ] Strip to auth only: sign-in/up page
- [ ] Remove AI/S3: keep authentication
- [ ] Local storage: no database, use localStorage/sessionStorage
- [ ] Demo click button: one-click demo login
- [ ] Commit to base-layer2

### Layer 1 (Static Welcome)
- [ ] Remove all auth: no login
- [ ] Static page only: single welcome page
- [ ] No dependencies: minimal Next.js
- [ ] Commit to base-layer1

---

## Layer Specifications

| Layer | Branch | Features | Storage | Purpose |
|-------|--------|----------|---------|---------|
| Layer 3 | base-layer3 | All (social auth, AI, S3) | Mock/localStorage | Full boilerplate |
| Layer 2 | base-layer2 | Auth + demo, local cache | localStorage | Quick start |
| Layer 1 | base-layer1 | Static welcome only | None | Bare minimum |

### Shared Per Layer
- Independent root config files
- Own src content
- Own dist build folder

---

## config-files Branch

### Infrastructure Files (from beta)
- [ ] package.json with pnpm scripts
- [ ] tsconfig.json
- [ ] tailwind.config.js
- [ ] prettier.config.js
- [ ] husky hooks
- [ ] dist scripts
- [ ] eslint config

---

## External Repo (Future)
**Nexthood/_ai-base-project** sync happens after branches are ready and verified.


[additional]

# todo-base-project.md - Strip Down Plan for _ai-base-project

## Overview
Two-stage plan: Stage 1 strips useclevr-2026 on `base-project` branch. Stage 2 sets up the stripped content in Nexthood/_ai-base-project on `beta` branch and verifies dist workflow.

---

## Stage 1: Strip useclevr-2026 on base-project branch

### Tasks (Strip-down approach on useclevr-2026 repo)

1. [ ] **Branch Setup**
   - Create and switch to `base-project` branch in useclevr-2026

2. [ ] **Strip Pages and Routes**
   - Remove all pages from `src/app/` except `page.tsx` for hello frontpage
   - Remove `src/app/api/chat/route.ts`
   - Remove `src/app/api/query/route.ts`
   - Remove `src/app/api/upload/route.ts`
   - Remove all dashboard, analytics, and business intelligence pages

3. [ ] **Strip Business Logic**
   - Remove entire `src/lib/business/` directory
   - Remove entire `src/lib/ai/` directory
   - Remove `src/lib/queryEngine.ts`
   - Remove `src/lib/queryIntentPrompt.ts`
   - Remove `src/lib/data/` directory

4. [ ] **Strip Components**
   - Remove UI components except minimal Card components needed for structure
   - Remove all specialized components (charts, filters, upload components)

5. [ ] **Strip Authentication**
   - Remove Auth.js configuration and providers
   - Remove authentication middleware and session handling

6. [ ] **Strip Database**
   - Remove Drizzle ORM configuration
   - Remove Neon PostgreSQL schema and migrations
   - Remove `src/lib/db/` directory

7. [ ] **Strip Assets**
   - Remove all files from `src/assets/` except favicon
   - Remove `src/app/assets/` route handler
   - Keep only default Next.js favicon

8. [ ] **Strip CI/CD and Deploy Config**
   - Remove `dist-root/` directory entirely
   - Remove `.github/workflows/` directory entirely
   - Remove `scripts/package-dist/` and `scripts/server/` directories
   - Keep only essential package.json scripts

9. [ ] **Strip Configuration Files**
   - Remove `AGENTS.md`
   - Remove `ai-chat-behavior.config.ts`
   - Remove `gemini-behavior.config.ts`
   - Remove `CHANGELOG.md`
   - Remove `.TODO/` directory

10. [ ] **Strip Documentation**
    - Replace `README.md` with minimal content for base project
    - Remove project-specific markdown documentation

11. [ ] **Simplify Infrastructure**
    - Create minimal `package.json` with pnpm scripts
    - Keep `husky` pre-commit hooks but simplify
    - Simplify `tsconfig.json`
    - Simplify `tailwind.config.js`
    - Remove eslint config, keep minimal next.js defaults

12. [ ] **Create Hello Frontpage**
    - Modify `src/app/page.tsx` to show:
      - `<h1>Hello main title</h1>`
      - `<p>welcome</p>` (single word content)
    - Ensure favicon is present

13. [ ] **Push Stage 1 Complete**
    - Commit all stripped changes to `base-project` branch in useclevr-2026
    - Push to origin

---

## Stage 2: Setup Nexthood/_ai-base-project

### Tasks

1. [ ] **Branch Setup**
   - Create and switch to `beta` branch in Nexthood/_ai-base-project (repo exists but empty)
   - Note: useclevr-2026 `base-project` branch has stripped content to copy

2. [ ] **Initialize Base Project**
   - Copy stripped content from useclevr-2026 `base-project` branch
   - Or manually apply same stripping to new repo
   - Commit with minimal setup

3. [ ] **Add dist Configuration**
   - Add minimal `dist-root/` structure with basic Railway/Vercel config
   - Ensure `scripts/package-dist/create-dist.cjs` exists for packaging

4. [ ] **Push and PR**
    - Commit changes to `beta` branch in Nexthood/_ai-base-project
    - Push `beta` branch to GitHub
    - Create PR: `beta` → `main` using `gh pr create`

5. [ ] **Verify Auto-Publish**
    - Monitor PR for auto-merge
    - After merge, verify `dist` branch is created/updated
    - User will check dist branch on Railway

---

## Suggestions

1. **dist-root preservation**: Should we preserve minimal `dist-root/server-config/` as template for future deployments?

2. **Asset handling**: Keep `src/assets/` with just favicon, or remove and use public folder?

3. **Script simplification**: Simplify `pnpm validate`, `pnpm health` to basic `next build`/`next lint` or keep current structure?

## Questions

1. Should the `.TODO/` directory pattern be preserved in the stripped version, or completely removed?

2. Should `pnpm exec tsc --noEmit --pretty false` typecheck be kept or simplified?

3. Preserve Next.js app router structure exactly, or simplify to pages router for base project?
