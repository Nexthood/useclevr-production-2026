# UseClevr Production Outputs

- `node/`: Next.js standalone Node server bundle. This is the cleanest Railway/Docker/VPS deploy root.
- `package.json` and `railway.json`: allow `dist/` itself to be used as a Railway deploy root; it starts `node/server.js`.
- `static/`: reserved for a host-anywhere static export. This project is not fully static-exportable yet because it uses server routes and auth.
- `shared/`: common copied assets/public files used by production outputs.
