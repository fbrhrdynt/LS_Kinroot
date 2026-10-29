# KinRoot v0.2.0 security notes

All promotional people, stories and generated portraits are fictional. Real family records are never bundled into static assets.

- Host-verified identity is required for every family, invitation and private-photo operation.
- Every family ID is reauthorized server-side. Viewer accounts cannot write; only owners administer membership/invitations.
- The server uses prepared SQL, confirmed-biological cycle validation, explicit relationship facts and revision-checked writes.
- Mutation requests require a same-origin Origin header. JSON request streams are bounded to 1.5 MB; images to 2 MB.
- Invitation secrets are cryptographically random 256-bit tokens; only SHA-256 hashes are stored. Links expire after seven days, are single-use, can be revoked and can target one email.
- Photo content types are restricted to raster formats, signature-checked and served with nosniff. R2 reads check family membership.
- User content is escaped in HTML/SVG; CSV formula prefixes are neutralized. API JSON responses use no-store.
- No OAuth client secrets, source credentials or database keys are shipped in browser assets.

Limitations: invitation URLs are bearer secrets and should be shared privately. No external email service, automated asset garbage collection, full account erasure flow, rate-limiting service or independent security audit is included. The host's existing private access gate remains active. Direct independent Google/Apple OAuth is unavailable in this host integration.
