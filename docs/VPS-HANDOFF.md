# VPS handoff — current runtime requirements

KinRoot v0.2.1 starts with an empty family. No cloud records, uploaded private photos, membership data, invitation tokens or local database files are included in the repository. QA fixtures do not seed a real installation.

## Runtime boundary

The current full-stack implementation targets Cloudflare Workers via Vinext, with D1 and R2. Login identity is supplied by ChatGPT Work hosting. This is **not yet a standalone Ubuntu Node/PM2 backend**. Copying the source to a VPS alone does not recreate D1/R2 or host-managed sign-in.

Before standalone VPS production, supply a supported database/file adapter and an authentication/session implementation. Google/Apple require registered provider applications and secure runtime credentials. Never accept client-supplied `oai-authenticated-user-*` headers as proof of identity on a public VPS; those headers are trusted only behind the Work dispatch boundary.

No VPS connection or deployment was performed in this change. Keep future new implementation work under `/home/ubuntu/codex/`, uploads under `/home/ubuntu/patches/`, and backups under `/home/ubuntu/backups/`. Existing deployment directories are not used by this repository automatically.

## Work/Cloudflare build

`npm ci`, `npm test`, and `npm run build` reproduce the current runtime. `.openai/hosting.json` in the GitHub export declares only DB/BUCKET bindings and does not identify the existing private review Site. The Sites-managed checkout separately preserves that Site identity.

Cloud tables are created by schema-only migrations. No automatic demo seed or real-family dump is included. Demo datasets are retained only as test fixtures; the application's initial local record and default newly created cloud families are empty.
