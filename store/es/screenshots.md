# SpanishBuddy — screenshot shot list

Capture on a real phone (TASK-049), with SpanishBuddy installed from `build_bundle_android_release.bat es`.
Five shots per UI language, same order as GermanBuddy's `assets/screenshots/<lang>/`:

| # | Screen | File name | What must be visible |
|---|--------|-----------|----------------------|
| 1 | Vault ("Vocabolario" / "Vocabulary") | `1-vault-<ui>.png` | 6–8 saved words with different articles (el/la) and review-date chips; one word due |
| 2 | Today's word | `2-today-<ui>.png` | article, IPA, meaning, example, cultural note, speaker button |
| 3 | Review | `3-review-<ui>.png` | a typed fill-in-the-blank card mid-session |
| 4 | Matching | `4-match-<ui>.png` | a matching round with one pair already linked |
| 5 | Sentence reorder | `5-reorder-<ui>.png` | tiles partly placed |

Languages: it en fr pt ru uk pl tr zh ja hi ar (the app's UI languages for Spanish; no `es`).

**Set-up:** a fresh install at level A1; save 3 A1 words with different articles (e.g. *casa*, *libro*, *agua*), plus 4–5 more from the
word list so one is due. Use the UI language under test (Settings → language); Arabic needs a restart for the right-to-left layout.

**Avoid:** real learner data, the notification shade, debug banners, a keyboard covering the answer, the AI key screen.
Size: 1080×1920 or the phone's native portrait size, PNG, no device frame. Do not publish a language whose listing is still `draft`.
