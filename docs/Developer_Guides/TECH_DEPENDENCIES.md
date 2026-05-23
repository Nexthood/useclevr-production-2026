# Technical Dependencies

## Table Of Contents

- [Frontend And Runtime](#frontend-and-runtime)
- [Development And CI](#development-and-ci)

Major-version dates are projections only when upstream publishes a schedule. Otherwise, track upstream release notes before upgrading.

## Frontend And Runtime

| Dependency | Current Version | Expected Future Major | Used Where | Short Description |
| --- | --- | --- | --- | --- |
| `@ai-sdk/google` | `^3.0.65` | Unknown; monitor upstream | AI runtime | Google Gemini provider for AI SDK |
| `@aws-sdk/client-s3` | `^3.1049.0` | Unknown; monitor upstream | Runtime storage | S3-compatible upload storage |
| `@neondatabase/serverless` | `^1.1.0` | Unknown; monitor upstream | Database runtime | Neon PostgreSQL serverless client |
| `@radix-ui/react-tabs` | `^1.1.13` | Unknown; monitor upstream | Frontend UI | Accessible tabs primitive |
| `@types/papaparse` | `^5.5.2` | Unknown; monitor upstream | Runtime typing | PapaParse TypeScript types used by source |
| `ai` | `^6.0.169` | Unknown; monitor upstream | AI runtime | AI SDK orchestration |
| `bcryptjs` | `^3.0.3` | Unknown; monitor upstream | Auth runtime | Password hashing for credentials auth |
| `canvg` | `3.0.11` | Unknown; monitor upstream | Export runtime | SVG rendering dependency required by PDF export |
| `clsx` | `2.1.1` | Unknown; monitor upstream | Frontend UI | Conditional class name helper |
| `dompurify` | `3.4.1` | Unknown; monitor upstream | Frontend/runtime security | HTML sanitization |
| `drizzle-orm` | `^0.45.2` | Unknown; monitor upstream | Database runtime | Typed ORM |
| `html2canvas` | `1.4.1` | Unknown; monitor upstream | Export runtime | HTML capture for reports |
| `jspdf` | `^4.2.1` | Unknown; monitor upstream | Export runtime | PDF generation |
| `jspdf-autotable` | `^5.0.7` | Unknown; monitor upstream | Export runtime | PDF table generation |
| `lucide-react` | `^1.14.0` | Unknown; monitor upstream | Frontend UI | Icon set |
| `next` | `16.2.4` | Unknown; monitor upstream | Frontend/runtime | Next.js app framework |
| `next-auth` | `5.0.0-beta.31` | Unknown; monitor upstream | Auth runtime | Auth.js / NextAuth |
| `next-themes` | `^0.4.6` | Unknown; monitor upstream | Frontend UI | Theme switching |
| `papaparse` | `^5.5.3` | Unknown; monitor upstream | Data runtime | CSV parsing |
| `pg` | `^8.13.0` | Unknown; monitor upstream | Database runtime | PostgreSQL driver |
| `postcss-import` | `^16.1.1` | Unknown; monitor upstream | Frontend styling | CSS import processing |
| `qrcode` | `^1.5.4` | Unknown; monitor upstream | Referral/runtime | QR code generation |
| `react` | `^19.2.5` | Unknown; monitor upstream | Frontend UI | React UI runtime |
| `react-dom` | `^19.2.5` | Unknown; monitor upstream | Frontend UI | React DOM runtime |
| `react-icons` | `^5.5.0` | Unknown; monitor upstream | Frontend UI | Supplemental icon set |
| `recharts` | `^3.8.1` | Unknown; monitor upstream | Frontend analytics | Charts |
| `stripe` | `^14` | Unknown; monitor upstream | Billing runtime | Stripe checkout/webhooks |
| `tailwind-merge` | `3.5.0` | Unknown; monitor upstream | Frontend styling | Tailwind class merging |
| `tw-animate-css` | `^1.4.0` | Unknown; monitor upstream | Frontend styling | Animation utilities |
| `uuid` | `^14.0.0` | Unknown; monitor upstream | Runtime utility | ID generation |
| `ws` | `^8.18.0` | Unknown; monitor upstream | Runtime networking | WebSocket support |
| `zod` | `^4.3.6` | Unknown; monitor upstream | Runtime validation | Schema validation |

## Development And CI

| Dependency | Current Version | Expected Future Major | Used Where | Short Description |
| --- | --- | --- | --- | --- |
| `@commitlint/cli` | `^21.0.1` | Unknown; monitor upstream | Dev tooling | Commit message validation |
| `@commitlint/config-conventional` | `^21.0.1` | Unknown; monitor upstream | Dev tooling | Conventional commit rules |
| `@types/node` | `^25.6.0` | Unknown; monitor upstream | Dev typing | Node.js types |
| `@types/pg` | `^8.20.0` | Unknown; monitor upstream | Dev typing | PostgreSQL driver types |
| `@types/qrcode` | `^1.5.6` | Unknown; monitor upstream | Dev typing | QRCode types |
| `@types/react` | `^19.2.14` | Unknown; monitor upstream | Dev typing | React types |
| `@types/react-dom` | `^19.2.3` | Unknown; monitor upstream | Dev typing | React DOM types |
| `@typescript-eslint/eslint-plugin` | `^8.59.3` | Unknown; monitor upstream | Dev lint | TypeScript ESLint rules |
| `@typescript-eslint/parser` | `^8.59.3` | Unknown; monitor upstream | Dev lint | TypeScript ESLint parser |
| `autoprefixer` | `10.5.0` | Unknown; monitor upstream | Build styling | CSS vendor prefixes |
| `drizzle-kit` | `^0.31.10` | Unknown; monitor upstream | Database tooling | Schema push/generation |
| `eslint` | `^10.4.0` | Unknown; monitor upstream | Dev lint | Lint runner |
| `eslint-plugin-only-warn` | `^1.2.1` | Unknown; monitor upstream | Dev lint | Warning-only lint plugin |
| `husky` | `^9.1.7` | Unknown; monitor upstream | Dev hooks | Git hooks |
| `js-yaml` | `^4.1.1` | Unknown; monitor upstream | Docs/tooling | YAML parsing helpers |
| `markdownlint-cli` | `^0.48.0` | Unknown; monitor upstream | Docs tooling | Markdown linting |
| `postcss` | `8.5.12` | Unknown; monitor upstream | Build styling | PostCSS processor |
| `prettier` | `^3.8.3` | Unknown; monitor upstream | Dev format | Formatter |
| `tailwindcss` | `3.4.17` | Unknown; monitor upstream | Build styling | Tailwind CSS compiler |
| `tsx` | `^4.21.0` | Unknown; monitor upstream | Dev scripts | TypeScript script runner |
| `turbo` | `^2.4.2` | Unknown; monitor upstream | Dev tooling | Task cache/orchestration |
| `typescript` | `6.0.3` | Unknown; monitor upstream | Dev typing | TypeScript compiler |

