# TASK-057 — Check the live German contact form

**Status:** `ready`
**Assigned to:** Product Owner (Giacomo) — not a Developer task; Claude can help on request
**Written by:** Tech Lead
**Depends on:** none

## Context
The workspace copy of the German contact page posts to a placeholder Formspree id (`REPLACE_WITH_GERMANBUDDY_FORMSPREE_ID`). The live page may be fine; nobody has checked.

## Steps
1. Open the live contact page of GermanBuddy and send a test message.
2. If it does not arrive: create the Formspree form, put its id in `germanbuddy-support/contact.html`, push that repo.
3. Remove the known-issue line from `CONTEXT.md`.

## Done when
- [ ] A test message from the live page reaches your inbox
