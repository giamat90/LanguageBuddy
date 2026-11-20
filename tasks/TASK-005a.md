# TASK-005a — Paywall Screen + Play Billing Integration

**Status:** `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-004 (merged ✓)

---

## Context

The paywall is the product's revenue engine. Per CLAUDE.md §10, it appears immediately
after the user taps Save on the word card — the peak intent moment. Two subscription tiers:
`pro_monthly` (€6.99/mo) and `pro_annual` (€49/yr), both with a 7-day free trial.

Purchase verification is server-side only — the Android client sends the raw Play Billing
purchase token to `POST /billing/webhook`, and the backend verifies it via the Google Play
Android Developer API before setting `users.is_pro = true`.

This task also adds the `is_pro` column to the `users` table (Alembic migration) and
persists `is_pro` to DataStore after server confirmation. TASK-005b reads that DataStore
value to gate chat access.

---

## Scope

### In scope
- Backend: `POST /billing/webhook` route + `billing_service.py` (Google Play token verification)
- Backend: Alembic migration adding `is_pro` + `pro_expires_at` to `users` table
- Android: `PaywallScreen.kt` + `PaywallUiState.kt` + `PaywallViewModel.kt`
- Android: `BillingRepository.kt` interface + `BillingRepositoryImpl.kt` (Play Billing v6)
- Android: `BillingModule.kt` Hilt DI
- Android: `WortschatzApi.kt` — add billing verify endpoint
- Android: Persist `is_pro` to DataStore after server confirms purchase
- Android: Trigger PaywallScreen navigation from WordCardScreen after successful save
- Navigation: add `Routes.PAYWALL` to `AppNavGraph.kt`
- Strings: all Italian strings in `strings.xml`
- Tests: 3 backend + 3 Android

### Out of scope
- Chat screen / session start (TASK-005b)
- Subscription management / cancellation UI
- Google Play Real-Time Developer Notifications via Pub/Sub (v1.1)
- Restore purchases flow (v1.1)
- Analytics / conversion tracking

---

## Acceptance Criteria

- [ ] After tapping Save (and save succeeds), PaywallScreen appears
- [ ] PaywallScreen shows two plans with prices loaded from Play Billing `ProductDetails`
- [ ] Annual plan is pre-selected by default
- [ ] Tapping "Inizia la prova gratuita" launches the Play Billing flow for the selected plan
- [ ] On purchase success: purchase token is POSTed to `/billing/webhook`; on 200 response `is_pro = true` is written to DataStore
- [ ] Backend rejects invalid/expired tokens with 400
- [ ] Dismiss ("Forse più tardi") navigates to `Routes.VAULT`
- [ ] If DataStore already has `is_pro = true` when PaywallScreen opens, it auto-dismisses to `Routes.VAULT`
- [ ] All strings are in `strings.xml` — zero hardcoded Italian strings in Kotlin
- [ ] All specified tests pass

---

## Technical Spec

### Files to create
```
android/app/src/main/java/com/wortschatz/ui/paywall/PaywallUiState.kt
android/app/src/main/java/com/wortschatz/ui/paywall/PaywallViewModel.kt
android/app/src/main/java/com/wortschatz/ui/paywall/PaywallScreen.kt
android/app/src/main/java/com/wortschatz/data/billing/BillingRepository.kt
android/app/src/main/java/com/wortschatz/data/billing/BillingRepositoryImpl.kt
android/app/src/main/java/com/wortschatz/di/BillingModule.kt
android/app/src/main/java/com/wortschatz/data/remote/dto/VerifyPurchaseDto.kt
android/app/src/test/java/com/wortschatz/ui/paywall/PaywallViewModelTest.kt
android/app/src/androidTest/java/com/wortschatz/ui/paywall/PaywallScreenTest.kt
backend/app/routers/billing.py
backend/app/services/billing_service.py
backend/app/schemas/billing.py          — Pydantic schemas for billing
backend/tests/test_billing_router.py
backend/alembic/versions/002_add_is_pro_to_users.py
```

### Files to modify
```
android/app/src/main/java/com/wortschatz/data/remote/WortschatzApi.kt      — add billing endpoint
android/app/src/main/java/com/wortschatz/ui/word/WordCardScreen.kt          — add onSaveSuccess callback trigger
android/app/src/main/java/com/wortschatz/ui/navigation/AppNavGraph.kt       — add PAYWALL route
android/app/src/main/res/values/strings.xml                                 — paywall strings
backend/app/main.py                                                          — include billing router
backend/requirements.txt                                                     — add google-api-python-client
backend/app/core/config.py                                                   — add GOOGLE_PLAY_SERVICE_ACCOUNT_JSON setting
```

---

### Database migration — `002_add_is_pro_to_users.py`

```python
"""add is_pro to users

Revision ID: 002
Revises: 001
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column("users", sa.Column("is_pro", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("pro_expires_at", sa.TIMESTAMP(timezone=True), nullable=True))

def downgrade():
    op.drop_column("users", "pro_expires_at")
    op.drop_column("users", "is_pro")
```

Also add `is_pro` and `pro_expires_at` fields to the `User` SQLAlchemy model in `backend/app/models/db.py`:
```python
is_pro: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
pro_expires_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
```

---

### Backend — `backend/app/core/config.py`

Add one new setting:
```python
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: str = ""  # JSON string of Play service account
```

---

### Backend — `backend/app/services/billing_service.py`

```python
import json
from datetime import datetime, timezone
from googleapiclient.discovery import build
from google.oauth2 import service_account

PACKAGE_NAME = "com.wortschatz"
PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
VALID_PRODUCTS = {"pro_monthly", "pro_annual"}


def _get_play_service():
    from app.core.config import settings
    credentials = service_account.Credentials.from_service_account_info(
        json.loads(settings.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON),
        scopes=[PLAY_SCOPE],
    )
    return build("androidpublisher", "v3", credentials=credentials, cache_discovery=False)


async def verify_subscription(purchase_token: str, product_id: str) -> dict:
    """
    Returns {"is_pro": True, "expires_at": datetime} or raises ValueError.
    purchase_state 1 = active. payment_state 1 = paid, 2 = free trial.
    """
    if product_id not in VALID_PRODUCTS:
        raise ValueError(f"Unknown product: {product_id}")

    service = _get_play_service()  # googleapiclient is sync — run in threadpool
    result = (
        service.purchases()
        .subscriptionsv2()
        .get(packageName=PACKAGE_NAME, token=purchase_token)
        .execute()
    )

    # subscriptionState: ACTIVE = "SUBSCRIPTION_STATE_ACTIVE"
    state = result.get("subscriptionState", "")
    if state != "SUBSCRIPTION_STATE_ACTIVE":
        raise ValueError(f"Subscription not active: {state}")

    # expiryTime is ISO 8601 string
    expiry_str = result.get("lineItems", [{}])[0].get("expiryTime", "")
    expires_at = datetime.fromisoformat(expiry_str.replace("Z", "+00:00")) if expiry_str else None

    return {"is_pro": True, "expires_at": expires_at}
```

Note: `_get_play_service()` is a sync call. The route must wrap it with `asyncio.get_event_loop().run_in_executor(None, ...)` or call it via `asyncio.to_thread`. Spec it as:

```python
import asyncio

async def verify_subscription(purchase_token: str, product_id: str) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _verify_sync, purchase_token, product_id)

def _verify_sync(purchase_token: str, product_id: str) -> dict:
    # ... googleapiclient call as above
```

---

### Backend — `backend/app/routers/billing.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.core.db import get_db
from app.models.db import User
from app.services.billing_service import verify_subscription
from app.schemas.billing import VerifyPurchaseRequest, VerifyPurchaseResponse

router = APIRouter(prefix="/billing", tags=["billing"])

@router.post("/webhook", response_model=VerifyPurchaseResponse)
async def billing_webhook(
    body: VerifyPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await verify_subscription(body.purchase_token, body.product_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    current_user.is_pro = True
    current_user.pro_expires_at = result["expires_at"]
    await db.commit()

    return VerifyPurchaseResponse(is_pro=True)
```

### Backend — `backend/app/schemas/billing.py`

```python
from pydantic import BaseModel

class VerifyPurchaseRequest(BaseModel):
    purchase_token: str
    product_id: str      # "pro_monthly" | "pro_annual"
    package_name: str    # must equal "com.wortschatz"

class VerifyPurchaseResponse(BaseModel):
    is_pro: bool
```

Register in `main.py`:
```python
from app.routers.billing import router as billing_router
app.include_router(billing_router, prefix="/v1")
```

---

### Android — DTOs

**`data/remote/dto/VerifyPurchaseDto.kt`**
```kotlin
data class VerifyPurchaseRequest(
    @SerializedName("purchase_token") val purchaseToken: String,
    @SerializedName("product_id")     val productId: String,
    @SerializedName("package_name")   val packageName: String = "com.wortschatz",
)

data class VerifyPurchaseResponse(
    @SerializedName("is_pro") val isPro: Boolean,
)
```

### Android — Retrofit API

Add to `WortschatzApi.kt`:
```kotlin
@POST("billing/webhook")
suspend fun verifyPurchase(@Body body: VerifyPurchaseRequest): VerifyPurchaseResponse
```

---

### Android — DataStore key

Add to the existing `AppModule.kt` DataStore setup or `WordRepositoryImpl.kt` companion:

```kotlin
val IS_PRO_KEY = booleanPreferencesKey("is_pro")
```

Place this in a new file `data/local/PreferencesKeys.kt` so both `WordRepositoryImpl` and
`BillingRepositoryImpl` can import it without a circular dependency:
```kotlin
object PreferencesKeys {
    val STREAK_KEY  = intPreferencesKey("streak_days")
    val IS_PRO_KEY  = booleanPreferencesKey("is_pro")
}
```

Update `WordRepositoryImpl.kt` to import from `PreferencesKeys` instead of using its own
companion `STREAK_KEY`.

---

### Android — BillingRepository

**`data/billing/BillingRepository.kt`**
```kotlin
interface BillingRepository {
    suspend fun loadProducts(): Result<List<ProductDetails>>
    suspend fun launchBillingFlow(activity: Activity, productDetails: ProductDetails): Result<Unit>
    suspend fun verifyAndActivate(purchaseToken: String, productId: String): Result<Unit>
    suspend fun getIsPro(): Boolean
}
```

**`data/billing/BillingRepositoryImpl.kt`**

Key implementation notes:
- Inject `BillingClient`, `WortschatzApi`, `DataStore<Preferences>` via Hilt
- `loadProducts()`: calls `BillingClient.queryProductDetailsAsync` for both subscription
  product IDs (`pro_monthly`, `pro_annual`). Wrap result in `Result`.
- `launchBillingFlow(activity, productDetails)`: builds `BillingFlowParams` with a
  `ProductDetailsParamsList` containing one item (the selected product), calls
  `billingClient.launchBillingFlow(activity, params)`. Returns `Result.success(Unit)` if
  `BillingClient.BillingResponseCode.OK`, otherwise `Result.failure`.
- `verifyAndActivate(purchaseToken, productId)`: POSTs to backend, on success writes
  `IS_PRO_KEY = true` to DataStore.
- `getIsPro()`: reads `IS_PRO_KEY` from DataStore, returns false if absent.

BillingClient setup:
```kotlin
@Singleton
class BillingRepositoryImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: WortschatzApi,
    private val dataStore: DataStore<Preferences>,
) : BillingRepository, PurchasesUpdatedListener {

    private val _purchaseResult = MutableSharedFlow<Purchase>(extraBufferCapacity = 1)
    val purchaseResult: SharedFlow<Purchase> = _purchaseResult.asSharedFlow()

    private val billingClient: BillingClient = BillingClient.newBuilder(context)
        .setListener(this)
        .enablePendingPurchases()
        .build()

    override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
            purchases?.forEach { _purchaseResult.tryEmit(it) }
        }
    }

    private suspend fun ensureConnected() { /* connect if not ready */ }
    // ... implement interface methods
}
```

The `onPurchasesUpdated` result flows into `PaywallViewModel` via `purchaseResult`. The ViewModel
collects it and calls `verifyAndActivate()`.

---

### Android — BillingModule

**`di/BillingModule.kt`**
```kotlin
@Module
@InstallIn(SingletonComponent::class)
abstract class BillingModule {
    @Binds
    abstract fun bindBillingRepository(impl: BillingRepositoryImpl): BillingRepository
}
```

---

### Android — PaywallUiState

**`ui/paywall/PaywallUiState.kt`**
```kotlin
enum class SelectedPlan { Monthly, Annual }

sealed class PaywallUiState {
    object Loading : PaywallUiState()   // loading ProductDetails from Play
    data class Ready(
        val monthlyDetails: ProductDetails,
        val annualDetails: ProductDetails,
        val selectedPlan: SelectedPlan = SelectedPlan.Annual,
        val isPurchasing: Boolean = false,
        val error: String? = null,
    ) : PaywallUiState()
    object AlreadyPro : PaywallUiState()  // user already subscribed → auto-dismiss
    object Purchased : PaywallUiState()   // purchase confirmed by server
}
```

---

### Android — PaywallViewModel

**`ui/paywall/PaywallViewModel.kt`**
```kotlin
@HiltViewModel
class PaywallViewModel @Inject constructor(
    private val billingRepository: BillingRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<PaywallUiState>(PaywallUiState.Loading)
    val uiState: StateFlow<PaywallUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            if (billingRepository.getIsPro()) {
                _uiState.value = PaywallUiState.AlreadyPro
                return@launch
            }
            billingRepository.loadProducts()
                .onSuccess { products ->
                    val monthly = products.first { it.productId == "pro_monthly" }
                    val annual  = products.first { it.productId == "pro_annual" }
                    _uiState.value = PaywallUiState.Ready(monthly, annual)
                }
                .onFailure { e ->
                    _uiState.value = PaywallUiState.Ready(
                        // fallback: show hardcoded prices if Play unavailable
                        // ProductDetails cannot be constructed; leave as error state
                    )
                    // For simplicity: show error message if products fail to load
                }
        }

        // Collect purchase results from BillingClient callback
        viewModelScope.launch {
            (billingRepository as? BillingRepositoryImpl)
                ?.purchaseResult
                ?.collect { purchase ->
                    handlePurchase(purchase)
                }
        }
    }

    fun selectPlan(plan: SelectedPlan) {
        val current = _uiState.value as? PaywallUiState.Ready ?: return
        _uiState.value = current.copy(selectedPlan = plan)
    }

    fun startPurchase(activity: Activity) {
        val current = _uiState.value as? PaywallUiState.Ready ?: return
        if (current.isPurchasing) return
        _uiState.value = current.copy(isPurchasing = true)
        viewModelScope.launch {
            val product = if (current.selectedPlan == SelectedPlan.Annual)
                current.annualDetails else current.monthlyDetails
            billingRepository.launchBillingFlow(activity, product)
                .onFailure {
                    _uiState.value = current.copy(isPurchasing = false, error = "Acquisto non riuscito")
                }
            // success path continues via onPurchasesUpdated → purchaseResult flow
        }
    }

    private suspend fun handlePurchase(purchase: Purchase) {
        val current = _uiState.value as? PaywallUiState.Ready ?: return
        billingRepository.verifyAndActivate(purchase.purchaseToken, purchase.products.first())
            .onSuccess { _uiState.value = PaywallUiState.Purchased }
            .onFailure { _uiState.value = current.copy(isPurchasing = false, error = "Verifica acquisto fallita") }
    }
}
```

---

### Android — Paywall visual layout

**Visual anatomy (top to bottom, `Background` screen):**

```
┌──────────────────────────────────────────────────┐
│  [X dismiss — top right, IconButton]             │
│                                                  │
│  🎯 Lena vuole praticare                         │ 28sp Bold, OnBackground
│     questa parola con te →                       │
│                                                  │
│  Sblocca Wortschatz Pro                          │ 16sp, TextSecondary
│                                                  │
│  ✓  Sessioni di chat illimitate                  │ 14sp, OnBackground, icon=Check Primary
│  ✓  Riepilogo grammaticale                       │
│  ✓  Tracciamento progressi                       │
│  ✓  Ripetizione spaziata (SRS)                   │
│                                                  │
│  ╔══════════════════════════════════════════╗    │ tappable Card, 16dp corner
│  ║  Mensile             €6,99 / mese        ║    │ border=CardDivider if unselected
│  ║  Prova gratis 7 giorni                   ║    │ border=Primary+2dp if selected
│  ╚══════════════════════════════════════════╝    │
│                                                  │
│  ╔══════════════════════════════════════════╗    │ Annual pre-selected by default
│  ║  Annuale  ★ RISPARMIA 41%  €49 / anno   ║    │
│  ║  Prova gratis 7 giorni                   ║    │
│  ╚══════════════════════════════════════════╝    │
│                                                  │
│  [Inizia la prova gratuita]  ← Primary button    │ full width, 56dp, BUTTON_CORNER_RADIUS
│  (shows CircularProgressIndicator when isPurchasing)
│                                                  │
│  [Forse più tardi]           ← TextButton grey   │
│                                                  │
│  Puoi annullare in qualsiasi momento             │ 12sp, TextTertiary, centred
└──────────────────────────────────────────────────┘
```

Spacing constants: reuse `SCREEN_HORIZONTAL_PADDING = 16.dp`, `SECTION_SPACING = 16.dp`,
`BUTTON_HEIGHT = 56.dp`, `BUTTON_CORNER_RADIUS = 14.dp` from `WordCardDimensions.kt`.
New constant: `PLAN_CARD_CORNER = 16.dp` — define in a new `PaywallDimensions.kt` file.

Plan card price text: load from `ProductDetails.subscriptionOfferDetails[0].pricingPhases.pricingPhaseList.last().formattedPrice` — this is the real price string from Play Billing. Do not hardcode `€6,99`.

**Split composable**: `PaywallScreen(viewModel = hiltViewModel())` wraps `PaywallContent(uiState, onSelectPlan, onStartPurchase, onDismiss)` exactly as TASK-004 split `WordCardScreen`/`WordCardContent`. Tests hit `PaywallContent` directly.

---

### Android — Navigation changes

**`ui/navigation/AppNavGraph.kt`**

Add route constant:
```kotlin
object Routes {
    const val WORD_CARD = "word_card"
    const val VAULT     = "vault"
    const val PAYWALL   = "paywall"   // NEW
    const val CHAT      = "chat"      // placeholder — TASK-005b wires this
}
```

Add composable:
```kotlin
composable(Routes.PAYWALL) {
    PaywallScreen(
        onDismiss     = { navController.navigate(Routes.VAULT) { popUpTo(Routes.PAYWALL) { inclusive = true } } },
        onPurchased   = { navController.navigate(Routes.VAULT) { popUpTo(Routes.PAYWALL) { inclusive = true } } },
    )
}
```

**`ui/word/WordCardScreen.kt`** — modify `WordCardContent` to accept an `onSaveSuccess` callback,
and fire it when `saveState` transitions to `Saved` via `LaunchedEffect`:

```kotlin
@Composable
fun WordCardContent(
    uiState: WordUiState,
    onSkip: () -> Unit,
    onSave: () -> Unit,
    onRetry: () -> Unit,
    onSaveSuccess: () -> Unit = {},   // NEW — default no-op for tests
) {
    if (uiState is WordUiState.Success) {
        LaunchedEffect(uiState.saveState) {
            if (uiState.saveState == SaveState.Saved) {
                onSaveSuccess()
            }
        }
    }
    // ... rest of layout unchanged
}
```

`WordCardScreen` passes `onSaveSuccess = { navController.navigate(Routes.PAYWALL) }`.

---

### Strings — `res/values/strings.xml`

```xml
<!-- Paywall screen -->
<string name="paywall_headline">Lena vuole praticare\nquesta parola con te →</string>
<string name="paywall_subhead">Sblocca Wortschatz Pro</string>
<string name="paywall_feature_chat">Sessioni di chat illimitate</string>
<string name="paywall_feature_recap">Riepilogo grammaticale</string>
<string name="paywall_feature_progress">Tracciamento progressi</string>
<string name="paywall_feature_srs">Ripetizione spaziata (SRS)</string>
<string name="paywall_plan_monthly">Mensile</string>
<string name="paywall_plan_annual">Annuale</string>
<string name="paywall_plan_annual_badge">★ RISPARMIA 41%</string>
<string name="paywall_trial">Prova gratis 7 giorni</string>
<string name="paywall_cta">Inizia la prova gratuita</string>
<string name="paywall_dismiss">Forse più tardi</string>
<string name="paywall_legal">Puoi annullare in qualsiasi momento</string>
<string name="paywall_error_purchase">Acquisto non riuscito</string>
<string name="paywall_error_verify">Verifica acquisto fallita</string>
```

---

## API Contract

```
POST /v1/billing/webhook
Authorization: Bearer <firebase_jwt>

Request body:
{
  "purchase_token": "string — raw token from Play Billing",
  "product_id":     "string — \"pro_monthly\" | \"pro_annual\"",
  "package_name":   "string — must be \"com.wortschatz\""
}

Response 200:
{
  "is_pro": true
}

Response 400:
{
  "detail": "Subscription not active: SUBSCRIPTION_STATE_CANCELED"
}

Response 422:
{
  "detail": "Unknown product: ..."
}
```

---

## Tests

### Backend — `test_billing_router.py`

- `test_billing_webhook_valid_token` — mock `billing_service.verify_subscription` to return
  `{"is_pro": True, "expires_at": datetime(...)}`. POST valid body → 200, `{"is_pro": true}`.
  Assert `user.is_pro == True` in DB.

- `test_billing_webhook_invalid_token` — mock `verify_subscription` to raise
  `ValueError("Subscription not active: SUBSCRIPTION_STATE_CANCELED")`. POST → 400.

- `test_billing_webhook_unknown_product` — send `product_id = "unknown"` → 422 or 400
  (the `ValueError` from `verify_subscription`).

Use `app.dependency_overrides` to bypass Firebase auth (same pattern as TASK-003 tests).
Patch `app.services.billing_service.verify_subscription` with `unittest.mock.patch`.

### Android — `PaywallViewModelTest.kt` (unit test, no Android)

- `test_already_pro_shows_already_pro_state` — fake `BillingRepository.getIsPro()` returns
  true → state becomes `PaywallUiState.AlreadyPro`.

### Android — `PaywallScreenTest.kt` (instrumented Compose test)

- `testPaywallShowsPlanCards` — render `PaywallContent` with a fake `PaywallUiState.Ready`
  (use test doubles for `ProductDetails` or pass pre-formatted price strings). Assert
  `R.string.paywall_plan_monthly` and `R.string.paywall_plan_annual` are displayed.

- `testPaywallDismissCallsCallback` — render `PaywallContent`, tap dismiss button, assert
  `onDismiss` lambda was invoked.

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] All 5 specified tests written and green
- [ ] `./gradlew assembleDebug` passes with no errors
- [ ] Zero hardcoded Italian strings in Kotlin files
- [ ] `is_pro` is written to DataStore after server confirms purchase
- [ ] PaywallScreen auto-dismisses if already Pro on open
- [ ] No API keys or secrets in code
- [ ] `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` added to `.env.example` (empty value only)
- [ ] Alembic migration runs cleanly: `alembic upgrade head`
- [ ] Conventional commit: `feat(TASK-005a): paywall screen and Play Billing integration`
- [ ] TASK status updated to `done`
