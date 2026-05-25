# Done TODO

Completed work lives here after product requirements and changelog updates are handled where needed.

Get T-number (task number) from `.TODO/config.json` before adding new tasks.

## Links

- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Completed

- T-298. Business profile review, setup progress tracking, the setup tour, sidebar links, dashboard
  FAQ actions, plan suggestions, and TODO retirement updates were completed.
- T-269. A GitHub issue template now links promoted issues back to local task IDs and release
  targets.
- T-270. A release artifact checklist now defines which CI outputs should be attached to GitHub
  Releases.
- T-277. Common git command patterns were documented for repeatable local workflows.
- T-278. Long-running command and timeout handling patterns were documented.
- T-280. Common development task prompt templates were documented.
- T-281. User-AI communication patterns were documented.
- T-282. Future AI collaboration guidelines were documented.
- T-297. Dashboard users can open the AI Assistant from the sidebar, select a dataset, and ask
  follow-up business questions in one workspace.
- T-126. Admin customer, customer level, and discount pages now use shared read-first tables with focused row edit pages.
- T-204. Dashboard sidebar footer now includes coming-soon mobile app buttons, social placeholders, the user panel, and Terms access.
- T-205. Dashboard now opens directly to datasets, Hybrid AI and subscription changes use checkout review, paid download access includes Business and super-admin users, and dashboard FAQ uses filtered expandable answers.
- T-206. The App Router shell owns document markup, production builds fail on TypeScript errors, and public FAQ highlighting renders through React instead of injected HTML.
- T-207. Dist deployment succeeded and active dist migration tasks were folded into the regular TODO queues.
- T-208. Project audit work was converted into regular TODO tasks plus auditor and testing guide documents.
- T-209. TODO management now uses `T-` task numbers and `todo-next.md` as the only active queue.
- T-244. Dist and audit TODO files were retired into the regular next, done, future, and ignored
  queues.
- T-245. Project audit and testing guides were added for repeatable start-to-finish review.
- T-258. Railway deploys from the `dist` branch with `/dist` as the root directory.
- T-259. Railway runtime secrets remain in Railway environment variables.
- T-260. The older source-branch Railway deployment path is no longer the active deploy target.
- T-261. A successful publish confirmed fresh generated `/dist` output on the dist branch.
- T-262. Dist branch publish scope is limited to generated `/dist` output and `/server-config`.
- T-263. TODO management docs document how retired audit and dist tasks moved into the regular queues.
- T-264. Dashboard topbar onboarding, shared activity popup behavior, TODO retirement guidance, and
  GitHub issue/project/release guidance were added.
- T-283. Dashboard onboarding now uses database-backed progress and seen state, social login buttons
  create local user/profile records when providers are configured, and onboarding/activity actions
  save to the activity feed.
- T-265. Small-screen dashboard users can reopen onboarding from the topbar Process button.
- T-267. The topbar notices and activity popup now shows loading and error states when recent
  activity cannot be fetched.
- T-210. Technical guides moved into developer documentation.
- T-211. Flowcharts moved into developer guide folders.
- T-212. User-facing documentation moved into user guide folders.
- T-213. Project requirements moved into developer-facing documentation where appropriate.
- T-214. Troubleshooting guidance was replaced with a developer testing guide.
- T-215. Flowcharts were split into user-facing, production technical, and deployment charts.
- T-216. TODO and future recommendation documents moved into `.TODO/`.
- T-217. Documentation links were updated after folder changes.
- T-218. Mermaid editor guidance was added for project diagrams.
- T-219. Static files moved into `src/assets/` and are served through `/assets/...`.
- T-220. Railway debug endpoint for homepage HTML was removed.
- T-221. Runtime target moved off the old Node.js baseline.
- T-222. npm and pnpm dependencies were updated for the current app baseline.
- T-223. Original system flowchart was created.
- T-224. Docs landing page and onboarding docs were refreshed.
- T-225. Railway and Vercel deployment guides now own host-specific commands, settings, and troubleshooting notes.
- T-226. Railway generated-output builds refresh Corepack and use a Node-compatible pnpm release.
- T-227. Generated runtime packages avoid conflicting pnpm build-approval settings.
- T-228. Runtime installs tolerate generated deployment packages without a committed lockfile.
- T-229. Generated runtime packages include migration tooling required by pre-deploy schema steps.
- T-230. Generated deployments restore the Next.js build output when host snapshots omit dot-directories.
- T-231. Repository text files are normalized with UTF-8 and LF rules.
- T-232. Payment provider settings and super-admin dashboard pages require super-admin access from direct URLs.
- T-233. Dashboard notices live in a topbar inbox with recent product activity, user activity history, super-admin total activity, and subscription-focused credit access.
- T-234. Dist publish history keeps the previous deployment commit visible while reducing workflow log output.
- T-235. Dist deployment config stays under `/server-config`, and generated deployment output runs from `/dist`.
- T-236. Railway generated-output builds use a generated Nixpacks plan so installs run through Corepack pnpm.
- T-237. Railway runtime builds use Nixpacks with explicit Corepack pnpm activation.
- T-238. PDF export browser dependencies are explicit production dependencies.
- T-239. Auto-merged release pull requests dispatch branch maintenance after merge.
- T-240. Local pre-commit validation runs the production publish build.
- T-241. Public login errors stay inline, public contact requests can be submitted without sign-in, and legal links are visible from public/auth footers.
- T-242. Generated production starts are split by local, Railway, and Vercel server targets.
- T-243. Operational storage, referral reward guards, production readiness checks, and CSV edge-case tests were added.
- T-290. Service layer extraction created lib/services/reportService.ts for report generation orchestration.
- T-291. Service layer extraction created lib/services/datasetService.ts for dataset analysis orchestration.
- T-292. Configuration centralization created lib/config/index.ts with Zod validation for runtime envs.
- T-293. Dashboard language feature implemented with language selector in topbar, LanguageProvider context, and Google Translation service with caching. Language context enhanced with `translate` function for dynamic Google Translation API calls.
- T-301. Ticketing features fixed: super admin can send messages, admin name and timestamp now displayed in admin notes.
- T-302. FAQ items open by default with open/close all buttons in header.
- T-303. FAQ page includes open/close all buttons.
- T-304. App version text added under Terms & Conditions in sidebar.
- T-305. Sign out redirect fixed to use relative URL.
- T-306. Social panel title removed from sidebar.
- T-307. Topbar reordered: Hybrid AI button moved left, notice icon placed before logout.
- T-308. Hover color contrast improved in dashboard FAQ actions (hover:bg-accent/50).
- T-309. Language context enhanced with `translate` function using Google Translation API.
- T-310. Cookie consent bar added with accept button.
