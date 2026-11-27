# ChineseBuddy — icon and feature graphic brief

**Status:** the app icon is Chinese-specific (`mobile/assets/icon-zh.png`, `adaptive-icon-zh.png`): the same word-card idea as the other apps, with
the pinyin "zì" over the character 字 on jade green (`#0F6B50`, adaptive background and app colour) and three accent dashes. It was generated, not
hand-drawn: the Product Owner may replace it with real art. The 1024×500 feature graphic is still to do.

| Asset | Size | Notes |
|-------|------|-------|
| App icon | 512×512 PNG (32-bit, ≤ 1 MB); also the adaptive icon foreground (`mobile/assets/adaptive-icon-zh.png`, safe zone: keep the mark inside the central 66%) | one simple mark, readable at 48 px |
| Feature graphic | 1024×500 PNG/JPEG, no transparency | name "ChineseBuddy" in Latin script; keep text out of the outer 10% |

**Palette:** the `zh` entry of `mobile/src/theme/palettes.ts` (jade, dark green ink, gold). Red belongs to SpanishBuddy.
**Type:** the app's display face (Playfair Display) for the name; Chinese characters in a clear simplified-Chinese face.
**Do not use:** flags, maps, national symbols, the Great Wall or other national shorthand, rankings, "best", "official", store badges, screenshots
with learner data, claims about reviews or exams.
Changing the icon files also needs the `icon` / `adaptiveIcon` fields in `mobile/variants/zh.json` (and a `variants.test.ts` run: it checks the files exist).
