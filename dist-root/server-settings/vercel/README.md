# Vercel Deployment Target

This folder contains the Vercel source-branch deployment template.

Vercel should deploy from:

```text
branch: main
root: /
config: /vercel.json
```

Vercel builds the Next.js source app directly and does not use the generated `dist` branch. Railway
continues to deploy from `dist:/dist`.

Source of truth:

```text
dist-root/vercel.json
```

Generated root config:

```text
vercel.json
```

Sync it from the template:

```bash
pnpm deploy:vercel:sync
```

Check it:

```bash
pnpm deploy:vercel:check
```

Vercel does not run the Railway pre-deploy migration command. Keep database schema changes controlled
through Railway pre-deploy, a manual migration command, or a future migration job if both production
targets need independent rollout control.

Local generated-output testing stays the default:

```bash
npm run start
```

Named production targets stay explicit:

```bash
npm run start:railway
npm run start:vercel
```
