# TASK-063 — The French `LanguagePack` (rules, grammar drill, quiz, strings; no word content)

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-044 (the Spanish pack, the `choices` mechanism), TASK-045 (draft languages), TASK-062 (pushed `bd8d05d`)

## Context
Spanish was added in two layers: the pack (TASK-044: behavior, drills, quiz, strings, no words) and the bank (045/046/046b). French follows the same path, so this task adds **only behavior**. The word bank is TASK-064, its translations TASK-065, the app variant, store and QA TASK-066. Until 064 delivers content, French is a **draft language** (`"draft": true`): build and validator skip it, `set-active-language fr` refuses it, `npm test` and the German and Spanish apps are untouched.

### Product decisions (taken by the Tech Lead on 2026-11-22; the Product Owner can still change them)
| Question | Decision | Consequence in this task |
|---|---|---|
| Scope | **All levels A1–C2**, ≈300 words per level (as Spanish) | rule codes for all six levels |
| French variety | **Standard French of France** (Paris pronunciation, IPA). Québec, Belgian and Swiss forms appear only in notes (*septante/nonante*, *déjeuner*) | TTS locale `fr-FR` |
| Audience (app languages) | all 13 **except French** | `uiLanguages` has 12 entries (it en es pt ru uk pl tr zh ja hi ar) |
| Name | **FrenchBuddy**, package `com.giamat90.frenchbuddy` | `pack.app` |
| Typography | Correct French spacing in the bank: a no-break space (U+00A0) before `? ! : ;` and inside `« »`. **Straight apostrophe** `'` everywhere in the bank (what a phone keyboard types) | tokenizers must not split on U+00A0; `fold` maps `’` to `'` |

## Scope

### In
1. `TargetLanguageCode` widened to `'de' | 'es' | 'fr'`; the French pack `src/languages/fr.ts`.
2. Article drill for `le`/`la`; "find the mistake" gender slot for `le la un une`; **choice** drill with three rule sets (below). No case drill (`cases: null`).
3. French overlay strings `src/languages/fr/strings/<ui>.ts` for the 12 offered app languages, and the placement quiz.
4. `scripts/wordbank/fr/language.json` with `"draft": true`, rule codes, parts of speech, articles, `ruleChecks`.
5. Two small engine changes French needs and German/Spanish must not feel: (a) `tokenizeSentence` splits on ordinary whitespace only (`/[ \t\r\n]+/`), so `va ?` (U+00A0) stays one tile; (b) `buildCloze`/typed grading unchanged but tested with elision (`l'ami`).
6. `CLAUDE.md` §4 rule-code list gains French; `CONTEXT.md`.

### Out
- Any French word, TSV or JSON (064/065); the variant, icons, store text (066).
- A French UI (`fr` stays one of the 13 app languages for German and Spanish learners; French is simply not offered to a French native).
- Tense/mood drills (their codes exist as tags only, no drill yet).
- Changing German or Spanish behavior (every German and Spanish test stays green).

## Acceptance Criteria
- [ ] With `setActivePackForTests(fr)`: typed `ecole` for `école`, `etre` for `être`, `francais` for `français`, `coeur` for `cœur`, `ca` for `ça` are graded `close` (accent/cedilla/ligature fold, word of 5+ letters tolerates one typo); `Être` is `exact`; `eleve` for `élève` is `close`; `ecloe` for `école` (two edits) is `wrong`.
- [ ] `splitToken("« Bonjour !»")` yields lead `«` + NBSP, core `Bonjour`, trail NBSP + `!»` (the no-break spaces belong to lead/trail, so rebuilding the token keeps them); `buildCloze("J'aime l'ami de Paul.", 'ami')` gives `J'aime l'` / ` de Paul.`; a typed answer `l'ami` for `ami` is `wrong`, `ami` is `exact`.
- [ ] `tokenizeSentence("Comment ça va ?")` → `['Comment', 'ça', 'va ?']` (three tiles); German and Spanish results unchanged.
- [ ] Article drill: question for nouns whose article is `le` or `la`; any other article value (`les`, `l'`, `-`) yields no question.
- [ ] Choice drill: `AUXILIARY_AVOIR_ETRE` ("Hier, je suis allé au marché.") blank `suis`, options contain `suis` and `ai`; `DIRECT_OBJECT_PRONOUN` options are the three of `le/la/les` including the answer; `RELATIVE_QUI_QUE` ("Le livre que tu lis est ancien.") blank `que`, options exactly `que`/`qui`; sentences without a member of the rule's sets give no question; `qu'` (elision) is never a blank.
- [ ] "Find the mistake" under `fr`: gender slot (the card's own `le`/`la` directly before the noun, wrong form from the opposite gender, never valid; `un`/`une` are not slot forms, as `el/la` in Spanish) and choice slot (tagged rule); `l'` before the noun gives **no** gender slot; German and Spanish results unchanged (their seeded tests green without edits).
- [ ] `buildDrill` under `fr` yields article + choice questions only; under `de`/`es` unchanged.
- [ ] The French quiz: five questions, correct indices `[1, 1, 0, 1, 0]`; all right → B2, all wrong → A1.
- [ ] `src/languages/fr/strings/` has the 12 offered app languages with identical keys and placeholders (parity test), the 23 required keys below, translated (not Italian) except the quiz options.
- [ ] `uiLanguages` of `fr` has no `fr`; `coerceNativeLanguage('fr')` is the default under the French pack.
- [ ] Build/validate print `skipped draft language fr` and exit 0; `set-active-language fr` exits 1 with "draft".
- [ ] `tsc` clean, `npm test` and `npm run test:app -- es` green, German app unchanged; `CONTEXT.md`, `CLAUDE.md` updated.

## Technical Spec

### Files to create
```
mobile/src/languages/fr.ts
mobile/src/languages/fr/strings/{it,en,es,pt,ru,uk,pl,tr,zh,ja,hi,ar}.ts
mobile/scripts/wordbank/fr/language.json        (draft)
mobile/__tests__/frenchPack.test.ts
```
### Files to modify
```
mobile/src/languages/types.ts, index.ts   TargetLanguageCode 'de'|'es'|'fr'; register the pack
mobile/src/lib/exercises/reorder.ts       tokenizeSentence: split on ordinary whitespace only
mobile/__tests__/targetStrings.test.ts    overlay languages = that pack's uiLanguages
mobile/__tests__/wordbankScripts.test.ts  draft French skipped; set-active refuses
mobile/scripts/lib/active-language.mjs    only if the draft list is hard-coded (it should not be)
CLAUDE.md (§4), CONTEXT.md, tasks/TASK-063.md (status)
```

### `fr.ts` (values fixed here)
```
code 'fr'; name 'French'; app { name:'FrenchBuddy', backupTag:'FrenchBuddy', dbFile:'frenchbuddy.db' }
letters /([A-Za-zÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸàâæçéèêëîïôœùûüÿ]+)/        // the apostrophe is NOT a letter: l'ami → l | ami
fold: trim, lower-case, ’→', œ→oe, æ→ae, then NFD and remove U+0300–U+036F, NFC   // é è ê ë à â î ï ô ù û ü ç ÿ all fold
typoMinLength 5
punctuation { lead: /^[«‹("“‘—  ]+/, trail: /[.,!?;:»›)"”’'…—  ]+$/ }
collation 'fr'; speech { locale:'fr-FR', rate:0.9 }; ai { languageName:'French' }
articles { forms ['le','la'], rule 'NOUN_GENDER', genderOf le→m, la→f }
gender { forms { le:['le','un'], la:['la','une'] }, neverValid { le:['la','une'], la:['le','un'] },
         pluralLookalike /$^/, lookalike { skipArticle:'', onlyWrongFor:{} } }
cases null
choices { ruleSets: {
  AUXILIARY_AVOIR_ETRE: [['ai','suis'],['as','es'],['a','est'],['avons','sommes'],['avez','êtes'],['ont','sont']],
  DIRECT_OBJECT_PRONOUN: [['le','la','les']],
  RELATIVE_QUI_QUE: [['qui','que']] } }
quiz [ {n:1,correctIndex:1},{n:2,correctIndex:1},{n:3,correctIndex:0},{n:4,correctIndex:1},{n:5,correctIndex:0} ]
uiLanguages ['it','en','es','pt','ru','uk','pl','tr','zh','ja','hi','ar']     (literal list, no import of i18n/language)
strings { it, en, es, pt, ru, uk, pl, tr, zh, ja, hi, ar }
```
Notes the Developer must respect:
- `l'` (elided article) is deliberately not a gender slot: it hides the gender, so the mistake builder only looks at a token directly before the noun that is one of `le la un une`. The article drill still asks `le`/`la` for `ami` and the explanation says "l'ami".
- `a`/`es` in `AUXILIARY_AVOIR_ETRE` are also ordinary words; that is acceptable because the drill uses only sentences the bank author tagged (064 caps them and checks that exactly one member of one pair is present). A sentence with both members of a pair is never tagged.
- No `fr` plural/gender look-alike problem as in German (`les` differs from `le`/`la`), hence `pluralLookalike /$^/`.
- German keeps `choices: null`; Spanish keeps its sets. Reuse the Spanish choice mechanism unchanged; if something in `grammar.ts`/`mistake.ts` hard-codes `el/la`-style assumptions, generalise it with a test, do not copy it.

### Overlay strings for `fr` (12 UI languages; Italian texts to write, the Developer translates the rest, machine-drafted)
Keys: `welcome_subtitle`, `review_mc_prompt_target`, `speech_unavailable_title`, `speech_unavailable_body`, `quiz_q1 … quiz_q5`, `quiz_q1_a … quiz_q5_b`, `grammar_rule_NOUN_GENDER`, `grammar_rule_AUXILIARY_AVOIR_ETRE`, `grammar_rule_DIRECT_OBJECT_PRONOUN`, `grammar_rule_RELATIVE_QUI_QUE` = 4 + 15 + 4 = **23** keys; the test asserts exactly these.
- `welcome_subtitle`: "Una parola di francese al giorno, da imparare davvero."
- `review_mc_prompt_target`: "Come si dice in francese?"
- `speech_unavailable_*`: as the Spanish ones, naming a French voice ("…non riesce a leggere il francese… installa una voce francese").
- Quiz (Italian question text; options are the French content):
  1. "Quale frase è corretta?" — A "Le maison est grande." B "La maison est grande."
  2. "Quale frase è corretta?" — A "Hier, j'ai allé au marché." B "Hier, je suis allé au marché."
  3. "Quale frase è corretta?" — A "Tu veux du pain ? Oui, j'en veux." B "Tu veux du pain ? Oui, j'y veux."
  4. "Quale frase è corretta?" — A "Il faut que tu viens demain." B "Il faut que tu viennes demain."
  5. "Quale frase è corretta?" — A "Si j'avais su, je serais venu." B "Si j'aurais su, je serais venu."
  (Correct: B, B, A, B, A → `[1,1,0,1,0]`. In Q3 *en* replaces a partitive, *y* a place or `à` + thing, so B is wrong.)
- `grammar_rule_NOUN_GENDER`: "Il genere va imparato insieme al nome: memorizza sempre le o la con la parola (davanti a una vocale diventa l'ami, l'école: il genere si perde, quindi impara la forma con l'articolo)."
- `grammar_rule_AUXILIARY_AVOIR_ETRE`: "Il passé composé usa avoir quasi sempre; être con i verbi di movimento e di cambiamento (aller, venir, arriver, partir, naître…) e con tutti i verbi riflessivi."
- `grammar_rule_DIRECT_OBJECT_PRONOUN`: "Il pronome complemento oggetto va prima del verbo e concorda con il nome sostituito: le (m.), la (f.), les (plurale); davanti a vocale diventa l'."
- `grammar_rule_RELATIVE_QUI_QUE`: "Qui sostituisce il soggetto della relativa, que il complemento oggetto (davanti a vocale qu')."
Parity rules as in TASK-043/044: same keys, equal placeholders, non-empty, not left in Italian (quiz options exempt).

### Draft language `scripts/wordbank/fr/language.json`
```json
{ "code": "fr", "draft": true, "name": "French", "levels": ["A1","A2","B1","B2","C1","C2"],
  "partsOfSpeech": ["noun","verb","adj","prep","conj","adv","pron"],
  "articles": ["le","la"],
  "i18nLanguages": ["es","pt","ru","uk","pl","tr","zh","ja","hi","ar"],
  "ruleCodes": [ ... ],
  "ruleChecks": {
    "AUXILIARY_AVOIR_ETRE": { "mustContainAny": ["ai","suis","as","es","a","est","avons","sommes","avez","êtes","ont","sont"] },
    "DIRECT_OBJECT_PRONOUN": { "mustContainAny": ["le","la","les"] },
    "RELATIVE_QUI_QUE": { "mustContainAny": ["qui","que"] } } }
```
Rule codes (tags; only the four drillable ones have an explanation string):
- **A1:** `NOUN_GENDER, ADJ_AGREEMENT, VERB_PRESENT_ER, ETRE_AVOIR, NEGATION_NE_PAS`
- **A2:** `VERB_PRESENT_IRREGULAR, REFLEXIVE_VERBS, PASSE_COMPOSE, AUXILIARY_AVOIR_ETRE, DIRECT_OBJECT_PRONOUN, PARTITIVE_ARTICLE, FUTUR_PROCHE`
- **B1:** `IMPARFAIT, FUTUR_SIMPLE, CONDITIONNEL, IMPERATIF, INDIRECT_OBJECT_PRONOUN, PRONOUNS_Y_EN, RELATIVE_QUI_QUE`
- **B2:** `SUBJONCTIF_PRESENT, PLUS_QUE_PARFAIT, PASSIF, RELATIVE_COMPOSE, DISCOURS_RAPPORTE`
- **C1:** `SUBJONCTIF_PASSE, SI_CLAUSES, GERONDIF_PARTICIPE`
- **C2:** `PASSE_SIMPLE, REGISTRE_SOUTENU, CONCORDANCE_TEMPS`

Draft behavior is the one from TASK-045 (`skipped draft language fr`, exit 0; `set-active-language fr` prints `fr is a draft language`, exit 1). If `i18nLanguages`, `ruleChecks`, or the draft flag are not yet read generically by the scripts, make them generic (a test with a temp fixture), do not special-case `fr`.

## Tests (write first, watch them fail)
`frenchPack.test.ts` (real `fr` pack via `setActivePackForTests`):
- grading and typography: the fold cases in the criteria (`ecole`, `etre`, `francais`, `coeur`, `ca`, `Être`), `’` typed for `'`; `splitToken` with NBSP and guillemets; `buildCloze` with `l'ami`; `tokenizeSentence` keeps `va ?` together; the German and Spanish tokenizer tests unchanged.
- articles: `{word:'ami', article:'le'}` and `{article:'la'}` give questions; `les`, `l'`, `-` give none.
- gender mistake: "Le chien mange la viande" with card chien/le gives a gender mistake whose wrong form is a feminine article; `l'` before the noun gives no slot; `un`/`une` are not slot forms.
- choice mistake and drill: each of the three rules (including a sentence-initial `Qui`, `Les`, `Ai`... only if it is a member: assert the capitalised answer), sentences without a member → null, `qu'` never a blank, unknown rule → null, options size 2/3/2, answer included, rng-deterministic.
- pack data: quiz indices, `uiLanguages` (12, no `fr`), `speech fr-FR`, `app`, `fold` of `œ`, `ç`, `ÿ`, `choices.ruleSets` keys, `collation` sorts `côte < coté`... (use a pair where `fr` and code-point order differ, as the Spanish `ñ` test).
- `targetStrings.test.ts`: overlay languages from the pack; `fr` has 12 files; required keys present; placeholders equal.
- `wordbankScripts.test.ts`: French draft skipped by build/validate, `set-active-language fr` refuses.
- Guard checks: drop the `œ` mapping from `fold` and see the `coeur` test go red; make `tokenizeSentence` use `\s+` again and see the NBSP test go red.

## Definition of Done
- [ ] Criteria checked; tests written first, red then green; German and Spanish tests unchanged and green
- [ ] `npx tsc --noEmit`, `npm test`, `npm run test:app -- es` green from `mobile/`
- [ ] Diff review: no German/Spanish behavior change, no French word content, no unrelated files
- [ ] **Native-agent check** (standing rule): a French native-speaker agent reads the five quiz questions and the four explanations in French and Italian; the result is noted in `CONTEXT.md`. Findings are fixed before the commit
- [ ] Conventional commit: `feat(TASK-063): French language pack`
- [ ] `CONTEXT.md` (063 done, 064 next), `CLAUDE.md` §4 updated, status `done`

## Notes for Tech Lead (remove before handing over)
- Accent folding makes `a`/`à`, `ou`/`où`, `sur`/`sûr` typed slips "close" (0.7), which is the intended leniency for a learner on a phone. If the Product Owner prefers accents to count as errors in the typed format, only `fold` changes.
- The auxiliary pairs were chosen over passé composé vs imparfait because the latter needs a different verb form, not one token from a set; it stays a tag without a drill.
- The apostrophe is not a letter on purpose: `aujourd'hui`, `quelqu'un` are headwords that will not get a typed cloze (the cloze needs a single letter run); 064 keeps such headwords few.

## Done (2026-11-22) — deviations from the spec

- 30 rule codes, not 26 (A1 5, A2 7, B1 7, B2 5, C1 3, C2 3). `un`/`une` are listed in `gender.forms`/`neverValid` as wrong forms but are not slot forms (the slot logic is shared with German and Spanish and only looks at the card's own article).
- `mistake.ts` now uses `tokenizeSentence` (ordinary whitespace only) so NBSP-joined marks stay in their token; `buildChoiceCloze` never blanks a letter run glued to an apostrophe (`j'ai`, `l'ai`, `qu'il`); typed answers treat `’` as `'`.
- Added a French palette (`#0055A4`) in `theme/palettes.ts` because `Record<TargetLanguageCode, Palette>` requires one; `variants/fr.json` (TASK-066) must use the same colour for the adaptive icon.
- Native-agent check: the French reader found two false statements in the explanations (movement verbs always take être; the pronoun always precedes the verb) and rated quiz q5 as B1/B2; explanations fixed in 12 languages, q5 kept (the wrong option is plainly wrong). Hindi term for the relative clause fixed. Es/pt/ru/uk/pl/tr/zh/ja/ar: no errors.
