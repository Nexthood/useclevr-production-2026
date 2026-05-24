# Root Structure

Short guide to the root files and folders. Keep app code in `src/`; keep host-specific server files
outside `src/`.

| Path                                   | Used by                    | Why it exists                                                                                                                |
| -------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `.TODO/`                               | Humans, AI agents          | Active tasks, done lists, future notes, and AI task skills.                                                                  |
| `.github/workflows/`                   | GitHub Actions             | Source validation, beta sync, and dist publishing workflows.                                                                 |
| `.husky/`                              | Husky                      | Local Git hooks. Current hook checks commit messages with commitlint and allows `PR:` titles.                                |
| `.kilo/`                               | Kilo                       | Local Kilo agents and commands.                                                                                              |
| `.vscode/`                             | VS Code                    | Workspace recommendations, launch settings, and local editor settings.                                                       |
| `docs/`                                | Developers, users          | Developer and user documentation.                                                                                            |
| `mcp/`                                 | Local MCP tooling          | MCP handlers, resources, and tools.                                                                                          |
| `scripts/analysis/`                    | Developers                 | Local analysis and test helpers.                                                                                             |
| `scripts/build/`                       | Developers, CI             | General build cleanup helpers.                                                                                               |
| `scripts/docs/`                        | Developers, CI             | Documentation validation helpers.                                                                                            |
| `scripts/health/`                      | Developers                 | Local health checks such as Neon connectivity.                                                                               |
| `scripts/package-dist/`                | Developers, GitHub Actions | Assembles generated production output in local `dist/`.                                                                      |
| `scripts/release/`                     | Developers                 | Release checks and tag helpers.                                                                                              |
| `scripts/runtime/`                     | Local runtime              | Runtime env loading for local production starts.                                                                             |
| `scripts/server/`                      | Server hosts               | Host-specific helper scripts, grouped by server provider.                                                                    |
| `dist-root/`                           | GitHub Actions             | Permanent deployment branch files copied to the dist branch root.                                                            |
| `dist-root/server-config/railway.json` | Railway                    | Railway deploy config source-of-truth published as `/server-config/railway.json` on the dist branch.                         |
| `dist-root/server-config/vercel.json`  | Vercel                     | Vercel deploy config source-of-truth published as `/server-config/vercel.json` on the dist branch and synced to source root. |
| `src/`                                 | Next.js app                | Product code, UI, API routes, app assets, services, and libraries.                                                           |
| `AGENTS.md`                            | AI agents                  | Project-specific operating rules.                                                                                            |
| `CHANGELOG.md`                         | Developers, release notes  | User-facing and dev-facing release history.                                                                                  |
| `README.md`                            | Everyone                   | Project entry point.                                                                                                         |
| `requirements.md`                      | Product, developers        | Product-facing requirements.                                                                                                 |
| `ai-chat-behavior.config.ts`           | AI agents                  | Shared AI agent communication and project rules.                                                                             |
| `commitlint.config.cjs`                | commitlint                 | Commit message rules used by Husky.                                                                                          |
| `components.json`                      | shadcn/ui                  | UI component generation/config.                                                                                              |
| `drizzle.config.ts`                    | Drizzle                    | Database schema and migration config.                                                                                        |
| `eslint.config.mjs`                    | ESLint                     | Lint rules.                                                                                                                  |
| `gemini-behavior.config.ts`            | Gemini tooling             | Gemini agent behavior rules.                                                                                                 |
| `kilo.json`                            | Kilo                       | Kilo workspace config.                                                                                                       |
| `next.config.mjs`                      | Next.js                    | Framework/build config.                                                                                                      |
| `package.json`                         | pnpm, Node tools           | Scripts and dependency manifest.                                                                                             |
| `pnpm-lock.yaml`                       | pnpm                       | Locked dependency graph.                                                                                                     |
| `pnpm-workspace.yaml`                  | pnpm                       | pnpm workspace and dependency build approvals.                                                                               |
| `postcss.config.mjs`                   | PostCSS/Tailwind           | CSS transform config.                                                                                                        |
| `proxy.ts`                             | Next.js                    | Request proxy/middleware entry.                                                                                              |
| `tailwind.config.ts`                   | Tailwind                   | Design token and utility config.                                                                                             |
| `tsconfig.json`                        | TypeScript                 | Type checking config.                                                                                                        |
| `turbo.json`                           | Turborepo                  | Task cache inputs and outputs.                                                                                               |
| `vercel.json`                          | Vercel                     | Source-branch deploy config synced from `dist-root/server-config/vercel.json`.                                               |

Generated or local-only folders such as `dist/`, `.next/`, `node_modules/`, `.turbo/`, logs, and
environment files are ignored and should not be committed.
