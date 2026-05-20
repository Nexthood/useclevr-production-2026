# Dist Branch Deployment Future Requests

- Add a generated deployment manifest with source commit, build timestamp, Node version, pnpm
  version, and healthcheck path.
- Add a `dist` branch smoke-check workflow only if Railway needs to wait for a GitHub status check
  before deploying.
- Add a two-service Railway setup only if background jobs or migrations need isolation from the web
  server.
- Add server-host templates for a second hosting destination if Railway is not the only production
  host.
- Add a Railway account-backed service checklist covering Railway, Neon, Gemini, Stripe, upload
  storage, and future secondary hosts.
