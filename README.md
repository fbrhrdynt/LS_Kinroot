# KinRoot

Genealogy application with member profiles, explicit family relationships, interactive SVG tree, stories, family workspaces, role-based collaboration and invitations.

Version: **0.2.1**.

New installations begin with **zero members and zero relationships**. Names and other forms use neutral placeholders. The canonical letter-based family cases are internal QA fixtures and are not displayed as user-facing labels or automatically seeded into a family.

## Features

- Add/edit/delete members, biographies, dates and photos.
- Explicit biological, step, adoptive, guardian and uncertain relationships.
- Shared biological branches originate at the couple midpoint; marriage never implies biological parentage.
- Pan/zoom/fit tree, profile inspection, JSON/CSV/SVG export and JSON import.
- Cloud family workspaces, owner/editor/viewer roles and expiring single-use invitation links.
- Revision conflict detection and membership-protected photo access.
- No personal family data or cloud records are included in this repository.

## Build and checks

Node >=22.13.0:

```sh
npm ci
npm test
npm run build
```

The build prepares browser assets from `src/` and compiles the maintained Vinext Worker integration. Drizzle migrations are schema-only and do not seed example families.

## Runtime and future VPS deployment

The current backend targets **Cloudflare Workers, D1 and R2**, with identity supplied by ChatGPT Work. It is **not yet a standalone Ubuntu Node/PM2 backend**. A VPS deployment requires compatible persistence/file adapters and real server authentication; copying the source alone does not provide those services.

Read [VPS handoff](docs/VPS-HANDOFF.md) before deployment. No VPS has been accessed or changed.

## Source

- `src/`: browser application, clean initial family, explicit relationship domain and tree routing.
- `server/`: authorization policy and cloud API.
- `app/`: Vinext pages and API routes.
- `db/`, `drizzle/`: schema and migrations.
- `tests/`: domain, persistence, routing, clean-start and multi-user cloud tests.
- `public/kinroot-app/`: prepared browser assets.

Runtime secrets, databases, local tool state and uploaded photos are ignored by Git. Test fixtures are isolated from application initialization. The GitHub export omits the private Work Site project identity and promotional portrait sheet.
