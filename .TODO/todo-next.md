# Active — leading edge work. Description and issue type in one line.

## In Progress 🔄

- Plan and checkout total prices still use client-side defaults for some settings
- Tickets, referral events, billing settings, and support notes from temp file storage to database — risk
- Referral signup and paid event idempotency (prevent duplicate credit awards) — risk
- Self-referral / abuse prevention before credits are issued — risk
- Payment provider event reconciliation after downtime — risk
- Reduce repo-wide lint warning debt; current full lint passes with warnings, mostly unused imports,
  unused values, and type-only import cleanup — dev

## Blocked 🚧

- Checkout edge cases: abandonment behaviour, proration, refunds, expired cards — risk

## Product Risk

- Decide credit expiry rules, backfill behaviour, and post-refund credit reversal — product
- Privacy rules for referred-user lists — product

## Data Risk

- Test empty uploads, huge CSV files, malformed rows, missing headers, unusual currencies, mixed time zones — data

## AI Risk

- Keep AI answers tied to uploaded data; handle unanswerable questions clearly — ai

## Access Risk

- Verify every super-admin page redirects regular users; tickets cannot be opened by other users — access

## Deployment Risk

- Keep production bundle, hosting config, healthcheck, runtime, and environment setup aligned — deployment
- Confirm Railway deploys only from the `dist` branch `/dist` root and waits for GitHub Actions before deploying — deployment
- Add a `dist` branch smoke check for install, start, and `/api/health` before Railway deployment — deployment
- Add a generated deployment manifest with source commit, build timestamp, runtime version, and healthcheck path — deployment
- Add a post-publish check that fails if `railway.json` appears at the `dist` branch root instead of
  inside `/dist` — deployment
- Add a generated-output size report before publishing to `dist` so large package/runtime files are
  visible before Railway reads the branch — deployment
- Prepare server-host templates for a second destination if Railway is not the only production host — deployment
- Consider a separate migration or worker service only after background jobs or schema changes need isolation from the web service — deployment
- Confirm the older Railway service or source-branch deployment is disabled after the `dist` service succeeds — deployment
- Add an account-backed deployment checklist for Railway, Neon, Gemini, Stripe, upload storage, and any future secondary host — deployment
- Add a branch-rule checklist that verifies PR titles start with `PR:` before enabling auto-merge — deployment
- Add a server-settings README example for the next host only when a second host is selected — deployment

## Accessibility Risk

- Check keyboard focus, modal focus traps, color contrast, small screens, sidebar/topbar overflow — a11y
