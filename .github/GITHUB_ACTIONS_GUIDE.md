# GitHub Actions CI/CD Pipeline

This project includes GitHub Actions workflows for continuous integration and deployment.

## Overview

### Why GitHub Actions?

Railway automatically deploys when you push to the configured branch. GitHub Actions adds:

✅ **Pre-deployment validation** - Catch issues before Railway builds
✅ **Lint & type checks** - Ensure code quality
✅ **Build verification** - Confirm the app builds successfully
✅ **Security scanning** - Check for vulnerabilities
✅ **PR feedback** - Auto-comment on pull requests

---

## Workflows

### 1. CI/CD Pipeline (`ci-cd.yml`)

**Triggers**: Push to `main`/`develop`, Pull Requests

**Jobs**:

#### Lint & Type Check
- Runs ESLint
- TypeScript compilation check
- Fast feedback (< 2 min)

#### Build & Verify
- Installs dependencies
- Builds Next.js app
- Verifies `.next` directory created
- Requires lint to pass

#### Docker Build Verification
- Builds Docker image without pushing
- Verifies Dockerfile is valid
- Only runs on push to main

#### Security Scan
- Runs `npm audit`
- Optional Snyk integration (if token provided)
- Non-blocking (doesn't prevent deployment)

#### Tests
- Runs configured test suite
- Falls back to "no tests configured" if none exist
- Non-blocking (doesn't prevent deployment)

#### Deploy Ready Check
- Verifies all critical jobs passed
- Comments on PRs with status
- Blocks deployment if lint/build fail

---

### 2. Deploy to Railway (`deploy-railway.yml`)

**Triggers**: Push to `main`, Manual workflow dispatch

**Why?**: Railway auto-deploys, but this workflow:
- Runs additional pre-deployment checks
- Notifies on commit about deployment status
- Optional manual trigger capability
- Logs deployment events

---

## Setup Instructions

### 1. Enable Actions

- Go to GitHub repo → Settings → Actions
- Keep "Allow all actions and reusable workflows" selected (default)

### 2. (Optional) Add Secrets

For enhanced security scanning:

```bash
# Go to Settings → Secrets → New secret
```

Available secrets:
- `SNYK_TOKEN` - For Snyk security scanning
- `RAILWAY_TOKEN` - For Railway CLI (optional, not needed for auto-deploy)
- `RAILWAY_PROJECT_ID` - Your Railway project ID (reference only)

### 3. Configure Branch Protection (Optional)

GitHub Settings → Branches → Branch protection rules:

```
- Require status checks to pass:
  ✓ Lint & Type Check
  ✓ Build & Verify
  ✓ Security Scan

- Dismiss stale PR approvals when new commits are pushed
- Require branches to be up to date before merging
```

---

## Workflow Behavior

### On Pull Request

```
PR opened
    ↓
Lint → Build → Security → Test
    ↓
If all pass: ✅ Comments "Ready to merge and deploy"
If any fail: ❌ Shows which step failed
    ↓
Developer fixes & pushes again
    ↓
Workflow re-runs automatically
```

### On Push to Main

```
Push to main
    ↓
CI/CD Pipeline runs (same as PR)
    ↓
If all pass: ✅ Deployment workflow runs
    ↓
Pre-deployment checks run
    ↓
Railway auto-deploys (via webhook)
    ↓
Commit gets comment with status
```

---

## Viewing Results

### GitHub UI
1. Go to repo → Actions tab
2. Click on workflow run to see details
3. Expand job to see step-by-step output

### PR Comments
- Automatic comments appear on PRs after checks complete
- Shows pass/fail status

### Build Logs
- Each job shows full stdout/stderr
- Docker build logs visible
- npm command outputs included

---

## Performance & Costs

### Execution Time
- **Lint + Build**: ~2-3 minutes
- **Security Scan**: ~1 minute (optional)
- **Docker Build**: ~1-2 minutes (push to main only)
- **Total**: ~5-7 minutes on main push

### GitHub Actions Limits
- **Free tier**: 2,000 minutes/month
- **Estimate**: ~10-15 workflow runs = ~1 hour = well within limits
- **Cost**: Free for public repos, minimal for private repos

---

## Customization

### Add Tests

If tests exist, uncomment in `ci-cd.yml`:

```yaml
test:
  script:
    - npm test
```

Or add test script to `package.json`:

```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch"
}
```

### Adjust Lint Rules

Modify ESLint in `ci-cd.yml`:

```yaml
- name: Run ESLint
  run: npm run lint
  # Remove "|| true" to fail on lint errors
```

### Add Code Coverage

Add to CI/CD pipeline:

```yaml
- name: Generate coverage report
  run: npm test -- --coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
```

### Custom Security Checks

Add custom security scanning:

```yaml
- name: Check for hardcoded secrets
  run: npx detect-secrets scan
```

---

## Troubleshooting

### Workflow Won't Run

**Issue**: Workflow not triggering on push
- ✓ Check workflow file is in `.github/workflows/`
- ✓ Verify branch name matches (main vs master)
- ✓ Check Actions tab for errors

### Build Fails in Actions but Works Locally

**Common causes**:
- Missing environment variables
- Node version mismatch
- Different npm/package-lock versions

**Solution**:
```bash
# Match Actions env locally
node --version  # Should be 20.x
npm --version   # Update if needed
npm ci           # Use ci instead of install
npm run build
```

### GitHub Actions Minutes Exceeded

**Prevention**:
- GitHub gives free 2,000 minutes/month
- Monitor usage in Settings → Billing
- Scale by reducing unnecessary jobs

---

## Integration with Railway

### How They Work Together

```
┌─────────────────────────────────────────────┐
│        GitHub Repo (main branch)            │
│  ┌──────────────────────────────────────┐  │
│  │   Commit pushed                      │  │
│  └──────────────┬───────────────────────┘  │
│                 │                          │
│         ┌───────▼────────┐                │
│         │  GitHub Actions│                │
│         │  • Lint        │                │
│         │  • Build       │                │
│         │  • Test        │                │
│         │  • Security    │                │
│         └───────┬────────┘                │
│                 │ (Push webhook)          │
│  ┌──────────────▼───────────────────────┐│
│  │        Railway Platform              ││
│  │  • Detects push                      ││
│  │  • Builds Docker image               ││
│  │  • Runs health checks                ││
│  │  • Deploys to production             ││
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Key Point**: GitHub Actions runs first, Railway deploys second.

---

## Next Steps

1. **Push changes** to activate workflows
2. **Monitor** Actions tab for first run
3. **Check PRs** for auto-comments
4. **(Optional)** Configure branch protection
5. **(Optional)** Add Snyk token for security scanning
6. **(Optional)** Set up notifications/Slack integration

---

## Helpful Links

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Node.js Action](https://github.com/actions/setup-node)
- [Docker Buildx](https://github.com/docker/build-push-action)
- [Railway + GitHub](https://docs.railway.app/guides/github)

---

## Support

Issues with workflows?

1. Check Actions tab → workflow run → failed job
2. Expand step to see error message
3. Common fixes:
   - `npm ci` vs `npm install`
   - Node version compatibility
   - Missing dependencies
   - Environment variable issues
