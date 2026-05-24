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