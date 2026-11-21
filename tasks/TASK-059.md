# TASK-059 — German word bank: fix what the native-agent audit found

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead
**Depends on:** TASK-058 (done)

## Context
TASK-058's native-agent review of a 40-row sample per level (about 130 findings for German) showed that the German words are mostly good, but a number of rows contain visible errors: invented, vulgar or non-word entries at C2, a wrong article, entries that are phrases or wrong forms, Italian notes that are false or explain another word, stilted examples, and words one or two levels too low or too high. This task fixes **the listed items** (and only after a second native-agent opinion, see Process). A sweep of the whole bank for the same error classes is TASK-061.

## Scope
### In
The items below, for `mobile/scripts/wordbank/de/`. Counts of words per level may change only through the *moves* listed.
### Out
Mass retagging, adding new words beyond the 1:1 replacements (TASK-062 adds words), any change to Spanish, releasing the German app, the audit script.

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

**A. Remove or replace (1:1, same level and topic; the Spanish-style "not found" list of the audit helps to find the rows)**
- C2: `Verklärungsmomentum` (not a word), `Futterneidgefühl` (invented; `Futterneid` already exists), `Kollegenschwein` (vulgar), `Weltschmerzgeneration` (invented), `Bußfertigkeit` (religious, old: replace with `Reue`/`Einsicht`/`Läuterung`), `Sollbruchpunkt` (real word is `Sollbruchstelle`), `Zäsurmoment`, `Neusprachlichkeit`, `Verabredungsstress`, `Sprachgeklingel`, `Weltschmerzlich`.
- C2, vulgar or regional in the "not found" list (replace unless the second pass says keep): `Klugscheißerei`, `Korinthenkacker`, `Warmduscher`, `Backpfeifengesicht`, `Sitzriese`, `Sturschädel`, `Fingerhakeln`.
- Near-duplicate clusters in C2: keep **one** each of the `Futterneid…` family (3), the `Weltschmerz…` family (4), the `Sprachgewalt/Sprachmächtigkeit/Wortgewaltigkeit/Redegewandtheit/Wortgewandtheit/Beredsamkeit/Eloquenz` family (7) and `Politikverdrossenheit/Politikverdruss`; replace the others with different, common advanced words (suggestions from the agents: `nichtsdestotrotz`, `gleichwohl`, `indes`, `mitnichten`, `ohnehin`, `zumal`, `demzufolge`, `hinsichtlich`, `ungeachtet`, `beanstanden`, `anprangern`, `einräumen`, `bekräftigen`, `gewährleisten`, `verankern`).
- B2: `Outplacement` (niche; replace with a common everyday word), `Abfindungsverhandlung` → teach `Abfindung`, `Expansion planen` → `Expansion`/`expandieren`, `Multitasking vermeiden` → `vermeiden` *(check)*.
- B1: `Gewohnheit ändern` (duplicates the noun `Gewohnheit`; use `sich gewöhnen an`), `Sehenswürdigkeiten besichtigen` (duplicates the noun; teach `besichtigen`, note the contrast with `besuchen`).
- A1/A2 entries that are not words: `anrufen bitte` → `anrufen`; `Woche geht schnell` → a real word (`Woche` or `schnell`, whichever is not yet in the bank); `verlaufen sich` → `sich verlaufen` (A2); `Karte spielen` → `Karten spielen`; `empfehlen sich` → `empfehlen`; `sparen mit Strom` → `Strom sparen`.
- A1 phrase entries (`Zimmer aufräumen`, `Tisch decken`, `Uhr tragen`, `Geschenk machen`, `einladen zur Feier`): *(check)* keep only where the verb alone would mislead (`Tisch decken` yes); otherwise use the lemma (`aufräumen`, `tragen`, `schenken`, `einladen`).

**B. Wrong article, lemma, spelling**
- `Kuddelmuddel`: article `das` (Duden), fix the note (rhyming reduplication of `Muddel`, not onomatopoeia); the word is B2/C1, move to C1.
- `heiße` (C1): the entry should be `es heißt` (indicative); the Konjunktiv I in the sentence is `sei`; fix word and note.
- `berufliche Torschlussangst` → `Torschlusspanik`, new example about career or age.
- `Möbliert` → `möbliert`. `Bio-Lebensmittel`: plural, no article; fix the note (the EU organic regulation, the German `Bio-Siegel` is a separate national label).
- `Epochenschwelle`: the example must contain the word (`Wir stehen an einer Epochenschwelle.`).
- `Passwort`: note says it is a calque of English `password`, not an English loan in `Pass`.

**C. False, empty or misplaced notes (rewrite so the note teaches the headword; fix `note_it` and `note_en`)**
`gelangweilt` (participle used as adjective; `langweilig` vs `gelangweilt`), `Angst` (`Angst haben vor + Dativ`; plural `Ängste` is rare), `versprechen` (person in the dative, thing in the accusative; drop the false `ver-` claim), `hundert` (drop the misleading note), `Tür` (drop the fire-door claim), `Salz` (short, not an idiom digression), `schüchtern` *(check: drop the unfounded claim)*, `würzen` (`Gewürz` derives from `würzen`), `überholen` (inseparable in the sense "overtake"; the claim about `über-` is wrong), `Anmeldung` (the example and note must agree: two weeks), `Urteilsvermögen` (Kant's term is `Urteilskraft`: remove the claim), `Scharade` (figurative sense is `farsa`, not Italian `sciarada`), `Heimlichkeit` *(check; Freud's essay is about `heimlich/unheimlich`)*, `im Zuge` *(check: `Zug` here is course, not train)*, `Beeinträchtigung` (soften), `Existenzialismus` (mention the second spelling), `Gestaltungsspielraum` *(check)*, and the rows whose note explains **another word** instead of the headword: `Machtmissbrauch`, `Permafrost`, `Lebensfreude`, `Stadion`, `Ausland`, `Demenz`, `Nanotechnologie`, `Polemik`, `Entfremdung`, `Filterblase`, `Briefkasten`.

**D. Examples that are stilted, wrong or do not use the headword**
`Arm` (`Mein Arm tut weh.`), `Solarenergie` (`… haben eine Solaranlage auf dem Dach.`), `Feuchtigkeit` (use the headword, not `Luftfeuchtigkeit`), `Zeitverschiebung` (`… nach New York beträgt sechs Stunden.`), `Bescheidenheit`, `Gemütlichkeit`, `Vollzug` *(check: `Vollstreckung`/`Strafvollzug`)*, `Herzschmerz` (`Liebeskummer` is the common word), `Untergangsprophet` (Italian `spöttisch` is `con tono di scherno`).

**E. Level moves (the word moves with its i18n rows; update count pins)**
- To B1: `würde`, `hätte`, `trotzdem` (from B2); `Kompass`, `Spiegelbild`, `Diagnose` (from A1/A2); `Klima`, `Fließband` *(check)*, `Solarenergie`, `Feuchtigkeit`.
- To A2: `Termin vereinbaren` (from A1), `Briefkasten` *(check, from B1)*, `Regenbogen` (from A1).
- To B2: `Frist` (from A2), `gelassen` (from A2, with a simpler example), `Achtsamkeit`, `Anpassungsfähigkeit`, `Willenskraft`, `Durchhaltevermögen`, `Zugehörigkeit`, `Wendepunkt`, `Absicherung`, `Klausel`, `seelisch` (from B1), `allerdings`, `Gnade` (from C1/C2), `Bescheidenheit` (from B1).
- To B2/C1 (decide with the second pass): `Kuriosität`, `hypothetisch`, `Achillesferse`, `Selbstgerechtigkeit`.
- Check against the Goethe lists by the agents *(check)*: `Konsequenz`, `Auswirkung`, `Voraussetzung`, `Gleichberechtigung`, `Integration`, `Inflation`, `Ladesäule`, `Boarding`, `Landkarte`, `Ehe`, `Arbeitgeber`.

**Left as they are (artefacts of the subtitle list, confirmed by the agents):** compounds such as `Großvater`, `Fahrplan`, `Reiseführer`, `Backofen`, `Stundenplan`, `Krankenkasse`, `Nebenkosten`, and the culture words `Lebkuchen`, `Glühwein`, `Karneval`, `Trachten`.

## Acceptance Criteria
- [ ] Every item is either applied (with a second-pass `agree`), or listed in the hand-off as `disagree`/not found with the reason.
- [ ] No row keeps an invented, vulgar or non-word entry; no row has an entry written as a phrase unless the second pass agreed.
- [ ] Level sizes only changed through the listed moves; pins updated; topic balance not worse (`npm run audit:wordbank -- de` section 5 pasted before/after).
- [ ] Every touched row has fresh translations in all UI languages; a moved or replaced row exists in the i18n TSVs of its new level.
- [ ] Test: a vault word that is no longer in the bank still reviews and practises (flip-card), and its word detail renders from the stored copy.
- [ ] `build:wordbank`, validator, `tsc`, `npm test`, `npm run test:app -- es` green; `WORDBANK_VERSION` bumped; seams German.
- [ ] Final native-agent check done, objections listed.

## Definition of Done
- [ ] Criteria checked; hand-off with: counts of items applied/disagreed/not found per section, the before/after audit numbers, the final agents' remaining objections
- [ ] `CONTEXT.md` updated; commit `fix(TASK-059): correct the German word bank findings of the TASK-058 audit`; status `done`

## Notes for Tech Lead (remove before handing over)
- The German app is on Play: these fixes ship with the next German release (versionCode > 20), together with the permission change (TASK-050) that already needs a phone check.
- Rejected: mass retagging (invisible to the learner, no runtime effect outside the drilled codes); fixing by regex (every change is a language judgment).
- Risk: moving a word between levels changes which words the daily word can draw next; already-used words are matched by word, so nothing repeats.
