# Public Assets

This folder is for files that must be served directly by Next.js from the site root.

Examples for files that can live here:

- `public/manifest.webmanifest` -> `/manifest.webmanifest`
- `public/assets/generated/...` -> `/assets/generated/...`

`robots.txt` and `sitemap.xml` are generated from `src/config/site.ts`, so keep those in source rather than hand-writing public files.

Most app assets should stay in `src/assets/` and be served through the existing `/assets/...` route. Keep generated files out of git; `public/assets/generated/` is ignored.
