# TASK-055 — Spanish store setup: support site, form, Play app

**Status:** `ready`
**Assigned to:** Product Owner (Giacomo) — not a Developer task; Claude can help on request
**Written by:** Tech Lead
**Depends on:** TASK-048, TASK-054 (listing text)

## Context
The pages and listing texts are generated (`npm run build:store -- es`), but the accounts and forms that make them real do not exist yet.

## Steps
1. Create the GitHub repo `giamat90/spanishbuddy-support`; copy `store/es/dist/support/*` into it; enable GitHub Pages.
2. Create a Formspree form; put its id in `store/es/support.json` → `contactFormId`; run `npm run build:store -- es` again and recopy the pages; send yourself a test message.
3. Create the Play app `com.giamat90.spanishbuddy` in the developer account (a new package, not an update).
4. Give the CI service account access to it (Users and permissions) so `release-android.yml` with `app=es` and the version check work.
5. Fill the forms from `store/es/play-checklist.md` (Data safety, content rating, target audience, ads: none). Where it says *Product Owner to confirm*, answer in the console.
6. Create a signing setup for the Spanish app if you use a separate key; keep `release.keystore` backed up outside the repo.

## Done when
- [ ] Privacy policy URL opens and the contact form delivers
- [ ] Play app exists with all forms complete, ready for a first upload
- [ ] `CONTEXT.md` notes the support URL and Play status
