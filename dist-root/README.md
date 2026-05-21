# UseClevr Deployment Branch Root

This folder contains version-controlled files and server-host templates used when publishing the
generated `dist` branch.

Root files such as `.gitignore` and `README.md` may be copied to the deployment branch root.
Runtime hosting config must live inside the generated `/dist` folder.

## Railway

Railway source-of-truth:

```text
dist-root/railway.json
```

Generated Railway config (inside the `/dist` folder):

```text
dist/railway.json
```

Do not place `railway.json` at the deployment branch root.

## Vercel

Vercel source-of-truth:

```text
dist-root/vercel.json
```

Generated root config (at the deployment branch root):

```text
vercel.json
```

Vercel deploys the source app from `main` using the root `vercel.json`, which is synced from the above template.
