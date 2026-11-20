# TASK-003 — Backend: Word Router (GET /word/today, POST /word/save)

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Branch:** `main` (commit directly — no feature branch)
**Depends on:** TASK-002 (merged ✓)

---

## Context

TASK-002 populates `daily_items` via the nightly job. This task exposes those rows to the
Android client — the two endpoints that form the entire free-tier user loop:
fetch today's word, save it to the vault, update the streak.
These are the first routes the Android client will actually call; everything else blocks on them.

There is also a design gap to close: `app/core/auth.py` currently injects a Firebase UID
string, but routes need the full `User` ORM object to perform DB operations.
TASK-003 adds a `get_current_user` dependency that resolves the Firebase token to a `User` row.

---

## Scope

### In scope
- `app/core/auth.py` — add `get_current_user` dependency (returns `User` ORM object)
- `app/models/schemas.py` — add `DailyItemResponse` and `SaveWordResponse` Pydantic models
- `app/services/word_service.py` — service layer: `get_today_word`, `save_word`, `update_streak`, `upsert_vocabulary_item`
- `app/routers/word.py` — replace 501 stubs with real implementations
- `tests/test_word_router.py` — 8 tests (no real DB, no Firebase)

### Out of scope
- `GET /vault` endpoint (TASK-005)
- Any SRS score updates on save (TASK-005)
- Any mastery updates (later)
- Android client (later)

---

## Acceptance Criteria

- [ ] `GET /v1/word/today` returns 200 with full word fields when a `daily_items` row exists for today
- [ ] `GET /v1/word/today` returns 404 when no row exists for today
- [ ] `GET /v1/word/today` returns 401 when JWT is missing or invalid
- [ ] `POST /v1/word/save` returns 200 with `streak_days` and `already_saved: false` on first save
- [ ] `POST /v1/word/save` returns 200 with `already_saved: true` and unchanged streak on repeat call
- [ ] `POST /v1/word/save` returns 404 when no `daily_items` row exists for today
- [ ] After `POST /v1/word/save`, `daily_items.saved_at` is set and a `vocabulary_items` row exists for the word
- [ ] All 8 specified tests pass

---

## Technical Spec

### Files to create
```
backend/app/services/word_service.py   — service layer for word routes
backend/tests/test_word_router.py      — 8 route tests
```

### Files to modify
```
backend/app/core/auth.py               — add get_current_user dependency
backend/app/models/schemas.py          — add DailyItemResponse, SaveWordResponse
backend/app/routers/word.py            — replace 501 stubs
```

---

### `app/core/auth.py` — add `get_current_user`

The existing `get_current_user_id` (returns Firebase UID string) stays untouched.
Add a new dependency below it:

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.db import User

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    _ensure_firebase()
    token = credentials.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
        email = decoded.get("email")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has no email claim")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not registered")
    return user
```

---

### `app/models/schemas.py` — add response schemas

Add these two Pydantic v2 models. Use `model_config = ConfigDict(from_attributes=True)` so
they can be constructed directly from SQLAlchemy ORM objects.

```python
import uuid
from datetime import date as date_type
from pydantic import BaseModel, ConfigDict


class DailyItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    word: str
    article: str | None
    part_of_speech: str | None
    ipa: str | None
    meaning_en: str | None
    meaning_it: str | None
    example_de: str | None
    example_it: str | None
    cultural_note: str | None
    grammar_angle: str | None
    topic_domain: str | None
    cefr_band: str | None
    session_scenario: str | None
    date: date_type
    is_saved: bool  # derived: saved_at IS NOT NULL — NOT a DB column; set in service


class SaveWordResponse(BaseModel):
    streak_days: int
    already_saved: bool
```

`is_saved` is not a column on `DailyItem`. The service layer computes it and passes it
when constructing the response. See service implementation below.

---

### `app/services/word_service.py`

Four functions. All DB operations use `AsyncSession`. No raw SQL.

#### `update_streak` — pure function, verbatim from CLAUDE.md §7

```python
from datetime import date, timedelta
from app.models.db import User

def update_streak(user: User) -> int:
    today = date.today()
    last = user.last_active_at.date() if user.last_active_at else None
    if last == today:
        return user.streak_days          # already saved today
    elif last == today - timedelta(days=1):
        return user.streak_days + 1     # consecutive day
    else:
        return 1                         # streak broken, restart
```

#### `get_today_word`

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.db import DailyItem
import uuid

async def get_today_word(db: AsyncSession, user_id: uuid.UUID) -> DailyItem | None:
    result = await db.execute(
        select(DailyItem).where(
            DailyItem.user_id == user_id,
            DailyItem.date == date.today(),
        )
    )
    return result.scalar_one_or_none()
```

#### `upsert_vocabulary_item`

Checks if the word already exists in `vocabulary_items` for this profile.
If yes: increments `times_seen`. If no: inserts a new row.
Returns `True` if the word was new, `False` if it already existed.

```python
from app.models.db import DailyItem, LearnerProfile, VocabularyItem
from datetime import datetime, timedelta

async def upsert_vocabulary_item(
    db: AsyncSession,
    profile_id: uuid.UUID,
    daily_item: DailyItem,
) -> bool:
    result = await db.execute(
        select(VocabularyItem).where(
            VocabularyItem.profile_id == profile_id,
            VocabularyItem.word == daily_item.word,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.times_seen += 1
        await db.commit()
        return False  # not new
    else:
        new_item = VocabularyItem(
            profile_id=profile_id,
            word=daily_item.word,
            article=daily_item.article,
            translation_en=daily_item.meaning_en,
            translation_it=daily_item.meaning_it,
            part_of_speech=daily_item.part_of_speech,
            source="word_of_the_day",
            times_seen=1,
            times_used=0,
            retention_score=0.5,
        )
        db.add(new_item)
        await db.commit()
        return True  # new word
```

#### `save_word`

Orchestrates the full save flow. Returns `(streak_days, already_saved)`.

```python
from datetime import datetime, timezone

async def save_word(db: AsyncSession, user: User) -> tuple[int, bool]:
    # 1. Load today's daily_item
    daily_item = await get_today_word(db, user.id)
    if daily_item is None:
        return None, False  # caller raises 404

    # 2. Idempotency: already saved today?
    if daily_item.saved_at is not None:
        return user.streak_days, True

    # 3. Mark saved
    daily_item.saved_at = datetime.now(timezone.utc)

    # 4. Load learner profile (needed for vocabulary_items FK)
    from app.models.db import LearnerProfile
    profile_result = await db.execute(
        select(LearnerProfile).where(LearnerProfile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile is not None:
        await upsert_vocabulary_item(db, profile.id, daily_item)

    # 5. Update streak
    new_streak = update_streak(user)
    user.streak_days = new_streak
    user.last_active_at = datetime.now(timezone.utc)

    await db.commit()
    return new_streak, False
```

---

### `app/routers/word.py` — replace stubs

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.db import User
from app.models.schemas import DailyItemResponse, SaveWordResponse
from app.services.word_service import get_today_word, save_word

router = APIRouter(tags=["word"])


@router.get("/word/today", response_model=DailyItemResponse)
async def get_word_today(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    daily_item = await get_today_word(db, user.id)
    if daily_item is None:
        raise HTTPException(status_code=404, detail="No word available for today")
    return DailyItemResponse(
        **{c.name: getattr(daily_item, c.name) for c in daily_item.__table__.columns},
        is_saved=daily_item.saved_at is not None,
    )


@router.post("/word/save", response_model=SaveWordResponse)
async def save_word_route(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    streak_days, already_saved = await save_word(db, user)
    if streak_days is None:
        raise HTTPException(status_code=404, detail="No word available for today")
    return SaveWordResponse(streak_days=streak_days, already_saved=already_saved)
```

---

## API Contract

```
GET /v1/word/today
Authorization: Bearer <firebase_jwt>

Response 200:
{
  "id": "uuid",
  "word": "Schlüssel",
  "article": "der",
  "part_of_speech": "noun",
  "ipa": "ˈʃlʏsl̩",
  "meaning_en": "key",
  "meaning_it": "chiave",
  "example_de": "Ich habe den Schlüssel verloren.",
  "example_it": "Ho perso la chiave.",
  "cultural_note": "...",
  "grammar_angle": "ACCUSATIVE_MASC",
  "topic_domain": "home",
  "cefr_band": "A2",
  "session_scenario": "Dealing with lost items",
  "date": "2026-05-03",
  "is_saved": false
}

Response 404: { "detail": "No word available for today" }
Response 401: { "detail": "Invalid or expired token" }

---

POST /v1/word/save
Authorization: Bearer <firebase_jwt>
(no request body)

Response 200:
{
  "streak_days": 3,
  "already_saved": false
}

Response 200 (repeat call):
{
  "streak_days": 3,
  "already_saved": true
}

Response 404: { "detail": "No word available for today" }
Response 401: { "detail": "Invalid or expired token" }
```

---

## Tests

All in `backend/tests/test_word_router.py`. Use `app.dependency_overrides` to inject a
mock `User` (bypassing Firebase), and `unittest.mock.patch` to mock service functions.
No DB, no network.

### Setup pattern

```python
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from app.main import app
from app.core.auth import get_current_user
from app.models.db import User
import uuid
from datetime import date, datetime, timezone

def make_user(**kwargs) -> User:
    u = MagicMock(spec=User)
    u.id = kwargs.get("id", uuid.uuid4())
    u.email = kwargs.get("email", "test@example.com")
    u.streak_days = kwargs.get("streak_days", 2)
    u.last_active_at = kwargs.get("last_active_at", None)
    return u

def override_user(user: User):
    app.dependency_overrides[get_current_user] = lambda: user

def clear_overrides():
    app.dependency_overrides.clear()
```

### The 8 tests

```
test_get_word_today_returns_200
    — override get_current_user with mock user
    — patch get_today_word to return a mock DailyItem with all fields set, saved_at=None
    — GET /v1/word/today
    — assert 200, response["word"] matches mock, response["is_saved"] == False

test_get_word_today_is_saved_true_when_saved_at_set
    — patch get_today_word to return daily_item with saved_at = datetime.now(utc)
    — assert response["is_saved"] == True

test_get_word_today_404_when_no_item
    — patch get_today_word to return None
    — assert 404

test_get_word_today_401_without_jwt
    — do NOT override get_current_user (clear overrides)
    — GET /v1/word/today with no Authorization header
    — assert 403 (HTTPBearer returns 403 when header is missing)

test_save_word_happy_path
    — patch save_word to return (3, False)
    — POST /v1/word/save
    — assert 200, streak_days=3, already_saved=False

test_save_word_already_saved
    — patch save_word to return (3, True)
    — assert 200, already_saved=True

test_save_word_404_when_no_item
    — patch save_word to return (None, False)
    — assert 404

test_update_streak_pure_function
    — import update_streak directly (no HTTP)
    — test three cases with a mock User:
      a) last_active_at = yesterday → streak_days + 1
      b) last_active_at = 3 days ago → returns 1 (reset)
      c) last_active_at = today → streak_days unchanged
```

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] All 8 tests pass (`python -m pytest tests/test_word_router.py -v`)
- [ ] Full test suite still green (`python -m pytest -v`)
- [ ] No hardcoded strings — all error messages defined inline in routes
- [ ] No API keys or secrets in code
- [ ] Conventional commit: `feat(TASK-003): word router GET /word/today and POST /word/save`
- [ ] TASK status updated to `done`
