# TASK-027 — Learning statistics and editable daily-word topics

**Status:** `done`
**Assigned to:** Developer (Sonnet) — Product Owner asked for the whole cycle in one session
**Written by:** Tech Lead
**Depends on:** none

---

## Context

The learner has no view of their progress, and the topics picked at onboarding (`learner_profile.topic_preferences`) are
**stored but never used**: `pickNextWord` ignores them, and there is no way to change them later. This task adds
(1) a statistics screen and (2) topic selection that actually drives the daily word and can be edited in Settings.

---

## Scope

### In scope
- Pure stats engine: per-tier, per-topic and per-CEFR-level counts of saved words against the size of the word bank.
- `/(app)/stats` screen, opened from the Vault actions row.
- `pickNextWord` accepts the active topics and prefers them; falls back to the level's other topics rather than failing.
- Settings section "Topics of the daily word": toggle chips, immediate save, at least 1 topic, per-topic word counts at the learner's level.
- Onboarding keeps working (its `TOPICS` list moves to a shared module).
- Strings in all 13 languages; tests; CONTEXT.md.

### Out of scope
- Charts over time / history, per-day activity (no data is stored for it).
- Changing the CEFR level after onboarding.
- Replacing a word that has already been chosen today (the change applies from the next new word).
- Filtering review/practice by topic.
- Schema changes (none needed).

---

## Acceptance Criteria

- [ ] AC1: Stats show saved words, and how many are New / Learning / Mastered (same `tierOf` rules as the exercise engine), the review count and accuracy, and the streak.
- [ ] AC2: Stats show, per topic and per CEFR level, saved words (split by tier) against the number of bank words in that group. Saved words not found in the bank are counted in totals but in no group.
- [ ] AC3: Stats screen has a friendly empty state with no saved words and a generic error state (no `e.message`).
- [ ] AC4: Topics with `topic_preferences[key] >= 0.5` are active. Empty/invalid preferences mean **all** topics are active (old or restored profiles never get stuck).
- [ ] AC5: The daily word comes from an active topic when one has an unused word at the level; otherwise from any topic at the level (never an empty card); only when the whole level is used does it recycle (recycling prefers active topics).
- [ ] AC6: Settings lets the learner toggle topics; the last active topic cannot be switched off; the change is persisted at once and is included in backups (already: it lives in `learner_profile`).
- [ ] AC7: Each topic chip shows how many words exist for it at the learner's level; a topic with 0 words is labelled so and a note explains that other topics are used when the chosen ones run out.
- [ ] AC8: `npx tsc --noEmit` clean; `npm test` green (incl. `uiStringsParity`).

---

## Technical Spec

### Files to create
```
src/lib/topics.ts                  — TOPICS (key, emoji, labelKey), isActiveTopic, activeTopicKeys, buildTopicPreferences, topicCountsForLevel
src/lib/stats.ts                   — pure computeStats(rows, reviews, bank)
src/services/statsService.ts       — fetchStats(): reads vocabulary_items + review_log + profile, calls computeStats
src/screens/StatsScreen.tsx        — the screen
app/(app)/stats.tsx                — route
src/components/ui/TopicPreferences.tsx — Settings section (chips + counts + persist)
```
### Files to modify
```
src/data/dailyWord.ts              — pickNextWord(level, installId, used, activeTopics?) -> { entry, id, exhausted, outsideTopics }
src/services/wordService.ts        — pass active topics from the profile
src/services/profileService.ts     — setTopicPreferences(prefs)
src/screens/TopicsScreen.tsx       — import TOPICS/buildTopicPreferences from lib/topics (keep the re-export of buildTopicPreferences)
src/screens/SettingsScreen.tsx     — render <TopicPreferences />
src/screens/VaultScreen.tsx        — "Statistics" action
app/(app)/_layout.tsx              — register the route
src/i18n/*.ts                      — new keys (13 files)
```

### Rules
- `isActiveTopic(prefs, key)`: if no key in `prefs` is a finite number >= 0.5 → true for every topic (fallback); else `prefs[key] >= 0.5`.
- Stats group by `topic_domain` / `cefr_band` of the first bank entry whose lowercased word matches (bank lookup built once per call; 4 words occur in two levels — first, i.e. lowest level, wins, deterministically).
- `computeStats` is pure; the service does the I/O. Mastered = `tierOf` strong, New = tier new, else Learning.
- Accuracy = correct / total reviews from `review_log` (null when there are none).
- Settings write goes through `setTopicPreferences`, which stores 0.8 / 0.3 (existing convention) and never writes an all-inactive map.
- Errors: `console.error` + generic i18n string. Strings in all languages; all touchables have `accessibilityRole`/`accessibilityLabel`.

## Tests (written first)
- `topics.test.ts`: isActiveTopic fallback cases (empty, garbage, all <0.5), build/roundtrip, `topicCountsForLevel` equals bank counts.
- `dailyWord.test.ts` (extend): picks only active topics while available; falls back with `outsideTopics`; recycle prefers active; no `activeTopics` = old behaviour; property test over every level × single topic never returns undefined.
- `stats.test.ts`: tiers, groups, unknown word, empty vault, accuracy null, totals add up.
- `statsService.test.ts`: real in-memory DB end to end.
- `wordFlow`-style: `fetchTodayWord` honours the saved preferences; `setTopicPreferences` persists and refuses all-off.
- `StatsScreen.test.tsx`, `TopicPreferences.test.tsx`: render, toggle, last-topic guard, error state.
- `uiStringsParity` stays green.

## Notes
- Behaviour change for existing installs: from the next new word the topics chosen at onboarding start to count. Intended; record in CONTEXT.md.
- C1/C2 have almost no food/shopping/home words: hence the fallback (AC5) and the counts (AC7).
