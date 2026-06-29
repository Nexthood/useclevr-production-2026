# UseClevr Helper

UseClevr Helper provides the local private-analysis bridge for the UseClevr web app.

Run locally:

```bash
cd helper
pnpm start
```

The helper listens on `http://localhost:14567` and exposes:

- `GET /health`
- `GET /status` with shared Lite and MEGA feature flags
- `POST /chat`

Customer-facing UI names this capability UseClevr Hybrid AI, Private AI Analysis, Local AI Engine, and Secure runtime connected. Internal runtime details stay inside the helper implementation.

One UseClevr Helper installation serves Hybrid AI Lite and Hybrid AI MEGA. The UseClevr web app unlocks modules from the authenticated subscription and keeps future modules behind the same helper contract.
