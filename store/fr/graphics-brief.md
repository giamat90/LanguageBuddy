# FrenchBuddy — icon and feature graphic brief

**Status:** the app icon is French-specific (`mobile/assets/icon-fr.png`, `adaptive-icon-fr.png`, 2026-11-23): the same word-card idea as
GermanBuddy ("LE / Mot") on French blue (`#0055A4`, adaptive background and app colour), with tricolour accent dashes. It was generated, not hand-drawn:
the Product Owner may replace it with real art. The 1024×500 feature graphic is still to do.

| Asset | Size | Notes |
|-------|------|-------|
| App icon | 512×512 PNG (32-bit, ≤ 1 MB); also the adaptive icon foreground (`mobile/assets/adaptive-icon.png`, safe zone: keep the mark inside the central 66%) | one simple mark, readable at 48 px |
| Feature graphic | 1024×500 PNG/JPEG, no transparency | name "FrenchBuddy" in Latin script in every language; keep text out of the outer 10% |

**Palette:** from `mobile/src/theme/colors.ts` (navy and gold of the German brand); the French app may shift the accent to the blue used for the
adaptive background. **Type:** the app's display face (Playfair Display) for the name.
**Do not use:** flags, maps, national symbols, rankings, "best", "official", store badges, screenshots with learner data, claims about reviews.
Changing the icon files also needs the `icon` / `adaptiveIcon` fields in `mobile/variants/fr.json` (and a `variants.test.ts` run: it checks the files exist).
