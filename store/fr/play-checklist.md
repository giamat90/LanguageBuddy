# FrenchBuddy — Play Console checklist

Everything here is for the Product Owner to enter in Play Console. **Nothing is submitted by the repo.**
Where the repo cannot prove an answer, the row says *Product Owner to confirm in the console* — no value is guessed.
The reference for every "same as German" row is the GermanBuddy app in the same developer account.

Build the texts and pages first: `cd mobile && npm run build:store -- fr` (needs `contactFormId` in
`store/fr/support.json`; use `--allow-placeholder` only for a draft). Output: `store/fr/dist/`.

## Before you create the app
| Step | What | Source |
|------|------|--------|
| 1 | Create the repo `giamat90/frenchbuddy-support`, copy `store/fr/dist/support/*` into it, enable GitHub Pages | `supportUrl` in `store/fr/support.json` must then be true |
| 2 | Create a Formspree form and put its id in `store/fr/support.json` → `contactFormId`, rebuild | the contact page posts there; also check the **live German** contact page: the repo copy still had a placeholder id |
| 3 | Create a **new** Play app (French is a different package) | package `com.giamat90.frenchbuddy` (`mobile/variants/fr.json`) |
| 4 | Grant the CI service account access to the new app (Play Console → Users and permissions) | needed by `release-android.yml -f app=fr` and `npm run check:play-version` |

## Main store listing
| Field | Answer | Source |
|-------|--------|--------|
| App name | `FrenchBuddy: Learn French` (≤ 30) | `dist/listing/en/title.txt` |
| Short description | `dist/listing/en/short.txt` (≤ 80) | listing JSON |
| Full description | `dist/listing/en/full.txt` (≤ 4000) | listing JSON |
| Default language | English (en-US) — Product Owner to confirm | — |
| Translations | one per folder in `dist/listing/<ui>/`, languages it en es pt ru uk pl tr zh ja hi ar. **Publish only languages marked `reviewed` in `dist/STATUS.txt`**; today all are `draft` (machine-written, no native reader) | `STATUS.txt` |
| App icon 512×512 | see `graphics-brief.md` (current art is a placeholder) | — |
| Feature graphic 1024×500 | see `graphics-brief.md` | — |
| Phone screenshots (2–8) | see `screenshots.md` | — |
| App category | Education | policy: language-learning app |
| Tags | Product Owner to choose | — |
| Contact e-mail / phone / website | the developer account's own; website = `supportUrl` | `store/fr/support.json` |
| Privacy policy URL | `https://giamat90.github.io/frenchbuddy-support/privacy-policy.html` | `support.json` → `supportUrl` |

## App content
| Form | Answer | Source |
|------|--------|--------|
| App access | all functionality available without login or special access | policy §1 "There is no account" |
| Ads | no ads | policy §7 |
| Content rating | Education / reference; no violence, sexual content, gambling, user-generated content, location or purchases. Same questionnaire answers as GermanBuddy — *Product Owner to confirm in the console* | — |
| Target audience | 18+ (adult learners), not designed for children | policy §9 |
| News app / COVID / government | no — *Product Owner to confirm* | — |
| Financial features / health | none — *Product Owner to confirm* | — |
| Data deletion | the app stores nothing on a server; deletion = uninstall or clear storage. URL: `…/delete-account.html` | policy §8, `delete-account.html` |

## Data safety (same declarations as GermanBuddy — the code is the same)
| Question | Answer | Source |
|----------|--------|--------|
| Does the app collect or share data? | **Collects**: yes, one type. **Shares**: no | policy §6–7 |
| Data type collected | **Device or other IDs** — the Firebase installation ID created by the Firebase Cloud Messaging component of `expo-notifications`; purpose **App functionality**; not shared; not optional; processed by Google, never received by us | policy §4; the same declaration Play required for GermanBuddy on 2026-11-19 |
| Other types (location, contacts, photos, audio, files, health, financial, messages, personal info…) | none collected | policy §2 (everything stays on the device) |
| Optional AI feature | sends one word, its CEFR level and the app language **directly to the provider the learner chose, with the learner's own key, only on the learner's action**. Declare as in GermanBuddy — *Product Owner to confirm how the German form describes it* | policy §3 |
| Encryption in transit | yes (the AI call is https only; nothing else leaves the device) | `src/lib/ai/` |
| Users can request deletion | yes — the delete-your-data page | policy §8 |

## Release
| Item | Answer | Source |
|------|--------|--------|
| Package | `com.giamat90.frenchbuddy` | `mobile/variants/fr.json` |
| versionCode | a new app, so 1 is valid; still check it first: `cd mobile && node scripts/with-language.mjs fr -- npm run check:play-version -- 1 --key ../GoogleCloud/<service-account>.json` (the wrapper makes the package name come from the French variant) | TASK-028 |
| Build | `build_bundle_android_release.bat fr` (local) or `gh workflow run release-android.yml -f app=fr -f track=internal -f release_status=draft -f version_code=1` | TASK-047 |
| Signing | Play App Signing; the upload key is the same `release.keystore` as GermanBuddy unless you create a new one — *Product Owner to confirm* | CONTEXT.md |
| Permissions declared | `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE` (same as German) | `mobile/variants` → `buildExpoConfig` |
| minSdk / target | 24 / 36 | `app.config.js` |
| Release tag | `fr-v1.0.<versionCode>` is pushed by the workflow after Play accepts the upload | TASK-047 |

## Not to claim anywhere
Native-speaker review of the French words or the translations (none has happened), rankings or superlatives, any
French-speaking country (France, Canada, Belgium…) as "the" variant (the app uses standard French and fr-FR text-to-speech).
