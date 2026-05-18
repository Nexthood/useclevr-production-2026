Migrate to Payload

You are working inside the existing UseClevr Next.js project.

Goal:
Upgrade the project to the latest stable Next.js setup and integrate Payload CMS into the same Next.js app, without breaking the current client-side website/app pages.

Important:
This project already contains changelog files, skills files, commits, and project history. Before making changes, inspect the repo carefully:
- package.json
- next.config.*
- app/
- pages/ if present
- components/
- lib/
- middleware.*
- existing auth/payment/database code
- changelog / skills / commits / notes files
- existing README or docs

Do NOT refactor unrelated code.
Do NOT redesign the UI.
Do NOT remove existing features.
Make the smallest safe changes.

Main tasks:

1. Upgrade Next.js safely
- Check the current Next.js version.
- Upgrade to the latest stable Next.js version compatible with the project.
- Update React and React DOM only if required.
- Fix any breaking changes caused by the upgrade.
- Replace deprecated `next lint` usage with `eslint .` if needed.
- Ensure GitHub Actions still builds successfully.
- Keep Railway deployment compatibility.

2. Keep the existing client-side home/pages unchanged
- The current website/app client-side pages must keep working as they are.
- Do not rewrite the current home page or landing page.
- Do not change existing design unless required to fix compatibility.

3. Move current public/client pages under `/alpha`
- Migrate the existing current app/client-side experience to `/alpha`.
- The `/alpha` route should preserve the current behavior and layout.
- Keep existing components reused instead of duplicating large code.
- Make sure old imports and routes still resolve.
- If the current homepage should remain public marketing, keep it stable.
- If route conflicts exist, document them before changing.

Expected routing:
- `/` = existing public/marketing homepage, unchanged unless necessary
- `/alpha` = current client-side UseClevr experience
- `/admin` = Payload CMS admin panel
- API routes = must not conflict with existing app APIs

4. Add Payload CMS inside the same Next.js app
- Integrate Payload CMS into the existing Next.js app, not as a separate service.
- Use Neon Postgres as the Payload database.
- Do not add a second Railway service.
- Add Payload admin at `/admin`.
- Add Payload API routes according to the official Payload + Next.js setup.
- Use environment variables, do not hardcode secrets.

Payload should initially support simple CMS collections:
- FAQ items
- Blog posts
- Changelog entries
- Static page sections
- Legal pages
- Resources/articles

Do NOT migrate analytics engine/user report logic into Payload.
Payload is only for CMS/admin content.

5. Add Stripe plugin/support for Payload
- Add Payload Stripe integration/plugin only if it fits cleanly.
- Stripe remains the source of truth for payments and subscriptions.
- Payload should store/sync useful billing metadata only, such as:
  - stripeCustomerId
  - stripeSubscriptionId
  - plan
  - subscriptionStatus
  - credits if already used by the app
- Do not replace existing Stripe checkout logic if it already exists.
- Keep Stripe Checkout flow:
  Next.js pricing page → API checkout route → Stripe Checkout → success/cancel page → webhook updates DB/Payload.
- Ensure webhook logic is not duplicated or broken.

6. Static assets with GitHub workflow
- Do NOT store uploaded CMS/user media on Railway disk.
- For now, static marketing assets should be stored in the GitHub repo under:
  `/public/assets/...`
- These assets are controlled assets only:
  - logos
  - icons
  - landing images
  - manually approved blog images
  - static PDFs
- The app should read them as normal Next.js public assets, for example:
  `/assets/blog/example.webp`
- Do NOT implement GitHub as dynamic CMS upload storage.
- Do NOT write user uploads to GitHub automatically.
- For future dynamic media, leave a clean TODO for Cloudflare R2 / Google Cloud Storage / S3 adapter.

7. Neon Postgres setup
- Use Neon Postgres for Payload database.
- Reuse existing DATABASE_URL if appropriate.
- If the app already uses Neon/Drizzle/Prisma, do not break existing database logic.
- Avoid schema conflicts between existing app tables and Payload tables.
- Add required env examples to `.env.example`.

Needed environment variables may include:
- DATABASE_URL
- PAYLOAD_SECRET
- NEXT_PUBLIC_SERVER_URL
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- STRIPE_PRICE_ID_PRO or existing price IDs

8. Railway compatibility
- Keep one Railway service.
- Use package.json engines if Node version is required.
- Prefer Node 24.x LTS unless the project explicitly requires Node 26.x.
- Ensure build command and start command still work.
- Do not rely on local disk for persistent uploads.
- Confirm the app builds with:
  npm install
  npm run build
  npm run start

9. GitHub Actions
- Update CI so it works with the upgraded Next.js version.
- Replace any direct `next lint` command with `npm run lint`.
- Ensure scripts are correct:
  - build
  - start
  - lint
  - typecheck if already present
- Do not create unnecessary enterprise CI complexity.

10. Documentation
After changes, update or create a short implementation note:
- What was upgraded
- Where Payload config lives
- How `/admin` works
- How `/alpha` routing works
- What env vars are required
- What was intentionally not changed
- Any TODOs for future R2/GCS/S3 media storage

Acceptance criteria:
- `npm install` succeeds
- `npm run build` succeeds
- `npm run lint` succeeds or existing lint issues are documented without hiding them
- Existing homepage still works
- Existing client-side UseClevr pages work under `/alpha`
- Payload admin loads at `/admin`
- Payload uses Neon Postgres
- Stripe checkout/webhook logic is not broken
- Static assets load from `/public/assets`
- No Railway disk media storage is introduced
- No unrelated UI redesign or app logic refactor is done

Work style:
- First inspect the current repo structure.
- Then make a short plan.
- Then implement in small commits/steps.
- If there is an existing architecture decision in changelog, skills files, commits, or notes, follow it.
- Prefer minimal, safe changes over large rewrites.
