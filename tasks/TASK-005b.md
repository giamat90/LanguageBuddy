# TASK-005b — Chat Screen + SSE Streaming

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-005a (must be merged first — provides `is_pro` DataStore gate)

---

## Context

This task delivers the Pro feature that justifies the subscription: a grammar-focused chat
session with Lena, the AI tutor. Every session is anchored to today's word. Lena steers
the conversation so the learner naturally uses that word, corrects errors in-line, and
delivers a short recap at message 10.

The backend serves three session endpoints: `POST /session/start`, `POST /session/message`
(SSE streaming), and `POST /session/end`. The Android client connects the `ChatScreen` to
these endpoints via a dedicated `SseClient` and `ChatViewModel`.

Chat access is gated: if `is_pro == false` in DataStore, the nav graph redirects to
`Routes.PAYWALL` before ChatScreen can load.

Recap screen (GET /session/{id}/recap, RecapScreen) is TASK-006 — out of scope here.

---

## Scope

### In scope
- Backend: `POST /session/start`, `POST /session/message` (SSE), `POST /session/end`
- Backend: `backend/app/services/session_service.py` — session CRUD + prompt assembly
- Backend: `backend/app/services/prompt_builder.py` — assemble `SESSION_SYSTEM_PROMPT`
- Backend: add `stream_chat` method to `backend/app/core/claude.py`
- Android: `SseClient.kt` — OkHttp EventSource wrapper
- Android: `ChatUiState.kt`, `ChatViewModel.kt`, `ChatScreen.kt`, `MessageBubble.kt`
- Android: `di/ChatModule.kt` — Hilt bindings for session repo
- Android: `data/repository/SessionRepository.kt` + `SessionRepositoryImpl.kt`
- Android: `WortschatzApi.kt` — add session start + end endpoints (message is SSE, not Retrofit)
- Navigation: `Routes.CHAT` wired in `AppNavGraph.kt` with `is_pro` guard
- Navigation: WordCardScreen "Pratica con Lena" button appears only in `SaveState.Saved` + is_pro
- Strings: all Italian strings in `strings.xml`
- Tests: 3 backend + 3 Android

### Out of scope
- RecapScreen and GET /session/{id}/recap (TASK-006)
- Async error classifier (TASK-006 — runs post-session)
- SRS updates (TASK-006)
- Session history list
- Reconnection / resuming interrupted sessions

---

## Acceptance Criteria

- [ ] Tapping "Pratica con Lena" on the saved WordCard navigates to `ChatScreen`
  (button only visible when `saveState == SaveState.Saved` AND `isPro == true` in DataStore)
- [ ] If user reaches ChatScreen route but `isPro == false`, nav redirects to `Routes.PAYWALL`
- [ ] `POST /session/start` returns a `session_id`; ChatScreen opens the SSE stream
- [ ] Bot's first message appears within 3 seconds on a normal connection
- [ ] SSE tokens render incrementally — each token appends to the streaming bot message in real time
- [ ] User can type a message and tap Send; user bubble appears immediately; bot streams reply
- [ ] Send button and text field are disabled while a bot reply is streaming
- [ ] At message 10 (5 user + 5 bot OR however Lena counts to 10 per the prompt), `POST /session/end`
  is called automatically; a "Sessione completata!" banner appears; chat input is locked
- [ ] Backend returns 403 if session belongs to a non-Pro user
- [ ] All strings are in `strings.xml` — zero hardcoded Italian strings
- [ ] All specified tests pass

---

## Technical Spec

### Files to create
```
android/app/src/main/java/com/wortschatz/network/SseClient.kt
android/app/src/main/java/com/wortschatz/domain/model/ChatMessage.kt
android/app/src/main/java/com/wortschatz/domain/model/SessionInfo.kt
android/app/src/main/java/com/wortschatz/data/repository/SessionRepository.kt
android/app/src/main/java/com/wortschatz/data/repository/SessionRepositoryImpl.kt
android/app/src/main/java/com/wortschatz/data/remote/dto/SessionDto.kt
android/app/src/main/java/com/wortschatz/di/ChatModule.kt
android/app/src/main/java/com/wortschatz/ui/chat/ChatUiState.kt
android/app/src/main/java/com/wortschatz/ui/chat/ChatViewModel.kt
android/app/src/main/java/com/wortschatz/ui/chat/ChatScreen.kt
android/app/src/main/java/com/wortschatz/ui/chat/components/MessageBubble.kt
android/app/src/test/java/com/wortschatz/ui/chat/ChatViewModelTest.kt
android/app/src/androidTest/java/com/wortschatz/ui/chat/ChatScreenTest.kt
backend/app/routers/session.py
backend/app/services/session_service.py
backend/app/services/prompt_builder.py
backend/app/schemas/session.py
backend/tests/test_session_router.py
```

### Files to modify
```
android/app/src/main/java/com/wortschatz/data/remote/WortschatzApi.kt        — add session/start, session/end
android/app/src/main/java/com/wortschatz/ui/word/WordCardScreen.kt            — add "Pratica con Lena" button
android/app/src/main/java/com/wortschatz/ui/word/WordViewModel.kt             — expose isPro from DataStore
android/app/src/main/java/com/wortschatz/ui/navigation/AppNavGraph.kt         — add CHAT route with guard
android/app/src/main/res/values/strings.xml                                   — chat strings
backend/app/main.py                                                            — include session router
backend/app/core/claude.py                                                     — add stream_chat method
```

---

### Backend — `backend/app/core/claude.py`

Add a streaming method. Keep any existing `complete()` method untouched.

```python
from anthropic import AsyncAnthropic
from app.core.config import settings
from typing import AsyncIterator

_client: AsyncAnthropic | None = None

def get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client

async def stream_chat(
    messages: list[dict],
    system: str,
    max_tokens: int = 512,
) -> AsyncIterator[str]:
    """Yields text tokens from Claude claude-haiku-4-5-20251001 as they arrive."""
    async with get_client().messages.stream(
        model="claude-haiku-4-5-20251001",
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
```

---

### Backend — `backend/app/services/prompt_builder.py`

Implements `build_session_system_prompt`. Uses `SESSION_SYSTEM_PROMPT` template verbatim
from CLAUDE.md §6. Imports `compute_difficulty` from CLAUDE.md §7 logic.

```python
from app.models.db import LearnerProfile, DailyItem, GrammarWeakness
from app.core.prompts import SESSION_SYSTEM_PROMPT   # define constant here

MASTERY_WEAK_THRESHOLD = 0.6


def compute_difficulty(recent_fluency_scores: list[float]) -> str:
    if not recent_fluency_scores:
        return "steady"
    avg = sum(recent_fluency_scores[-3:]) / len(recent_fluency_scores[-3:])
    if avg >= 0.80:
        return "challenging"
    elif avg >= 0.60:
        return "steady"
    else:
        return "supportive"


def build_session_system_prompt(
    profile: LearnerProfile,
    daily_item: DailyItem,
    weaknesses: list[GrammarWeakness],
    recent_fluency_scores: list[float],
    review_words: list[str],
) -> str:
    weak_rules = [
        f"{w.rule_code} ({w.rule_label})"
        for w in weaknesses
        if w.mastery_score < MASTERY_WEAK_THRESHOLD
    ]
    grammar_label = next(
        (w.rule_label for w in weaknesses if w.rule_code == daily_item.grammar_angle),
        daily_item.grammar_angle or "",
    )
    difficulty = compute_difficulty(recent_fluency_scores)

    return SESSION_SYSTEM_PROMPT.format(
        cefr_level=profile.cefr_level,
        weak_rules=", ".join(weak_rules) if weak_rules else "Nessuna (ancora)",
        word=daily_item.word,
        meaning_it=daily_item.meaning_it or "",
        scenario=daily_item.session_scenario or "Conversazione libera",
        grammar_angle=daily_item.grammar_angle or "",
        grammar_label=grammar_label,
        review_words=", ".join(review_words) if review_words else "—",
        difficulty=difficulty,
    )
```

Move prompt constants to `backend/app/core/prompts.py` (create file if not already present):
```python
SESSION_SYSTEM_PROMPT = """..."""  # paste verbatim from CLAUDE.md §6
```

---

### Backend — `backend/app/services/session_service.py`

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.db import Session as SessionModel, DailyItem, LearnerProfile, GrammarWeakness
from app.services.prompt_builder import build_session_system_prompt

async def start_session(user_id: str, db: AsyncSession) -> dict:
    """Creates session row, returns session_id + assembled system prompt."""
    # Fetch today's daily item
    result = await db.execute(
        select(DailyItem)
        .where(DailyItem.user_id == user_id)
        .order_by(DailyItem.date.desc())
        .limit(1)
    )
    daily_item = result.scalar_one_or_none()
    if daily_item is None:
        raise ValueError("No daily item for user")

    # Fetch profile and weaknesses
    profile_result = await db.execute(
        select(LearnerProfile).where(LearnerProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile is None:
        raise ValueError("No learner profile for user")

    weaknesses_result = await db.execute(
        select(GrammarWeakness).where(GrammarWeakness.profile_id == profile.id)
    )
    weaknesses = weaknesses_result.scalars().all()

    system_prompt = build_session_system_prompt(
        profile=profile,
        daily_item=daily_item,
        weaknesses=list(weaknesses),
        recent_fluency_scores=[],   # populated by future SRS task
        review_words=[],
    )

    session = SessionModel(
        id=str(uuid.uuid4()),
        user_id=user_id,
        daily_item_id=daily_item.id,
        topic=daily_item.session_scenario,
        cefr_level_at_start=profile.cefr_level,
        llm_system_prompt={"system": system_prompt},
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return {"session_id": session.id, "word": daily_item.word}


async def end_session(session_id: str, user_id: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(SessionModel)
        .where(SessionModel.id == session_id, SessionModel.user_id == user_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise ValueError("Session not found")
    session.ended_at = datetime.now(timezone.utc)
    if session.started_at:
        delta = session.ended_at - session.started_at
        session.duration_seconds = int(delta.total_seconds())
    await db.commit()
```

---

### Backend — `backend/app/routers/session.py`

```python
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.auth import get_current_user
from app.core.db import get_db
from app.core import claude
from app.models.db import User, Session as SessionModel
from app.services.session_service import start_session, end_session
from app.schemas.session import (
    SessionStartResponse, SessionMessageRequest, SessionEndRequest
)

router = APIRouter(prefix="/session", tags=["session"])


@router.post("/start", response_model=SessionStartResponse)
async def session_start(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_pro:
        raise HTTPException(status_code=403, detail="Pro subscription required")
    try:
        result = await start_session(str(current_user.id), db)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return SessionStartResponse(**result)


@router.post("/message")
async def session_message(
    body: SessionMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_pro:
        raise HTTPException(status_code=403, detail="Pro subscription required")

    # Fetch session + system prompt
    result = await db.execute(
        select(SessionModel).where(
            SessionModel.id == body.session_id,
            SessionModel.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    system = session.llm_system_prompt.get("system", "")

    # Build messages list: reconstruct from session or pass full history from client.
    # v1.0 simplification: client sends full message history in body.messages.
    messages = body.messages  # list of {"role": "user"|"assistant", "content": "..."}

    # Increment message count
    session.message_count = (session.message_count or 0) + 1
    await db.commit()

    async def event_generator():
        message_id = str(uuid.uuid4())
        async for token in claude.stream_chat(messages, system):
            data = json.dumps({"type": "token", "content": token})
            yield f"data: {data}\n\n"
        data = json.dumps({"type": "done", "message_id": message_id})
        yield f"data: {data}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/end")
async def session_end(
    body: SessionEndRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await end_session(body.session_id, str(current_user.id), db)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}
```

### Backend — `backend/app/schemas/session.py`

```python
from pydantic import BaseModel

class SessionStartResponse(BaseModel):
    session_id: str
    word: str

class SessionMessage(BaseModel):
    role: str     # "user" | "assistant"
    content: str

class SessionMessageRequest(BaseModel):
    session_id: str
    message: str
    messages: list[SessionMessage]   # full history including new user message

class SessionEndRequest(BaseModel):
    session_id: str
```

Register in `main.py`:
```python
from app.routers.session import router as session_router
app.include_router(session_router, prefix="/v1")
```

---

### Android — Domain models

**`domain/model/ChatMessage.kt`**
```kotlin
data class ChatMessage(
    val id: String = java.util.UUID.randomUUID().toString(),
    val role: Role,
    val content: String,
    val isStreaming: Boolean = false,   // true while SSE tokens are arriving
) {
    enum class Role { User, Bot }
}
```

**`domain/model/SessionInfo.kt`**
```kotlin
data class SessionInfo(val sessionId: String, val word: String)
```

---

### Android — DTOs

**`data/remote/dto/SessionDto.kt`**
```kotlin
data class StartSessionResponse(
    @SerializedName("session_id") val sessionId: String,
    @SerializedName("word")       val word: String,
)
```

Add to `WortschatzApi.kt`:
```kotlin
@POST("session/start")
suspend fun startSession(): StartSessionResponse

@POST("session/end")
suspend fun endSession(@Body body: EndSessionRequest): okhttp3.ResponseBody

data class EndSessionRequest(@SerializedName("session_id") val sessionId: String)
```

---

### Android — SseClient

**`network/SseClient.kt`**

Wraps OkHttp `EventSource`. Inject `OkHttpClient` from Hilt (already provided by
`NetworkModule`). Use `okhttp3-sse` artifact (add to `build.gradle.kts` if not present).

```kotlin
@Singleton
class SseClient @Inject constructor(private val okHttpClient: OkHttpClient) {

    private var activeSource: EventSource? = null

    fun streamMessage(
        sessionId: String,
        messages: List<ChatMessage>,
        onToken: (String) -> Unit,
        onDone: (messageId: String) -> Unit,
        onError: (Throwable) -> Unit,
    ) {
        cancel()  // cancel any in-flight stream

        val body = buildRequestBody(sessionId, messages)
        val request = Request.Builder()
            .url("${BuildConfig.API_BASE_URL}v1/session/message")
            .post(body)
            .build()

        val listener = object : EventSourceListener() {
            override fun onEvent(source: EventSource, id: String?, type: String?, data: String) {
                try {
                    val event = JSONObject(data)
                    when (event.getString("type")) {
                        "token" -> onToken(event.getString("content"))
                        "done"  -> onDone(event.getString("message_id"))
                    }
                } catch (e: Exception) { onError(e) }
            }
            override fun onFailure(source: EventSource, t: Throwable?, response: okhttp3.Response?) {
                onError(t ?: IOException("SSE stream failed: ${response?.code}"))
            }
        }

        activeSource = EventSources.createFactory(okHttpClient)
            .newEventSource(request, listener)
    }

    fun cancel() { activeSource?.cancel(); activeSource = null }

    private fun buildRequestBody(sessionId: String, messages: List<ChatMessage>): RequestBody {
        val json = JSONObject().apply {
            put("session_id", sessionId)
            put("message", messages.last { it.role == ChatMessage.Role.User }.content)
            put("messages", JSONArray(messages.map { msg ->
                JSONObject().apply {
                    put("role", if (msg.role == ChatMessage.Role.User) "user" else "assistant")
                    put("content", msg.content)
                }
            }))
        }
        return json.toString().toRequestBody("application/json".toMediaType())
    }
}
```

Add to `build.gradle.kts` if not present:
```kotlin
implementation("com.squareup.okhttp3:okhttp-sse:4.12.0")
```

Use the same OkHttp version already in the project.

---

### Android — SessionRepository

**`data/repository/SessionRepository.kt`**
```kotlin
interface SessionRepository {
    suspend fun startSession(): Result<SessionInfo>
    suspend fun endSession(sessionId: String): Result<Unit>
}
```

**`data/repository/SessionRepositoryImpl.kt`**
```kotlin
@Singleton
class SessionRepositoryImpl @Inject constructor(
    private val api: WortschatzApi,
) : SessionRepository {

    override suspend fun startSession(): Result<SessionInfo> = try {
        val dto = api.startSession()
        Result.success(SessionInfo(dto.sessionId, dto.word))
    } catch (e: Exception) { Result.failure(e) }

    override suspend fun endSession(sessionId: String): Result<Unit> = try {
        api.endSession(EndSessionRequest(sessionId))
        Result.success(Unit)
    } catch (e: Exception) { Result.failure(e) }
}
```

**`di/ChatModule.kt`**
```kotlin
@Module
@InstallIn(SingletonComponent::class)
abstract class ChatModule {
    @Binds
    abstract fun bindSessionRepository(impl: SessionRepositoryImpl): SessionRepository
}
```

---

### Android — ChatUiState

**`ui/chat/ChatUiState.kt`**
```kotlin
sealed class ChatUiState {
    object Loading : ChatUiState()           // starting session
    data class Active(
        val sessionId: String,
        val word: String,
        val messages: List<ChatMessage>,
        val inputText: String,
        val isStreaming: Boolean,
        val messageCount: Int,               // total messages sent (user + bot)
        val isSessionEnded: Boolean,
    ) : ChatUiState()
    data class Error(val message: String) : ChatUiState()
}
```

---

### Android — ChatViewModel

**`ui/chat/ChatViewModel.kt`**

```kotlin
const val SESSION_MESSAGE_LIMIT = 10

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val sessionRepository: SessionRepository,
    private val sseClient: SseClient,
) : ViewModel() {

    private val _uiState = MutableStateFlow<ChatUiState>(ChatUiState.Loading)
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    init { startSession() }

    private fun startSession() {
        viewModelScope.launch {
            sessionRepository.startSession()
                .onSuccess { info ->
                    _uiState.value = ChatUiState.Active(
                        sessionId = info.sessionId,
                        word = info.word,
                        messages = emptyList(),
                        inputText = "",
                        isStreaming = false,
                        messageCount = 0,
                        isSessionEnded = false,
                    )
                    // Lena opens: stream the first bot message with empty history
                    streamBotReply(info.sessionId, emptyList())
                }
                .onFailure { e ->
                    _uiState.value = ChatUiState.Error(e.message ?: "Errore di rete")
                }
        }
    }

    fun onInputChanged(text: String) {
        val current = _uiState.value as? ChatUiState.Active ?: return
        _uiState.value = current.copy(inputText = text)
    }

    fun sendMessage() {
        val current = _uiState.value as? ChatUiState.Active ?: return
        if (current.isStreaming || current.isSessionEnded || current.inputText.isBlank()) return

        val userMessage = ChatMessage(role = ChatMessage.Role.User, content = current.inputText.trim())
        val updatedMessages = current.messages + userMessage
        val newCount = current.messageCount + 1

        _uiState.value = current.copy(
            messages = updatedMessages,
            inputText = "",
            messageCount = newCount,
        )

        streamBotReply(current.sessionId, updatedMessages)
    }

    private fun streamBotReply(sessionId: String, history: List<ChatMessage>) {
        val current = _uiState.value as? ChatUiState.Active ?: return

        // Add empty streaming bot message placeholder
        val botPlaceholder = ChatMessage(role = ChatMessage.Role.Bot, content = "", isStreaming = true)
        _uiState.value = current.copy(
            messages = history + botPlaceholder,
            isStreaming = true,
        )

        sseClient.streamMessage(
            sessionId = sessionId,
            messages = history,
            onToken = { token -> appendToken(token) },
            onDone = { _ -> onStreamDone(sessionId) },
            onError = { e ->
                val state = _uiState.value as? ChatUiState.Active ?: return@streamMessage
                _uiState.value = state.copy(isStreaming = false)
            },
        )
    }

    private fun appendToken(token: String) {
        val current = _uiState.value as? ChatUiState.Active ?: return
        val messages = current.messages.toMutableList()
        val lastIndex = messages.indexOfLast { it.isStreaming }
        if (lastIndex < 0) return
        messages[lastIndex] = messages[lastIndex].copy(content = messages[lastIndex].content + token)
        _uiState.value = current.copy(messages = messages)
    }

    private fun onStreamDone(sessionId: String) {
        val current = _uiState.value as? ChatUiState.Active ?: return
        val messages = current.messages.map { if (it.isStreaming) it.copy(isStreaming = false) else it }
        val newCount = current.messageCount + 1  // count bot reply

        val isEnded = newCount >= SESSION_MESSAGE_LIMIT
        _uiState.value = current.copy(
            messages = messages,
            isStreaming = false,
            messageCount = newCount,
            isSessionEnded = isEnded,
        )

        if (isEnded) {
            viewModelScope.launch { sessionRepository.endSession(sessionId) }
        }
    }

    override fun onCleared() {
        super.onCleared()
        sseClient.cancel()
    }
}
```

---

### Android — MessageBubble

**`ui/chat/components/MessageBubble.kt`**

```kotlin
@Composable
fun MessageBubble(message: ChatMessage, modifier: Modifier = Modifier) {
    val isUser = message.role == ChatMessage.Role.User
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .background(
                    color = if (isUser) Primary else CardSectionBg,
                    shape = RoundedCornerShape(
                        topStart = 16.dp, topEnd = 16.dp,
                        bottomEnd = if (isUser) 4.dp else 16.dp,
                        bottomStart = if (isUser) 16.dp else 4.dp,
                    ),
                )
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            if (message.isStreaming && message.content.isEmpty()) {
                // Show "..." while waiting for first token
                Text(
                    text = "...",
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (isUser) Color.White else OnBackground,
                )
            } else {
                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (isUser) Color.White else OnBackground,
                )
            }
        }
    }
}
```

---

### Android — ChatScreen

**Visual anatomy:**
```
┌──────────────────────────────────────────────────┐
│  TopAppBar                                        │
│  "Lena"              [Badge: word of day]         │
├──────────────────────────────────────────────────┤
│  LazyColumn (messages, reverseLayout = false)    │
│  + 8.dp spacing between bubbles                  │
│  Scroll to bottom on new message                 │
│                                                  │
│  [SessionEndBanner — visible if isSessionEnded]  │
│   "Sessione completata! 🎉"                       │  Primary background, white text
│   [Torna alla parola del giorno — TextButton]     │
├──────────────────────────────────────────────────┤
│  Row (visible if !isSessionEnded):               │
│  [TextField "Scrivi in tedesco…"  flex] [Send]   │
│  TextField + Send disabled while isStreaming     │
└──────────────────────────────────────────────────┘
```

Split composable: `ChatScreen(viewModel = hiltViewModel())` wraps
`ChatContent(uiState, onInputChanged, onSend, onBack)`. Tests hit `ChatContent` directly.

```kotlin
@Composable
fun ChatScreen(
    onBack: () -> Unit,
    viewModel: ChatViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    ChatContent(
        uiState = uiState,
        onInputChanged = viewModel::onInputChanged,
        onSend = viewModel::sendMessage,
        onBack = onBack,
    )
}
```

`TopAppBar`: title = `"Lena"`, navigationIcon = back arrow calling `onBack`.
`actions`: `Surface`-background badge showing `word` (the anchor word from `SessionInfo`).
Colors: `TopAppBarDefaults.topAppBarColors(containerColor = Background)`.

Session end banner: when `isSessionEnded == true`, show a full-width `Box` with
`background(Primary)`, centred `Column` with white text "Sessione completata! 🎉" and a
`TextButton(color=White)` "Torna alla parola del giorno" that calls `onBack()`.

LazyColumn: `Modifier.weight(1f)`, items = `messages`, key = `{ it.id }`.
Auto-scroll: use `LaunchedEffect(messages.size) { listState.animateScrollToItem(messages.size) }`.

---

### Android — Navigation changes

Add to `AppNavGraph.kt`:

```kotlin
composable(Routes.CHAT) {
    // is_pro guard: if not pro, redirect to paywall
    val dataStore = LocalContext.current.dataStore   // or inject via CompositionLocal
    val isPro by remember {
        dataStore.data.map { it[PreferencesKeys.IS_PRO_KEY] ?: false }
    }.collectAsState(initial = false)

    LaunchedEffect(isPro) {
        if (!isPro) navController.navigate(Routes.PAYWALL) {
            popUpTo(Routes.CHAT) { inclusive = true }
        }
    }

    if (isPro) {
        ChatScreen(onBack = { navController.navigate(Routes.WORD_CARD) {
            popUpTo(Routes.CHAT) { inclusive = true }
        }})
    }
}
```

**`WordCardScreen.kt`**: add a "Pratica con Lena" button below `SaveButton` in the
`WordUiState.Success` layout, visible only when `saveState == SaveState.Saved` AND
`isPro == true`. If `isPro == false` while `saveState == Saved`, hide the button (the
paywall already showed after save via `onSaveSuccess`).

`WordViewModel` must expose `isPro` by reading `PreferencesKeys.IS_PRO_KEY` from DataStore
in `loadTodayWord()` and including it in `WordUiState.Success`:

```kotlin
data class Success(
    val word: DailyWord,
    val saveState: SaveState,
    val streakDays: Int,
    val isPro: Boolean,   // NEW — read from DataStore
) : WordUiState()
```

Add to `WordViewModel.loadTodayWord()`:
```kotlin
val isPro = dataStore.data.map { it[PreferencesKeys.IS_PRO_KEY] ?: false }.first()
// include in WordUiState.Success(... isPro = isPro)
```

`WordViewModel` already injects `WordRepositoryImpl` which has `dataStore`. Access it
directly: `wordRepository.dataStore` is not exposed — instead inject `DataStore<Preferences>`
directly into `WordViewModel` alongside `wordRepository`.

Updated `WordViewModel` constructor:
```kotlin
@HiltViewModel
class WordViewModel @Inject constructor(
    private val wordRepository: WordRepositoryImpl,
    private val dataStore: DataStore<Preferences>,
) : ViewModel()
```

---

### Strings — `res/values/strings.xml`

```xml
<!-- Chat screen -->
<string name="chat_title">Lena</string>
<string name="chat_input_hint">Scrivi in tedesco…</string>
<string name="chat_send">Invia</string>
<string name="chat_session_ended">Sessione completata! 🎉</string>
<string name="chat_back_to_word">Torna alla parola del giorno</string>
<string name="chat_error_start">Impossibile avviare la sessione</string>
<string name="chat_word_badge_cd">Parola del giorno: %s</string>
<!-- WordCard — new button -->
<string name="word_card_practice">Pratica con Lena</string>
```

---

## API Contract

```
POST /v1/session/start
Authorization: Bearer <firebase_jwt>

Response 200:
{ "session_id": "uuid", "word": "Schlüssel" }

Response 403:
{ "detail": "Pro subscription required" }

---

POST /v1/session/message
Authorization: Bearer <firebase_jwt>
Content-Type: application/json

Body:
{
  "session_id": "uuid",
  "message": "Ich habe den Schlüssel verloren.",
  "messages": [
    {"role": "assistant", "content": "Hallo! Lass uns über ..."},
    {"role": "user",      "content": "Ich habe den Schlüssel verloren."}
  ]
}

Response: text/event-stream
data: {"type": "token", "content": "Oh nein!"}
data: {"type": "token", "content": " Das ist"}
data: {"type": "done",  "message_id": "uuid"}

---

POST /v1/session/end
Authorization: Bearer <firebase_jwt>

Body: { "session_id": "uuid" }
Response 200: { "ok": true }
```

---

## Tests

### Backend — `test_session_router.py`

- `test_session_start_creates_row` — mock `start_session` service, call `POST /session/start`
  with auth override → 200, response contains `session_id` and `word`.

- `test_session_message_streams_sse` — mock `claude.stream_chat` to yield `["Hallo", " Welt"]`.
  Call `POST /session/message`. Read StreamingResponse body, assert contains
  `data: {"type": "token", "content": "Hallo"}` and `data: {"type": "done"`.

- `test_session_start_returns_403_for_free_user` — auth override returns a user with
  `is_pro = False`. Call `POST /session/start` → 403.

Use `app.dependency_overrides` to bypass Firebase auth. Patch `claude.stream_chat` with an
async generator that yields two tokens.

### Android — `ChatViewModelTest.kt` (unit test, no Android)

- `test_initial_state_is_loading` — state is `ChatUiState.Loading` immediately after
  ViewModel creation (before coroutines run).

- `test_send_message_appends_user_bubble` — fake `SessionRepository.startSession()` succeeds;
  after `advanceUntilIdle()`, state is `Active`. Call `onInputChanged("Hallo")` then
  `sendMessage()`. Assert messages contains a user message with content `"Hallo"`.

- `test_session_ends_at_limit` — fake `SseClient` that immediately calls `onDone`.
  Drive 5 round trips (sendMessage + SseClient fires onDone) to reach
  `messageCount >= SESSION_MESSAGE_LIMIT`. Assert `isSessionEnded == true` and
  `sessionRepository.endSession` was called once.

Use `StandardTestDispatcher` + `advanceUntilIdle()`. Create a `FakeSessionRepository` inner
class. Create a `FakeSseClient` inner class that immediately invokes `onDone` in tests.

### Android — `ChatScreenTest.kt` (instrumented Compose test)

- `testChatScreenShowsMessages` — render `ChatContent` with `ChatUiState.Active` containing
  two messages (one user, one bot). Assert both message contents are displayed.

- `testSendButtonDisabledWhileStreaming` — render `ChatContent` with `isStreaming = true`.
  Assert the send `IconButton` has `enabled = false` (use `assertIsNotEnabled()`).

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] All 6 specified tests written and green
- [ ] `./gradlew assembleDebug` passes with no errors
- [ ] SSE tokens visually append in real time (manually verified on device)
- [ ] Session end banner appears at message 10 and locks input
- [ ] Chat is inaccessible to free users (redirects to PaywallScreen)
- [ ] Zero hardcoded Italian strings in Kotlin files
- [ ] No API keys or secrets in code
- [ ] Conventional commit: `feat(TASK-005b): chat screen with SSE streaming and session backend`
- [ ] TASK status updated to `done`
