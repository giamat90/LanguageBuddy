# TASK-007 — VaultScreen + GET /vault

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-006 (must be merged first)

---

## Context

VaultScreen is the last feature required for v1.0 feature complete. Free users can browse all words they have saved via `POST /word/save`. The vault displays each word's SRS data — retention score and days until next review — so users understand their learning progress. After this task merges, the end-to-end smoke test follows.

---

## Scope

### In scope
- Backend: `GET /vault` replacing the 501 stub, paginated (page size 20), sorted by `next_review_at ASC`
- Android: Replace `WortschatzDatabase` placeholder entity with real `VocabularyItemEntity` + `VocabularyItemDao`
- Android: Paging 3 + Room `RemoteMediator` for offline-capable paginated vault
- Android: `VaultScreen` — lazy list, each row shows word, article, part of speech, Italian translation, retention progress bar, days until review
- Android: Empty state when vault is empty
- Android: Vault icon button in `WordCardScreen` TopAppBar as entry point (in addition to the existing "Salta per oggi" flow)
- Android: `VaultScreen` receives `onBack` and calls `navController.popBackStack()`

### Out of scope
- Editing or deleting vault items (v1.1)
- Sorting/filtering UI (v1.1)
- SRS review session triggered from vault (v1.1)
- `GET /profile` endpoint (not needed for vault; leave 501 stub)

---

## Acceptance Criteria

- [ ] `GET /vault?page=1&page_size=20` returns items sorted by `next_review_at ASC`, authenticated
- [ ] `GET /vault` returns 401 without a valid JWT
- [ ] `GET /vault` returns empty `items: []` when user has no saved words (not 404)
- [ ] VaultScreen displays each item: article badge (grey if null), word, part of speech, Italian translation, retention `LinearProgressIndicator`, days-until-review chip
- [ ] Empty state renders when `items` list is empty
- [ ] Vault icon button in WordCard TopAppBar navigates to VaultScreen
- [ ] Back button on VaultScreen pops to WordCard
- [ ] Vault list pages correctly — page 2 loads when scrolling past 20 items
- [ ] Room cache survives app restart — offline vault shows last-fetched items
- [ ] All new strings in `strings.xml`, no hardcoded Italian
- [ ] `testDebugUnitTest` passes (no compile errors or test failures)

---

## Technical Spec

### Files to create
```
backend/app/schemas/vault.py                                          — VaultItemSchema, VaultResponse
android/app/src/main/java/com/wortschatz/data/local/VocabularyItemEntity.kt   — Room entity + DAO
android/app/src/main/java/com/wortschatz/data/remote/dto/VaultDto.kt          — VaultItemDto, VaultResponseDto
android/app/src/main/java/com/wortschatz/domain/model/VaultItem.kt            — domain model
android/app/src/main/java/com/wortschatz/data/repository/VaultRepository.kt   — interface
android/app/src/main/java/com/wortschatz/data/repository/VaultRepositoryImpl.kt — Pager + RemoteMediator
android/app/src/main/java/com/wortschatz/di/VaultModule.kt                    — Hilt bindings
android/app/src/main/java/com/wortschatz/ui/vault/VaultViewModel.kt           — ViewModel
backend/tests/test_vault_router.py                                    — backend tests
android/app/src/test/java/com/wortschatz/ui/vault/VaultViewModelTest.kt       — unit tests
android/app/src/androidTest/java/com/wortschatz/ui/vault/VaultScreenTest.kt   — instrumented tests
```

### Files to modify
```
backend/app/routers/vault.py                          — replace 501 stub with real implementation
android/app/src/main/java/com/wortschatz/data/local/WortschatzDatabase.kt  — replace placeholder entity, bump version
android/app/src/main/java/com/wortschatz/di/DatabaseModule.kt              — provide VocabularyItemDao
android/app/src/main/java/com/wortschatz/data/remote/WortschatzApi.kt      — update getVault signature
android/app/src/main/java/com/wortschatz/ui/vault/VaultScreen.kt           — replace stub with real screen
android/app/src/main/java/com/wortschatz/ui/word/WordCardScreen.kt         — add onOpenVault param + TopAppBar icon
android/app/src/main/java/com/wortschatz/ui/navigation/AppNavGraph.kt      — wire onOpenVault, add onBack to VaultScreen
android/app/src/main/res/values/strings.xml                                — vault strings
android/gradle/libs.versions.toml                                          — add paging version + libs
android/app/build.gradle.kts                                               — add paging dependencies
```

---

### Implementation notes

**Section 1 — Backend: `backend/app/schemas/vault.py`**

```python
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class VaultItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    word: str
    article: str | None
    part_of_speech: str | None
    translation_it: str | None
    retention_score: float
    next_review_at: datetime
    times_seen: int

class VaultResponse(BaseModel):
    items: list[VaultItemSchema]
    total: int
```

`id` is a UUID — serialize as string via `str(item.id)` when building the schema, or use `model_validator`. The simplest approach: in the router, pass `id=str(item.id)` explicitly when the ORM model uses `uuid.UUID`. Check how `recap.py` handles UUID serialization and follow the same pattern.

**Section 2 — Backend: `backend/app/routers/vault.py`**

Replace the 501 stub:

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.db import LearnerProfile, VocabularyItem, User
from app.schemas.vault import VaultResponse, VaultItemSchema

router = APIRouter(tags=["vault"])

@router.get("/vault", response_model=VaultResponse)
async def get_vault(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await db.scalar(
        select(LearnerProfile).where(LearnerProfile.user_id == current_user.id)
    )
    if profile is None:
        return VaultResponse(items=[], total=0)

    total = await db.scalar(
        select(func.count()).select_from(VocabularyItem)
        .where(VocabularyItem.profile_id == profile.id)
    ) or 0

    result = await db.scalars(
        select(VocabularyItem)
        .where(VocabularyItem.profile_id == profile.id)
        .order_by(VocabularyItem.next_review_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.all()

    return VaultResponse(
        items=[VaultItemSchema(
            id=str(item.id),
            word=item.word,
            article=item.article,
            part_of_speech=item.part_of_speech,
            translation_it=item.translation_it,
            retention_score=item.retention_score,
            next_review_at=item.next_review_at,
            times_seen=item.times_seen,
        ) for item in items],
        total=total,
    )
```

Use `get_current_user` (not `get_current_user_id`) — consistent with `recap.py`. A missing profile means the user has no words; return empty list with 200, not 404.

**Section 3 — Paging 3 dependencies**

Add to `android/gradle/libs.versions.toml`:

```toml
# in [versions]
paging = "3.3.0"

# in [libraries]
paging-runtime = { group = "androidx.paging", name = "paging-runtime-ktx", version.ref = "paging" }
paging-compose = { group = "androidx.paging", name = "paging-compose", version.ref = "paging" }
room-paging = { group = "androidx.room", name = "room-paging", version.ref = "room" }
```

Add to `android/app/build.gradle.kts` `dependencies` block:

```kotlin
implementation(libs.paging.runtime)
implementation(libs.paging.compose)
implementation(libs.room.paging)
```

**Section 4 — `VocabularyItemEntity.kt`**

Create `android/app/src/main/java/com/wortschatz/data/local/VocabularyItemEntity.kt`:

```kotlin
package com.wortschatz.data.local

import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Upsert
import androidx.paging.PagingSource

@Entity(tableName = "vocabulary_items")
data class VocabularyItemEntity(
    @PrimaryKey val id: String,
    val word: String,
    val article: String?,
    @ColumnInfo(name = "part_of_speech") val partOfSpeech: String?,
    @ColumnInfo(name = "translation_it") val translationIt: String?,
    @ColumnInfo(name = "retention_score") val retentionScore: Float,
    @ColumnInfo(name = "next_review_at_ms") val nextReviewAtMs: Long,
    @ColumnInfo(name = "times_seen") val timesSeen: Int,
)

@Dao
interface VocabularyItemDao {
    @Query("SELECT * FROM vocabulary_items ORDER BY next_review_at_ms ASC")
    fun pagingSource(): PagingSource<Int, VocabularyItemEntity>

    @Upsert
    suspend fun upsertAll(items: List<VocabularyItemEntity>)

    @Query("DELETE FROM vocabulary_items")
    suspend fun clearAll()

    @Query("SELECT COUNT(*) FROM vocabulary_items")
    suspend fun count(): Int
}
```

**Section 5 — `WortschatzDatabase.kt`**

Replace the entire file:

```kotlin
package com.wortschatz.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [VocabularyItemEntity::class],
    version = 2,
    exportSchema = false,
)
abstract class WortschatzDatabase : RoomDatabase() {
    abstract fun vocabularyItemDao(): VocabularyItemDao
}
```

Bump to version 2. The `CachedWordEntity` placeholder is removed — it was never in production, so no migration is needed. In `DatabaseModule.kt`, add `fallbackToDestructiveMigration()` to the builder:

```kotlin
Room.databaseBuilder(context, WortschatzDatabase::class.java, "wortschatz.db")
    .fallbackToDestructiveMigration()
    .build()
```

Add to `DatabaseModule.kt`:

```kotlin
@Provides
@Singleton
fun provideVocabularyItemDao(db: WortschatzDatabase): VocabularyItemDao = db.vocabularyItemDao()
```

**Section 6 — Domain model: `VaultItem.kt`**

```kotlin
package com.wortschatz.domain.model

data class VaultItem(
    val id: String,
    val word: String,
    val article: String?,
    val partOfSpeech: String?,
    val translationIt: String?,
    val retentionScore: Float,
    val nextReviewAtMs: Long,
    val timesSeen: Int,
)
```

Extension on entity:

```kotlin
fun VocabularyItemEntity.toDomain() = VaultItem(
    id = id,
    word = word,
    article = article,
    partOfSpeech = partOfSpeech,
    translationIt = translationIt,
    retentionScore = retentionScore,
    nextReviewAtMs = nextReviewAtMs,
    timesSeen = timesSeen,
)
```

Put this extension in `VaultItem.kt` itself (import `VocabularyItemEntity`).

**Section 7 — DTO: `VaultDto.kt`**

```kotlin
package com.wortschatz.data.remote.dto

import com.google.gson.annotations.SerializedName
import com.wortschatz.data.local.VocabularyItemEntity
import java.time.Instant

data class VaultItemDto(
    @SerializedName("id") val id: String,
    @SerializedName("word") val word: String,
    @SerializedName("article") val article: String?,
    @SerializedName("part_of_speech") val partOfSpeech: String?,
    @SerializedName("translation_it") val translationIt: String?,
    @SerializedName("retention_score") val retentionScore: Float,
    @SerializedName("next_review_at") val nextReviewAt: String,  // ISO-8601
    @SerializedName("times_seen") val timesSeen: Int,
) {
    fun toEntity(): VocabularyItemEntity = VocabularyItemEntity(
        id = id,
        word = word,
        article = article,
        partOfSpeech = partOfSpeech,
        translationIt = translationIt,
        retentionScore = retentionScore,
        nextReviewAtMs = Instant.parse(nextReviewAt).toEpochMilli(),
        timesSeen = timesSeen,
    )
}

data class VaultResponseDto(
    @SerializedName("items") val items: List<VaultItemDto>,
    @SerializedName("total") val total: Int,
)
```

**Section 8 — API: update `WortschatzApi.kt`**

Replace:
```kotlin
@GET("vault")
suspend fun getVault(): Any
```
With:
```kotlin
@GET("vault")
suspend fun getVault(
    @Query("page") page: Int,
    @Query("page_size") pageSize: Int,
): VaultResponseDto
```

Add import: `import com.wortschatz.data.remote.dto.VaultResponseDto` and `import retrofit2.http.Query`.

**Section 9 — `VaultRepository.kt` + `VaultRepositoryImpl.kt`**

```kotlin
// VaultRepository.kt
package com.wortschatz.data.repository

import androidx.paging.PagingData
import com.wortschatz.domain.model.VaultItem
import kotlinx.coroutines.flow.Flow

interface VaultRepository {
    fun getVaultItems(): Flow<PagingData<VaultItem>>
}
```

```kotlin
// VaultRepositoryImpl.kt
package com.wortschatz.data.repository

import androidx.paging.ExperimentalPagingApi
import androidx.paging.LoadType
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.PagingState
import androidx.paging.RemoteMediator
import androidx.paging.map
import com.wortschatz.data.local.VocabularyItemDao
import com.wortschatz.data.local.VocabularyItemEntity
import com.wortschatz.data.remote.WortschatzApi
import com.wortschatz.domain.model.VaultItem
import com.wortschatz.domain.model.toDomain
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private const val PAGE_SIZE = 20

@OptIn(ExperimentalPagingApi::class)
private class VaultRemoteMediator(
    private val api: WortschatzApi,
    private val dao: VocabularyItemDao,
) : RemoteMediator<Int, VocabularyItemEntity>() {

    override suspend fun load(
        loadType: LoadType,
        state: PagingState<Int, VocabularyItemEntity>,
    ): MediatorResult {
        val page = when (loadType) {
            LoadType.REFRESH -> 1
            LoadType.PREPEND -> return MediatorResult.Success(endOfPaginationReached = true)
            LoadType.APPEND -> {
                val count = dao.count()
                if (count == 0) return MediatorResult.Success(endOfPaginationReached = true)
                (count / PAGE_SIZE) + 1
            }
        }
        return try {
            val response = api.getVault(page = page, pageSize = PAGE_SIZE)
            if (loadType == LoadType.REFRESH) dao.clearAll()
            dao.upsertAll(response.items.map { it.toEntity() })
            MediatorResult.Success(endOfPaginationReached = response.items.size < PAGE_SIZE)
        } catch (e: Exception) {
            MediatorResult.Error(e)
        }
    }
}

@Singleton
class VaultRepositoryImpl @Inject constructor(
    private val api: WortschatzApi,
    private val dao: VocabularyItemDao,
) : VaultRepository {

    @OptIn(ExperimentalPagingApi::class)
    override fun getVaultItems(): Flow<PagingData<VaultItem>> = Pager(
        config = PagingConfig(pageSize = PAGE_SIZE, enablePlaceholders = false),
        remoteMediator = VaultRemoteMediator(api, dao),
        pagingSourceFactory = { dao.pagingSource() },
    ).flow.map { pagingData -> pagingData.map { it.toDomain() } }
}
```

**Section 10 — `VaultModule.kt`**

```kotlin
package com.wortschatz.di

import com.wortschatz.data.repository.VaultRepository
import com.wortschatz.data.repository.VaultRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class VaultModule {
    @Binds
    @Singleton
    abstract fun bindVaultRepository(impl: VaultRepositoryImpl): VaultRepository
}
```

**Section 11 — `VaultViewModel.kt`**

```kotlin
package com.wortschatz.ui.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import com.wortschatz.data.repository.VaultRepository
import com.wortschatz.domain.model.VaultItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

@HiltViewModel
class VaultViewModel @Inject constructor(
    vaultRepository: VaultRepository,
) : ViewModel() {
    val items: Flow<PagingData<VaultItem>> = vaultRepository.getVaultItems().cachedIn(viewModelScope)
}
```

**Section 12 — `VaultScreen.kt`**

Replace the stub entirely. Structure:

```
VaultScreen(onBack, viewModel)           ← public, used by nav graph
  VaultContent(lazyItems, onBack)        ← internal, used by tests
    Scaffold + TopAppBar (back arrow + title)
    when (lazyItems.loadState.refresh):
      Loading → centered CircularProgressIndicator
      Error   → centered error text (R.string.vault_error_load) + Retry button
      else    → if lazyItems.itemCount == 0 → EmptyState
                else → LazyColumn with VaultItemRow per item
```

```kotlin
@Composable
fun VaultScreen(
    onBack: () -> Unit,
    viewModel: VaultViewModel = hiltViewModel(),
) {
    val lazyItems = viewModel.items.collectAsLazyPagingItems()
    VaultContent(lazyItems = lazyItems, onBack = onBack)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun VaultContent(
    lazyItems: LazyPagingItems<VaultItem>,
    onBack: () -> Unit,
) { ... }
```

`VaultItemRow` composable (private):
- `Row` with `fillMaxWidth`, `padding(horizontal = 16.dp, vertical = 12.dp)`
- Left column (weight 1f):
  - `Row` with article badge (same `Surface` style as `WordCardScreen` — `Primary.copy(alpha=0.12f)` bg, `Primary` text) + word text in `titleMedium`
  - Part of speech in `labelSmall`, color `TextSecondary`
  - Italian translation in `bodyMedium`
- Right column (width = 80.dp, center-aligned):
  - `LinearProgressIndicator(progress = { item.retentionScore }, color = Primary, trackColor = Primary.copy(alpha = 0.12f))`
  - Days until review text:
    ```kotlin
    val daysUntil = ((item.nextReviewAtMs - System.currentTimeMillis()) / 86_400_000.0)
        .let { kotlin.math.ceil(it).toLong().coerceAtLeast(0L) }
    val label = if (daysUntil == 0L)
        stringResource(R.string.vault_review_today)
    else
        stringResource(R.string.vault_days_until_review, daysUntil)
    ```
  - Label in `labelSmall`, color `TextSecondary`, `textAlign = TextAlign.Center`

Between rows, use `HorizontalDivider(color = CardDivider)` — same as `RecapScreen`.

`EmptyState` composable (private):
- `Box(Modifier.fillMaxSize(), contentAlignment = Center)`
- `Text(stringResource(R.string.vault_empty), textAlign = TextAlign.Center, color = TextSecondary)`

Retry button on error: `Button(onClick = { lazyItems.retry() })` showing `R.string.vault_retry`.

Accessibility: `LinearProgressIndicator` wrapped in `Modifier.semantics { contentDescription = stringResource(R.string.cd_vault_retention, (item.retentionScore * 100).toInt()) }`.

**Section 13 — `WordCardScreen.kt` changes**

Add `onOpenVault: () -> Unit = {}` to both `WordCardScreen` and `WordCardContent` signatures.

In `WordCardContent`'s `TopAppBar`, add to the `actions` block:
```kotlin
IconButton(onClick = onOpenVault) {
    Icon(
        imageVector = Icons.AutoMirrored.Filled.LibraryBooks,
        contentDescription = stringResource(R.string.vault_open),
        tint = Primary,
    )
}
```

`Icons.AutoMirrored.Filled.LibraryBooks` is in `material-icons-extended` (already a dependency). If `LibraryBooks` is not in the automirrored set, use `Icons.Filled.LibraryBooks` without the automirrored wrapper.

**Section 14 — `AppNavGraph.kt` changes**

1. `WordCardScreen` call: add `onOpenVault = { navController.navigate(Routes.VAULT) }`
2. `VaultScreen` composable: add `onBack = { navController.popBackStack() }`

```kotlin
composable(Routes.WORD_CARD) {
    WordCardScreen(
        onSkip = { navController.navigate(Routes.VAULT) },
        onSaveSuccess = { ... },
        onPracticeWithLena = { ... },
        onOpenVault = { navController.navigate(Routes.VAULT) },
    )
}
// ...
composable(Routes.VAULT) {
    VaultScreen(onBack = { navController.popBackStack() })
}
```

**Section 15 — `strings.xml` additions**

Add before the closing `</resources>` tag:

```xml
<!-- Vault screen -->
<string name="vault_title">Il mio vocabolario</string>
<string name="vault_empty">Nessuna parola salvata.\nSalva la parola del giorno per iniziare!</string>
<string name="vault_days_until_review">%d giorni</string>
<string name="vault_review_today">Oggi</string>
<string name="vault_open">Apri il vocabolario</string>
<string name="vault_error_load">Impossibile caricare il vocabolario</string>
<string name="vault_retry">Riprova</string>
<string name="cd_vault_retention">Ritenzione: %d percento</string>
```

---

## API Contract

```
GET /vault?page=1&page_size=20
Authorization: Bearer <firebase_jwt>

Response 200:
{
  "items": [
    {
      "id": "uuid-string",
      "word": "Schlüssel",
      "article": "der",
      "part_of_speech": "noun",
      "translation_it": "chiave",
      "retention_score": 0.75,
      "next_review_at": "2026-05-11T02:00:00Z",
      "times_seen": 3
    }
  ],
  "total": 42
}

Response 200 (empty vault):
{
  "items": [],
  "total": 0
}

Response 401:
{ "detail": "Not authenticated" }
```

Query params: `page` (int, ≥1, default 1), `page_size` (int, 1–100, default 20).

---

## Database Changes

No schema changes. `vocabulary_items` table is already defined and populated by `POST /word/save`.

The Android Room schema change (new entity, removed placeholder) is a destructive migration — acceptable for v1.0 pre-launch. `fallbackToDestructiveMigration()` handles it.

---

## Tests

### Backend (pytest) — `backend/tests/test_vault_router.py`

- `test_get_vault_returns_items` — user with 2 vocabulary_items; assert response status 200, `len(items) == 2`, `total == 2`, items sorted by `next_review_at ASC`
- `test_get_vault_empty` — user with no vocabulary_items; assert status 200, `items == []`, `total == 0`
- `test_get_vault_pagination` — user with 25 items; page=1&page_size=20 returns 20; page=2 returns 5
- `test_get_vault_unauthorized` — no Authorization header; assert 401 or 403

Use `app.dependency_overrides` pattern consistent with `test_recap_router.py`.

### Android unit (JUnit) — `VaultViewModelTest.kt`

- `test_items_flow_is_not_null` — construct `VaultViewModel` with `FakeVaultRepository` returning `PagingData.empty()`; assert `viewModel.items` is not null
- `test_viewmodel_exposes_paging_flow` — same fake; collect one emission, assert it doesn't throw

`FakeVaultRepository`:
```kotlin
class FakeVaultRepository : VaultRepository {
    override fun getVaultItems(): Flow<PagingData<VaultItem>> = flowOf(PagingData.empty())
}
```

### Android instrumented (Compose) — `VaultScreenTest.kt`

Use `createComposeRule`. Build a real `Pager` with a `TestPagingSource` to supply items to `VaultContent`.

- `testVaultEmptyStateDisplayed` — `lazyItems` from `PagingData.empty()`; assert `vault_empty` string is displayed
- `testVaultItemRowDisplaysWord` — `lazyItems` with one `VaultItem(word = "Schlüssel", ...)`; assert `"Schlüssel"` is displayed

For `testVaultItemRowDisplaysWord`, construct paging data:
```kotlin
val pager = Pager(PagingConfig(pageSize = 20)) {
    object : PagingSource<Int, VaultItem>() {
        override fun getRefreshKey(state: PagingState<Int, VaultItem>) = null
        override suspend fun load(params: LoadParams<Int>) =
            LoadResult.Page(listOf(fakeItem), null, null)
    }
}
val lazyItems = pager.flow.collectAsLazyPagingItems()
```

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] All specified tests written and green
- [ ] No hardcoded strings (all in `strings.xml`)
- [ ] No API keys or secrets in code
- [ ] Conventional commit: `feat(TASK-007): vault screen, GET /vault, Paging 3 + Room`
- [ ] TASK status updated to `done`
