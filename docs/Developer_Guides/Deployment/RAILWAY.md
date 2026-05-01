# Railway

## Runtime

| Item | Value |
| --- | --- |
| Platform | Railway |
| Builder | Nixpacks |
| Package manager | pnpm |
| Node | 22+ |
| Health | `/api/health` |

## Commands

From `railway.json`:

```text
Build: pnpm railway:install && pnpm railway:build
Start: pnpm railway:start
```

Local prod check:

```bash
pnpm prod:build
pnpm prod:start
```

`pnpm prod:build` outputs `dist/server.js`, `dist/.next/`, and `dist/assets/`.

## Env

Required:

```env
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
GEMINI_API_KEY=
```

Optional:

```env
AUTH_URL=
TRUST_PROXY=true
LOCAL_UPLOAD_DIR=/tmp/useclevr-uploads
UPLOAD_PROVIDER=
```

## Deploy Checklist

- Nixpacks enabled.
- Env vars set in Railway.
- Start binds to `0.0.0.0`.
- Runtime uses Railway `$PORT`.
- `/api/health` returns 200.
- `assets/` copied to `dist/assets/`.
- No secrets in Git or logs.
- Uploads validate type/size.
- Security headers remain enabled in `next.config.mjs`.

## Debug

```bash
railway logs
railway status
railway open
```

Check:

- missing env vars
- build/start mismatch
- database connection
- health timeout
- leaked secrets

## Incident

1. Rotate affected secrets.
2. Check Railway variables and logs.
3. Confirm deployed commit.
4. Disable affected route/integration if needed.
5. Patch, redeploy, verify `/api/health`.
