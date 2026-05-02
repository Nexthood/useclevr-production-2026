# UseClevr Production Outputs

- `node/`: Next.js standalone Node server bundle. Deploy this to Railway, Docker, VPS, or any Node host.
- `static/`: reserved for a host-anywhere static export. This project is not fully static-exportable yet because it uses server routes and auth.
- `shared/`: common copied assets/public files used by production outputs.
