# TASK-067 — French: reader review, store setup, graphics, phone QA

**Status:** `ready`
**Assigned to:** Product Owner (Giacomo) — not a Developer task; Claude can help on request
**Written by:** Tech Lead
**Depends on:** TASK-063 to TASK-066

## Context
The French bank, its translations into 10 languages and the store listing in 12 languages are machine-written and agent-reviewed; **no human who reads French has checked them**. The app also needs a store listing, a support site and real graphics before it can be published. These steps mirror TASK-053 to TASK-056 for Spanish.

## Steps
1. **Reader review.** Find a French reader for the review sheets in `mobile/scripts/wordbank/fr/review/` (40 rows per sheet, 6 sheets): wrong words, unnatural examples, wrong notes, wrong tags. Send the corrections to Claude; source fixes go into the TSVs, `npm run build:wordbank`, and the touched rows are re-translated (the accepted cost of translating before review).
2. **Skim readers** for at least it, en, es, pt: 20 random rows of `src/data/wordbank/fr/i18n/<L>.json` and the listing `store/fr/listing/<L>.json`. Mark `reviewed` in a listing file only for languages a reader approved; publish only those.
3. **Support site.** Create `giamat90/frenchbuddy-support`, copy `store/fr/dist/support/*` (from `npm run build:store -- fr`) into it, enable GitHub Pages.
4. **Contact form.** Create a Formspree form; put its id in `store/fr/support.json` → `contactFormId`; run the build again, recopy, send yourself a test message.
5. **Play app.** Create `com.giamat90.frenchbuddy` in the developer account (a new package), give the CI service account access, fill the forms from `store/fr/play-checklist.md` (Data safety, content rating, audience, no ads).
6. **Graphics.** Real icon, adaptive foreground and feature graphic from `store/fr/graphics-brief.md` (replace `assets/icon-fr.png`, `assets/adaptive-icon-fr.png`); screenshots from a phone per `store/fr/screenshots.md`.
7. **Phone QA** with `store/fr/qa-checklist.md` on at least one phone with a French voice and one without: typed answers with accents and `ç`, the reorder tile `va ?` stays one tile, the TTS voice speaks `fr-FR`, backup/restore, notifications, language switching. Record failures for Claude.
8. **First release** only after steps 1–7: check the highest versionCode on Play first (never trust `CONTEXT.md`), then run `release-android.yml` with `app=fr`.

## Done when
- [ ] French bank reviewed and corrected by a reader
- [ ] At least it and en listings reviewed; the rest stay unpublished until reviewed
- [ ] Support site, form, Play app and graphics exist
- [ ] Phone QA passed; `CONTEXT.md` records who reviewed what and the release status
