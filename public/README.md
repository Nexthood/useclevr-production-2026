# Public Assets

This folder is for files that must be served directly by Next.js from the site root.

Examples:

- `public/robots.txt` -> `/robots.txt`
- `public/manifest.webmanifest` -> `/manifest.webmanifest`
- `public/assets/generated/...` -> `/assets/generated/...`

Most app assets should stay in `src/assets/` and be served through the existing `/assets/...` route. Keep generated files out of git; `public/assets/generated/` is ignored.

