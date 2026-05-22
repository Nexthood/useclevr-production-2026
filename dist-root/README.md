# UseClevr Deployment Branch Root

This folder contains version-controlled files and server-host templates used when publishing the
generated `dist` branch.

Everything in this folder is copied to the deployment branch root. Runtime application output stays
inside the generated `/dist` folder.

Host config files use the platform-native filenames under `server-config/`. The publish workflow
keeps them in `/server-config` on the deployment branch and does not copy them to the branch root or
inside `/dist`.

## Railway

Railway source-of-truth:

```text
dist-root/server-config/railway.json
```

Published Railway config:

```text
server-config/railway.json
```

Railway should use branch `dist`, root directory `/dist`, and config file path
`/server-config/railway.json`. Generated `/dist` includes `nixpacks.toml` so Nixpacks runs Corepack
pnpm in its install phase and does not run the default `npm i`.

## Vercel

Vercel source-of-truth:

```text
dist-root/server-config/vercel.json
```

Published Vercel config on the deployment branch:

```text
server-config/vercel.json
```

Vercel deploys the source app from `main` using the source-branch root `vercel.json`, which is
synced from the above template.
