# TASK-015 — Seed daily word on onboarding completion

**Status:** `ready`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-014 (must be merged first)

---

## Context

After onboarding completes (`POST /profile/onboarding` returns 200), the mobile app navigates to the home screen which immediately calls `GET /word/today`. This returns 404 because the nightly job hasn't run for the new user yet. The fix is to call `generate_for_user(user_id)` synchronously inside the onboarding handler, before returning the response, so today's word exists by the time the client needs it.

---

## Scope

### In scope
- Call `await generate_for_user(str(user.id))` at the end of the `POST /profile/onboarding` handler, after commit + refresh
- One new test: `test_onboarding_seeds_daily_word`
- Update existing `test_onboarding_200` to account for the new call

### Out of scope
- Changes to `generate_for_user()` itself — do not modify word_generator.py
- Changes to `GET /word/today`
- Any new routes or schema changes
- Alembic migrations

---

## Acceptance Criteria

> The task is done when ALL of these are true. Developer self-checks before marking done.

- [ ] AC1: `POST /profile/onboarding` calls `generate_for_user(str(user.id))` after commit
- [ ] AC2: If `generate_for_user` raises, the exception is swallowed — onboarding response is still returned (note: `generate_for_user` already handles all exceptions internally; no extra try/except needed in the router)
- [ ] AC3: `test_onboarding_seeds_daily_word` passes — asserts `generate_for_user` was called with the correct user_id string
- [ ] AC4: Full backend test suite passes with no regressions

---

## Technical Spec

### Files to modify
```
backend/app/routers/profile.py      — call generate_for_user at end of onboarding handler
backend/tests/test_profile.py       — add test_onboarding_seeds_daily_word; patch generate_for_user in existing tests
```

### Files to create
```
(none)
```

### Implementation notes

**profile.py — onboarding handler change:**

At the top of `profile.py`, add the import:
```python
from app.services.word_generator import generate_for_user
```

In the `onboarding()` handler, after `await db.commit()` and `await db.refresh(profile)`, add:
```python
await generate_for_user(str(user.id))
```

The full tail of the handler should read:
```python
    await db.commit()
    await db.refresh(profile)
    await generate_for_user(str(user.id))
    return await _build_profile_response(db, profile)
```

No try/except is needed around the call. `generate_for_user` catches all its own exceptions internally (Claude API errors, DB errors, timeouts) and falls back to `pick_fallback(cefr_level)`. If even the fallback fails, it logs to Sentry and returns — it never re-raises. The onboarding response is unaffected.

**test_profile.py — patching strategy:**

`generate_for_user` is a coroutine, so mock it with `AsyncMock`. Patch at the import site in the router module: `"app.routers.profile.generate_for_user"`.

All existing tests in `test_profile.py` that call `POST /profile/onboarding` must patch `generate_for_user` to prevent actual word generation. Add this patch to `test_onboarding_200`, `test_onboarding_invalid_cefr` (N/A — fails at validation before the call), `test_onboarding_rule_count_*`, and `test_onboarding_idempotent`.

For all existing onboarding tests, add as a decorator or context manager:
```python
@patch("app.routers.profile.generate_for_user", new_callable=AsyncMock)
```

Or use `pytest.mark.usefixtures` if a fixture is cleaner — match the style already in the file.

**New test — `test_onboarding_seeds_daily_word`:**

```python
@patch("app.routers.profile.generate_for_user", new_callable=AsyncMock)
async def test_onboarding_seeds_daily_word(mock_gen, client, ...):
    response = await client.post("/profile/onboarding", json={
        "cefr_level": "B1",
        "topic_preferences": {"food": 0.8, "travel": 0.8, ...}
    }, headers=auth_headers)
    assert response.status_code == 200
    mock_gen.assert_called_once_with(<user_id_string>)
```

The `user_id` string must match what the handler passes — `str(user.id)`. In the test setup, the mock user object has a known `id` (UUID), so assert `mock_gen.assert_called_once_with(str(mock_user.id))`.

Match the exact fixture/helper style already used in `test_profile.py` for user setup and auth headers.

---

## API Contract

No changes to request/response contract. `POST /profile/onboarding` returns the same `ProfileResponse` as before.

---

## Database Changes

None.

---

## Tests

### Backend (pytest)
- `test_onboarding_seeds_daily_word` — POST /profile/onboarding, assert `generate_for_user` called once with `str(user.id)`
- All existing `test_onboarding_*` tests — add `generate_for_user` patch so they don't hit word generation code

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] All specified tests written and green
- [ ] No API keys or secrets in code
- [ ] Conventional commit: `feat(TASK-015): seed daily word on onboarding`
- [ ] TASK status updated to `done`
