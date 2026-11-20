# TASK-001 — Project Scaffolding

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Branch:** `feature/TASK-001-scaffolding`
**Depends on:** none

---

## Context

No code exists yet. This task creates the skeleton for both the Android app and the
FastAPI backend with all dependencies configured but no business logic implemented.
Every subsequent task depends on this being merged first.

---

## Scope

### In scope
- Android project with all v1.0 dependencies wired up
- FastAPI backend with DB connection, auth middleware, and empty routers
- Alembic migrations for all 6 database tables
- Railway deployment config
- .env.example with all required keys (no real values)

### Out of scope
- Any UI screens (TASK-002+)
- Any business logic (word generation, session, etc.)
- Any actual API implementation (routes return 501 Not Implemented)

---

## Acceptance Criteria

- [ ] `./gradlew build` passes with no errors on Android
- [ ] `uvicorn app.main:app` starts with no errors on backend
- [ ] `alembic upgrade head` creates all 6 tables in a local Postgres DB
- [ ] All 6 DB tables match schema in CLAUDE.md §4 exactly (column names, types, constraints)
- [ ] All backend routes exist and return `{"detail": "not implemented"}` with HTTP 501
- [ ] Firebase Auth middleware rejects requests without valid JWT (return 401)
- [ ] `.env.example` lists all required env vars with placeholder values
- [ ] No secrets, API keys, or real credentials anywhere in the codebase

---

## Technical Spec

### Android — `android/`

Create a new Android project with package name `com.wortschatz`.
Use Android Studio template: **Empty Activity** then replace with Compose.

**`app/build.gradle.kts` — required dependencies:**
```kotlin
// Compose BOM — use latest stable
implementation(platform("androidx.compose:compose-bom:2024.05.00"))
implementation("androidx.compose.ui:ui")
implementation("androidx.compose.material3:material3")
implementation("androidx.compose.ui:ui-tooling-preview")
implementation("androidx.activity:activity-compose:1.9.0")

// Navigation
implementation("androidx.navigation:navigation-compose:2.7.7")

// Hilt
implementation("com.google.dagger:hilt-android:2.51")
ksp("com.google.dagger:hilt-compiler:2.51")
implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

// Retrofit + OkHttp
implementation("com.squareup.retrofit2:retrofit:2.11.0")
implementation("com.squareup.retrofit2:converter-gson:2.11.0")
implementation("com.squareup.okhttp3:okhttp:4.12.0")
implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
implementation("com.launchdarkly:okhttp-eventsource:4.1.1")  // SSE

// Room
implementation("androidx.room:room-runtime:2.6.1")
implementation("androidx.room:room-ktx:2.6.1")
ksp("androidx.room:room-compiler:2.6.1")

// DataStore
implementation("androidx.datastore:datastore-preferences:1.1.1")

// Firebase
implementation(platform("com.google.firebase:firebase-bom:33.1.0"))
implementation("com.google.firebase:firebase-auth-ktx")
implementation("com.google.firebase:firebase-messaging-ktx")

// Play Billing
implementation("com.android.billingclient:billing-ktx:7.0.0")

// Sentry
implementation("io.sentry:sentry-android:7.10.0")
```

**Folder structure to create (empty files with TODO stubs):**
```
android/app/src/main/java/com/wortschatz/
├── MainActivity.kt               — single activity, sets Compose content
├── WortschatzApp.kt              — @HiltAndroidApp Application class
├── ui/
│   ├── navigation/
│   │   └── AppNavGraph.kt        — NavHost with placeholder routes
│   ├── word/
│   │   └── WordCardScreen.kt     — TODO stub
│   ├── chat/
│   │   └── ChatScreen.kt         — TODO stub
│   ├── recap/
│   │   └── RecapScreen.kt        — TODO stub
│   ├── vault/
│   │   └── VaultScreen.kt        — TODO stub
│   └── onboarding/
│       └── OnboardingScreen.kt   — TODO stub
├── data/
│   ├── local/
│   │   ├── WortschatzDatabase.kt — Room DB definition (empty entities)
│   │   └── dao/                  — empty DAO interfaces
│   ├── remote/
│   │   └── WortschatzApi.kt      — Retrofit interface (all endpoints, all return TODO)
│   └── repository/               — empty repository interfaces + impls
├── domain/
│   └── model/                    — data classes mirroring API responses
└── di/
    ├── AppModule.kt              — Hilt module: provides Retrofit, OkHttpClient, DB
    ├── NetworkModule.kt          — base URL from BuildConfig
    └── DatabaseModule.kt         — Room DB singleton
```

**`MainActivity.kt`** — minimal, just launches the nav graph:
```kotlin
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WortschatzTheme {
                AppNavGraph()
            }
        }
    }
}
```

**`AppNavGraph.kt`** — define all routes as string constants, placeholder composables:
```kotlin
object Routes {
    const val ONBOARDING = "onboarding"
    const val WORD_CARD  = "word_card"
    const val CHAT       = "chat"
    const val RECAP      = "recap/{sessionId}"
    const val VAULT      = "vault"
    const val PAYWALL    = "paywall"
}
```

**Theme** — create `ui/theme/` with `Color.kt`, `Type.kt`, `Theme.kt`.
Use Material3. Color palette:
- Primary: `#1D9E75` (forest green)
- Background: `#F5F2EB` (warm paper)
- Surface: `#FFFFFF`
- OnBackground: `#1A1A18`

---

### Backend — `backend/`

**`requirements.txt`:**
```
fastapi==0.111.0
uvicorn[standard]==0.30.1
sqlalchemy[asyncio]==2.0.31
asyncpg==0.29.0
alembic==1.13.2
pydantic==2.7.4
pydantic-settings==2.3.4
python-jose[cryptography]==3.3.0
httpx==0.27.0
anthropic==0.30.0
redis==5.0.7
firebase-admin==6.5.0
sentry-sdk[fastapi]==2.7.1
python-dotenv==1.0.1
```

**`app/core/config.py`** — settings via pydantic-settings:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    anthropic_api_key: str
    firebase_service_account: str  # JSON string
    sentry_dsn: str = ""
    environment: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()
```

**`app/core/auth.py`** — Firebase JWT middleware:
- Verify `Authorization: Bearer <token>` on every protected route
- Use `firebase_admin.auth.verify_id_token(token)`
- Return HTTP 401 if missing or invalid
- Inject `user_id: str` as a FastAPI dependency

**`app/models/db.py`** — SQLAlchemy ORM models.
Create one class per table, matching schema in CLAUDE.md §4 **exactly**:
- `User`, `LearnerProfile`, `Session`, `SessionError`,
  `GrammarWeakness`, `VocabularyItem`, `DailyItem`, `VocabularyEncounter`
- Use `UUID` primary keys with `server_default=text("gen_random_uuid()")`
- Use `JSONB` for jsonb columns

**`app/routers/`** — one file per domain:
- `word.py` — `GET /word/today`, `POST /word/save`
- `session.py` — `POST /session/start`, `POST /session/message`, `POST /session/end`
- `recap.py` — `GET /session/{id}/recap`
- `vault.py` — `GET /vault`
- `profile.py` — `GET /profile`, `POST /profile/onboarding`
- `billing.py` — `POST /billing/webhook`

Every route body:
```python
raise HTTPException(status_code=501, detail="not implemented")
```

**`app/main.py`:**
```python
from fastapi import FastAPI
from sentry_sdk.integrations.fastapi import FastApiIntegration
import sentry_sdk

app = FastAPI(title="Wortschatz API", version="0.1.0")

# Include all routers with prefix /v1
app.include_router(word_router, prefix="/v1")
# ... etc
```

**`alembic/`** — full Alembic setup.
`alembic/versions/001_initial_schema.py` must create all 8 tables from CLAUDE.md §4.
Include all foreign keys, unique constraints, and default values.

**`Procfile`:**
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
worker: python -m app.jobs.nightly_word
```

**`railway.toml`:**
```toml
[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"

[[services]]
name = "nightly-word-job"
cronSchedule = "0 2 * * *"
startCommand = "python -m app.jobs.nightly_word"
```

**`.env.example`:**
```
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/wortschatz
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-your-key-here
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
SENTRY_DSN=https://xxx@sentry.io/xxx
ENVIRONMENT=development
```

---

## Tests

### Backend
- `tests/test_health.py` — `GET /health` returns 200 (add a health endpoint)
- `tests/test_auth.py` — protected routes return 401 without JWT
- `tests/test_db.py` — all 8 tables exist after migration, columns match expected names

### Android
- `WordCardScreenTest.kt` — screen renders without crash (empty state)
- Hilt component test — `AppModule` provides non-null Retrofit instance

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] `./gradlew build` passes
- [ ] `uvicorn app.main:app` starts
- [ ] `alembic upgrade head` runs clean
- [ ] All routes return 501
- [ ] Protected routes return 401 without JWT
- [ ] All tests pass
- [ ] No secrets in repo
- [ ] Conventional commit: `feat(TASK-001): project scaffolding`
- [ ] Branch pushed, ready for human review
- [ ] TASK status updated to `done`
