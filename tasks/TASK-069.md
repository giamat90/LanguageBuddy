# TASK-069 — No back arrow on the vault after onboarding

**Status:** `done` (phone check pending)
**Assigned to:** Developer
**Written by:** Tech Lead
**Depends on:** none

## Context
Phone report (FrenchBuddy 1.0.2): the vault title "Il mio vocabolario" broke as "Il mio voc / abolario". Right after onboarding the welcome and
quiz screens stay in the history (`replace` only replaced the topics screen), so the vault shows a back arrow that takes the title's room, and
"back" reopens the quiz. Shared code: every app does this on its first session.

## Scope
- In: `TopicsScreen` dismisses the stack before replacing it with the vault.
- Out: title font or layout changes, a new bundle.

## Acceptance Criteria
- [x] `__tests__/onboardingNavigation.test.tsx` (real expo-router) fails first, then passes: nothing to go back to from the vault
- [x] `tsc --noEmit`, `npm test`, `npm run test:app -- fr` pass
- [ ] Phone: after a fresh install and onboarding, the vault has no arrow and the title wraps between words
