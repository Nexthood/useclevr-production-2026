# UseClevr Deployment Branch Root

This folder contains version-controlled files and server-host templates used when publishing the
generated `dist` branch.

Everything in this folder is copied to the deployment branch root. Runtime application output stays
inside the generated `/dist` folder.

Host config files use the platform-native filenames under `server-config/`, then the publish workflow
copies them to the deployment branch root as `railway.json` and `vercel.json`.

## Railway

Railway source-of-truth:

```text
dist-root/server-config/railway.json
```

Published Railway config:

```text
railway.json
```

Railway should use branch `dist`, root directory `/dist`, and config file path `/railway.json`.
The generated `/dist` folder still includes `dist/railway.json` for local parity.

## Vercel

Vercel source-of-truth:

```text
dist-root/server-config/vercel.json
```

Generated root config (at the deployment branch root):

```text
vercel.json
```

Vercel deploys the source app from `main` using the root `vercel.json`, which is synced from the above template.
