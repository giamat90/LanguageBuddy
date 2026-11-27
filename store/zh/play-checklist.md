# ChineseBuddy — Play Console checklist

Everything here is for the Product Owner to enter in Play Console. **Nothing is submitted by the repo.**
Where the repo cannot prove an answer, the row says *Product Owner to confirm in the console*: no value is guessed.
The reference for every "same as German" row is the GermanBuddy app in the same developer account.

Build the texts and pages first: `cd mobile && npm run build:store -- zh`. Output: `store/zh/dist/`.

## Before you create the app
| Step | What | Source |
|------|------|--------|
| 1 | A native Chinese reader has checked the words, pinyin, meanings, sentences, notes, characters, measure words, grammar-drill answers and rule texts, and the pronunciation guide (all machine-drafted) | CONTEXT.md, TASK-077 |
| 2 | Compare the word list with the official HSK level 1 word list (2025 syllabus; the choice of words was based on a third-party copy), and run `cd mobile && npm run check:unihan` after downloading Unihan (it checks only the character readings) | TASK-077 |
| 3 | Phone QA with `qa-checklist.md` | — |
| 4 | Create the repo `giamat90/chinesebuddy-support`, copy `store/zh/dist/support/*` into it, enable GitHub Pages | `supportUrl` in `store/zh/support.json` must then be true |
| 5 | Check the support email in `store/zh/support.json` → `supportEmail` (shown publicly on the contact page and in Play) | the contact page is a `mailto:` link |
| 6 | Create a **new** Play app. The package name is permanent | `com.giamat90.chinesebuddy` (`mobile/variants/zh.json`) |
| 7 | Grant the CI service account access to the new app (Play Console → Users and permissions) | needed by `release-android.yml -f app=zh` and `npm run check:play-version` |

## Main store listing
| Field | Answer | Source |
|-------|--------|--------|
| App name | `ChineseBuddy: Learn Chinese` (≤ 30) | `dist/listing/en/title.txt` |
| Short description | `dist/listing/en/short.txt` (≤ 80) | listing JSON |
| Full description | `dist/listing/en/full.txt` (≤ 4000) | listing JSON |
| Default language | English (en-US) — Product Owner to confirm | — |
| Translations | Italian. **Publish only languages marked `reviewed` in `dist/STATUS.txt`**; today both are `draft` | `STATUS.txt` |
| App icon 512×512 | see `graphics-brief.md` | — |
| Feature graphic 1024×500 | still to do, see `graphics-brief.md` | — |
| Phone screenshots (2–8) | see `screenshots.md` | — |
| App category | Education | policy: language-learning app |
| Tags | Product Owner to choose | — |
| Contact e-mail / phone / website | the developer account's own; website = `supportUrl` | `store/zh/support.json` |
| Privacy policy URL | `https://giamat90.github.io/chinesebuddy-support/privacy-policy.html` | `support.json` → `supportUrl` |

## App content
| Form | Answer | Source |
|------|--------|--------|
| App access | all functionality available without login or special access | policy §1 "There is no account" |
| Ads | no ads | policy §7 |
| Content rating | Education / reference; no violence, sexual content, gambling, user-generated content, location or purchases. Same questionnaire answers as GermanBuddy — *Product Owner to confirm in the console* | — |
| Target audience | 18+ (adult learners), not designed for children | policy §9 |
| News app / COVID / government | no — *Product Owner to confirm* | — |
| Financial features / health | none — *Product Owner to confirm* | — |
| Data deletion | the app stores nothing on a server; deletion = uninstall or clear storage. URL: `…/delete-account.html` | policy §8 |
| Countries | Offering the app in mainland China needs steps outside Google Play; this checklist does not cover them — *Product Owner to choose the countries* | — |

## Data safety (same declarations as GermanBuddy: the code is the same)
| Question | Answer | Source |
|----------|--------|--------|
| Does the app collect or share data? | **Collects**: yes, one type. **Shares**: no | policy §6–7 |
| Data type collected | **Device or other IDs**: the Firebase installation ID created by the Firebase Cloud Messaging component of `expo-notifications`; purpose **App functionality**; not shared; not optional; processed by Google, never received by us | policy §4 |
| Other types | none collected | policy §2 (everything stays on the device) |
| Public privacy page | its two AI sentences name the word, its meaning, level and language (TASK-081); check that the published page says so | `store/support-template/privacy-policy.html`, CONTEXT.md |
| Optional AI feature | sends one word, its meaning, its level and the app language **directly to the provider the learner chose, with the learner's own key, only on the learner's action**. Declare as in GermanBuddy — *Product Owner to confirm* | policy §3 |
| Encryption in transit | yes (the AI call is https only; nothing else leaves the device) | `src/lib/ai/` |
| Users can request deletion | yes, the delete-your-data page | policy §8 |

## Release
| Item | Answer | Source |
|------|--------|--------|
| Package | `com.giamat90.chinesebuddy` | `mobile/variants/zh.json` |
| versionCode | a new app, so 1 is valid; still check it first: `cd mobile && node scripts/with-language.mjs zh -- npm run check:play-version -- 1 --key ../GoogleCloud/<service-account>.json` | TASK-028 |
| Build | `build_bundle_android_release.bat zh` (local) or `gh workflow run release-android.yml -f app=zh -f track=internal -f release_status=draft -f version_code=1` | TASK-047, TASK-078 |
| Signing | Play App Signing; the upload key is the same `release.keystore` as GermanBuddy unless you create a new one — *Product Owner to confirm* | CONTEXT.md |
| Permissions declared | `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `INTERNET` (the optional AI call) | `buildExpoConfig` |
| minSdk / target | 24 / 36 | `app.config.js` |
| Release tag | `zh-v1.0.<versionCode>` is pushed by the workflow after Play accepts the upload | TASK-047 |

## Not to claim anywhere
Native-speaker review of the content (none has happened), any link with or endorsement by a Chinese language exam or its owners,
exam preparation, any level beyond A1, character writing or stroke order, rankings or superlatives.
