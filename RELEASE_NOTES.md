# KinRoot v0.2.1

29 October 2026.

- Tree cards, relationship selectors, profile views and exported tree labels use names/profile information rather than example letter IDs.
- Removed the demo/cloud announcement banner and its management link from the dashboard.
- Fresh application storage and newly created cloud families start empty.
- Removed demo-loading choices from the application UI.
- Family-name placeholder: “Ketik Nama Keluarga”.
- Creator credit appears only in the footer: “KinRoot by Febro Herdyanto”.
- Existing saved family records are not deleted by these presentation/default changes.
- Source prepared for the requested LS_Kinroot GitHub repository, excluding runtime databases, credentials, uploads and Work Site identity.

The backend still uses Work/Cloudflare identity, D1 and R2. A standalone Node/PM2 VPS adapter and independent Google/Apple OAuth remain future work; see `docs/VPS-HANDOFF.md`.
