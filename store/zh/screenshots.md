# ChineseBuddy — screenshot shot list

Capture on a real phone, with ChineseBuddy installed from `build_bundle_android_release.bat zh`.
Five shots per UI language (it, en):

| # | Screen | File name | What must be visible |
|---|--------|-----------|----------------------|
| 1 | Vault | `1-vault-<ui>.png` | 6–8 saved words with pinyin and review-date chips; one word due |
| 2 | Today's word | `2-today-<ui>.png` | characters, pinyin, meaning, example, note, speaker button |
| 3 | Review | `3-review-<ui>.png` | a typed fill-in-the-blank card with pinyin over the sentence |
| 4 | Tone choice | `4-tone-<ui>.png` | the four tone options of a word |
| 5 | Grammar | `5-grammar-<ui>.png` | a measure-word question (一 ___ 书) |

**Set-up:** a fresh install; save words from several topics (e.g. 书, 茶, 老师, 学校, 猫), plus a few more from the word list so one is due.
Use the UI language under test (Settings → language).

**Avoid:** real learner data, the notification shade, debug banners, a keyboard covering the answer, the AI key screen.
Size: 1080×1920 or the phone's native portrait size, PNG, no device frame. Do not publish a language whose listing is still `draft`.
