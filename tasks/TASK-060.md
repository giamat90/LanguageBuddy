# TASK-060 — Spanish word bank: fix what the native-agent audit found

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-058 (done). Independent of TASK-054 (human reader), but run before it so the reader sees corrected rows.

## Context
TASK-058's native-agent review of a 40-row sample per level (about 130 findings for Spanish) found natural, grammatical Spanish sentences, but: Italian notes that are false or padding, examples that are unnatural or contain a translation error, unlabelled Latin-American vocabulary, words one or two levels off, and C1/C2 slots spent on archaic or obscure words. This task fixes **the listed items** after a second native-agent opinion. A sweep for the same error classes over the whole bank is TASK-061.

## Scope
### In
The items below, for `mobile/scripts/wordbank/es/` (and the 10 translated languages of the touched rows).
### Out
Mass retagging, adding new words beyond the 1:1 replacements (TASK-062 adds words), German, the human review (TASK-054), the audit script.

## Decision made here: which Spanish
The app speaks **neutral Spanish** (the speech locale is `es-US`). A word or sentence that is clearly regional is either replaced by the neutral one or kept **with the region named in the note** (`note_it`/`note_en`): for example `refrigerador` (Latin America) / `nevera`, `frigorífico` (Spain); `papas` / `patatas`; `celular` / `móvil`; `frijol` / `judía`/`alubia`; `aderezo` / `aliño`. The second pass decides per word; the default is the neutral or double form.

## Process (the same for every fix task of this series)
1. **Locate** each listed row in `mobile/scripts/wordbank/<lang>/<LEVEL>.tsv` (edit TSVs only, never the JSON). A listed item that cannot be found is reported, not guessed.
2. **Second opinion first (native agents, read-only).** The findings below come from ONE native-agent pass over a 40-row sample per level and some are marked `check`. Before changing anything, start fresh native agents (per language and level group; they get the rows as text, never edit files) and ask for each item: `agree` / `disagree` / `alternative`, with the final wording. **Apply only items both passes agree on**; `disagree` items stay and are listed in the hand-off. Items marked *(check)* need an explicit `agree`.
3. **Apply.** Visible text (word, article, meaning, example, notes, translations) is what matters. Tags: `grammar_angle` describes the *example sentence*, and at runtime only the drilled codes matter (German case rules, Spanish choice rules `SER_ESTAR`, `POR_PARA`, `DIRECT_OBJECT_PRONOUN`); other tags are invisible metadata. **Change a tag only if the sentence or the word changed, or the tag is a drilled one that does not fit its sentence** (the validator already checks the forms). Do not mass-retag filler tags (WORD_ORDER_V2, VERB_PRESENT_REGULAR, ACCUSATIVE_MASC on non-masculine nouns): that is out of scope.
4. **Keep the other languages in step.** A changed meaning, example or note means the row's translations in `scripts/wordbank/<lang>/i18n/<UI>/<LEVEL>.tsv` (all UI languages of the app) are re-written from the corrected English/Italian text, and a moved word moves its i18n rows with it. Machine translation is fine and stays marked unreviewed.
5. **Removing or replacing a word:** replace it 1:1 **in the same level and topic** with a word suggested in this spec (or another common word the native agents agree on), so level sizes and topic balance do not change; the replacement needs every column and all translations. A word that is only *moved* changes the level counts: update the pins that fail (`test-support/appExpectations.ts`, bank-count tests) and say so in the hand-off. Check the validator rules of `language.json` (`uniqueAcrossLevels`, per-level `maxTokens`/`allowedCodes`, caps on choice-rule sentences).
6. **Saved words keep working.** `vocabulary_items` stores a copy of the word keyed by the word; review, practice and word detail look the bank up by word. A learner may have saved a word that is now removed, renamed or moved: add or confirm tests that such a card still reviews and practises (flip-card fallback, no crash) and that the word detail shows the stored copy.
7. Bump `WORDBANK_VERSION`, run `npm run build:wordbank`, then `npx tsc --noEmit`, `npm test`, `npm run test:app -- es`, and `npm run audit:wordbank -- <lang>` (levels still monotone, no new flags caused by the change). Seams stay German.
8. **Final native-agent check on the changed rows** (a new set of agents; they see only the final rows). Their remaining objections go into the hand-off; the human reader of TASK-054 still has the last word for Spanish.
9. Update `CONTEXT.md` (done, counts, what changed in numbers, objections left) and commit `fix(TASK-0xx): …`. The German fixes reach users with the next German release; this task does not release anything.

## Items

**A. Remove or replace (1:1, same level and topic)**
- C2 archaic or historical (from the "not found" list too): `alcabala`, `tullido` (also offensive), `usucapir` (legal, defective verb), `paladeo` (keep the verb `paladear`), `asaz`, `yantar`, `bajel`, `vianda`, `pitanza`, `yacija`, `amanuense`, `cauterio`.
- C2 very obscure or regional: `payada`, `estraperlo`, `canonjía`, `prebenda`, `quincalla`, `enladrillar`, `medianería`, `condumio`, `peculio`; the maritime cluster (`rada`, `varadero`, `escollera`, `bajel`) is too niche: keep at most one.
- Replace with current advanced words, e.g. `diligente`, `desdeñar`, `quimera`, `acarrear`, `denodado`, `arraigado`, `abordar`, `afrontar`, `desempeñar`, `sobrellevar`, `empeño`, `trasfondo`, `vaivén`, `desafío`, `sin ambages`, `a regañadientes`, `poner en tela de juicio`, `dar pie a`, `hacer hincapié`, `pese a`, `a raíz de`, `de cara a`, `ahora bien`, `a no ser que`, `por mucho que`, `sea como fuere` (each must be new to the bank; multi-word entries are fine, `a tenor de` already is one).
- B1: `mole` (Mexican dish, not core): replace or move to C1 *(check)*.

**B. False, empty or misplaced notes (rewrite so the note teaches the headword; `note_it` and `note_en`)**
`sal` (drop the `el sal` claim; `sal` is feminine, imperative of `salir`), `playa` (spiaggia; `la mar` claim is wrong), `llave` (chiave; tap is `grifo`/`llave`), `aeropuerto` (drop the AIFA digression), `trabajo` (lavoro, not the workplace), `mercado`, `nuevo` (`un coche nuevo`/`un nuevo coche` is B1), `sano` (not `cuerdo`; `saludable` is for food), `recibir` (garbled), `visitar` (`visitar a alguien` / `visitar un lugar`), `sensible` (**true friend**: sensibile; the note calls it a false friend), `caldo` (the adjective is `caliente`; `caldo` is broth), `albergue` (ostello/rifugio, not `albergo`=`hotel`), `sucursal` (drop the doubtful etymology), `cimentar` (**false friend**: `fundar, consolidar`, not `mettere alla prova`), `hogaza` (big round rustic loaf; level B2/C1), `vereda` (marciapiede in the Southern Cone and Peru; rural subdivision in Colombia), `negocio` *(check)*, `pared`/`muro` *(check)*, `consejo`, `madre`/`mujer` *(check)*.

**C. Examples that are unnatural, wrong or mistranslated**
`sentir` (`Lo siento mucho.` / `Siento frío.`), `peinarse` (`delante del espejo` / `Me peino antes de salir.`), `oreja` (`Me duele el oído.`), `cargo` (`Mi puesto es…`, or move to B1), `nacer` (`El bebé va a nacer en mayo.` / `Mi hija nació en mayo.`), `atesorar` (`Dedicó años a atesorar monedas antiguas.`), `desviar` (`Tuvieron que desviarse por una carretera de montaña.`), `varar` (`El buque varó en un banco de arena durante la noche.`), `postrar` (`La fiebre lo postró en cama durante semanas.`), `haber` (use the plural `los haberes del difunto`, or drop the entry), `itinerario` (**Italian translation error**: `Voglio che tu riveda…`), `ahorro` (`Mis ahorros son para el viaje de verano.`), `saldo` (`móvil`, and the note: phone credit exists in Spain too), `anticipar` (`adelantar mi viaje`), `rodear` (`Un jardín rodea la casa.`), `mochilero` (`Los mochileros duermen en albergues baratos.`), `liza`, `fugaz` (`Gozó de una fama fugaz.`), `detallista` (both meanings: meticuloso and minorista), `cuarentena` *(check)*, `avergonzado` *(check)*, `limpio` *(check)*.

**D. Tags that drive a drill and do not fit their sentence (the only tag changes in scope)**
`archivo` (sentence is present: retag, or write `Te enviaré el archivo mañana.`), `anoche` (`PRETERITO_INDEFINIDO`), `amortizar` (`FUTURO_SIMPLE`), `envolver` (a polite question is not `IMPERATIVO`: write `Envuelva el regalo, por favor.`), `preocupado` (`SER_ESTAR`, not `POR_PARA`), `ocupado`, `triste` (the sentence uses `está`: `SER_ESTAR`), `hola` (part of speech `interj`, not `adv`, and not a present-tense verb tag), `porque` (conjunction: not a verb tag), `cuenta`, `casa`, `probador`, `contar`, `disponer`, `sembrar` (stem-changing or irregular verbs are not `VERB_PRESENT_REGULAR`; use `VERB_PRESENT_IRREGULAR`).

**E. Level moves**
- Earlier: `seguridad`, `abogado` (B2 → A2/B1; keep the subjunctive sentence of `abogado` only if it stays at B2 or retag), `cumpleaños` (A2 → A1), `albergue`, `puerto`, `carretera` (B2 → B1), `ruta` (C1 → B1), `sembrar`, `disponer`, `desviar`, `cuarentena`, `estancia`, `asombroso`, `competencia` (C1 → B2), `cabalgar` (C2 → B2), `sublime`, `cónyuge`, `copioso`, `cautivador`, `rancio` (C2 → C1/B2, with an advanced sense for `rancio`) *(check each)*.
- Later: `maridaje` (B2 → C1), `mandón` (B2 → C1) *(check)*, `imprescindible` (B1 → B2), `elegir`, `recibir`, `sano` (A1 → A2), `probador` (A2 → B1).

**Left as they are (artefacts, confirmed by the agents):** reflexive and `-ar` lemmas flagged as rare (`ducharse`, `aburrirse`, `acordarse`, `llamarse`, `costar`, `despertarse`, `merendar`, `enfadarse`, `interesar`, `regañar`, `alojarse`), multi-word entries not found in the list, and `asequible` (B1/B2, written register).

## Acceptance Criteria
- [ ] Every item is either applied (with a second-pass `agree`) or listed in the hand-off as `disagree`/not found with the reason.
- [ ] No C1/C2 row is archaic, obscure or offensive without the second pass having kept it deliberately; regional words are neutral or labelled with their region.
- [ ] The `spanishBank` validator rules still hold (caps on `SER_ESTAR`/`POR_PARA`/`DIRECT_OBJECT_PRONOUN` sentences, tags allowed per level, no word in two levels, `exampleRules`); level counts changed only through the listed moves; pins updated; `npm run audit:wordbank -- es` before/after pasted.
- [ ] Every touched row has fresh translations in the 10 translated languages (and the Italian/English columns in the TSV), and the `i18n` rows moved with a moved word.
- [ ] Test: a saved word that is no longer in the bank still reviews and practises (see Process 6).
- [ ] `build:wordbank`, validator, `tsc`, `npm test`, `npm run test:app -- es` green; `WORDBANK_VERSION` bumped; seams German.
- [ ] Final native-agent check done, objections listed.

## Definition of Done
- [ ] Criteria checked; hand-off with counts per section (applied / disagreed / not found), before/after audit numbers, remaining objections
- [ ] `CONTEXT.md` updated; commit `fix(TASK-060): correct the Spanish word bank findings of the TASK-058 audit`; status `done`

## Notes for Tech Lead (remove before handing over)
- Spanish is not on Play yet, so there are no saved words to protect in production; the saved-word test is still required because the German task shares the mechanism.
- The regional-variant decision is the one real product choice; the default (neutral or double form, region named in the note) keeps the app useful for both Spain and Latin America.
- Rejected: dropping the 40-row samples' findings into a regex pass; every change is a language judgment and needs the second opinion.
