# UseClevr Deployment Branch Root

This folder contains version-controlled files and server-host templates used when publishing the
generated `dist` branch.

Root files such as `.gitignore` and `README.md` may be copied to the deployment branch root.
Runtime hosting config must live inside the generated `/dist` folder.

Railway source-of-truth:

```text
dist-root/server-settings/railway/railway.dist.json
```

Generated Railway config:

```text
dist/railway.json
```

Do not place `railway.json` at the deployment branch root.
