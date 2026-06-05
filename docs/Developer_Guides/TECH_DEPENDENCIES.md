# Technical Dependencies

## Table Of Contents

- [Frontend And Runtime](#frontend-and-runtime)
- [Development And CI](#development-and-ci)
- [Related Docs](#related-docs)

## Frontend And Runtime

<!-- markdownlint-disable MD060 -->
| Dependency                 | Current Version | Official URL                                      | Used Where                | Short Description                               |
| -------------------------- | --------------- | ------------------------------------------------- | ------------------------- | ----------------------------------------------- |
| `@ai-sdk/google`           | `^3.0.65`       | <https://www.npmjs.com/package/@ai-sdk/google>    | AI runtime                | Google Gemini provider for AI SDK               |
| `@aws-sdk/client-s3`       | `^3.1049.0`     | <https://www.npmjs.com/package/@aws-sdk/client-s3> | Runtime storage          | S3-compatible upload storage                    |
| `@neondatabase/serverless` | `^1.1.0`        | <https://www.npmjs.com/package/@neondatabase/serverless> | Database runtime   | Neon PostgreSQL serverless client               |
| `@radix-ui/react-tabs`     | `^1.1.13`       | <https://www.npmjs.com/package/@radix-ui/react-tabs> | Frontend UI          | Accessible tabs primitive                       |
| `@types/papaparse`         | `^5.5.2`        | <https://www.npmjs.com/package/@types/papaparse>  | Runtime typing            | PapaParse TypeScript types used by source       |
| `ai`                       | `^6.0.169`      | <https://www.npmjs.com/package/ai>                | AI runtime                | AI SDK orchestration                            |
| `bcryptjs`                 | `^3.0.3`        | <https://www.npmjs.com/package/bcryptjs>          | Auth runtime              | Password hashing for credentials auth           |
| `canvg`                    | `3.0.11`        | <https://www.npmjs.com/package/canvg>             | Export runtime            | SVG rendering dependency required by PDF export |
| `clsx`                     | `2.1.1`         | <https://www.npmjs.com/package/clsx>              | Frontend UI               | Conditional class name helper                   |
| `dompurify`                | `3.4.1`         | <https://www.npmjs.com/package/dompurify>         | Frontend/runtime security | HTML sanitization                               |
| `drizzle-orm`              | `^0.45.2`       | <https://www.npmjs.com/package/drizzle-orm>       | Database runtime          | Typed ORM                                       |
| `html2canvas`              | `1.4.1`         | <https://www.npmjs.com/package/html2canvas>       | Export runtime            | HTML capture for reports                        |
| `jspdf`                    | `^4.2.1`        | <https://www.npmjs.com/package/jspdf>             | Export runtime            | PDF generation                                  |
| `jspdf-autotable`          | `^5.0.7`        | <https://www.npmjs.com/package/jspdf-autotable>   | Export runtime            | PDF table generation                            |
| `lucide-react`             | `^1.14.0`       | <https://www.npmjs.com/package/lucide-react>      | Frontend UI               | Icon set                                        |
| `next`                     | `16.2.4`        | <https://www.npmjs.com/package/next>              | Frontend/runtime          | Next.js app framework                           |
| `next-auth`                | `5.0.0-beta.31` | <https://www.npmjs.com/package/next-auth>         | Auth runtime              | Auth.js / NextAuth                              |
| `next-themes`              | `^0.4.6`        | <https://www.npmjs.com/package/next-themes>       | Frontend UI               | Theme switching                                 |
| `papaparse`                | `^5.5.3`        | <https://www.npmjs.com/package/papaparse>         | Data runtime              | CSV parsing                                     |
| `pg`                       | `^8.13.0`       | <https://www.npmjs.com/package/pg>                | Database runtime          | PostgreSQL driver                               |
| `postcss-import`           | `^16.1.1`       | <https://www.npmjs.com/package/postcss-import>    | Frontend styling          | CSS import processing                           |
| `qrcode`                   | `^1.5.4`        | <https://www.npmjs.com/package/qrcode>            | Referral/runtime          | QR code generation                              |
| `react`                    | `^19.2.5`       | <https://www.npmjs.com/package/react>             | Frontend UI               | React UI runtime                                |
| `react-dom`                | `^19.2.5`       | <https://www.npmjs.com/package/react-dom>         | Frontend UI               | React DOM runtime                               |
| `react-icons`              | `^5.5.0`        | <https://www.npmjs.com/package/react-icons>       | Frontend UI               | Supplemental icon set                           |
| `recharts`                 | `^3.8.1`        | <https://www.npmjs.com/package/recharts>          | Frontend analytics        | Charts                                          |
| `stripe`                   | `^14`           | <https://www.npmjs.com/package/stripe>            | Billing runtime           | Stripe checkout/webhooks                        |
| `tailwind-merge`           | `3.5.0`         | <https://www.npmjs.com/package/tailwind-merge>    | Frontend styling          | Tailwind class merging                          |
| `tw-animate-css`           | `^1.4.0`        | <https://www.npmjs.com/package/tw-animate-css>    | Frontend styling          | Animation utilities                             |
| `uuid`                     | `^14.0.0`       | <https://www.npmjs.com/package/uuid>              | Runtime utility           | ID generation                                   |
| `ws`                       | `^8.18.0`       | <https://www.npmjs.com/package/ws>                | Runtime networking        | WebSocket support                               |
| `zod`                      | `^4.3.6`        | <https://www.npmjs.com/package/zod>               | Runtime validation        | Schema validation                               |

## Development And CI

| Dependency                         | Current Version | Official URL                                           | Used Where       | Short Description         |
| ---------------------------------- | --------------- | ------------------------------------------------------ | ---------------- | ------------------------- |
| `@commitlint/cli`                  | `^21.0.1`       | <https://www.npmjs.com/package/@commitlint/cli>        | Dev tooling      | Commit message validation |
| `@commitlint/config-conventional`  | `^21.0.1`       | <https://www.npmjs.com/package/@commitlint/config-conventional> | Dev tooling | Conventional commit rules |
| `@types/node`                      | `^25.6.0`       | <https://www.npmjs.com/package/@types/node>            | Dev typing       | Node.js types             |
| `@types/pg`                        | `^8.20.0`       | <https://www.npmjs.com/package/@types/pg>              | Dev typing       | PostgreSQL driver types   |
| `@types/qrcode`                    | `^1.5.6`        | <https://www.npmjs.com/package/@types/qrcode>          | Dev typing       | QRCode types              |
| `@types/react`                     | `^19.2.14`      | <https://www.npmjs.com/package/@types/react>           | Dev typing       | React types               |
| `@types/react-dom`                 | `^19.2.3`       | <https://www.npmjs.com/package/@types/react-dom>       | Dev typing       | React DOM types           |
| `@typescript-eslint/eslint-plugin` | `^8.59.3`       | <https://www.npmjs.com/package/@typescript-eslint/eslint-plugin> | Dev lint | TypeScript ESLint rules   |
| `@typescript-eslint/parser`        | `^8.59.3`       | <https://www.npmjs.com/package/@typescript-eslint/parser> | Dev lint      | TypeScript ESLint parser  |
| `autoprefixer`                     | `10.5.0`        | <https://www.npmjs.com/package/autoprefixer>           | Build styling    | CSS vendor prefixes       |
| `drizzle-kit`                      | `^0.31.10`      | <https://www.npmjs.com/package/drizzle-kit>            | Database tooling | Schema push/generation    |
| `eslint`                           | `^10.4.0`       | <https://www.npmjs.com/package/eslint>                 | Dev lint         | Lint runner               |
| `eslint-plugin-only-warn`          | `^1.2.1`        | <https://www.npmjs.com/package/eslint-plugin-only-warn> | Dev lint        | Warning-only lint plugin  |
| `husky`                            | `^9.1.7`        | <https://www.npmjs.com/package/husky>                  | Dev hooks        | Git hooks                 |
| `js-yaml`                          | `^4.1.1`        | <https://www.npmjs.com/package/js-yaml>                | Docs/tooling     | YAML parsing helpers      |
| `markdownlint-cli`                 | `^0.48.0`       | <https://www.npmjs.com/package/markdownlint-cli>       | Docs tooling     | Markdown linting          |
| `postcss`                          | `8.5.12`        | <https://www.npmjs.com/package/postcss>                | Build styling    | PostCSS processor         |
| `prettier`                         | `^3.8.3`        | <https://www.npmjs.com/package/prettier>               | Dev format       | Formatter                 |
| `tailwindcss`                      | `3.4.17`        | <https://www.npmjs.com/package/tailwindcss>            | Build styling    | Tailwind CSS compiler     |
| `tsx`                              | `^4.21.0`       | <https://www.npmjs.com/package/tsx>                    | Dev scripts      | TypeScript script runner  |
| `turbo`                            | `^2.4.2`        | <https://www.npmjs.com/package/turbo>                  | Dev tooling      | Task cache/orchestration  |
| `typescript`                       | `6.0.3`         | <https://www.npmjs.com/package/typescript>             | Dev typing       | TypeScript compiler       |
<!-- markdownlint-enable MD060 -->

## Related Docs

- [Package Json And Pnpm Usage](PACKAGE_JSON.md)
- [Railway Deployment](RAILWAY_DEPLOYMENT.md)
- [Vercel Deployment](VERCEL_DEPLOYMENT.md)
