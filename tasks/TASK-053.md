# TASK-053 — Phone QA of SpanishBuddy and GermanBuddy

**Status:** `ready`
**Assigned to:** Product Owner (Giacomo) — not a Developer task; Claude can help on request
**Written by:** Tech Lead
**Depends on:** TASK-049, TASK-050

## Context
Everything from TASK-040 to TASK-050 has only been tested on a computer. This is the real test on a phone.

## Steps
1. Install SpanishBuddy (debug-signed release APK is fine) next to GermanBuddy.
2. Work through `store/es/qa-checklist.md` section by section; write OK / Bug / n.a. and notes.
3. Repeat the German-relevant rows on GermanBuddy (speech of whole sentences from TASK-040, filter sheet from TASK-039, permissions, backup, languages).
4. Send the Bugs to Claude as a list; each becomes its own fix task with a failing test first.

## Done when
- [ ] Checklist filled in, sign-off (section 12) done
- [ ] No Bug left in sections 1–4, 7, 8 (they block the first upload)
