# TASK-014 — Profile Onboarding Routes + SRS Service

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-013 (Expo Router migration merged ✓)

---

## Context

Two backend routes are live but return `501 Not Implemented`: `POST /profile/onboarding`
and `GET /profile`. The mobile onboarding screen calls `POST /profile/onboarding` to write
the user's CEFR level and topic preferences — without a real implementation the onboarding
flow cannot complete and new users are stuck. `GET /profile` is the learner snapshot that
`prompt_builder.py` already queries internally; exposing it as a route gives the mobile app
access to progress data (weak rules, vocab due for review). Alongside these routes, `srs.py`
must be implemented and wired into session end so vocabulary retention scores update after
every chat session.

---

## Scope

### In scope
- `POST /profile/onboarding`: update learner profile with CEFR level + topic preferences,
  seed grammar weakness rows for all CEFR bands up to and including the user's level
- `GET /profile`: return full learner snapshot — profile fields + weak grammar rules +
  vocabulary due for review
- `backend/app/services/srs.py`: `next_review_date()` and `update_retention_score()`
  verbatim from CLAUDE.md §7
- Wire SRS into `session_service.py`: call `update_retention_score()` + `next_review_date()`
  for every `VocabularyEncounter` when `end_session()` is called
- New Pydantic schemas for the two endpoints

### Out of scope
- CEFR promotion logic (`should_promote()`) — future task
- Persona settings update (user cannot change Lena's settings in v1.0)
- `GET /profile` powering the mobile progress chart screen — that screen is out of v1.0 scope;
  this route exists to serve the prompt builder and mobile onboarding completion check
- Any changes to `mastery.py` — grammar weakness mastery updates are already wired elsewhere

---

## Acceptance Criteria

- [ ] AC1: `POST /profile/onboarding` with a valid JWT, CEFR level `"B1"`, and topic preferences
  returns 200 with the profile; the DB has `learner_profiles.cefr_level = "B1"` and
  `grammar_weaknesses` rows seeded for A1, A2, and B1 bands (12 rows total)
- [ ] AC2: Calling `POST /profile/onboarding` a second time with the same user is idempotent —
  no duplicate weakness rows, existing mastery scores are preserved
- [ ] AC3: `GET /profile` returns `cefr_level`, `topic_preferences`, `persona_settings`,
  `weak_rules` (only those with `mastery_score < 0.6`), and `vocabulary_due` (only items
  with `next_review_at < now()`)
- [ ] AC4: After `POST /session/end`, every `VocabularyEncounter` for that session has its
  linked `VocabularyItem.retention_score` and `next_review_at` updated
- [ ] AC5: `npx pytest backend/tests/` passes with the new tests listed in the Tests section
- [ ] AC6: `POST /profile/onboarding` and `GET /profile` no longer return 501

---

## Technical Spec

### Files to create
```
backend/app/services/srs.py                     — next_review_date() + update_retention_score()
backend/tests/test_profile.py                   — tests for both profile routes
backend/tests/test_srs.py                       — unit tests for srs.py functions
```

### Files to modify
```
backend/app/routers/profile.py                  — replace 501 stubs with real implementations
backend/app/models/schemas.py                   — add OnboardingRequest, ProfileResponse, WeakRuleOut, VocabDueOut
backend/app/services/session_service.py         — call SRS update in end_session()
```

---

### Implementation notes

**1 — Grammar rule seed table**

Define this constant at the top of `profile.py` (not in a separate file — it is used only
here). The order of bands in `CEFR_ORDER` determines which rules are seeded cumulatively.

```python
CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]

GRAMMAR_RULES: dict[str, list[tuple[str, str]]] = {
    "A1": [
        ("VERB_CONJ_REGULAR",   "Regular verb conjugation"),
        ("NOUN_GENDER",         "Noun gender (der/die/das)"),
        ("WORD_ORDER_V2",       "Verb-second word order"),
        ("NEGATION_NICHT_KEIN", "Negation with nicht/kein"),
    ],
    "A2": [
        ("VERB_CONJ_IRREGULAR", "Irregular verb conjugation"),
        ("ACCUSATIVE_MASC",     "Accusative case (masculine)"),
        ("ACCUSATIVE_PREP",     "Accusative prepositions"),
        ("SEPARABLE_VERB",      "Separable verbs"),
    ],
    "B1": [
        ("DATIV_PREP",          "Dative preposition case"),
        ("DATIV_INDIRECT_OBJ",  "Dative indirect object"),
        ("MODAL_VERB",          "Modal verbs"),
        ("PERF_SEIN_HABEN",     "Perfekt with sein/haben"),
        ("SUBORD_VERB_FINAL",   "Subordinate clause verb-final"),
    ],
    "B2": [
        ("KONJUNKTIV_II",       "Konjunktiv II (subjunctive)"),
        ("GENITIV_CASE",        "Genitive case"),
        ("PASSIVE_VOICE",       "Passive voice"),
    ],
    "C1": [
        ("KONJUNKTIV_I",        "Konjunktiv I (reported speech)"),
        ("EXTENDED_ATTR",       "Extended attribute constructions"),
    ],
}
```

Bands to seed for a given level = all bands from `CEFR_ORDER` up to and including the
user's level. A B1 user gets A1 + A2 + B1 rules seeded (12 rows). Rationale: higher-level
learners are still tested on foundational rules; seeding them all at `mastery_score = 0.5`
is correct — errors will lower the score, practice will raise it.

---

**2 — POST /profile/onboarding**

Use `get_current_user` (not `get_current_user_id`) — this dependency already creates the
`users` row and a blank `LearnerProfile` if the user is new. The route only needs to update
the existing profile and seed weaknesses.

```python
@router.post("/profile/onboarding", response_model=ProfileResponse)
async def onboarding(
    body: OnboardingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
```

Steps inside the handler:
1. Load the user's `LearnerProfile` via `user.id`. It always exists because `get_current_user`
   creates it. If somehow absent, raise `HTTPException(500)`.
2. Update `profile.cefr_level = body.cefr_level` and
   `profile.topic_preferences = body.topic_preferences`.
3. Determine bands to seed: `CEFR_ORDER[:CEFR_ORDER.index(body.cefr_level) + 1]`.
4. For each `(rule_code, rule_label)` in those bands, insert a `GrammarWeakness` row using
   `INSERT ... ON CONFLICT (profile_id, rule_code) DO NOTHING`. In SQLAlchemy async use
   `insert().on_conflict_do_nothing()` from `sqlalchemy.dialects.postgresql`:

```python
from sqlalchemy.dialects.postgresql import insert as pg_insert

rows = [
    {"profile_id": profile.id, "rule_code": code, "rule_label": label, "cefr_band": band}
    for band in bands_to_seed
    for code, label in GRAMMAR_RULES[band]
]
if rows:
    await db.execute(pg_insert(GrammarWeakness).values(rows).on_conflict_do_nothing())
```

5. `await db.commit()` then `await db.refresh(profile)`.
6. Return `ProfileResponse` (see schema section below).

---

**3 — GET /profile**

```python
@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
```

Steps:
1. Load profile via `user.id`. If absent, raise `HTTPException(404, "Profile not found —
   complete onboarding first")`.
2. Load all `GrammarWeakness` rows for the profile. Filter in Python:
   `weak_rules = [w for w in weaknesses if w.mastery_score < 0.6]`
3. Load `VocabularyItem` rows where `next_review_at < datetime.now(timezone.utc)` and
   `profile_id = profile.id`. Do this with a DB-side filter, not in Python:

```python
from sqlalchemy import select
from datetime import datetime, timezone

now = datetime.now(timezone.utc)
result = await db.execute(
    select(VocabularyItem)
    .where(VocabularyItem.profile_id == profile.id)
    .where(VocabularyItem.next_review_at < now)
)
vocab_due = result.scalars().all()
```

4. Return `ProfileResponse`.

---

**4 — Pydantic schemas**

Add to `backend/app/models/schemas.py`:

```python
from datetime import datetime

class OnboardingRequest(BaseModel):
    cefr_level: str          # "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
    topic_preferences: dict  # {"food": 0.0-1.0, "travel": ..., "work": ..., "culture": ...}

class WeakRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    rule_code: str
    rule_label: str
    cefr_band: str
    mastery_score: float
    error_count: int
    seen_count: int

class VocabDueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    word: str
    article: str | None
    translation_it: str | None
    retention_score: float
    next_review_at: datetime

class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    cefr_level: str
    topic_preferences: dict
    persona_settings: dict
    total_sessions: int
    total_words_seen: int
    weak_rules: list[WeakRuleOut]
    vocabulary_due: list[VocabDueOut]
```

`ProfileResponse` is not a direct ORM model reflection — it is assembled manually in both
route handlers:

```python
return ProfileResponse(
    cefr_level=profile.cefr_level,
    topic_preferences=profile.topic_preferences,
    persona_settings=profile.persona_settings,
    total_sessions=profile.total_sessions,
    total_words_seen=profile.total_words_seen,
    weak_rules=weak_rules,
    vocabulary_due=vocab_due,
)
```

---

**5 — srs.py**

Create `backend/app/services/srs.py`. Implement exactly:

```python
from datetime import datetime, timedelta, timezone


def next_review_date(times_seen: int, retention_score: float) -> datetime:
    """Simplified SM-2: interval grows with retention."""
    if retention_score >= 0.9:
        interval = 21
    elif retention_score >= 0.75:
        interval = 7
    elif retention_score >= 0.6:
        interval = 3
    else:
        interval = 1
    return datetime.now(timezone.utc) + timedelta(days=interval)


def update_retention_score(current_score: float, was_correct: bool, times_seen: int) -> float:
    """Recency-weighted retention update. Same algorithm as update_mastery() in mastery.py."""
    weight = 1 / (1 + 0.1 * times_seen)
    outcome = 1.0 if was_correct else 0.0
    return round(current_score * (1 - weight) + outcome * weight, 3)
```

`update_retention_score` uses the identical recency-weighted formula from `update_mastery()`
in `mastery.py` — CLAUDE.md §7 defines this algorithm once and it applies to both grammar
mastery and vocabulary retention.

---

**6 — Wire SRS into session_service.end_session()**

In `backend/app/services/session_service.py`, after setting `session.ended_at` and before
`await db.commit()`, load and update all vocabulary encounters for the session:

```python
from app.services.srs import next_review_date, update_retention_score
from app.models.db import VocabularyEncounter, VocabularyItem

# inside end_session(), after session.ended_at = ...
enc_result = await db.execute(
    select(VocabularyEncounter)
    .where(VocabularyEncounter.session_id == session.id)
)
encounters = enc_result.scalars().all()

for enc in encounters:
    item_result = await db.execute(
        select(VocabularyItem).where(VocabularyItem.id == enc.vocab_item_id)
    )
    item = item_result.scalar_one_or_none()
    if item is None:
        continue
    was_correct = enc.used_correctly if enc.used_correctly is not None else True
    item.retention_score = update_retention_score(
        item.retention_score, was_correct, item.times_seen
    )
    item.next_review_at = next_review_date(item.times_seen, item.retention_score)
    item.times_seen += 1
```

Then `await db.commit()` as before. No separate commit needed — fold into the existing one.

---

## API Contract

```
POST /profile/onboarding
Authorization: Bearer <firebase_jwt>

Request body:
{
  "cefr_level": "string — A1|A2|B1|B2|C1|C2",
  "topic_preferences": {
    "food": "float 0.0–1.0",
    "travel": "float 0.0–1.0",
    "work": "float 0.0–1.0",
    "culture": "float 0.0–1.0"
  }
}

Response 200: ProfileResponse (see schema above)

Response 422: invalid cefr_level or topic_preferences shape
```

```
GET /profile
Authorization: Bearer <firebase_jwt>

Response 200: ProfileResponse (see schema above)

Response 404:
{
  "detail": "Profile not found — complete onboarding first"
}
```

---

## Database Changes

No schema changes. No new migration needed. The `grammar_weaknesses` table already exists
with the correct columns (`profile_id`, `rule_code`, `rule_label`, `cefr_band`,
`mastery_score`, `error_count`, `seen_count`, `last_seen_at`) and the
`UNIQUE(profile_id, rule_code)` constraint that makes the idempotent insert safe.

---

## Tests

### Backend (pytest)

**`backend/tests/test_profile.py`**
- `test_onboarding_creates_profile` — POST /profile/onboarding with level B1 returns 200;
  DB has `cefr_level = "B1"` and exactly 12 grammar weakness rows (A1×4 + A2×4 + B1×5... 
  wait: A1=4, A2=4, B1=5 = 13 rows total)
- `test_onboarding_idempotent` — calling POST /profile/onboarding twice with the same user
  does not create duplicate grammar_weaknesses rows; the count stays the same
- `test_onboarding_preserves_mastery` — seed one weakness manually with mastery_score=0.9,
  re-run onboarding, confirm mastery_score is still 0.9 (ON CONFLICT DO NOTHING)
- `test_get_profile_returns_weak_rules` — seed two weaknesses: one at 0.4 (weak), one at
  0.8 (strong); GET /profile returns only the 0.4 row in `weak_rules`
- `test_get_profile_returns_vocab_due` — insert a VocabularyItem with
  `next_review_at = now() - 1 day`; GET /profile includes it in `vocabulary_due`
- `test_get_profile_excludes_future_vocab` — insert a VocabularyItem with
  `next_review_at = now() + 7 days`; GET /profile does NOT include it in `vocabulary_due`
- `test_get_profile_404_before_onboarding` — delete the auto-created LearnerProfile; GET
  /profile returns 404

**`backend/tests/test_srs.py`**
- `test_next_review_date_high_retention` — score 0.95 → interval is 21 days
- `test_next_review_date_medium_retention` — score 0.80 → interval is 7 days
- `test_next_review_date_low_retention` — score 0.4 → interval is 1 day
- `test_update_retention_score_correct` — correct answer raises score
- `test_update_retention_score_incorrect` — incorrect answer lowers score
- `test_update_retention_score_bounded` — repeated correct answers never exceed 1.0

---

## Definition of Done

- [ ] All acceptance criteria checked (AC1–AC6)
- [ ] All specified tests written and green
- [ ] No hardcoded strings
- [ ] No API keys or secrets in code
- [ ] Conventional commit: `feat(TASK-014): profile onboarding routes + srs service`
- [ ] TASK status updated to `done`

---

## Notes for Tech Lead

- `test_onboarding_creates_profile` rule count: A1=4, A2=4, B1=5 = **13 rows** for B1.
  The test should assert `== 13`, not 12. Correct this if copying from the tests section above.
- Next task candidate: the mobile `OnboardingScreen` needs to call `POST /profile/onboarding`
  and then navigate to the word card. Check whether `OnboardingScreen.tsx` currently calls
  a real endpoint or is still mocked.
- `end_session` SRS wiring loads encounters one-by-one inside a loop. For v1.0 session sizes
  (< 20 messages, < 10 vocab items per session) this is fine. Do not optimise prematurely.
- `GET /profile` currently has no caching. The prompt builder already queries the DB directly
  and does not call this route — they share the same data but different code paths. This is
  intentional; unifying them is a refactor for after v1.0.
