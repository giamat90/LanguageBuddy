# TASK-062 — Fill the word-bank gaps the native agents named

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-059, TASK-060 (so the fixed rows and the 1:1 replacements are in place first)

## Context
The TASK-058 native agents agreed on gaps in **both** banks: everyday connectors and abstract words, argument verbs, advanced connectors and verbs at C1, and in German a real gap at B2 in food, home, shopping and leisure (0 / 10 / 4 / 11 words). The German agent judged the C1/C2 topic imbalance natural (advanced vocabulary is abstract), so this task does **not** try to equalise topics at C1/C2. This task **adds** words; replacements for removed rows are in TASK-059/060.

## Scope
### In
New rows (full columns, all translations) in both languages as listed. The candidates are suggestions from the agents and from the audit's section 4; each must first be checked against the bank (`word` and its inflected/accent variants) and skipped if already there.
### Out
Mass retagging, level moves, the C1/C2 topic balance, any UI change.

## Candidate words
**German**
- A2/B1 particles and connectors (check which exist): `eigentlich`, `überhaupt`, `wahrscheinlich`, `ziemlich`, `sogar`, `bestimmt`, `deshalb`/`deswegen`, `leider`, `bereits`, `kaum`, `sondern`, `endlich`, `bitte`, `danke`, `vielleicht`, `manchmal`, `gern`, `sofort`, `bald`, `warum`, plus core verbs if missing: `tun`, `sagen`, `machen`, `lassen`, `bleiben`, `bekommen`, `vergessen`, `versuchen`, `brauchen`, `bedeuten`.
- B2 everyday topics, about 15 each: **food** (`Zutat`, `Rezept`, `vertragen`, …), **home** (`Kaution`, `Hausverwaltung`, `Vermieter`, …; `Nebenkosten` exists), **shopping** (`Garantie`, `Umtausch`, `Rückgabe`, `Rabatt`, `Preisvergleich`, `Lieferung`, `Reklamation`, `Retoure`, `Angebot`, `Bestellung stornieren`, …), **leisure** (`Ehrenamt`, `Verein`, `Hobby ausüben`, …). Prefer ordinary words over jargon (the agents found `Markenidentität`/`Digitalstrategie` too narrow).
- C1 formal connectors and verbs: `nichtsdestotrotz`, `gleichwohl`, `indes`, `mitnichten`, `ohnehin`, `zumal`, `demzufolge`, `hinsichtlich`, `diesbezüglich`, `ungeachtet`, `sofern`/`insofern`, `beanstanden`, `anprangern`, `einräumen`, `bekräftigen`, `monieren`, `ahnden`, `gewährleisten`, `verankern`, `in Kauf nehmen`, `ins Gewicht fallen`, `zum Tragen kommen`, `in Betracht ziehen`, `Rechnung tragen` (use the ones not already placed by TASK-059).
- Check that the basics the A1/A2 agent suspected missing exist: `Entschuldigung`, `Mädchen`, `Kinder`, `Eltern`, `Frau`, `Mann`, `Tochter`, `Sohn`, `Hilfe`.

**Spanish**
- A1/A2 basics to check first (the A1–A2 agent could not tell what is missing): `coche`, `escuela`, `comida`, `hermana`, `hija`, `niño/niña`, `amigo/amiga`, the numbers up to ten, `cosa`, `vez`, `hoy`/`mañana`/`ayer`, `también`, `mucho`/`poco`, `bueno`/`malo`, `grande`/`pequeño`, `gracias`, `perdón`; add what is missing.
- B1/B2 connectors and abstract words: `aunque`, `sino`, `incluso`, `además`, `bastante`, `demasiado`, `quizá(s)`, `mientras`, `ni siquiera`, `por supuesto`, `acerca de`, `culpa`, `suerte`, `razón`, `oportunidad`, `situación`, `información`, `error`, `ayuda`, `resto`, `fuerza`, `falta`, `argumentar`, `defender`, `criticar`, `discutir`, `convencer`.
- C1 locutions and verbs (those not already used as replacements in TASK-060): `pese a`, `a raíz de`, `de cara a`, `cabe destacar`, `ahora bien`, `a no ser que`, `por mucho que`, `sea como fuere`, `abordar`, `afrontar`, `desempeñar`, `sobrellevar`, `desdeñar`, `acarrear`.
- C2 idioms (unused ones): `sin ambages`, `a regañadientes`, `a bote pronto`, `poner en tela de juicio`, `dar pie a`, `no dar abasto`, `salirse con la suya`, `hacer hincapié`, `de buenas a primeras`, `tomar cartas en el asunto`.

## Process
As TASK-059 Process, with these differences: step 1 is "check what exists" (a script or a one-off command that lists candidates already in the bank; the result goes into the hand-off); step 2 is **a native agent reviews the drafted rows before they are added** (word, level, example, notes, tag allowed at the level, regional neutrality); step 4: new rows need all 14 TSV columns and every UI-language row; choice-rule caps (`SER_ESTAR`, `POR_PARA`, `DIRECT_OBJECT_PRONOUN`) and `uniqueAcrossLevels` apply; a new word goes to the level the agents agree on; level sizes change, so update the pins and report them; keep the Spanish topic mix even (each new Spanish word tags a topic that is not above 20% of its level).

## Acceptance Criteria
- [ ] The hand-off lists, per candidate, `added at <level>` / `already in the bank` / `rejected (reason)`.
- [ ] German B2 has at least 10 words in each of food, home, shopping and leisure afterwards (`npm run audit:wordbank -- de` section 5 before/after).
- [ ] Every new row passes the validator and has translations in all UI languages; example sentences follow `exampleRules`.
- [ ] The native agents' review of the drafted rows is in the hand-off; no row was added against an agent's `reject`.
- [ ] `build:wordbank`, `tsc`, `npm test`, `npm run test:app -- es` green; pins updated; `WORDBANK_VERSION` bumped; seams German.

## Definition of Done
- [ ] Criteria checked; `CONTEXT.md` updated (new counts per level and language); commit `feat(TASK-062): fill the word-bank gaps named by the native agents`; status `done`

## Notes for Tech Lead (remove before handing over)
- Why not topic-balance C1/C2: the German agent argued, convincingly, that connectors and verbs serve an advanced learner better than a forced `food` word at C1.
- New rows are machine-drafted like the rest: they join the TASK-054 review for Spanish.
- Growth: about 100 German and 80 Spanish rows; the apps stay offline and small (the bank is about 2 MB per language with translations).
