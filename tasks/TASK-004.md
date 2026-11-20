# TASK-004 — Android: WordCard Screen

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Branch:** `main` (commit directly — no feature branch)
**Depends on:** TASK-003 (merged ✓)

---

## Context

TASK-003 put `GET /word/today` and `POST /word/save` live on the backend. This task wires
the Android client to those endpoints and builds the word card screen — the first screen a
free user sees every day, and the product's single most important first impression.

The screen must be specified at pixel level here because Developer makes no design decisions
on the flagship screen. Every color, spacing value, and text style is mandated below.

---

## Scope

### In scope
- `domain/model/DailyWord.kt` and `SaveWordResult.kt` — domain models
- `data/remote/dto/` — Retrofit DTOs + mappers
- `data/repository/WordRepository.kt` + `WordRepositoryImpl.kt` — data layer
- `di/RepositoryModule.kt` — Hilt binding for WordRepository
- `di/NetworkModule.kt` — add `AuthInterceptor` (Firebase JWT on every request)
- `data/remote/WortschatzApi.kt` — replace `Any` stubs with real types for word endpoints
- `ui/theme/Color.kt` — add design tokens defined in this spec
- `ui/theme/Type.kt` — add type styles defined in this spec
- `ui/word/WordUiState.kt` — state sealed class
- `ui/word/WordViewModel.kt` — ViewModel with streak persistence via DataStore
- `ui/word/components/WordCard.kt` — the card composable
- `ui/word/components/ArticleBadge.kt` — article badge with gender colour coding
- `ui/word/components/StreakBadge.kt` — 🔥 N giorni badge
- `ui/word/components/SaveButton.kt` — three-state save button
- `ui/word/WordCardScreen.kt` — replace stub with full screen
- `res/values/strings.xml` — add all Italian UI strings for this screen
- `WordViewModelTest.kt` — 5 ViewModel unit tests (no Android)
- `WordCardScreenTest.kt` — 3 Compose UI tests

### Out of scope
- Login / Firebase Auth UI (covered by a later onboarding task)
- Paywall flow triggered after save (later task)
- VaultScreen implementation (later task)
- Room caching of word data (later task — offline mode)
- Any other screens

---

## Acceptance Criteria

- [ ] `GET /word/today` is called on screen entry; the card renders all fields
- [ ] `is_saved = true` from the API renders the card in the already-saved state on first load
- [ ] Save button transitions: **Idle → Loading → Saved** on tap; streak counter updates
- [ ] Tapping Save when `alreadySaved = true` from server keeps `SaveState.Saved` unchanged
- [ ] Skip button navigates to `Routes.VAULT`
- [ ] Loading state shows `CircularProgressIndicator` centred on `Background`
- [ ] Network error shows error message with Retry button
- [ ] Empty state (404 from server) shows "Nessuna parola per oggi" message
- [ ] Article badge uses the correct gender colour (`der` blue / `die` rose / `das` amber)
- [ ] Streak reads from DataStore on load; DataStore is updated after a successful save
- [ ] All strings are in `strings.xml` — zero hardcoded Italian/German strings in Kotlin
- [ ] All Compose elements have `contentDescription` for accessibility
- [ ] All 8 specified tests pass

---

## Technical Spec

### Files to create
```
android/app/src/main/java/com/wortschatz/domain/model/DailyWord.kt
android/app/src/main/java/com/wortschatz/domain/model/SaveWordResult.kt
android/app/src/main/java/com/wortschatz/data/remote/dto/DailyWordDto.kt
android/app/src/main/java/com/wortschatz/data/remote/dto/SaveWordResponseDto.kt
android/app/src/main/java/com/wortschatz/data/repository/WordRepository.kt
android/app/src/main/java/com/wortschatz/data/repository/WordRepositoryImpl.kt
android/app/src/main/java/com/wortschatz/di/RepositoryModule.kt
android/app/src/main/java/com/wortschatz/ui/word/WordUiState.kt
android/app/src/main/java/com/wortschatz/ui/word/WordViewModel.kt
android/app/src/main/java/com/wortschatz/ui/word/components/WordCard.kt
android/app/src/main/java/com/wortschatz/ui/word/components/ArticleBadge.kt
android/app/src/main/java/com/wortschatz/ui/word/components/StreakBadge.kt
android/app/src/main/java/com/wortschatz/ui/word/components/SaveButton.kt
android/app/src/test/java/com/wortschatz/ui/word/WordViewModelTest.kt
android/app/src/androidTest/java/com/wortschatz/ui/word/WordCardScreenTest.kt
```

### Files to modify
```
android/app/src/main/java/com/wortschatz/ui/theme/Color.kt      — add design tokens
android/app/src/main/java/com/wortschatz/ui/theme/Type.kt       — add type styles
android/app/src/main/java/com/wortschatz/data/remote/WortschatzApi.kt  — real return types
android/app/src/main/java/com/wortschatz/di/NetworkModule.kt    — add AuthInterceptor
android/app/src/main/java/com/wortschatz/ui/word/WordCardScreen.kt     — replace stub
android/app/src/main/res/values/strings.xml                     — add word card strings
```

---

### Design tokens — `ui/theme/Color.kt`

Add these constants below the existing five. Do not remove or rename the existing ones.

```kotlin
// Semantic text hierarchy
val TextSecondary = Color(0xFF6B6B68)   // IPA, Italian example, section labels
val TextTertiary  = Color(0xFF9E9E9A)   // disabled, placeholder

// Card internals
val CardDivider    = Color(0xFFE0DDD6)  // 1.dp horizontal rules inside card
val CardSectionBg  = Color(0xFFF0EDE6) // cultural note tinted background

// Article gender colours (German grammar pedagogy convention)
val ArticleDer = Color(0xFF4A90D9)     // masculine → blue
val ArticleDie = Color(0xFFE8507A)     // feminine  → rose
val ArticleDas = Color(0xFFF5A623)     // neuter    → amber
val ArticleNone = Color(0xFF9E9E9A)    // no article (verbs, adverbs) → grey

// Save button states
val SavedButtonBg      = Color(0xFFE8F5F0)  // light teal fill when saved
val SavedButtonContent = Color(0xFF1D9E75)  // same as Primary — explicit alias for clarity
```

---

### Typography scale — `ui/theme/Type.kt`

Extend the existing `Typography` object — keep the three existing styles, add named constants
for the word card. These are standalone `TextStyle` vals (not part of Material Typography),
used directly by composables.

```kotlin
import androidx.compose.ui.text.font.FontStyle

// --- Word card type styles ---

val WordHeading = TextStyle(
    fontWeight = FontWeight.SemiBold,
    fontSize = 40.sp,
    lineHeight = 44.sp,
    letterSpacing = (-0.5).sp,
)
val IpaStyle = TextStyle(
    fontWeight = FontWeight.Normal,
    fontStyle = FontStyle.Italic,
    fontSize = 16.sp,
    lineHeight = 22.sp,
)
val MeaningStyle = TextStyle(
    fontWeight = FontWeight.Normal,
    fontSize = 22.sp,
    lineHeight = 28.sp,
)
val ExampleDeStyle = TextStyle(
    fontWeight = FontWeight.Normal,
    fontSize = 15.sp,
    lineHeight = 22.sp,
)
val ExampleItStyle = TextStyle(
    fontWeight = FontWeight.Normal,
    fontSize = 14.sp,
    lineHeight = 20.sp,
)
val CulturalNoteStyle = TextStyle(
    fontWeight = FontWeight.Normal,
    fontSize = 14.sp,
    lineHeight = 20.sp,
)
val SectionLabelStyle = TextStyle(
    fontWeight = FontWeight.Medium,
    fontSize = 11.sp,
    lineHeight = 16.sp,
    letterSpacing = 0.8.sp,
)
val BadgeStyle = TextStyle(
    fontWeight = FontWeight.Medium,
    fontSize = 13.sp,
    lineHeight = 18.sp,
)
val StreakStyle = TextStyle(
    fontWeight = FontWeight.SemiBold,
    fontSize = 15.sp,
    lineHeight = 20.sp,
)
```

---

### Domain models

**`domain/model/DailyWord.kt`**
```kotlin
data class DailyWord(
    val id: String,
    val word: String,
    val article: String?,        // "der" | "die" | "das" | null
    val partOfSpeech: String?,
    val ipa: String?,
    val meaningIt: String?,
    val meaningEn: String?,
    val exampleDe: String?,
    val exampleIt: String?,
    val culturalNote: String?,
    val grammarAngle: String?,
    val topicDomain: String?,
    val cefrBand: String?,
    val date: String,
    val isSaved: Boolean,
)
```

**`domain/model/SaveWordResult.kt`**
```kotlin
data class SaveWordResult(val streakDays: Int, val alreadySaved: Boolean)
```

---

### DTOs — `data/remote/dto/`

**`DailyWordDto.kt`**
```kotlin
import com.google.gson.annotations.SerializedName

data class DailyWordDto(
    @SerializedName("id")               val id: String,
    @SerializedName("word")             val word: String,
    @SerializedName("article")          val article: String?,
    @SerializedName("part_of_speech")   val partOfSpeech: String?,
    @SerializedName("ipa")              val ipa: String?,
    @SerializedName("meaning_it")       val meaningIt: String?,
    @SerializedName("meaning_en")       val meaningEn: String?,
    @SerializedName("example_de")       val exampleDe: String?,
    @SerializedName("example_it")       val exampleIt: String?,
    @SerializedName("cultural_note")    val culturalNote: String?,
    @SerializedName("grammar_angle")    val grammarAngle: String?,
    @SerializedName("topic_domain")     val topicDomain: String?,
    @SerializedName("cefr_band")        val cefrBand: String?,
    @SerializedName("date")             val date: String,
    @SerializedName("is_saved")         val isSaved: Boolean,
) {
    fun toDomain() = DailyWord(
        id = id, word = word, article = article, partOfSpeech = partOfSpeech,
        ipa = ipa, meaningIt = meaningIt, meaningEn = meaningEn,
        exampleDe = exampleDe, exampleIt = exampleIt, culturalNote = culturalNote,
        grammarAngle = grammarAngle, topicDomain = topicDomain, cefrBand = cefrBand,
        date = date, isSaved = isSaved,
    )
}
```

**`SaveWordResponseDto.kt`**
```kotlin
data class SaveWordResponseDto(
    @SerializedName("streak_days")   val streakDays: Int,
    @SerializedName("already_saved") val alreadySaved: Boolean,
)
```

---

### Retrofit API — `data/remote/WortschatzApi.kt`

Replace only the two word endpoints (keep all others as `Any` stubs — they belong to later tasks):

```kotlin
@GET("word/today")
suspend fun getWordToday(): DailyWordDto

@POST("word/save")
suspend fun saveWord(): SaveWordResponseDto
```

---

### Auth interceptor — `di/NetworkModule.kt`

Replace `provideOkHttpClient()` with this version that adds the Firebase JWT header on every request. Use `Tasks.await()` (synchronous, safe on OkHttp's background thread):

```kotlin
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import okhttp3.Interceptor

private fun buildAuthInterceptor(): Interceptor = Interceptor { chain ->
    val user = FirebaseAuth.getInstance().currentUser
    val token = user?.let { Tasks.await(it.getIdToken(false)) }?.token
    val request = if (token != null) {
        chain.request().newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .build()
    } else {
        chain.request()
    }
    chain.proceed(request)
}

@Provides
@Singleton
fun provideOkHttpClient(): OkHttpClient {
    val logging = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
                else HttpLoggingInterceptor.Level.NONE
    }
    return OkHttpClient.Builder()
        .addInterceptor(buildAuthInterceptor())
        .addInterceptor(logging)
        .build()
}
```

`buildAuthInterceptor()` is a private top-level function in the same file — not a `@Provides` method.

---

### Repository

**`data/repository/WordRepository.kt`** (interface)
```kotlin
interface WordRepository {
    suspend fun getTodayWord(): Result<DailyWord>
    suspend fun saveWord(): Result<SaveWordResult>
}
```

**`data/repository/WordRepositoryImpl.kt`**

The implementation wraps every API call in `try/catch`. Map HTTP 404 to a sentinel exception
`NoWordForTodayException` so the ViewModel can distinguish it from network failures.

```kotlin
class NoWordForTodayException : Exception("No word for today")

@Singleton
class WordRepositoryImpl @Inject constructor(
    private val api: WortschatzApi,
    private val dataStore: DataStore<Preferences>,
) : WordRepository {

    companion object {
        val STREAK_KEY = intPreferencesKey("streak_days")
    }

    override suspend fun getTodayWord(): Result<DailyWord> = try {
        val dto = api.getWordToday()
        Result.success(dto.toDomain())
    } catch (e: HttpException) {
        if (e.code() == 404) Result.failure(NoWordForTodayException())
        else Result.failure(e)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun saveWord(): Result<SaveWordResult> = try {
        val dto = api.saveWord()
        dataStore.edit { prefs -> prefs[STREAK_KEY] = dto.streakDays }
        Result.success(SaveWordResult(dto.streakDays, dto.alreadySaved))
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getCachedStreak(): Int =
        dataStore.data.map { it[STREAK_KEY] ?: 0 }.first()
}
```

`DataStore<Preferences>` is already provided by the existing DataStore dependency. Wire it
in the Hilt graph:

**`di/RepositoryModule.kt`**
```kotlin
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    abstract fun bindWordRepository(impl: WordRepositoryImpl): WordRepository
}
```

Add a `@Provides` for `DataStore<Preferences>` in `AppModule.kt` if not already present:
```kotlin
@Provides
@Singleton
fun provideDataStore(@ApplicationContext context: Context): DataStore<Preferences> =
    PreferenceDataStoreFactory.create(
        produceFile = { context.preferencesDataStoreFile("user_prefs") }
    )
```

---

### ViewModel

**`ui/word/WordUiState.kt`**
```kotlin
enum class SaveState { Idle, Saving, Saved }

sealed class WordUiState {
    object Loading : WordUiState()
    data class Success(
        val word: DailyWord,
        val saveState: SaveState,
        val streakDays: Int,
    ) : WordUiState()
    data class Error(val message: String) : WordUiState()
    object Empty : WordUiState()   // 404 — no word generated for today
}
```

**`ui/word/WordViewModel.kt`**
```kotlin
@HiltViewModel
class WordViewModel @Inject constructor(
    private val wordRepository: WordRepositoryImpl,  // concrete for getCachedStreak access
) : ViewModel() {

    private val _uiState = MutableStateFlow<WordUiState>(WordUiState.Loading)
    val uiState: StateFlow<WordUiState> = _uiState.asStateFlow()

    init { loadTodayWord() }

    fun loadTodayWord() {
        viewModelScope.launch {
            _uiState.value = WordUiState.Loading
            val streakDays = wordRepository.getCachedStreak()
            wordRepository.getTodayWord()
                .onSuccess { word ->
                    _uiState.value = WordUiState.Success(
                        word = word,
                        saveState = if (word.isSaved) SaveState.Saved else SaveState.Idle,
                        streakDays = streakDays,
                    )
                }
                .onFailure { error ->
                    _uiState.value = when (error) {
                        is NoWordForTodayException -> WordUiState.Empty
                        else -> WordUiState.Error(error.message ?: "Errore di rete")
                    }
                }
        }
    }

    fun saveWord() {
        val current = _uiState.value as? WordUiState.Success ?: return
        if (current.saveState == SaveState.Saving) return  // guard double-tap
        viewModelScope.launch {
            _uiState.value = current.copy(saveState = SaveState.Saving)
            wordRepository.saveWord()
                .onSuccess { result ->
                    _uiState.value = current.copy(
                        saveState = SaveState.Saved,
                        streakDays = result.streakDays,
                    )
                }
                .onFailure {
                    _uiState.value = current.copy(saveState = SaveState.Idle)
                }
        }
    }
}
```

Note: injecting the concrete `WordRepositoryImpl` (not the interface) is intentional here
so `getCachedStreak()` is accessible without widening the `WordRepository` interface.

---

### Screen layout

**Visual anatomy (top to bottom):**

```
┌────────────────────────────────────────────────┐
│  TopAppBar (transparent, Background colour)     │
│  [no title]               [🔥 StreakBadge]     │
├────────────────────────────────────────────────┤
│  Screen background: Background (#F5F2EB)        │
│                                                 │
│  ╔══════════════════════════════════════════╗   │
│  ║  Card — white, 20.dp corners, 4.dp elev  ║   │
│  ║  horiz margin 16.dp, internal pad 24.dp  ║   │
│  ║                                          ║   │
│  ║  [ArticleBadge]  [CefrBadge]             ║   │  row, top of card
│  ║                                          ║   │
│  ║  Schlüssel                               ║   │  WordHeading (40sp SemiBold)
│  ║  ˈʃlʏsl̩                                 ║   │  IpaStyle (16sp italic grey)
│  ║                                          ║   │
│  ║  ─────────────────────────────────────   ║   │  CardDivider (1.dp)
│  ║                                          ║   │
│  ║  SIGNIFICATO                             ║   │  SectionLabelStyle (11sp, grey, uppercase)
│  ║  chiave                                  ║   │  MeaningStyle (22sp)
│  ║                                          ║   │
│  ║  ─────────────────────────────────────   ║   │
│  ║                                          ║   │
│  ║  ESEMPIO                                 ║   │  SectionLabelStyle
│  ║  Ich habe den Schlüssel verloren.        ║   │  ExampleDeStyle (15sp, OnBackground)
│  ║  Ho perso la chiave.                     ║   │  ExampleItStyle (14sp, TextSecondary)
│  ║                                          ║   │
│  ║  ┌──────────────────────────────────┐    ║   │
│  ║  │ CardSectionBg (#F0EDE6)          │    ║   │  Rounded 12.dp, padding 16.dp
│  ║  │ 🎭 CURIOSITÀ CULTURALE           │    ║   │  SectionLabelStyle
│  ║  │ Keys are taken very seriously…   │    ║   │  CulturalNoteStyle (14sp)
│  ║  └──────────────────────────────────┘    ║   │
│  ║                                          ║   │
│  ╚══════════════════════════════════════════╝   │
│                                                 │
│  [SaveButton — full width, 56.dp height]        │  16.dp horizontal margin
│                                                 │
│  [Skip — TextButton, centred]                   │  48.dp height
│                                                 │
└────────────────────────────────────────────────┘
```

**Spacing constants** (use these exact values throughout, do not invent others):
```
SCREEN_HORIZONTAL_PADDING = 16.dp
CARD_INTERNAL_PADDING     = 24.dp
CARD_CORNER_RADIUS        = 20.dp
CARD_ELEVATION            = 4.dp
SECTION_SPACING           = 16.dp   // vertical gap between card sections
BADGE_SPACING             = 8.dp    // gap between ArticleBadge and CefrBadge
BUTTON_HEIGHT             = 56.dp
BUTTON_CORNER_RADIUS      = 14.dp
CULTURAL_NOTE_CORNER      = 12.dp
DIVIDER_THICKNESS         = 1.dp
```

---

### Component: `ArticleBadge`

Displays `der`, `die`, `das`, or nothing if `article == null`.
Badge background = article gender colour. Text = white. Shape = `RoundedCornerShape(8.dp)`.
Horizontal padding 10.dp, vertical padding 4.dp.

```kotlin
fun articleColor(article: String?): Color = when (article?.lowercase()) {
    "der"  -> ArticleDer
    "die"  -> ArticleDie
    "das"  -> ArticleDas
    else   -> ArticleNone
}
```

If `article == null`, do not render the badge at all (no empty placeholder).

`contentDescription` = `"Articolo: ${article ?: "nessun articolo"}"`.

---

### Component: `CefrBadge`

Identical shape/size to `ArticleBadge` but always `Surface` background with `CardDivider`
border (1.dp stroke), text `OnBackground`. Displays the `cefrBand` string (e.g. `"A2"`).
Only render if `cefrBand != null`.

`contentDescription` = `"Livello CEFR: $cefrBand"`.

---

### Component: `StreakBadge`

Displayed in the TopAppBar trailing slot. Layout: Row with 4.dp spacing.
- Text "🔥" (literal emoji, not an icon — accessibility is handled by the Row description)
- Text `"$streakDays giorni"` styled with `StreakStyle`, colour `OnBackground`
- `contentDescription` on the Row = `"Serie di $streakDays giorni consecutivi"`
- If `streakDays == 0`: do not render the badge at all

---

### Component: `SaveButton`

Three visual states, controlled by `SaveState`. Full-width. Height `BUTTON_HEIGHT`. Corner
`BUTTON_CORNER_RADIUS`.

**SaveState.Idle:**
```
background   = Primary (#1D9E75)
content      = Text "Salva la parola"  (white, bodyLarge bold 16sp)
enabled      = true
```

**SaveState.Saving:**
```
background   = Primary (#1D9E75)
content      = CircularProgressIndicator(color=White, strokeWidth=2.dp, size=20.dp)
enabled      = false   ← no-op on tap
```

**SaveState.Saved:**
```
background   = SavedButtonBg (#E8F5F0)
content      = Row: Icon(Icons.Rounded.Check, tint=SavedButtonContent, size=20.dp)
                    + 8.dp spacer
                    + Text "Salvata" (SavedButtonContent=#1D9E75, bodyLarge bold)
enabled      = false   ← no-op on tap
```

`contentDescription` per state:
- Idle: `"Salva la parola del giorno"`
- Saving: `"Salvataggio in corso"`
- Saved: `"Parola già salvata"`

---

### Component: `WordCard`

Stateless composable. Signature:
```kotlin
@Composable
fun WordCard(word: DailyWord, modifier: Modifier = Modifier)
```

Layout: `Card` (Material3) with `shape = RoundedCornerShape(CARD_CORNER_RADIUS)`,
`elevation = CardDefaults.cardElevation(defaultElevation = CARD_ELEVATION)`,
`colors = CardDefaults.cardColors(containerColor = Surface)`.

Internal: `Column(modifier = Modifier.padding(CARD_INTERNAL_PADDING))`.

Section order inside the column:
1. Row → `ArticleBadge` + `BADGE_SPACING` + `CefrBadge`
2. `SECTION_SPACING`
3. `Text(word.word, style=WordHeading, color=OnBackground)`
4. `4.dp` spacer
5. `word.ipa?.let { Text(it, style=IpaStyle, color=TextSecondary) }`
6. `SECTION_SPACING` + `Divider(color=CardDivider, thickness=DIVIDER_THICKNESS)`
7. `SECTION_SPACING`
8. `Text(stringResource(R.string.word_card_section_meaning), style=SectionLabelStyle, color=TextSecondary)`
9. `4.dp` spacer
10. `Text(word.meaningIt ?: "", style=MeaningStyle, color=OnBackground)`
11. `SECTION_SPACING` + `Divider`
12. `SECTION_SPACING`
13. `Text(stringResource(R.string.word_card_section_example), style=SectionLabelStyle, color=TextSecondary)`
14. `4.dp` spacer
15. `Text(word.exampleDe ?: "", style=ExampleDeStyle, color=OnBackground)`
16. `2.dp` spacer
17. `Text(word.exampleIt ?: "", style=ExampleItStyle, color=TextSecondary)`
18. `word.culturalNote?.let { note -> SECTION_SPACING + CulturalNoteSection(note) }`

**`CulturalNoteSection`** (private composable inside `WordCard.kt`):
`Box` with `background(CardSectionBg, RoundedCornerShape(CULTURAL_NOTE_CORNER))`,
internal padding 16.dp. Column with:
- `Text(stringResource(R.string.word_card_section_cultural), style=SectionLabelStyle, color=TextSecondary)`
- `4.dp` spacer
- `Text(note, style=CulturalNoteStyle, color=OnBackground)`

---

### Screen: `WordCardScreen`

Signature:
```kotlin
@Composable
fun WordCardScreen(
    onSkip: () -> Unit,
    viewModel: WordViewModel = hiltViewModel(),
)
```

The screen passes `onSkip` from the nav graph (caller passes `{ navController.navigate(Routes.VAULT) }`).

**State handling:**

`WordUiState.Loading` → centred `CircularProgressIndicator(color=Primary)` on `Background`.

`WordUiState.Empty` →
```
Column(centred on screen):
  Text(stringResource(R.string.word_card_empty), style=bodyLarge, color=TextSecondary)
```

`WordUiState.Error(message)` →
```
Column(centred, 16.dp spacing):
  Text(message, style=bodyLarge, color=TextSecondary, textAlign=Center)
  Button(onClick = { viewModel.loadTodayWord() }) {
      Text(stringResource(R.string.word_card_retry))
  }
```

`WordUiState.Success(word, saveState, streakDays)` → full layout:
```kotlin
Scaffold(
    topBar = {
        TopAppBar(
            title = {},   // no title — minimal bar
            actions = { if (streakDays > 0) StreakBadge(streakDays) },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = Background),
        )
    },
    containerColor = Background,
) { padding ->
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(horizontal = SCREEN_HORIZONTAL_PADDING)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.height(8.dp))
        WordCard(word = word, modifier = Modifier.fillMaxWidth())
        SaveButton(
            saveState = saveState,
            onClick = { viewModel.saveWord() },
            modifier = Modifier.fillMaxWidth(),
        )
        TextButton(
            onClick = onSkip,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
        ) {
            Text(
                text = stringResource(R.string.word_card_skip),
                style = MaterialTheme.typography.bodyLarge,
                color = TextSecondary,
            )
        }
        Spacer(Modifier.height(16.dp))
    }
}
```

**Wire up in `AppNavGraph.kt`:**
```kotlin
composable(Routes.WORD_CARD) {
    WordCardScreen(onSkip = { navController.navigate(Routes.VAULT) })
}
```

---

### Strings — `res/values/strings.xml`

Add these entries (do not remove existing ones):

```xml
<!-- Word Card screen -->
<string name="word_card_section_meaning">Significato</string>
<string name="word_card_section_example">Esempio</string>
<string name="word_card_section_cultural">Curiosità culturale</string>
<string name="word_card_save">Salva la parola</string>
<string name="word_card_saved">Salvata</string>
<string name="word_card_skip">Salta per oggi</string>
<string name="word_card_empty">Nessuna parola per oggi.\nTorna domani!</string>
<string name="word_card_retry">Riprova</string>
<string name="word_card_saving">Salvataggio in corso</string>

<!-- Accessibility -->
<string name="cd_article_badge">Articolo: %s</string>
<string name="cd_article_none">Nessun articolo</string>
<string name="cd_cefr_badge">Livello CEFR: %s</string>
<string name="cd_streak">Serie di %d giorni consecutivi</string>
<string name="cd_save_idle">Salva la parola del giorno</string>
<string name="cd_save_saving">Salvataggio in corso</string>
<string name="cd_save_saved">Parola già salvata</string>
```

---

## Tests

### ViewModel unit tests — `WordViewModelTest.kt`

Use a fake `WordRepositoryImpl` stub (not a mock — create a `FakeWordRepository` inner class
that directly implements `WordRepository` and exposes a `result` var). No Android dependencies.

```
test_initial_state_is_loading
    — state is Loading immediately after ViewModel creation (before coroutine completes)

test_success_state_after_word_loaded
    — fake repo returns a DailyWord(isSaved=false)
    — state becomes Success, saveState=Idle

test_already_saved_on_load
    — fake repo returns DailyWord(isSaved=true)
    — state becomes Success, saveState=Saved

test_empty_state_when_404
    — fake repo returns Result.failure(NoWordForTodayException())
    — state becomes WordUiState.Empty

test_save_transitions_and_streak_updates
    — initial Success with streakDays=2, saveState=Idle
    — fake saveWord returns SaveWordResult(streakDays=3, alreadySaved=false)
    — after saveWord(), state is Success with saveState=Saved and streakDays=3
```

Use `kotlinx-coroutines-test` and `TestScope` + `StandardTestDispatcher`. Inject via
constructor injection by passing the fake repo directly.

### Compose UI tests — `WordCardScreenTest.kt`

Instrumented tests (`@RunWith(AndroidJUnit4::class)`). Use `createComposeRule()`.
Override the Hilt ViewModel by providing a fake via `hiltRule` + `@UninstallModules`
— or more simply, test the composable directly by passing a fake `WordViewModel`-shaped
state (extract state into a parameter if needed to avoid Hilt in tests).

**Simplest approach**: extract a `WordCardContent` composable that takes `uiState` and
callbacks as parameters (no ViewModel dependency), and test `WordCardContent` directly.
`WordCardScreen` wraps `WordCardContent` and calls `hiltViewModel()` — keeping UI logic
fully testable without Hilt.

```
testWordCardDisplaysWord
    — render WordCardContent with a Success state containing word="Schlüssel"
    — assert Text("Schlüssel") is displayed

testSaveButtonShowsSavedState
    — render WordCardContent with saveState=SaveState.Saved
    — assert Text(R.string.word_card_saved) is displayed
    — assert Save button is NOT clickable (assert no "Salva la parola" text)

testLoadingShowsProgressIndicator
    — render WordCardContent with WordUiState.Loading
    — assert CircularProgressIndicator is present (use semantics / testTag)
    — add testTag("loading_indicator") to the CircularProgressIndicator in implementation
```

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] All 8 tests pass (`./gradlew test` + `./gradlew connectedAndroidTest`)
- [ ] `./gradlew assembleDebug` passes with no errors
- [ ] Zero hardcoded Italian strings in Kotlin files
- [ ] All Compose elements have `contentDescription`
- [ ] Article badge shows correct gender colour on a real device or emulator
- [ ] Save button transitions through all three states without visual glitch
- [ ] No API keys or secrets in code
- [ ] Conventional commit: `feat(TASK-004): WordCard screen with GET /word/today and POST /word/save`
- [ ] TASK status updated to `done`
