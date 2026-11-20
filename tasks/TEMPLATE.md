# TASK-XXX — [Short Task Title]

**Status:** `draft` | `ready` | `in-progress` | `done`
**Assigned to:** Developer (Sonnet)
**Written by:** Tech Lead (Opus)
**Depends on:** TASK-YYY (must be merged first), or `none`

---

## Context

*1-3 sentences. Why does this task exist? What problem does it solve?
Reference the relevant section of CLAUDE.md if applicable.*

---

## Scope

### In scope
- Specific thing to build
- Another specific thing to build

### Out of scope
- Thing that might seem related but is NOT part of this task
- Another thing to defer

---

## Acceptance Criteria

> The task is done when ALL of these are true. Developer self-checks before marking done.

- [ ] AC1: Specific, testable, observable outcome
- [ ] AC2: Another specific outcome
- [ ] AC3: Tests written and passing
- [ ] AC4: No regressions in existing functionality

---

## Technical Spec

*This is the detailed implementation guide. Tech Lead writes this with enough precision
that Developer makes zero architectural decisions. If a decision needs to be made,
Tech Lead makes it here — not Developer mid-implementation.*

### Files to create
```
path/to/NewFile.kt        — purpose
path/to/AnotherFile.py    — purpose
```

### Files to modify
```
path/to/ExistingFile.kt   — what changes and why
```

### Implementation notes

**Section 1 — specific subsystem:**
Detailed description of what to build. Include:
- Class/function names
- Key logic (copy from CLAUDE.md if relevant)
- Edge cases to handle
- Error handling approach

```kotlin
// Example code or pseudocode if helpful
data class ExampleModel(
    val id: String,
    val value: String
)
```

**Section 2 — another subsystem:**
Continue as needed.

---

## API Contract

*Fill in only if this task creates or changes an API endpoint.*

```
METHOD /path/to/endpoint
Authorization: Bearer <jwt>

Request body:
{
  "field": "type — description"
}

Response 200:
{
  "field": "type — description"
}

Response 4xx:
{
  "detail": "error message"
}
```

---

## Database Changes

*Fill in only if this task creates or modifies DB schema.*

```sql
-- New table / ALTER / index
-- Copy exact SQL, consistent with schema in CLAUDE.md
```

Migration file: `backend/alembic/versions/XXX_description.py`

---

## Tests

*List the specific tests Developer must write. Be explicit — don't say "write tests", say which cases.*

### Backend (pytest)
- `test_xxx_happy_path` — description
- `test_xxx_edge_case` — description
- `test_xxx_error_case` — description

### Android (JUnit / Compose UI test)
- `testXxxDisplaysCorrectly` — description
- `testXxxOnSaveUpdatesState` — description

---

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] All specified tests written and green
- [ ] No hardcoded strings (Android: all in strings.xml)
- [ ] No API keys or secrets in code
- [ ] Conventional commit: `feat(TASK-XXX): short description`
- [ ] TASK status updated to `done`

---

## Notes for Tech Lead

*Remove this section before handing to Developer.*

- Design considerations, alternatives rejected, open questions
- Things to watch for in the next task after this one
