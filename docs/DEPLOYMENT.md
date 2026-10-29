# KinRoot v0.2.0 hosting and review

The same Work Site is now a Vinext Worker application with D1 (`DB`) and R2 (`BUCKET`) bindings. `.openai/hosting.json` retains project `appgprj_6ae32285c8848191b9b69487ff962fb3`; its former static-site declaration has been removed.

The production build prepares the existing genealogy client under `public/kinroot-app`, compiles the maintained Sites Worker integration and includes the generated schema migration. Sites provisions cloud storage and applies pending migrations before publishing. Browser v0.1.0 storage stays untouched; importing it into a cloud family is explicit.

This Site remains owner-private. Sign in through the host's Continue with ChatGPT flow. Family invitations do not change the Site hosting audience; invitees require Site access as well. A public demo/entry page can be enabled only after the owner's audience-change instruction. All real-family endpoints still require verified identity and explicit family membership even if the entry point later becomes public.

The Site login offers Google/Apple within ChatGPT authentication. Independent direct provider OAuth is not provisioned by this host integration.

## Rollback and recovery

Application data: export complete JSON before major edits. Cloud revision conflicts never silently overwrite a newer server record. Download failed drafts before leaving the page. Session undo is another revision-checked write. No automatic cloud data version history is claimed.

Code rollback: redeploy a compatible saved Site version. Database migrations can already have applied even if a deployment fails, so do not replay or alter applied migration files. Rolling back to the old static release does not delete D1/R2 records but hides their UI. Restoring browser-local code does not migrate cloud data into localStorage.

The final receipt records the verified deployment status, version, commit and live URL. Authenticated hosted UI and live cross-account acceptance need user verification; test coverage and limits are explicit in `TEST_REPORT-v020.md`.
