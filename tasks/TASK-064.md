# TASK-064 — French word bank: pipeline rules, content, audit and the end of the draft

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-063 (French pack, draft language)

## Context
French is a draft language with a pack and no words (TASK-063). The Spanish bank took three tasks (045 A1, 046 A2–C2, then repairs 059/060/062 after an audit and native-agent reviews found wrong notes, invented compounds, misplaced levels and gaps). This task **builds the French bank once, with those lessons applied from the start**: content rules the validator enforces, a frequency audit and two native-agent opinions *before* anything is translated, and then the end of the draft flag.

Size (the Spanish decision, kept): ≈300 words per level, ≈1,800 in total, in 14-column TSVs.

## Scope
### In
1. French content rules in `scripts/wordbank/fr/language.json` (`exampleRules`, `levelRules`, `forbidden`, apostrophe/typography rules) and the validator support for what is new (below).
2. `scripts/wordbank/fr/{A1,A2,B1,B2,C1,C2}.tsv`, machine-drafted **in batches of ~35**, each batch validated.
3. **The audit and native review inside this task** (below), their fixes applied, before the draft flag is removed.
4. Review sheets (`export-review-sample.mjs --lang fr`) and the translators' sheets (`export-i18n-source.mjs --lang fr`) for TASK-065.
5. `"draft": true` removed once all six levels validate; per-language pins updated (`wordsPerLevel` for `fr` in `test-support/appExpectations.ts` is **TASK-066's** job; here only `__tests__/frenchBank.test.ts`).
6. `scripts/reference-lists/fr.txt` is downloaded **by hand** by the Developer (hermitdave/FrequencyWords `fr_50k.txt`, as for `de`/`es`; gitignored, never committed).

### Out
Translations into other app languages (065); the app variant, store, QA expectations (066); activating French in the repo seams (they stay German); any change to German or Spanish content.

## Content rules
Columns as German and Spanish: `word, article, pos, ipa, meaning_en, meaning_it, example, example_it, note_it, tag, topic, scenario, example_en, note_en`.

**Word forms**
- Nouns: singular, **no article in `word`**; `article` is `le` or `la` (the dictionary gender, also for nouns written `l'` in a sentence). A noun whose gender changes the meaning (*le/la livre*, *le/la tour*, *le/la voile*, *le/la mode*) is two entries with distinct English meanings, or is left out; a noun used in both genders (*le/la collègue*, *le/la touriste*) takes the more common article and the note says so. Plural-only nouns (*les vacances*, *les gens*) are not entries.
- Verbs: infinitive; **pronominal verbs without `se`** (`laver`, with the note "se laver" or tag `REFLEXIVE_VERBS` only when the example is reflexive); essentially pronominal verbs (*se souvenir*, *s'évanouir*) are entered **with** the particle as a 2-token word (`se souvenir`) and get no typed cloze; keep these under 3 % of a level.
- Adjectives: masculine singular (`grand`, `beau`, `nouveau`); the example may use any agreed form (rule below).
- `article` is `-` for every other part of speech. Parts of speech: `noun verb adj prep conj adv pron` (no `interj`, no numerals).
- Multi-word entries (connectors, fixed phrases such as *tout à fait*, *bien sûr*) are allowed from A2 on, ≤ 3 tokens, ≤ 5 % of a level; they never get a typed cloze.
- A headword containing an apostrophe (*aujourd'hui*, *quelqu'un*, *presqu'île*) is allowed, ≤ 8 per level, with a note saying it is written with an apostrophe.

**Variety and register:** standard French of France. Familiar words (*bouquin*, *boulot*, *fric*) only from B1 on and only with "familier" in `note_it`/`note_en`; no slang/verlan, no vulgar words at any level. Québec/Belgian/Swiss forms only as a note on the standard word.

**Typography (validator-enforced):** straight apostrophe `'` only (`’` is rejected); a no-break space U+00A0 before `?`, `!`, `:`, `;` and inside guillemets; no ordinary space before those marks; no double spaces. Guillemets in examples are avoided (use plain sentences).

**IPA:** Parisian standard, one transcription, no slashes (as the German bank), written as a dictionary headword is (for *maison*: `mɛzɔ̃`), without liaison marks.

**Example sentence**
- 4–10 tokens at A1–B1, **4–14** at B2–C2 (tokens are split on ordinary spaces, so `va ?` is one token and `j'ai` is one token); starts upper-case; ends with `.`, `?` or `!` (a `?`/`!` preceded by U+00A0).
- Contains the word: nouns and prepositions/conjunctions/adverbs in **exactly the bank form** (singular), compared as a whole word of the pack's `letters` (so `l'ami` contains `ami`); adjectives in an **agreed form** (`word`, `word+e`, `word+s`, `word+es`, or the irregular feminine/plural from `adjectiveForms` in `language.json` for -eux/-euse, -if/-ive, -al/-aux, -er/-ère, -on/-onne, -en/-enne, -et/-ète, -eau/-elle…); verbs: the **infinitive**, or a token starting with the regular stem (infinitive minus `er`/`ir`/`re`, at least 3 letters). Irregular verbs (*être, avoir, aller, faire, pouvoir, vouloir, savoir, devoir, venir, voir, prendre…*) must therefore appear as an infinitive (modal + infinitive, *aller* + infinitive, *je veux boire*), which is also what the typed cloze needs.
- Forbidden list in `language.json` starts with the regional/slang forms the native agents name; `forbidden: []` is allowed on day one but the review below must fill it.

**Topics** (the same 8 as the other banks: food, travel, work, culture, home, leisure, health, shopping): each ≥ 8 % per level; the audit's section 5 must show no topic under 5 %.

**Parts of speech per level** (±5 pp): nouns 40–45 %, verbs 25–30 %, adjectives 12–15 %, the rest function words and adverbs (A1 needs *je, tu, il, elle, nous, vous, ils, très, aussi, ici…*; the pronoun entries are `pron`). At B2–C2 more connectors (*cependant, néanmoins, tandis que*) are allowed.

**Grammar tags** (every entry exactly one; used only when the example sentence really exercises it, otherwise the plain code of the part of speech):
- A1: `NOUN_GENDER` (nouns), `ADJ_AGREEMENT` (adjectives), `VERB_PRESENT_ER` (regular -er verbs), `ETRE_AVOIR`, `NEGATION_NE_PAS`
- A2: `VERB_PRESENT_IRREGULAR, REFLEXIVE_VERBS, PASSE_COMPOSE, AUXILIARY_AVOIR_ETRE, DIRECT_OBJECT_PRONOUN, PARTITIVE_ARTICLE, FUTUR_PROCHE` (+ A1 codes)
- B1: `IMPARFAIT, FUTUR_SIMPLE, CONDITIONNEL, IMPERATIF, INDIRECT_OBJECT_PRONOUN, PRONOUNS_Y_EN, RELATIVE_QUI_QUE`
- B2: `SUBJONCTIF_PRESENT, PLUS_QUE_PARFAIT, PASSIF, RELATIVE_COMPOSE, DISCOURS_RAPPORTE`
- C1: `SUBJONCTIF_PASSE, SI_CLAUSES, GERONDIF_PARTICIPE`
- C2: `PASSE_SIMPLE, REGISTRE_SOUTENU, CONCORDANCE_TEMPS`
`levelRules.<L>.allowedCodes` rejects a code of a later level.

**Choice-tagged sentences** (the drilled rules; one tag per entry, only where exactly one answer is right):
- `AUXILIARY_AVOIR_ETRE`: ≤ 20 at A2, ≤ 20 at B1, ≤ 10 per level after; the sentence contains **exactly one** member of one pair of the pack's set, as a **free token** (`il a`, `je suis`, `nous avons`; never inside an elision such as `j'ai`: the drill and "find the mistake" ignore elided forms), and never both members of a pair (validator).
- `DIRECT_OBJECT_PRONOUN`: ≤ 15 at A2 and B1, none later; the sentence contains one of `le/la/les` as a free token used as a pronoun (a human check; the validator only checks presence), so `Je les vois.` qualifies and `Je l'ai vu.` does not.
- `RELATIVE_QUI_QUE`: ≤ 15 at B1 and B2, none later; the sentence contains exactly one of `qui`/`que`, whole word, not inside `parce que`, `pour que`, `bien que`, `afin que`, `après que`, `avant que` (the validator rejects those sentences for this rule).
The words of these entries are the verb/noun the sentence is about.

**Notes** (`note_it`, `note_en`): one or two sentences, true, specific, **about the headword itself** (a usage difference, a false friend with Italian or English, an irregularity, a register), never a comment on another word of the example. No invented etymology and no date or name you are not sure of: when unsure, write the usage fact and leave the history out. French–Italian false friends are welcome where real (*attendre* ≠ attendere, *rester* ≠ restare, *chance* = fortuna, *librairie* ≠ libreria, *coin*, *lecture*). Italian must be natural Italian; English mirrors it.

**Hygiene that the earlier banks needed repairs for (rules of this task):** no word in two levels (case-insensitive, accent-insensitive); no two entries of the same part of speech with the same English meaning; no invented words or compounds (a headword must be in the frequency list or in a standard dictionary: the audit prints the ones that are in neither); no loose phrases or sentences as headwords; lemma forms only; capitalisation as in a dictionary (nouns lower-case in French); levels follow frequency and usefulness (the audit's misplaced-word lists are fixed, not just printed).

## Procedure (the order matters)
1. Rules and validator support first (tests red → green).
2. Draft a level in batches of ~35 (a topic mix each); run `validate-wordbank` after each batch.
3. When a level has ~300 rows: `npm run audit:wordbank -- fr`, fix the findings (misplaced words, thin topics, the gap candidates that are really missing everyday words).
4. **Native review per level** (standing rule): for each level, **two independent French-speaking native/teacher agents**, read-only, receive the whole level as a sheet (word, article, pos, meanings, example, example_en, notes, tag, topic) and report only real errors as JSON `{word, class, problem, suggestion}` with class 1 = note false/off-topic, 2 = example unnatural or wrong, 3 = entry invalid (invented, loose phrase, wrong lemma/gender/article), 4 = level or tag misplaced, 5 = IPA. The Developer applies what both agents agree on (or what is checkable); disagreements are listed in the report. Because the Spanish and German reviews found ≈2–35 % bad notes, **every level goes through this loop until a fresh pass finds ≤ 2 real errors per 100 rows**.
5. Only then export the review sheets and the translators' sheets and remove the draft flag.

## Acceptance Criteria
- [ ] `A1…C2.tsv` exist, 280–320 rows each, 14 columns, no duplicate within or across levels (also not by accent-folded form), validated.
- [ ] Per level: topics ≥ 8 %, nouns 40–45 % (±5 pp), multi-word ≤ 5 %, pronominal ≤ 3 %, apostrophe headwords ≤ 8, choice caps respected, tags within `allowedCodes`, all `ruleChecks` pass.
- [ ] Validator messages (each with a failing and a passing fixture test): `example must contain the word or an agreed form of it`, `example has N tokens (4–10 | 4–14)`, `example must start upper-case and end with . ? or !`, `example uses forbidden form /re/`, `apostrophe must be straight '`, `missing no-break space before ? ! : ;`, `ordinary space before ? ! : ;`, `article must be le, la or -`, `choice sentence has both members of a pair`, `RELATIVE_QUI_QUE sentence contains a fixed phrase`, `tag from a later level`.
- [ ] The audit report for `fr` (medians rising A1 → C2, misplaced lists fixed, topic balance) is summarised in the report; the frequency list is not committed.
- [ ] The native-review loop of step 4 ran on all six levels; per level the first-pass error rate per class and the final pass (≤ 2 per 100) are in the report; disagreements listed.
- [ ] `npm run build:wordbank` and `validate:wordbank` pass with the draft flag removed; `node scripts/set-active-language.mjs fr` works **in a temp copy** and does not change the repo seams.
- [ ] Property test over the whole real bank with `setActivePackForTests(fr)`: article question for every noun; every choice question has its answer in its options; ≥ 100 exercise models per level; the gender mistake never builds on an elided article.
- [ ] Review samples (`scripts/wordbank/fr/review/sample-<L>.md`, 40 rows each) and the six `i18n-source` sheets are generated and committed.
- [ ] `tsc` clean; `npm test` and `npm run test:app -- es` green (German and Spanish unchanged); `CONTEXT.md` updated.

## Technical Spec
### Files to create
```
mobile/scripts/wordbank/fr/{A1,A2,B1,B2,C1,C2}.tsv
mobile/scripts/wordbank/fr/audit.json                 (thresholds as for de/es; stop list: articles, pronouns, prepositions)
mobile/scripts/wordbank/fr/i18n-source/*.tsv          (generated)
mobile/scripts/wordbank/fr/review/sample-*.md         (generated)
mobile/src/data/wordbank/fr/*.json                    (generated)
mobile/__tests__/frenchBank.test.ts
```
### Files to modify
```
mobile/scripts/wordbank/fr/language.json   exampleRules, levelRules, forbidden, adjectiveForms, typography; remove "draft"
mobile/scripts/validate-wordbank.mjs, lib/*  new rule kinds (generic, driven by language.json; German has none, Spanish unchanged)
mobile/__tests__/wordbankScripts.test.ts   fixtures for each new message
CONTEXT.md, tasks/TASK-064.md (status)
```
`language.json` additions (shape; values as in "Content rules"):
```json
"exampleRules": { "minTokens": 4, "maxTokens": 10, "stemMinLength": 3, "straightApostrophe": true,
                  "nbspBefore": ["?","!",":",";"], "forbidden": [],
                  "adjectiveForms": [["eux","euse"],["if","ive"],["al","ale"],["al","aux"],["er","ère"],["on","onne"],["en","enne"],["et","ète"],["eau","elle"]] },
"levelRules": { "A1": {"allowedCodes":[…]}, "…": {}, "B2": {"maxTokens": 14}, "C1": {"maxTokens": 14}, "C2": {"maxTokens": 14} },
"choiceCaps": { "AUXILIARY_AVOIR_ETRE": {"A1":0,"A2":20,"B1":20,"B2":10,"C1":10,"C2":10},
                "DIRECT_OBJECT_PRONOUN": {"A1":0,"A2":15,"B1":15,"B2":0,"C1":0,"C2":0},
                "RELATIVE_QUI_QUE": {"A1":0,"A2":0,"B1":15,"B2":15,"C1":0,"C2":0} }
```
Generic rule kinds only (no `if (lang === 'fr')`): reuse what Spanish already has (`exampleRules`, `levelRules`, `choiceCaps`/caps, `ruleChecks`, cross-level duplicates) and add the new ones as options.

## Tests (write first)
- `wordbankScripts.test.ts`: one failing and one passing fixture per validator message in the criteria; adjective-form acceptance (`beau`→`belle`, `nouveau`→`nouvelle`, `heureux`→`heureuse`, `actif`→`active`, `légal`→`légaux`); verb stem acceptance (`manger`→`mange`, `finir`→`finissons`, `vendre`→`vendent`) and rejection of an irregular conjugated form (`aller` → `vais`); elision (`l'ami` contains `ami`); NBSP rules.
- `frenchBank.test.ts` (real JSON): counts and shares from the criteria, nothing empty, no forbidden form, choice sentences contain exactly one member, accent-folded duplicates absent, article ∈ {le, la, -}, nouns have an article, no `’`, typography rules hold for every example, property tests with `setActivePackForTests(fr)`.
- Guard checks: put a `’` into a fixture and see the straight-apostrophe test go red; delete `ruleChecks` for `RELATIVE_QUI_QUE` and see the presence test go red.

## Definition of Done
- [ ] Criteria checked; tests first, red then green; German and Spanish banks and tests untouched
- [ ] `npx tsc --noEmit`, `npm test`, `npm run test:app -- es` green
- [ ] Diff review: generated files only through the scripts; no frequency list or text derived from it committed beyond summary numbers
- [ ] Report: counts per level, audit summary, native-review error rates per class and level (first and last pass), disagreements, what is left debatable
- [ ] Conventional commit: `feat(TASK-064): French word bank A1–C2`
- [ ] `CONTEXT.md` updated (064 done, 065 next; the bank is machine-drafted and agent-reviewed, **not** reviewed by a human native), status `done`

## Notes for Tech Lead (remove before handing over)
- The audit and the native loop are in this task, unlike Spanish, because repairing a bank after translating it means re-translating (the cost TASK-059/060/062 paid ≈ 200 rows × 10 languages).
- Pronominal verbs: dropping `se` keeps the headword a single token for the typed cloze and the stem rule; the note carries "se laver". Essentially pronominal verbs are the exception and cost a typed cloze, hence the 3 % cap.
- NBSP is a content rule because French typography needs it; the engine side is the tokenizer change in TASK-063. If a phone keyboard cannot type NBSP the learner never has to: only the bank sentence uses it, and typed answers are single words.
- Choice caps are small on purpose (quality over count, as TASK-045 argued); the caps are the Tech Lead's guess and can be raised after the native review of the first twenty sentences.
