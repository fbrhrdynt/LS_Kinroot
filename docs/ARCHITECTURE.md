# KinRoot v0.2.0 architecture

The genealogy client remains modular JavaScript/HTML/CSS/SVG. A full-viewport same-origin frame loads its static assets under a Vinext server application. The maintained Sites Worker integration supplies durable D1/R2 bindings and host identity. `/` and `/kinroot` route to the application shell.

The browser calls `/api/cloud/*`. `server/handler.ts` injects the Worker environment and `getChatGPTUser` into the production API factory. `server/api.js` contains all database and authorization flows and is directly integration-tested. Request identities come from the host, never a browser userId parameter.

## Storage

`families`: id, display name, owner identity, validated genealogy JSON, monotonically increasing revision, updated timestamp.

`memberships`: composite family/user primary key; role, contact/display fields and join time.

`invitations`: family, SHA-256 token hash, editor/viewer role, optional exact normalized email, status, expiry, accepted identity and creating identity.

`BUCKET`: private photo bytes with family ID metadata. Every photo read/write checks membership. No public object URLs or client credentials are issued. Raster type signatures and 2 MB upload limits are enforced.

The first migration creates only these new tables/indexes. Demo seeding is explicit application data creation and never a migration side effect.

## Write consistency

Family writes compare the supplied revision in SQL: `UPDATE ... WHERE id=? AND revision=?`. A changed row increments the revision; zero changed rows return 409. The UI keeps an in-memory failed draft for export. Family records do not change on failed requests. Session-only undo is implemented as another validated revision-checked write.

Invitation acceptance uses a transactional D1 batch: claim a pending, unexpired link with matching optional email, then insert membership only for that claiming identity. A consumed/revoked link cannot grant a different user access. Membership conflicts do not replace an existing owner's role.

## Graph

Person IDs are canonical; marriage never infers parentage. Shared biological children branch from the couple midpoint only with two explicit confirmed biological edges. Prior-child biological facts remain available in profiles, while the C→H step link is orange dashed. Adoption, guardian and uncertain edges are separate. Complex partnership components use labeled crosslinks without duplicate person records.

## Hosting boundary

Site-level visitor access is independent of in-application family membership. Keep the existing Site audience unless the owner explicitly requests a change. A public entry/demo would permit anonymous fictional demo viewing and host sign-in, while real family APIs still require identity and membership. That audience change is not part of this publication without explicit confirmation.
