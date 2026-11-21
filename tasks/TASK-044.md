# TASK-044 — The Spanish `LanguagePack` (rules, grammar drill, quiz, strings; no word content)

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-043 (pushed, `003813f`)

## Context
Phase 1 (041–043) made the code language-agnostic. This task adds the second language *behavior*: the pack for Spanish, the grammar-drill and "find the mistake" mechanism Spanish needs (it has no cases; its hard points are ser/estar, por/para and object pronouns), the placement quiz, and the pack's strings in the app languages. The **word bank is TASK-045/046**; here Spanish stays a *draft* language that the build skips, so `npm test`, the German app and the German bank are untouched.

### Product decisions (taken by the Tech Lead on 2026-11-21; the Product Owner can still change them)
| Question | Decision | Consequence in this task |
|---|---|---|
| v1 scope | **All levels A1–C2** (Product Owner) | rule codes for all six levels |
| Spanish variety | **Latin American neutral**, Spain-only forms marked in the bank | TTS locale `es-US`; no `vosotros` forms in the choice sets |
| Audience (app languages) | all 13 **except Spanish** (a native speaker does not learn Spanish); German as an app language is a later task | `uiLanguages` has 12 entries |
| Name | **SpanishBuddy**, package `com.giamat90.spanishbuddy` | `pack.app` |

## Scope

### In
1. `TargetLanguageCode` widened to `'de' | 'es'`; the Spanish pack `src/languages/es.ts`.
2. A generic **choice** part of the pack (`choices`): sets of mutually exclusive forms (ser/estar, por/para, lo/la/los/las) driving a "pick the right form" drill and a third slot in "find the mistake". German keeps `choices: null` (no change).
3. `ReviewCard.grammarAngle` (from the bank) so "find the mistake" knows the sentence's rule.
4. Spanish overlay strings `src/languages/es/strings/<ui>.ts` for the 12 offered app languages, and the Spanish placement quiz.
5. A **draft** flag in `language.json`: `scripts/wordbank/es/language.json` exists (rule codes, parts of speech, articles, `ruleChecks`) but the build and validator skip it and `set-active-language` refuses it, until TASK-045 delivers content and removes the flag.
6. Validator `ruleChecks` (generic, used by Spanish; German gets none).
7. `CLAUDE.md` §4 rule-code list becomes per-language; `CONTEXT.md`.

### Out
- Any Spanish word, TSV or JSON (045/046); the translation packs for the bank.
- App variants, Metro aliasing, icons, store text (047/048).
- A German app language (`de.ts` UI strings).
- Changing German behavior (every German test stays green).
- Subjunctive/tense drills as questions (their codes exist as tags only; no drill yet).

## Acceptance Criteria
- [ ] With `setActivePackForTests(es)`: typed answers `camion` for `camión` and `Camión` are graded `close`/`exact` as specified; `ano` for `año` is **wrong** (ñ is a different letter); `¿Dónde` / `¡Hola!` tokens split correctly; the cloze finds `niño`.
- [ ] Article drill: `el`/`la` questions for nouns whose article is `el` or `la`; a noun with another article value yields no question.
- [ ] Choice drill: for a sentence tagged `SER_ESTAR` ("Mi madre está cansada.") the blank is `está` with options containing `está` and `es`; for `POR_PARA` the blank is `para`/`por` with exactly those two options; for `DIRECT_OBJECT_PRONOUN` the options are 3 of `lo/la/los/las` including the answer. Sentences without a member of the rule's sets give no question.
- [ ] "Find the mistake" under `es`: gender slot (`el`/`la` before the card's noun) and choice slot (tagged rule); wrong forms are never valid there; sentences with neither return `null`; German results are unchanged.
- [ ] `buildDrill` under `es` yields article + choice questions only (no case rules); under `de` unchanged.
- [ ] The Spanish quiz: five questions, correct indices `[0, 0, 0, 1, 1]`; all-right gives B2, all-wrong A1.
- [ ] `src/languages/es/strings/` has the 12 offered app languages with exactly the same keys, placeholders non-empty (parity test), the 23 required/rule keys listed below; texts are translated (not Italian) except the quiz sentences.
- [ ] `uiLanguages` of `es` has no `es`; `coerceNativeLanguage('es')` is the default under the Spanish pack.
- [ ] The build/validator print `skipped draft language es` and exit 0; `set-active-language es` exits non-zero with "draft".
- [ ] `tsc` clean; `npm test` green; German app unchanged; `CONTEXT.md`, `CLAUDE.md` updated.

## Technical Spec

### Files to create
```
mobile/src/languages/es.ts                          — the pack
mobile/src/languages/es/strings/{it,en,fr,pt,ru,uk,pl,tr,zh,ja,hi,ar}.ts
mobile/scripts/wordbank/es/language.json            — draft language config
mobile/__tests__/spanishPack.test.ts, choiceDrill.test.ts
```

### Files to modify
```
mobile/src/languages/types.ts          — TargetLanguageCode 'de'|'es'; ChoiceSupport; LanguagePack.choices
mobile/src/languages/de.ts             — choices: null
mobile/test-support/testPack.ts        — choices: null
mobile/src/lib/grammar.ts              — buildChoiceCloze, buildChoiceQuestion, choiceRules, choice options
mobile/src/lib/exercises/mistake.ts    — choice slot; mistakeKind 'gender' | 'case' | 'choice'
mobile/src/lib/exercises/types.ts      — mistakeKind union; doc comment
mobile/src/services/reviewService.ts   — ReviewCard.grammarAngle from the bank
mobile/src/services/grammarService.ts  — choice questions in the pools
mobile/scripts/build-wordbank.mjs, validate-wordbank.mjs, lib/active-language.mjs — draft flag, ruleChecks
mobile/__tests__/targetStrings.test.ts — overlay languages = that pack's uiLanguages (12 for es)
mobile/__tests__/wordbankScripts.test.ts — draft and ruleChecks cases
CLAUDE.md (§4 rule codes), CONTEXT.md
```

### Implementation notes

**`types.ts`**
```ts
export type TargetLanguageCode = 'de' | 'es';
export interface ChoiceSupport {
  /** Rule code → sets of mutually exclusive forms. A token that is a member of a set is a possible blank. */
  ruleSets: Record<string, readonly (readonly string[])[]>;
}
// LanguagePack: choices: ChoiceSupport | null;   // null → no choice drill and no choice slot
```

**`es.ts`** (all values fixed here)
```
code 'es'; name 'Spanish'; app { name:'SpanishBuddy', backupTag:'SpanishBuddy', dbFile:'spanishbuddy.db' }
letters /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/
fold: trim, lower-case, NFD, remove U+0300–U+036F EXCEPT the tilde of ñ (so ñ stays ñ: normalise áéíóúü → aeiou u and keep ñ).
  Implementation hint: s.normalize('NFD').replace(/ñ/g,'\u0001').replace(/[̀-ͯ]/g,'').replace(/\u0001/g,'ñ').normalize('NFC')
typoMinLength 5
punctuation lead /^[¿¡"«(‹'“‘—]+/ , trail /[.,!?;:”"»)›'’…—]+$/
speech { locale: 'es-US', rate: 0.9 }     // Latin American neutral
ai { languageName: 'Spanish' }
articles { forms ['el','la'], rule 'NOUN_GENDER', genderOf el→m, la→f }
gender { forms { el:['el','los'], la:['la','las'] }, neverValid { el:['la'], la:['el'] },
         pluralLookalike /$^/, lookalike { skipArticle:'', onlyWrongFor:{} } }
cases null
choices { ruleSets: {
  SER_ESTAR: [['soy','estoy'],['eres','estás'],['es','está'],['somos','estamos'],['son','están'],
              ['era','estaba'],['eran','estaban'],['fue','estuvo']] ,
  POR_PARA:  [['por','para']],
  DIRECT_OBJECT_PRONOUN: [['lo','la','los','las']] } }
quiz [ {n:1,correctIndex:0},{n:2,correctIndex:0},{n:3,correctIndex:0},{n:4,correctIndex:1},{n:5,correctIndex:1} ]
uiLanguages: it,en,fr,pt,ru,uk,pl,tr,zh,ja,hi,ar     (literal list, no 'es'; no import of i18n/language)
strings { it, en, fr, pt, ru, uk, pl, tr, zh, ja, hi, ar }
```
`fue` is ambiguous (ser/ir): the bank must only tag `SER_ESTAR` on sentences where `fue` is ser (validator cannot check this; it is a content rule for 045). `vosotros` forms are deliberately absent.

**Choice drill (`lib/grammar.ts`)**
- `choiceRules(pack)` = `Object.keys(pack.choices?.ruleSets ?? {})`.
- `buildChoiceCloze(sentence, ruleCode, pack)`: split with `pack.letters`; the first token whose lower-case is a member of a set of that rule gives `{ before, after, answer: token lower-cased, set }`; null when `pack.choices` is null, the rule is unknown or no token matches. No two-way-preposition exception (curation is the bank's job).
- Options: the set's members; if more than 3, the answer plus two others chosen with the injected `rng`; shuffled with `shuffle`. Sentence-initial answers are capitalised like `buildCaseQuestion` does (`fmt`).
- `buildChoiceQuestion(entry, rng, pack)` mirrors `buildCaseQuestion`: `ruleCode = entry.grammar_angle`, `id = 'choice:' + entry.word`, hints from `example_it`/`example_en`. `grammarService.buildPools` adds it for `choiceRules(pack).includes(entry.grammar_angle)`. German: `choices` null → nothing changes.

**"Find the mistake" choice slot (`mistake.ts`)**
`ReviewCard.grammarAngle` (string | null) is filled from the bank in `reviewService.bankFor/toCard`. Slot order of consideration is gender, case, **choice**; the existing rule "one rng call to pick the kind only when both kinds are possible" extends to: collect the possible kinds in the order gender, case, choice; if more than one, one `rng()` call picks `kinds[Math.floor(rng()*kinds.length)]`, else no call. (German has at most gender+case, and `rng() < 0.5` over two kinds equals `floor(rng()*2)` — keep the German results bit-for-bit identical: a regression test with the seeded rngs of the existing mistake tests must stay green.) Choice slot: the first token in a set of `card.grammarAngle`; the wrong form is `pick` from the other members of its set; options are the cloze options (as above); `ruleCode = card.grammarAngle`; `mistakeKind: 'choice'`. If `pack.choices` is null or `grammarAngle` has no sets, there is no choice slot.

**Overlay strings for `es`** (12 UI languages; Italian first, then translate; `%{…}` placeholders as in the German overlay):
```
welcome_subtitle, review_mc_prompt_target, speech_unavailable_title, speech_unavailable_body,
quiz_q1 … quiz_q5, quiz_q1_a … quiz_q5_b,
grammar_rule_NOUN_GENDER, grammar_rule_SER_ESTAR, grammar_rule_POR_PARA, grammar_rule_DIRECT_OBJECT_PRONOUN
```
That is 4 + 15 + 4 = 23 keys. Italian texts to write (the Developer translates them into the other 11 languages, machine-drafted like TASK-025):
- `welcome_subtitle`: "Una parola di spagnolo al giorno, da imparare davvero."
- `review_mc_prompt_target`: "Come si dice in spagnolo?"
- `speech_unavailable_*`: as German's, naming a Spanish voice ("…non riesce a leggere lo spagnolo… installa una voce spagnola").
- Quiz (question text in Italian, options are the Spanish content):
  1. "Quale frase è corretta?" — A "La casa es grande." B "El casa es grande."
  2. "Quale frase è corretta?" — A "Madrid está en España." B "Madrid es en España."
  3. `Come si dice "Mi piace la musica"?` — A "Me gusta la música." B "Yo gusto la música."
  4. "Quale suona come un madrelingua?" — A "Voy a la tienda por comprar pan." B "Voy a la tienda para comprar pan."
  5. "Come si esprime una speranza?" — A "Espero que vienes mañana." B "Espero que vengas mañana."
  (Correct: A, A, A, B, B → `[0,0,0,1,1]`.)
- `grammar_rule_NOUN_GENDER`: "Il genere va imparato insieme al nome: memorizza sempre el o la con la parola (attenzione: el agua, ma agua è femminile)."
- `grammar_rule_SER_ESTAR`: "Ser indica identità e qualità permanenti (es), estar posizione e stati temporanei (está)."
- `grammar_rule_POR_PARA`: "Para indica scopo e destinazione; por indica causa, mezzo e durata."
- `grammar_rule_DIRECT_OBJECT_PRONOUN`: "Il pronome diretto concorda con il nome sostituito: lo (m.), la (f.), los (m. pl.), las (f. pl.)."
Parity rules as in TASK-043: same keys per language, placeholders equal, non-empty, not left in Italian (quiz options exempt).

**Draft language.** `language.json` for `es` is:
```json
{ "code": "es", "draft": true, "levels": ["A1","A2","B1","B2","C1","C2"],
  "ruleCodes": [ ...see below... ], "partsOfSpeech": ["noun","verb","adj","prep","conj","adv","pron"],
  "articles": ["el","la"],
  "ruleChecks": { "SER_ESTAR": { "mustContainAny": ["soy","estoy","eres","estás","es","está","somos","estamos","son","están","era","estaba","eran","estaban","fue","estuvo"] },
                  "POR_PARA": { "mustContainAny": ["por","para"] },
                  "DIRECT_OBJECT_PRONOUN": { "mustContainAny": ["lo","la","los","las"] } } }
```
Rule codes (tags; only the four drillable ones have an explanation): `NOUN_GENDER, ADJ_AGREEMENT, VERB_PRESENT_REGULAR, SER_ESTAR, NEGATION_NO` (A1); `VERB_PRESENT_IRREGULAR, REFLEXIVE_VERBS, POR_PARA, PRETERITO_PERFECTO, PRETERITO_INDEFINIDO, DIRECT_OBJECT_PRONOUN` (A2); `PRETERITO_IMPERFECTO, FUTURO_SIMPLE, CONDICIONAL, IMPERATIVO, INDIRECT_OBJECT_PRONOUN, GUSTAR_VERBS` (B1); `SUBJUNTIVO_PRESENTE, SUBJUNTIVO_IMPERFECTO, PERIFRASIS_VERBAL, PASIVA_REFLEJA, RELATIVOS` (B2); `SUBJUNTIVO_COMPUESTO, ORACIONES_CONDICIONALES, SER_ESTAR_ADJETIVOS` (C1); `CONCORDANCIA_TEMPORAL, REGISTRO_FORMAL` (C2).
Build/validate: a language folder whose `language.json` has `"draft": true` is skipped with the message `skipped draft language <code>` (exit 0), including its absence of TSVs. `set-active-language <code>` on a draft prints `<code> is a draft language` and exits 1. Validator `ruleChecks`: for an entry whose `grammar_angle` has a rule check, the example must contain (whole word, case-insensitive, accents kept) at least one of `mustContainAny`, else `…: example for <rule> has none of its forms`. Tests use a temp fixture for this (the Spanish folder has no content yet).

## Tests (write first, watch them fail)
`spanishPack.test.ts` (real `es` pack via `setActivePackForTests`):
- grading: `camion`/`camión` close; `Camión` exact; `ano`/`año` wrong; `cafe`/`café` close; `ventana`/`ventanas` close (one typo, 5+ letters); `buildCloze('¿Dónde está el niño?', 'niño')` splits `¿Dónde está el ` / `?`; `splitToken('¡Hola!')` → lead `¡`, core `Hola`, trail `!`.
- articles: `buildArticleQuestion` for `{word:'casa', article:'la'}` has options `el`/`la` and answer `la`; a `{article:'los'}` entry yields null.
- gender mistake: "El perro come la carne ahora" with card perro/el gives a gender mistake whose wrong form is `La`; badge colors masculine/feminine via `ArticleBadge`.
- choice mistake: card `estar`-type word with `grammarAngle 'SER_ESTAR'` and sentence "Mi madre está muy cansada hoy" → `mistakeKind 'choice'`, wrong form `es`, options contain `está` and `es`; the same sentence with `grammarAngle` null and no article slot → null; German sentence results unchanged.
- seeded determinism: the German `mistake.test.ts` seeded cases stay green without edits (the rng contract above).
- pack data: quiz indices, `uiLanguages` (12, no `es`), speech `es-US`, `app`, fold of `ñ`, `choices.ruleSets` keys.
`choiceDrill.test.ts`: `buildChoiceCloze` for each rule (including sentence-initial `Para`/`Está`/`Lo`, a sentence without a member → null, unknown rule → null, German pack → null); options size and membership (3 for the pronoun set, 2 for ser/estar and por/para), answer always included, rng-deterministic; `buildChoiceQuestion` shape (`id`, `ruleCode`, hints); `buildDrill` under `es` with a small mocked `WORD_BANK` containing tagged and untagged entries gives only `NOUN_GENDER` and choice questions; under `de` unchanged.
`targetStrings.test.ts`: overlay languages come from the pack (`uiLanguages`); `es` has 12 files; required keys + the four rule keys present.
`wordbankScripts.test.ts`: draft language skipped by build and validate (exit 0, message), `set-active-language` refuses it; `ruleChecks` rejects a tagged entry without a form and accepts one with.
Quiz: Spanish scoring through the existing `quizPack` pattern with the real `es` pack.
Guard checks: let `fold` also map `ñ→n` and confirm the `año` test goes red; let the mistake builder ignore `grammarAngle` and confirm the choice-mistake test goes red.

## Definition of Done
- [ ] Criteria checked; tests written first, red then green; German tests unchanged and green
- [ ] `npx tsc --noEmit`, `npm test` green from `mobile/`
- [ ] Review of the diff: no German behavior change; no Spanish word content; no unrelated files
- [ ] A native or fluent Spanish reader checks the five quiz questions and the four explanations (Product Owner or a reviewer; note the result in `CONTEXT.md`)
- [ ] Conventional commit: `feat(TASK-044): Spanish language pack`
- [ ] `CONTEXT.md`, `CLAUDE.md` updated, status `done`

## Notes for Tech Lead (remove before handing over)
- `ñ` stays distinct on purpose (`año`/`ano` must not count as a slip). Accents on vowels are folded because they are the learner's likeliest slip and keep the meaning in context.
- Choice sets rely on bank curation: ser/estar and por/para are *often* both possible, so only sentences tagged by an author for that rule may be used, and the validator only checks that a form is present. TASK-045 must therefore tag few, clear sentences per level rather than many. That limit is why the choice slot is not applied to untagged cards.
- `es-US` is the best-supported Latin American voice on Android, but a phone may have only `es-ES`. TASK-049 (QA) must test both; if a phone lacks `es-US`, extend `speech` with a fallback list in a small follow-up.
- The case drill stays German-only. If a later language (Russian, Latin) needs real cases, `cases` is the right part; `choices` is for form contrasts.
- Next: TASK-045 (Spanish word-bank pipeline, TSV format, validator rules for Spanish, content generation per level) and TASK-046 (review of the machine-drafted content, translation packs).
