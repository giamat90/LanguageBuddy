# TASK-002 — Backend: Word Generation Service & Nightly Job

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Branch:** `main` (commit directly — no feature branch)
**Depends on:** TASK-001 (merged ✓)

---

## Context

TASK-001 created the skeleton. Every downstream feature — the word card, vault, chat session —
requires real German words in `daily_items` before any UI can be built or tested.
This task implements the generation pipeline: the Claude-powered word generator and the nightly
Railway cron job that populates `daily_items` for all active users at 02:00 UTC.
No API endpoints, no Android changes — pure backend service layer.

---

## Scope

### In scope
- `backend/app/core/prompts.py` — `WORD_GEN_PROMPT` constant (verbatim from CLAUDE.md §6)
- `backend/app/core/claude.py` — thin async wrapper around `anthropic.AsyncAnthropic`
- `backend/app/services/word_generator.py` — all generation logic and DB helpers
- `backend/app/jobs/nightly_word.py` — replace stub with full implementation
- `backend/tests/test_word_generator.py` — 9 unit tests (no DB, no network)

### Out of scope
- `GET /word/today` endpoint (reading generated words — TASK-003)
- `POST /word/save` endpoint (TASK-003)
- `prompt_builder.py` (session prompts — later task)
- `error_classifier.py`, `srs.py`, `mastery.py` (later tasks)
- Any Android code

---

## Acceptance Criteria

- [ ] `python -m app.jobs.nightly_word` exits 0 when `DATABASE_URL` and `ANTHROPIC_API_KEY` are set
- [ ] A `daily_items` row is created for each active user with all non-nullable columns populated
- [ ] Words are never repeated for the same user (checked against all existing `daily_items.word` values)
- [ ] When Claude returns invalid JSON, a missing field, an already-seen word, or raises any exception — the fallback pool is used and Sentry captures the exception
- [ ] `parse_and_validate_word` raises `ValueError` for: invalid JSON, missing required fields, unknown `grammar_angle` code, unknown `topic_domain`, and repeated words
- [ ] All 9 specified tests pass with no DB or network calls

---

## Technical Spec

### Files to create
```
backend/app/core/prompts.py              — WORD_GEN_PROMPT constant
backend/app/core/claude.py              — AsyncAnthropic client wrapper
backend/app/services/word_generator.py  — generation service and DB helpers
```

### Files to modify
```
backend/app/jobs/nightly_word.py        — replace stub with full implementation
```

---

### `backend/app/core/prompts.py`

Single constant, copied verbatim from CLAUDE.md §6. The double-braces in the JSON block
are intentional — they produce literal `{` `}` after `.format()` is called.

```python
WORD_GEN_PROMPT = """
You are a German language curriculum designer.
Generate a single German word of the day for this learner:

LEARNER PROFILE:
- CEFR level: {cefr_level}
- Native language: Italian
- Topic preferences (0-1 weight): {topic_preferences}
- Weak grammar rules to reinforce: {weak_rules}
- Words already seen (NEVER repeat): {seen_words}

REQUIREMENTS:
- Word must be appropriate for {cefr_level} level
- Prefer topics with higher preference weights
- Choose a word whose example sentence naturally practices one of the weak grammar rules
- Cultural interest > pure frequency ranking

Respond ONLY with valid JSON, no preamble, no markdown:
{{
  "word": "string",
  "article": "der|die|das|null",
  "part_of_speech": "noun|verb|adj|prep|conj|adv",
  "ipa": "string",
  "meaning_en": "string",
  "meaning_it": "string",
  "example_de": "string (natural sentence using the word)",
  "example_it": "string (Italian translation of example)",
  "cultural_note": "string (1-2 sentences, why this word is interesting)",
  "grammar_angle": "RULE_CODE from canonical list",
  "topic_domain": "food|travel|work|culture|home|leisure|health|shopping",
  "cefr_band": "{cefr_level}",
  "session_scenario": "string (short scenario title for Pro chat session)"
}}
"""
```

---

### `backend/app/core/claude.py`

Lazy singleton — client is created once on first call, reused for all subsequent calls.
Model is hardcoded as specified in CLAUDE.md §3: `claude-haiku-4-5-20251001`.

```python
import anthropic
from .config import settings

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def complete(prompt: str, max_tokens: int = 400) -> str:
    """Send a user-role message, return the text of the first content block."""
    client = get_client()
    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text
```

---

### `backend/app/services/word_generator.py`

Implement in this order: constants → fallback pool → DB helpers → pure functions →
`generate_for_user`.

#### Constants

```python
CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]

MASTERY_WEAK_THRESHOLD = 0.6  # mirrors CLAUDE.md §7

VALID_RULE_CODES = {
    "VERB_CONJ_REGULAR", "NOUN_GENDER", "WORD_ORDER_V2", "NEGATION_NICHT_KEIN",
    "VERB_CONJ_IRREGULAR", "ACCUSATIVE_MASC", "ACCUSATIVE_PREP", "SEPARABLE_VERB",
    "DATIV_PREP", "DATIV_INDIRECT_OBJ", "MODAL_VERB", "PERF_SEIN_HABEN", "SUBORD_VERB_FINAL",
    "KONJUNKTIV_II", "GENITIV_CASE", "PASSIVE_VOICE",
    "KONJUNKTIV_I", "EXTENDED_ATTR",
}

VALID_TOPIC_DOMAINS = {
    "food", "travel", "work", "culture", "home", "leisure", "health", "shopping"
}

VALID_PARTS_OF_SPEECH = {"noun", "verb", "adj", "prep", "conj", "adv"}

REQUIRED_WORD_FIELDS = {
    "word", "part_of_speech", "ipa", "meaning_en", "meaning_it",
    "example_de", "example_it", "cultural_note", "grammar_angle",
    "topic_domain", "cefr_band", "session_scenario",
}
```

#### Fallback pool

`FALLBACK_POOL: dict[str, list[dict]]` — keyed by CEFR level, each value is a list of
pre-built word dicts that match the `DailyItem` schema exactly. Every entry must include
all `REQUIRED_WORD_FIELDS` plus `article` (may be `None` for non-nouns).

Provide **at least 3 entries per level** (A1 through C2 = 6 levels, minimum 18 entries total).
Choose real, common German words appropriate to each level. The grammar_angle must be a valid
rule code from `VALID_RULE_CODES` that falls within or below the word's `cefr_band`.

Example structure for one A1 entry — follow this exact shape for all entries:

```python
{
    "word": "Haus",
    "article": "das",
    "part_of_speech": "noun",
    "ipa": "haʊ̯s",
    "meaning_en": "house",
    "meaning_it": "casa",
    "example_de": "Das Haus ist groß.",
    "example_it": "La casa è grande.",
    "cultural_note": "In Germany, most people rent rather than own their homes — Mietkultur is the norm.",
    "grammar_angle": "NOUN_GENDER",
    "topic_domain": "home",
    "cefr_band": "A1",
    "session_scenario": "Describing your home",
}
```

Add `pick_fallback(cefr_level: str) -> dict` that returns `random.choice` from the pool
for the given level, falling back to "A1" if the level is not in the pool.

#### DB helper functions

All helpers accept an `AsyncSession` parameter. Use SQLAlchemy 2.0 async `select()` —
no raw SQL.

```python
async def get_active_users(db: AsyncSession) -> list[User]:
    """Users active in the last 30 days, or created in last 30 days with no activity yet."""
    cutoff = datetime.utcnow() - timedelta(days=30)
    result = await db.execute(
        select(User).where(
            or_(
                User.last_active_at >= cutoff,
                and_(User.last_active_at.is_(None), User.created_at >= cutoff),
            )
        )
    )
    return result.scalars().all()


async def get_learner_snapshot(db: AsyncSession, user_id: str) -> dict:
    """Returns cefr_level, topic_preferences, and weak grammar rules for this user."""
    # 1. Load LearnerProfile for user_id
    # 2. If no profile exists, return defaults: cefr_level="A1", topic_preferences={}, weak_rules=[]
    # 3. Compute eligible_bands = CEFR_ORDER up to and including cefr_level
    # 4. Query GrammarWeakness where profile_id=profile.id AND cefr_band IN eligible_bands
    #    AND mastery_score < MASTERY_WEAK_THRESHOLD, ORDER BY mastery_score ASC
    # 5. Return dict with keys: "cefr_level", "topic_preferences", "weak_rules"
    #    weak_rules is a list of {"rule_code": ..., "rule_label": ..., "mastery_score": ...}


async def get_seen_words(db: AsyncSession, user_id: str) -> set[str]:
    """Returns lowercased set of all words already shown to this user via daily_items."""
    result = await db.execute(
        select(DailyItem.word).where(DailyItem.user_id == user_id)
    )
    return {row[0].lower() for row in result.all()}


async def store_daily_item(db: AsyncSession, user_id: str, word_data: dict) -> None:
    """Insert today's daily item. Silently skips if a row already exists for (user_id, date)."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    stmt = (
        pg_insert(DailyItem)
        .values(
            user_id=user_id,
            date=date.today(),
            word=word_data["word"],
            article=word_data.get("article"),
            part_of_speech=word_data.get("part_of_speech"),
            ipa=word_data.get("ipa"),
            meaning_en=word_data.get("meaning_en"),
            meaning_it=word_data.get("meaning_it"),
            example_de=word_data.get("example_de"),
            example_it=word_data.get("example_it"),
            cultural_note=word_data.get("cultural_note"),
            grammar_angle=word_data.get("grammar_angle"),
            topic_domain=word_data.get("topic_domain"),
            cefr_band=word_data.get("cefr_band"),
            session_scenario=word_data.get("session_scenario"),
        )
        .on_conflict_do_nothing(index_elements=["user_id", "date"])
    )
    await db.execute(stmt)
    await db.commit()
```

#### Pure functions (no I/O)

```python
def build_word_prompt(snapshot: dict, seen_words: set[str]) -> str:
    """Format WORD_GEN_PROMPT with the learner snapshot and seen words."""
    weak_rules_str = ", ".join(
        f"{r['rule_code']} ({r['rule_label']})" for r in snapshot["weak_rules"]
    ) or "none identified yet"
    # Cap seen_words at 50 to avoid token bloat; sort for determinism in tests
    capped = sorted(seen_words)[:50]
    seen_words_str = ", ".join(capped) or "none yet"
    return WORD_GEN_PROMPT.format(
        cefr_level=snapshot["cefr_level"],
        topic_preferences=snapshot["topic_preferences"],
        weak_rules=weak_rules_str,
        seen_words=seen_words_str,
    )


def parse_and_validate_word(raw: str, seen_words: set[str]) -> dict:
    """
    Parse and validate Claude's JSON response.
    Raises ValueError with a descriptive message on any failure.

    Validation order:
    1. JSON parseable
    2. All REQUIRED_WORD_FIELDS present
    3. word (lowercased) not in seen_words
    4. grammar_angle in VALID_RULE_CODES
    5. topic_domain in VALID_TOPIC_DOMAINS
    6. part_of_speech in VALID_PARTS_OF_SPEECH

    Post-processing: if article == "null" (string), convert to None.
    """
```

#### `generate_for_user`

```python
async def generate_for_user(user_id: str) -> None:
    """
    Generate and store today's word for one user.
    On any exception: capture to Sentry, use fallback pool.
    Always stores exactly one word — either Claude's or the fallback.
    """
    import sentry_sdk

    async with AsyncSessionLocal() as db:
        cefr_level = "A1"  # safe default before snapshot is loaded
        try:
            snapshot = await get_learner_snapshot(db, user_id)
            cefr_level = snapshot["cefr_level"]
            seen_words = await get_seen_words(db, user_id)
            prompt = build_word_prompt(snapshot, seen_words)
            raw = await claude_client.complete(prompt, max_tokens=400)
            word_data = parse_and_validate_word(raw, seen_words)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            word_data = pick_fallback(cefr_level)

        await store_daily_item(db, user_id, word_data)
```

Note: `cefr_level` is set before the try block so the except branch always has a valid level
even if `get_learner_snapshot` itself raised.

---

### `backend/app/jobs/nightly_word.py`

Replace the stub entirely:

```python
import asyncio
import logging
from app.core.database import AsyncSessionLocal
from app.services.word_generator import generate_for_user, get_active_users

logger = logging.getLogger(__name__)

MAX_CONCURRENCY = 50


async def run_nightly_word_generation() -> None:
    logger.info("Nightly word generation starting")

    async with AsyncSessionLocal() as db:
        users = await get_active_users(db)

    logger.info("Generating words for %d active users", len(users))
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

    async def guarded(user_id: str) -> None:
        async with semaphore:
            await generate_for_user(user_id)

    await asyncio.gather(
        *[guarded(str(u.id)) for u in users],
        return_exceptions=True,
    )
    logger.info("Nightly word generation complete")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_nightly_word_generation())
```

---

## Tests

All tests live in `backend/tests/test_word_generator.py`. No DB, no network, no Claude calls.
Build all test payloads inline with `json.dumps()`.

```
test_parse_valid_word
    — full valid JSON with all required fields and article="der"
    — assert returned dict["word"] matches input, article is preserved

test_parse_invalid_json
    — input "this is not json"
    — assert raises ValueError

test_parse_missing_field
    — valid JSON but with "ipa" key omitted
    — assert raises ValueError containing "ipa" or "missing"

test_parse_repeated_word
    — word "Haus" in JSON, seen_words={"haus"}  (lowercased)
    — assert raises ValueError

test_parse_unknown_rule_code
    — grammar_angle = "MADE_UP_CODE"
    — assert raises ValueError

test_parse_null_article_string_normalised
    — article = "null" (string) in JSON
    — assert returned dict["article"] is None (Python None, not string)

test_build_prompt_contains_weak_rules
    — snapshot with two weak rules: DATIV_PREP and MODAL_VERB
    — assert both rule codes appear in the returned prompt string

test_build_prompt_caps_seen_words_at_50
    — seen_words is a set of 60 words ("word_1" … "word_60")
    — assert the returned prompt string contains at most 50 comma-separated tokens
      in the seen_words section (count commas + 1 ≤ 50)

test_pick_fallback_valid_for_all_levels
    — call pick_fallback for each of: A1, A2, B1, B2, C1, C2
    — assert each returned dict contains all keys in REQUIRED_WORD_FIELDS
    — assert returned dict["cefr_band"] matches the requested level
```

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] All 9 tests pass (`python -m pytest tests/test_word_generator.py -v`)
- [ ] `python -m app.jobs.nightly_word` exits cleanly (with a real or test DB)
- [ ] No hardcoded strings outside `prompts.py` and `word_generator.py` constants
- [ ] No API keys or secrets in code
- [ ] Conventional commit: `feat(TASK-002): word generation service and nightly job`
- [ ] TASK status updated to `done`
