# TASK-006 — RecapScreen + Error Classifier + GET /session/{id}/recap

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-005b (must be merged first — provides `SessionError` model, session router, ChatScreen, DataStore pattern)

---

## Context

When Lena's session ends at message 10, the learner needs feedback: what they did well,
what to improve, and a numeric snapshot (fluency score, XP, new words). This task adds
the async error classifier that runs after each user message, the `GET /session/{id}/recap`
endpoint that assembles the final picture, and the RecapScreen that displays it.

The error classifier is a background Haiku call — it never blocks the SSE stream. It
writes to `session_errors` and updates `grammar_weaknesses` mastery scores. The recap
endpoint reads those rows at session end and computes XP, strengths, and a focus area.

---

## Scope

### In scope
- Backend: `ERROR_CLASSIFIER_PROMPT` constant in `prompts.py`
- Backend: `backend/app/services/error_classifier.py` — async classifier, `session_errors` writes, `grammar_weaknesses` upserts, running fluency score
- Backend: `backend/app/services/mastery.py` — `update_mastery()` from CLAUDE.md §7
- Backend: modify `POST /session/message` to fire classifier as FastAPI `BackgroundTasks`
- Backend: replace 501 stub in `backend/app/routers/recap.py` with full implementation
- Backend: `backend/app/schemas/recap.py` — Pydantic response schema
- Android: `RecapScreen.kt` (replace stub), `RecapUiState.kt`, `RecapViewModel.kt`
- Android: `RecapRepository.kt` + `RecapRepositoryImpl.kt` + `RecapModule.kt`
- Android: `domain/model/RecapData.kt` + `data/remote/dto/RecapDto.kt`
- Android: modify `ChatScreen.kt` — replace banner CTA with "Vedi il riepilogo"
- Android: modify `AppNavGraph.kt` — wire RECAP route, pass `onViewRecap` to ChatScreen
- Android: modify `WortschatzApi.kt` — add `getSessionRecap`
- Strings: all Italian strings in `strings.xml`
- Tests: 5 backend + 3 Android

### Out of scope
- SRS next-review-date updates (`vocabulary_items.next_review_at`) — TASK-007
- CEFR promotion check (runs every 10 sessions) — TASK-007
- Grammar pills UI (v1.1)
- Recap history list (v1.1)
- `VocabularyEncounter` rows (tied to SRS, TASK-007)

---

## Acceptance Criteria

- [ ] When the session ends in ChatScreen, the banner CTA reads "Vedi il riepilogo" and tapping it navigates to `RecapScreen(sessionId)`
- [ ] `GET /session/{id}/recap` returns 200 with `errors`, `strengths` (2 items), `focus_area`, `fluency_score`, `xp_earned`, `new_words_count`
- [ ] `GET /session/{id}/recap` returns 404 if the session does not belong to the authenticated user
- [ ] `POST /session/message` fires the error classifier as a background task — it does NOT block the SSE stream
- [ ] After the classifier runs, `session_errors` rows are written for every grammar error found
- [ ] After the classifier runs, `grammar_weaknesses` rows are upserted for each error's `rule_code`
- [ ] `sessions.fluency_score` is updated as a running exponential moving average after each classifier run
- [ ] RecapScreen displays: fluency %, XP earned, new word count, two strengths, one focus area, and a list of grammar errors (if any)
- [ ] "Torna alla parola del giorno" button on RecapScreen navigates back to `Routes.WORD_CARD` (popping RECAP from the stack)
- [ ] All strings are in `strings.xml` — zero hardcoded Italian strings
- [ ] All specified tests pass

---

## Technical Spec

### Files to create
```
backend/app/services/error_classifier.py    — classifier logic + DB writes
backend/app/services/mastery.py             — update_mastery() + MASTERY constants
backend/app/schemas/recap.py                — Pydantic response schema
backend/tests/test_error_classifier.py      — 2 classifier unit tests
backend/tests/test_recap_router.py          — 3 recap route tests
android/app/src/main/java/com/wortschatz/domain/model/RecapData.kt
android/app/src/main/java/com/wortschatz/data/remote/dto/RecapDto.kt
android/app/src/main/java/com/wortschatz/data/repository/RecapRepository.kt
android/app/src/main/java/com/wortschatz/data/repository/RecapRepositoryImpl.kt
android/app/src/main/java/com/wortschatz/di/RecapModule.kt
android/app/src/main/java/com/wortschatz/ui/recap/RecapUiState.kt
android/app/src/main/java/com/wortschatz/ui/recap/RecapViewModel.kt
android/app/src/test/java/com/wortschatz/ui/recap/RecapViewModelTest.kt
android/app/src/androidTest/java/com/wortschatz/ui/recap/RecapScreenTest.kt
```

### Files to modify
```
backend/app/core/prompts.py                     — add ERROR_CLASSIFIER_PROMPT
backend/app/routers/session.py                  — fire BackgroundTask in POST /session/message
backend/app/routers/recap.py                    — replace 501 stub
android/app/src/main/java/com/wortschatz/data/remote/WortschatzApi.kt     — add getSessionRecap
android/app/src/main/java/com/wortschatz/ui/recap/RecapScreen.kt          — replace stub
android/app/src/main/java/com/wortschatz/ui/chat/ChatScreen.kt            — add onViewRecap callback
android/app/src/main/java/com/wortschatz/ui/navigation/AppNavGraph.kt     — wire RECAP route
android/app/src/main/res/values/strings.xml                               — recap strings
```

---

### Backend — `ERROR_CLASSIFIER_PROMPT` in `backend/app/core/prompts.py`

Append verbatim. Do NOT modify `SESSION_SYSTEM_PROMPT` or `WORD_GEN_PROMPT`.

```python
RULE_CODES_LIST = (
    "A1: VERB_CONJ_REGULAR, NOUN_GENDER, WORD_ORDER_V2, NEGATION_NICHT_KEIN\n"
    "A2: VERB_CONJ_IRREGULAR, ACCUSATIVE_MASC, ACCUSATIVE_PREP, SEPARABLE_VERB\n"
    "B1: DATIV_PREP, DATIV_INDIRECT_OBJ, MODAL_VERB, PERF_SEIN_HABEN, SUBORD_VERB_FINAL\n"
    "B2: KONJUNKTIV_II, GENITIV_CASE, PASSIVE_VOICE\n"
    "C1: KONJUNKTIV_I, EXTENDED_ATTR"
)

ERROR_CLASSIFIER_PROMPT = """
You are a German grammar error classifier.

Conversation exchange:
User wrote: "{user_message}"
Correct German would be: (assess this yourself)

Classify any grammatical errors. Use ONLY these rule codes:
{rule_codes}

Respond ONLY with valid JSON, no preamble, no markdown:
{{
  "errors": [
    {{
      "rule_code": "RULE_CODE",
      "rule_label": "human readable label",
      "cefr_band": "A1|A2|B1|B2|C1",
      "user_text": "the incorrect fragment",
      "correct_form": "the correct form",
      "was_corrected_by_bot": true
    }}
  ],
  "new_words_used": ["word1", "word2"],
  "target_word_used": true,
  "fluency_score": 0.0
}}

If no errors, return empty errors array. fluency_score 0.0–1.0: 1.0 = flawless German.
"""
```

---

### Backend — `backend/app/services/mastery.py`

New file. Verbatim from CLAUDE.md §7.

```python
MASTERY_WEAK_THRESHOLD = 0.6
MASTERY_GRADUATED_THRESHOLD = 0.9


def update_mastery(current_score: float, was_correct: bool, seen_count: int) -> float:
    """Recency-weighted mastery update. Recent errors weigh more."""
    weight = 1 / (1 + 0.1 * seen_count)
    outcome = 1.0 if was_correct else 0.0
    return round(current_score * (1 - weight) + outcome * weight, 3)
```

---

### Backend — `backend/app/services/error_classifier.py`

New file. Called as a FastAPI BackgroundTask — must create its own DB session or use the
one passed in. FastAPI background tasks run after the response is fully sent; the
`AsyncSession` from `Depends(get_db)` remains valid during background task execution.
Pass the session directly.

```python
import json
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core import claude
from app.core.prompts import ERROR_CLASSIFIER_PROMPT, RULE_CODES_LIST
from app.models.db import Session as SessionModel, SessionError, LearnerProfile, GrammarWeakness
from app.services.mastery import update_mastery

FLUENCY_EMA_ALPHA = 0.3   # exponential moving average weight for newest score


async def classify_user_message(
    session_id: str,
    user_id: str,
    user_message: str,
    db: AsyncSession,
) -> None:
    """
    Fires after each user message (as a BackgroundTask).
    Writes session_errors rows, upserts grammar_weaknesses, updates sessions.fluency_score.
    Failures are silent — never raise to the caller.
    """
    try:
        prompt = ERROR_CLASSIFIER_PROMPT.format(
            user_message=user_message,
            rule_codes=RULE_CODES_LIST,
        )
        raw = await claude.complete(prompt, max_tokens=512)
        parsed = json.loads(raw)
    except Exception:
        return  # classifier failures are silent

    try:
        await _write_results(session_id, user_id, parsed, db)
    except Exception:
        return


async def _write_results(
    session_id: str,
    user_id: str,
    parsed: dict,
    db: AsyncSession,
) -> None:
    session_uuid = uuid.UUID(session_id)
    user_uuid = uuid.UUID(user_id)

    # Fetch session
    result = await db.execute(
        select(SessionModel).where(
            SessionModel.id == session_uuid,
            SessionModel.user_id == user_uuid,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        return

    # Fetch learner profile for grammar_weaknesses FK
    profile_result = await db.execute(
        select(LearnerProfile).where(LearnerProfile.user_id == user_uuid)
    )
    profile = profile_result.scalar_one_or_none()

    errors: list[dict] = parsed.get("errors", [])
    new_words: list[str] = parsed.get("new_words_used", [])
    fluency_score: float = float(parsed.get("fluency_score", 0.5))
    fluency_score = max(0.0, min(1.0, fluency_score))

    # Write SessionError rows
    for err in errors:
        rule_code = err.get("rule_code", "")
        if not rule_code:
            continue
        session_error = SessionError(
            id=uuid.uuid4(),
            session_id=session_uuid,
            error_type=rule_code,
            user_text=err.get("user_text"),
            correct_form=err.get("correct_form"),
            grammar_rule=err.get("rule_label"),
            was_corrected=bool(err.get("was_corrected_by_bot", False)),
        )
        db.add(session_error)

    # Update session counters
    session.errors_count = (session.errors_count or 0) + len(errors)
    session.new_words_count = (session.new_words_count or 0) + len(new_words)

    # Update running fluency score (exponential moving average)
    old_score = session.fluency_score if session.fluency_score is not None else fluency_score
    session.fluency_score = round(
        FLUENCY_EMA_ALPHA * fluency_score + (1 - FLUENCY_EMA_ALPHA) * old_score, 3
    )

    # Upsert grammar_weaknesses for each error rule
    if profile is not None:
        for err in errors:
            rule_code = err.get("rule_code", "")
            rule_label = err.get("rule_label", rule_code)
            cefr_band = err.get("cefr_band", "A1")
            if not rule_code:
                continue

            existing_result = await db.execute(
                select(GrammarWeakness).where(
                    GrammarWeakness.profile_id == profile.id,
                    GrammarWeakness.rule_code == rule_code,
                )
            )
            weakness = existing_result.scalar_one_or_none()

            if weakness is None:
                weakness = GrammarWeakness(
                    id=uuid.uuid4(),
                    profile_id=profile.id,
                    rule_code=rule_code,
                    rule_label=rule_label,
                    cefr_band=cefr_band,
                    error_count=1,
                    seen_count=1,
                    mastery_score=update_mastery(0.5, was_correct=False, seen_count=0),
                    last_seen_at=datetime.now(timezone.utc),
                )
                db.add(weakness)
            else:
                weakness.error_count = (weakness.error_count or 0) + 1
                weakness.seen_count = (weakness.seen_count or 0) + 1
                weakness.mastery_score = update_mastery(
                    weakness.mastery_score, was_correct=False, seen_count=weakness.seen_count
                )
                weakness.last_seen_at = datetime.now(timezone.utc)

    await db.commit()
```

---

### Backend — modify `backend/app/routers/session.py`

In `POST /session/message`, add `BackgroundTasks` parameter and fire the classifier.
Keep everything else unchanged.

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from app.services.error_classifier import classify_user_message

# In session_message signature, add:
#   background_tasks: BackgroundTasks,

@router.post("/message")
async def session_message(
    body: SessionMessageRequest,
    background_tasks: BackgroundTasks,         # NEW
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # ... existing auth check, session fetch, message_count increment, unchanged ...

    # NEW — fire classifier as background task (does not block SSE)
    background_tasks.add_task(
        classify_user_message,
        body.session_id,
        str(current_user.id),
        body.message,
        db,
    )

    # ... existing event_generator and StreamingResponse return, unchanged ...
```

Only add `BackgroundTasks` to the signature and the `background_tasks.add_task(...)` call.
Do NOT change the SSE logic, auth checks, or anything else in this file.

---

### Backend — `backend/app/schemas/recap.py`

New file.

```python
from pydantic import BaseModel


class SessionErrorSchema(BaseModel):
    rule_code: str
    rule_label: str | None
    user_text: str | None
    correct_form: str | None
    was_corrected: bool


class RecapResponse(BaseModel):
    session_id: str
    duration_seconds: int | None
    message_count: int
    errors_count: int
    new_words_count: int
    fluency_score: float          # 0.0–1.0
    xp_earned: int
    errors: list[SessionErrorSchema]
    strengths: list[str]          # exactly 2 items, always populated (fallback if no data)
    focus_area: str               # exactly 1 item, always populated
```

---

### Backend — `backend/app/routers/recap.py`

Replace the entire 501 stub. The router path prefix is NOT set here — it is registered in
`main.py` without a prefix (the route itself is `/session/{session_id}/recap`).
Use `get_current_user` (returns `User` object) so ownership can be verified via `user.id`.

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.db import User, Session as SessionModel, SessionError, LearnerProfile, GrammarWeakness
from app.schemas.recap import RecapResponse, SessionErrorSchema
from app.services.mastery import MASTERY_WEAK_THRESHOLD

router = APIRouter(tags=["recap"])


@router.get("/session/{session_id}/recap", response_model=RecapResponse)
async def get_recap(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch session, verify ownership
    result = await db.execute(
        select(SessionModel).where(
            SessionModel.id == uuid.UUID(session_id),
            SessionModel.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Fetch errors for this session
    errors_result = await db.execute(
        select(SessionError).where(SessionError.session_id == uuid.UUID(session_id))
    )
    errors = errors_result.scalars().all()

    # Fetch learner profile + grammar weaknesses for strengths/focus
    profile_result = await db.execute(
        select(LearnerProfile).where(LearnerProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()

    weaknesses: list[GrammarWeakness] = []
    if profile is not None:
        w_result = await db.execute(
            select(GrammarWeakness).where(GrammarWeakness.profile_id == profile.id)
        )
        weaknesses = list(w_result.scalars().all())

    # Compute XP
    fluency = session.fluency_score or 0.5
    xp_earned = int(50 + fluency * 50) + (session.new_words_count or 0) * 10
    xp_earned = min(200, max(10, xp_earned))

    # Compute strengths (2 strongest grammar rules) and focus area (weakest rule)
    strengths = _compute_strengths(weaknesses)
    focus_area = _compute_focus(weaknesses)

    return RecapResponse(
        session_id=session_id,
        duration_seconds=session.duration_seconds,
        message_count=session.message_count or 0,
        errors_count=session.errors_count or 0,
        new_words_count=session.new_words_count or 0,
        fluency_score=round(fluency, 2),
        xp_earned=xp_earned,
        errors=[
            SessionErrorSchema(
                rule_code=e.error_type or "",
                rule_label=e.grammar_rule,
                user_text=e.user_text,
                correct_form=e.correct_form,
                was_corrected=e.was_corrected,
            )
            for e in errors
        ],
        strengths=strengths,
        focus_area=focus_area,
    )


def _compute_strengths(weaknesses: list[GrammarWeakness]) -> list[str]:
    """Return 2 strength labels. Falls back to static strings if not enough data."""
    strong = sorted(
        [w for w in weaknesses if w.mastery_score >= 0.7],
        key=lambda w: w.mastery_score,
        reverse=True,
    )
    result = [f"{w.rule_code} — {w.rule_label}" for w in strong[:2]]
    fallbacks = ["Ottimo ritmo conversazionale!", "Buona comprensione del vocabolario!"]
    while len(result) < 2:
        result.append(fallbacks[len(result)])
    return result


def _compute_focus(weaknesses: list[GrammarWeakness]) -> str:
    """Return the weakest grammar rule label, or a static fallback."""
    weak = sorted(weaknesses, key=lambda w: w.mastery_score)
    if weak:
        w = weak[0]
        return f"{w.rule_code} — {w.rule_label}"
    return "Continua a praticare il vocabolario!"
```

Register the recap router in `main.py` without a prefix (the route path already includes `/session/`):
```python
from app.routers.recap import router as recap_router
app.include_router(recap_router, prefix="/v1")
```

---

### Android — Domain model

**`domain/model/RecapData.kt`**

```kotlin
package com.wortschatz.domain.model

data class RecapError(
    val ruleCode: String,
    val ruleLabel: String?,
    val userText: String?,
    val correctForm: String?,
    val wasCorrected: Boolean,
)

data class RecapData(
    val sessionId: String,
    val durationSeconds: Int?,
    val messageCount: Int,
    val errorsCount: Int,
    val newWordsCount: Int,
    val fluencyScore: Float,
    val xpEarned: Int,
    val errors: List<RecapError>,
    val strengths: List<String>,      // always 2 items
    val focusArea: String,            // always 1 item
)
```

---

### Android — DTO

**`data/remote/dto/RecapDto.kt`**

```kotlin
package com.wortschatz.data.remote.dto

import com.google.gson.annotations.SerializedName
import com.wortschatz.domain.model.RecapData
import com.wortschatz.domain.model.RecapError

data class RecapErrorDto(
    @SerializedName("rule_code")    val ruleCode: String,
    @SerializedName("rule_label")   val ruleLabel: String?,
    @SerializedName("user_text")    val userText: String?,
    @SerializedName("correct_form") val correctForm: String?,
    @SerializedName("was_corrected") val wasCorrected: Boolean,
)

data class RecapResponseDto(
    @SerializedName("session_id")       val sessionId: String,
    @SerializedName("duration_seconds") val durationSeconds: Int?,
    @SerializedName("message_count")    val messageCount: Int,
    @SerializedName("errors_count")     val errorsCount: Int,
    @SerializedName("new_words_count")  val newWordsCount: Int,
    @SerializedName("fluency_score")    val fluencyScore: Float,
    @SerializedName("xp_earned")        val xpEarned: Int,
    @SerializedName("errors")           val errors: List<RecapErrorDto>,
    @SerializedName("strengths")        val strengths: List<String>,
    @SerializedName("focus_area")       val focusArea: String,
) {
    fun toDomain() = RecapData(
        sessionId = sessionId,
        durationSeconds = durationSeconds,
        messageCount = messageCount,
        errorsCount = errorsCount,
        newWordsCount = newWordsCount,
        fluencyScore = fluencyScore,
        xpEarned = xpEarned,
        errors = errors.map {
            RecapError(it.ruleCode, it.ruleLabel, it.userText, it.correctForm, it.wasCorrected)
        },
        strengths = strengths,
        focusArea = focusArea,
    )
}
```

---

### Android — Retrofit API

Add to `WortschatzApi.kt`:

```kotlin
@GET("session/{sessionId}/recap")
suspend fun getSessionRecap(@Path("sessionId") sessionId: String): RecapResponseDto
```

---

### Android — RecapRepository

**`data/repository/RecapRepository.kt`**
```kotlin
package com.wortschatz.data.repository

import com.wortschatz.domain.model.RecapData

interface RecapRepository {
    suspend fun getRecap(sessionId: String): Result<RecapData>
}
```

**`data/repository/RecapRepositoryImpl.kt`**
```kotlin
package com.wortschatz.data.repository

import com.wortschatz.data.remote.WortschatzApi
import com.wortschatz.domain.model.RecapData
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RecapRepositoryImpl @Inject constructor(
    private val api: WortschatzApi,
) : RecapRepository {
    override suspend fun getRecap(sessionId: String): Result<RecapData> = try {
        Result.success(api.getSessionRecap(sessionId).toDomain())
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

**`di/RecapModule.kt`**
```kotlin
package com.wortschatz.di

import com.wortschatz.data.repository.RecapRepository
import com.wortschatz.data.repository.RecapRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class RecapModule {
    @Binds
    abstract fun bindRecapRepository(impl: RecapRepositoryImpl): RecapRepository
}
```

---

### Android — RecapUiState

**`ui/recap/RecapUiState.kt`**

```kotlin
package com.wortschatz.ui.recap

import com.wortschatz.domain.model.RecapData

sealed class RecapUiState {
    object Loading : RecapUiState()
    data class Success(val recap: RecapData) : RecapUiState()
    data class Error(val message: String) : RecapUiState()
}
```

---

### Android — RecapViewModel

**`ui/recap/RecapViewModel.kt`**

Receives `sessionId` from `SavedStateHandle` — Hilt + Navigation automatically populate
this from the nav argument `{sessionId}`.

```kotlin
package com.wortschatz.ui.recap

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wortschatz.data.repository.RecapRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RecapViewModel @Inject constructor(
    private val recapRepository: RecapRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val sessionId: String = checkNotNull(savedStateHandle["sessionId"])

    private val _uiState = MutableStateFlow<RecapUiState>(RecapUiState.Loading)
    val uiState: StateFlow<RecapUiState> = _uiState.asStateFlow()

    init { loadRecap() }

    fun loadRecap() {
        viewModelScope.launch {
            _uiState.value = RecapUiState.Loading
            recapRepository.getRecap(sessionId)
                .onSuccess { _uiState.value = RecapUiState.Success(it) }
                .onFailure { _uiState.value = RecapUiState.Error(it.message ?: "Errore") }
        }
    }
}
```

---

### Android — RecapScreen

**`ui/recap/RecapScreen.kt`** — replace the existing stub entirely.

Split composable pattern (consistent with every other screen in this project):
`RecapScreen(onDone, viewModel)` wraps `RecapContent(uiState, onDone, onRetry)`.
Tests target `RecapContent` directly.

**Visual anatomy:**
```
┌──────────────────────────────────────────────────┐
│  TopAppBar: "Riepilogo"  (no back arrow needed — │
│  this is the final step; WORD_CARD is the dest.) │
├──────────────────────────────────────────────────┤
│  Background (#F5F2EB)                            │
│                                                  │
│  ── Loading state ──                             │
│  CircularProgressIndicator centred               │
│                                                  │
│  ── Error state ──                               │
│  Text(error message) + Button("Riprova")         │
│                                                  │
│  ── Success state ──                             │
│  LazyColumn (or scrollable Column):              │
│                                                  │
│  ╔══════════════════════════════════════════╗   │
│  ║  Card — Stats row                        ║   │
│  ║  [Fluidità]   [XP]      [Parole nuove]  ║   │
│  ║  XX%          XXX XP    X               ║   │
│  ╚══════════════════════════════════════════╝   │
│                                                  │
│  ╔══════════════════════════════════════════╗   │
│  ║  Card — Punti di forza                   ║   │
│  ║  ✓ [strength 1]                          ║   │
│  ║  ✓ [strength 2]                          ║   │
│  ╚══════════════════════════════════════════╝   │
│                                                  │
│  ╔══════════════════════════════════════════╗   │
│  ║  Card — Da migliorare                    ║   │
│  ║  → [focus_area]                          ║   │
│  ╚══════════════════════════════════════════╝   │
│                                                  │
│  ╔══════════════════════════════════════════╗   │  only if errors_count > 0
│  ║  Card — Errori grammaticali              ║   │
│  ║  per error row:                          ║   │
│  ║    rule_code (SectionLabelStyle, grey)   ║   │
│  ║    "user_text" → "correct_form"          ║   │
│  ║    [✓ Corretto] badge if was_corrected   ║   │
│  ╚══════════════════════════════════════════╝   │
│                                                  │
│  [Torna alla parola del giorno]  Primary button  │
│  full width, 56.dp, 14.dp corner                 │
└──────────────────────────────────────────────────┘
```

Implementation notes:
- Reuse `SCREEN_HORIZONTAL_PADDING`, `SECTION_SPACING`, `BUTTON_HEIGHT`, `BUTTON_CORNER_RADIUS` from `WordCardDimensions.kt`
- Stats card: three equal-weight `Column` items in a `Row`, each with a label above and value below; label uses `SectionLabelStyle` + `TextSecondary`, value uses `MeaningStyle` + `OnBackground`
- Fluency displayed as `"${(recap.fluencyScore * 100).toInt()}%"`
- XP displayed as `"${recap.xpEarned} XP"`
- New words displayed as `"${recap.newWordsCount}"`
- Strengths card: two `Row` items, each with `"✓"` prefix in `Primary` colour + text in `OnBackground`
- Focus area card: one `Row` with `"→"` prefix in `TextSecondary` + text
- Errors card hidden if `recap.errors.isEmpty()`
- Each error row: `rule_code` label, then `"${error.userText}" → "${error.correctForm}"`, and a small `Surface`-wrapped `Text("✓ Corretto", Primary)` badge if `error.wasCorrected`
- `contentDescription` on the fluency stat: `"Fluidità: ${percent}%"` — follow the accessibility pattern from TASK-004
- TopAppBar: `title = { Text(stringResource(R.string.recap_title)) }`, `navigationIcon = {}` (no back arrow — the bottom button is the only exit)

```kotlin
@Composable
fun RecapScreen(
    onDone: () -> Unit,
    viewModel: RecapViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    RecapContent(
        uiState = uiState,
        onDone = onDone,
        onRetry = viewModel::loadRecap,
    )
}

@Composable
fun RecapContent(
    uiState: RecapUiState,
    onDone: () -> Unit,
    onRetry: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.recap_title)) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background),
            )
        },
        containerColor = Background,
    ) { padding ->
        // Loading, Error, and Success states rendered inside padding
    }
}
```

---

### Android — ChatScreen changes

**`ui/chat/ChatScreen.kt`** — two changes only:

1. Add `onViewRecap: (sessionId: String) -> Unit` parameter to both `ChatScreen` and `ChatContent`.
2. In the `SessionEndBanner` inside `ChatContent`, replace the existing `TextButton` with:
   ```kotlin
   Button(
       onClick = { (uiState as? ChatUiState.Active)?.sessionId?.let(onViewRecap) },
       colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Primary),
   ) {
       Text(stringResource(R.string.chat_view_recap))
   }
   ```
   The banner background remains `Primary`. The button text changes from
   `R.string.chat_back_to_word` to `R.string.chat_view_recap`.

Do NOT touch any other part of `ChatScreen.kt`.

Updated `ChatScreen` signature:
```kotlin
@Composable
fun ChatScreen(
    onBack: () -> Unit,
    onViewRecap: (sessionId: String) -> Unit,  // NEW
    viewModel: ChatViewModel = hiltViewModel(),
)
```

Updated `ChatContent` signature:
```kotlin
@Composable
fun ChatContent(
    uiState: ChatUiState,
    onInputChanged: (String) -> Unit,
    onSend: () -> Unit,
    onBack: () -> Unit,
    onViewRecap: (sessionId: String) -> Unit,  // NEW
)
```

---

### Android — AppNavGraph changes

**`ui/navigation/AppNavGraph.kt`** — two changes:

1. CHAT composable: pass `onViewRecap` to `ChatScreen`.

```kotlin
composable(Routes.CHAT) {
    val viewModel: ChatViewModel = hiltViewModel()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState) {
        if (uiState is ChatUiState.NotPro) {
            navController.navigate(Routes.PAYWALL) {
                popUpTo(Routes.CHAT) { inclusive = true }
            }
        }
    }

    ChatScreen(
        onBack = {
            navController.navigate(Routes.WORD_CARD) {
                popUpTo(Routes.CHAT) { inclusive = true }
            }
        },
        onViewRecap = { sessionId ->           // NEW
            navController.navigate(Routes.recap(sessionId)) {
                popUpTo(Routes.CHAT) { inclusive = true }
            }
        },
        viewModel = viewModel,
    )
}
```

2. RECAP composable: replace the stub `composable(Routes.RECAP) { RecapScreen() }` with:

```kotlin
import androidx.navigation.NavType
import androidx.navigation.navArgument

composable(
    route = Routes.RECAP,
    arguments = listOf(navArgument("sessionId") { type = NavType.StringType }),
) {
    RecapScreen(
        onDone = {
            navController.navigate(Routes.WORD_CARD) {
                popUpTo(Routes.RECAP) { inclusive = true }
            }
        }
    )
}
```

`Routes.RECAP = "recap/{sessionId}"` and `fun recap(sessionId: String) = "recap/$sessionId"`
already exist in the `Routes` object — do NOT change them.

---

### Strings — `res/values/strings.xml`

Add these entries. Do NOT remove or modify existing strings.

```xml
<!-- Recap screen -->
<string name="recap_title">Riepilogo</string>
<string name="recap_stat_fluency">Fluidità</string>
<string name="recap_stat_xp">XP</string>
<string name="recap_stat_words">Parole nuove</string>
<string name="recap_section_strengths">Punti di forza</string>
<string name="recap_section_focus">Da migliorare</string>
<string name="recap_section_errors">Errori grammaticali</string>
<string name="recap_error_corrected">✓ Corretto</string>
<string name="recap_done">Torna alla parola del giorno</string>
<string name="recap_error_load">Impossibile caricare il riepilogo</string>
<string name="recap_retry">Riprova</string>

<!-- Chat — updated banner CTA -->
<string name="chat_view_recap">Vedi il riepilogo</string>

<!-- Accessibility -->
<string name="cd_recap_fluency">Fluidità: %d percento</string>
<string name="cd_recap_xp">XP guadagnati: %d</string>
<string name="cd_recap_words">Parole nuove usate: %d</string>
```

---

## API Contract

```
GET /v1/session/{session_id}/recap
Authorization: Bearer <firebase_jwt>

Response 200:
{
  "session_id": "uuid",
  "duration_seconds": 183,
  "message_count": 10,
  "errors_count": 2,
  "new_words_count": 1,
  "fluency_score": 0.71,
  "xp_earned": 96,
  "errors": [
    {
      "rule_code": "ACCUSATIVE_MASC",
      "rule_label": "Masculine accusative case",
      "user_text": "ich sehe den Mann",
      "correct_form": "Ich sehe den Mann.",
      "was_corrected": true
    }
  ],
  "strengths": [
    "VERB_CONJ_REGULAR — Regular verb conjugation",
    "Ottimo ritmo conversazionale!"
  ],
  "focus_area": "DATIV_PREP — Dative preposition case"
}

Response 404:
{ "detail": "Session not found" }
```

---

## Tests

### Backend — `backend/tests/test_error_classifier.py`

- `test_classify_writes_session_errors` — create in-memory session row, mock `claude.complete`
  to return valid classifier JSON with one error, call `classify_user_message`, assert
  one `SessionError` row committed to test DB (use `httpx.AsyncClient` + `TestClient` or
  direct async session with sqlite). Assert `session.errors_count == 1`.

- `test_classify_updates_grammar_weaknesses` — same setup, assert a `GrammarWeakness` row
  is created for the error's rule_code. Call a second time with the same rule_code; assert
  `error_count == 2` and `mastery_score` decreased.

Use `unittest.mock.AsyncMock` to patch `claude.complete`. Use an in-memory SQLite async
session (already used in TASK-003 tests) — do NOT call the real API.

### Backend — `backend/tests/test_recap_router.py`

- `test_get_recap_returns_200` — create session row with `fluency_score=0.8`, `errors_count=1`,
  `new_words_count=2`; create one `SessionError` row; call `GET /session/{id}/recap` with
  auth override → 200. Assert `fluency_score == 0.8`, `xp_earned == 90`,
  `len(response["errors"]) == 1`, `len(response["strengths"]) == 2`,
  `response["focus_area"]` is a non-empty string.

- `test_get_recap_returns_404_for_wrong_user` — create session belonging to user A, call
  the endpoint authenticated as user B → 404.

- `test_get_recap_404_unknown_session` — call with a random UUID → 404.

Use `app.dependency_overrides` to bypass Firebase auth (same pattern as TASK-003).

### Android — `RecapViewModelTest.kt` (unit test, no Android)

- `test_initial_state_is_loading` — state is `RecapUiState.Loading` immediately after
  ViewModel creation (before coroutines run with `StandardTestDispatcher`).

- `test_success_state_after_recap_loaded` — `FakeRecapRepository.getRecap()` returns
  `Result.success(fakeRecapData)`. After `advanceUntilIdle()`, assert state is
  `RecapUiState.Success` and `recap.xpEarned == fakeRecapData.xpEarned`.

- `test_error_state_on_failure` — `FakeRecapRepository.getRecap()` returns
  `Result.failure(RuntimeException("network error"))`. After `advanceUntilIdle()`, assert
  state is `RecapUiState.Error`.

Use `StandardTestDispatcher`. Create a `FakeRecapRepository` inner class. Provide
`sessionId` via a fake `SavedStateHandle`: `SavedStateHandle(mapOf("sessionId" to "test-session-id"))`.

### Android — `RecapScreenTest.kt` (instrumented Compose test)

- `testRecapSuccessDisplaysStats` — render `RecapContent` with `RecapUiState.Success`
  containing `fluencyScore=0.72f`, `xpEarned=87`, `newWordsCount=2`. Assert text `"72%"`,
  `"87 XP"`, and `"2"` are each displayed.

- `testRecapDoneButtonCallsCallback` — render `RecapContent` with Success state. Tap
  `stringResource(R.string.recap_done)`. Assert the `onDone` callback lambda was invoked.

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] All 8 specified tests written and green
- [ ] `./gradlew assembleDebug` passes with no errors
- [ ] `POST /session/message` verified not to block on classifier (SSE stream starts immediately)
- [ ] RecapScreen shows correct stats after a real session on device/emulator
- [ ] Zero hardcoded Italian strings in Kotlin files
- [ ] No API keys or secrets in code
- [ ] Conventional commit: `feat(TASK-006): recap screen, error classifier, GET /session/{id}/recap`
- [ ] TASK status updated to `done`
