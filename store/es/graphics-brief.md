# SpanishBuddy — icon and feature graphic brief

**Status:** the app icon is now Spanish-specific (`mobile/assets/icon-es.png`, `adaptive-icon-es.png`, 2026-11-21): the same word-card idea as
GermanBuddy ("LA / Palabra") on the red brand colour (`#AA151B`, the red of the Spanish flag, as adaptive background and app colour), with non-flag accent dashes. It was generated, not hand-drawn:
the Product Owner may replace it with real art. The 1024×500 feature graphic is still to do (TASK-056).

| Asset | Size | Notes |
|-------|------|-------|
| App icon | 512×512 PNG (32-bit, ≤ 1 MB); also the adaptive icon foreground (`mobile/assets/adaptive-icon.png`, safe zone: keep the mark inside the central 66%) | one simple mark, readable at 48 px |
| Feature graphic | 1024×500 PNG/JPEG, no transparency | name "SpanishBuddy" in Latin script in every language; keep text out of the outer 10% |

**Palette:** from `mobile/src/theme/colors.ts` (navy and gold of the German brand); the Spanish app may shift the accent to the red used for the
adaptive background. **Type:** the app's display face (Playfair Display) for the name.
**Do not use:** flags, maps, national symbols, rankings, "best", "official", store badges, screenshots with learner data, claims about reviews.
Changing the icon files also needs the `icon` / `adaptiveIcon` fields in `mobile/variants/es.json` (and a `variants.test.ts` run: it checks the files exist).
