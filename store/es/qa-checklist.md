# SpanishBuddy — phone QA checklist (TASK-049)

Build: `build_bundle_android_release.bat es` (AAB) or a debug install with `deploy_local_debug_android.bat es`.
Phone model / Android version / text-to-speech engine: ______________________________

Result column: **OK / Bug / n.a.** Anything marked Bug in sections 1–4, 7 or 8 blocks the first upload (see section 12).

## 1. Install and identity
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 1.1 | Install next to GermanBuddy | Two icons, different names, different data | | |
| 1.2 | Look at the launcher name and the app info page | "SpanishBuddy" | | |
| 1.3 | First start | No German word on any of the first screens | | |

## 2. Onboarding
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 2.1 | Level quiz | 5 Spanish questions, exactly one correct answer each, a sensible level at the end | | |
| 2.2 | Topics screen | Topics saved, app continues | | |
| 2.3 | Welcome screen: restore a Spanish backup | Data restored, restart message | | |
| 2.4 | Welcome screen: restore a **GermanBuddy** backup | Clear "not a SpanishBuddy backup" message, nothing imported | | |

## 3. Today and vault
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 3.1 | Open today's word | A word of the chosen level; article (el/la) with colour; IPA; example; cultural note | | |
| 3.2 | Save the word | Streak 1, word in the vault | | |
| 3.3 | Speaker button, es-US voice installed | Spanish pronunciation, no German accent | | |
| 3.4 | Speaker button with **only es-ES** installed | Reads Spanish (or a clear message); no crash, no looping alerts | | |
| 3.5 | Speaker button with **no Spanish voice** | No crash, no looping alerts | | |
| 3.6 | Vault list and word detail | Review-date chips, words with ñ/á shown correctly | | |

## 4. Review and practice
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 4.1 | Typed fill-in, answer without accents (e.g. `manana`) | Accepted as close or correct, never wrong | | |
| 4.2 | Typed fill-in, hint | "N letters" counts ñ and accented letters as letters | | |
| 4.3 | Sentence reorder with `¿ ¡` | Punctuation stays attached sensibly | | |
| 4.4 | Multiple choice, both directions | Options plausible, one correct | | |
| 4.5 | Matching round | 4–5 pairs, no duplicated meanings | | |
| 4.6 | Flashcard | Front/back correct | | |
| 4.7 | Miss a word in a review | It comes back about 3 cards later, at most twice | | |
| 4.8 | Practice: miss then pass | Practice never moves a due date later | | |
| 4.9 | Grammar drills | Article (el/la), ser/estar, por/para, object pronouns | | |
| 4.10 | Look for case drills or case wording anywhere | **None** (Spanish has no case drill) | | |

## 5. Catalog and statistics
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 5.1 | Word lists | Alphabetical with Spanish order (mano, manzana, mañana…) | | |
| 5.2 | Start learning an unsaved word | Added to the vault, streak unchanged | | |
| 5.3 | Counts per level | Match the lists (A1 304, A2 293, B1 286, B2 287, C1 288, C2 281) | | |

## 6. Languages
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 6.1 | Switch the app language through all 12 offered | Each works; Spanish is **not** offered | | |
| 6.2 | Arabic | Right-to-left after the restart | | |
| 6.3 | Chinese, Japanese, Hindi, Arabic glyphs | No empty boxes | | |
| 6.4 | Translated word content in each language | Present and sensible (wording issues go to the translation review, not the bug list) | | |
| 6.5 | Open GermanBuddy | Still works, 13 languages, unaffected | | |

## 7. Notifications
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 7.1 | Permission prompt | Text sensible | | |
| 7.2 | Daily word and review reminders | Show "SpanishBuddy", in the chosen language | | |
| 7.3 | Tap a reminder | Opens the right screen | | |
| 7.4 | Reboot the phone | Reminders still arrive | | |

## 8. Backup
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 8.1 | Export a backup | File name contains `SpanishBuddy` | | |
| 8.2 | Import it on a second phone or a clean install | All data back | | |
| 8.3 | Automatic backup to a phone-storage folder | Files named `spanishbuddy-auto-…`, newest 10 kept | | |
| 8.4 | Pick a Google Drive folder | The "not supported" message | | |
| 8.5 | Export, then share to Drive / Gmail / Files | Share sheet opens, file arrives | | |
| 8.6 | Import the exported file with the document picker (also from Downloads) | Restored | | |
| 8.7 | Automatic backup: pick a phone-storage folder, change data, change folder | Files appear in the folder | | |
| 8.8 | App info → Permissions | No storage permission listed (TASK-050). Run 8.5–8.8 on the oldest Android you have (9 or lower) and on a current one, for **both** apps | | |

## 9. AI (optional)
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 9.1 | With a test key, open the extra note of a word | About the Spanish word, in the learner's language | | |
| 9.2 | Inspect the request (proxy or provider log) | Only the word, level and native language | | |

## 10. Stress and edges
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 10.1 | Vault of 300+ words (start learning from the catalog) | Scrolling smooth | | |
| 10.2 | Session of 30 cards | Completes | | |
| 10.3 | Airplane mode | Everything works offline | | |
| 10.4 | Rotate, background, kill during a session | No crash, no lost data | | |
| 10.5 | Low-memory kill | App restarts cleanly | | |
| 10.6 | System font size at maximum | Nothing cut off | | |

## 11. Store readiness
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 11.1 | Rendered support pages in a mobile browser | Fonts, links fine | | |
| 11.2 | Contact form with the real Formspree id | Message arrives | | |
| 11.3 | `delete-account` steps vs the phone's real menus | They match | | |
| 11.4 | Listing text in each language | Proof-read by a reader (note languages with none): ______ | | |

## 12. Sign-off
- [ ] Blocks the first upload: any Bug in sections 1–4, 7 or 8.
- [ ] Can follow the first upload: translation wording (6.4), section 10 edge cases, listing proof-reading in languages without a reader.

Tested by: ____________  Date: ____________
