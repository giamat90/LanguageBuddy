# TASK-051 — Security and CI housekeeping

**Status:** `ready`
**Assigned to:** Product Owner (Giacomo) — not a Developer task; Claude can help on request
**Written by:** Tech Lead
**Depends on:** none

## Context
Two blockers outside the code: a leaked credential in private history and GitHub Actions blocked by billing. Both stop a clean release.

## Steps
1. Revoke the leaked Firebase Admin key (found in the private GermanBuddy git history): Firebase/Google Cloud console → project → Service accounts → delete the key. Check nothing live still uses it; the app has no backend, so nothing should.
2. Fix GitHub billing so Actions run again (Settings → Billing and plans). Then push any commit and confirm `ci.yml` is green (type check, tests, and the new `npm run test:app -- es` step).
3. Optional: rotate the Play service-account key in `GoogleCloud/` if it was ever shared.

## Done when
- [ ] The old Firebase key no longer exists in the console
- [ ] CI is green on `main`, including the Spanish app suite step
- [ ] `CONTEXT.md` known-issues entries for both are removed
