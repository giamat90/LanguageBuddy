# ChineseBuddy — phone QA checklist (TASK-078)

Build: `build_bundle_android_release.bat zh` (AAB) or a debug install with `deploy_local_debug_android.bat zh`.
Phone model / Android version / text-to-speech engine: ______________________________

Result column: **OK / Bug / n.a.** Anything marked Bug in sections 1–5 or 8, or in test 10.2, blocks the first upload.

## 1. Install and identity
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 1.1 | Install next to the other apps | Own icon (字 on jade), own name and data | | |
| 1.2 | Look at the launcher name and the app info page | "ChineseBuddy" | | |
| 1.3 | First start | No German word on any of the first screens | | |

## 2. Onboarding and pronunciation guide
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 2.1 | Start | No level quiz; the pronunciation guide comes after the welcome screen | | |
| 2.2 | Tap the examples in the guide | Each is read aloud in Mandarin; tones audibly differ | | |
| 2.3 | Continue | Topics screen, then the vault | | |
| 2.4 | Grammar → pronunciation guide | Opens; going back keeps the running drill | | |
| 2.5 | Welcome screen: restore a backup of **another** app | "Not a ChineseBuddy backup", nothing imported | | |

## 3. Words, characters and pinyin
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 3.1 | Open today's word and save it | A word of the first stage; characters upright (never slanted), pinyin without slashes | | |
| 3.2 | Speaker button with a Mandarin voice installed | Reads word and sentence as the pinyin shows, also 了 (le), 还 (hái), 都 (dōu) and, in the example of 对, 得 (de; it is not a word of its own in the list) | | |
| 3.3 | Speaker button with **no Chinese voice** | No crash; at most one "speech unavailable" alert per app start | | |
| 3.4 | Pinyin setting: Automatic, Always, Only on tap | Sentences follow the setting; a tap reveals hidden pinyin | | |
| 3.5 | Long sentences with pinyin above | Pinyin stays over its word; lines wrap between words; nothing is cut at large font size | | |
| 3.6 | Word lists | Ordered by pinyin; 300 words at A1; no level filter | | |

## 4. Exercises
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 4.1 | Typed cloze, answer in characters | Right answer accepted | | |
| 4.2 | Typed cloze, pinyin with tone numbers, with tone marks, without tones | Full credit with correct tones (neutral syllables need none), partial credit without tones, a wrong tone counts as wrong; the blank never shows its own pinyin | | |
| 4.3 | Typed cloze on the phone keyboard | Both the Chinese keyboard and Latin letters work; autocorrect does not rewrite the pinyin | | |
| 4.4 | Tone choice | Three or four different options, one right (three is normal when a character has a second reading, as in 好 or 看; 一 and all-neutral words such as 了 or 吗 get no tone question); the word's pinyin is not shown before answering | | |
| 4.5 | Sentence reorder | One tile per word; punctuation stays at the end | | |
| 4.6 | Find the mistake | Exactly one wrong word, measure words included | | |
| 4.7 | Multiple choice, matching, flashcard | Correct, no duplicated meanings | | |
| 4.8 | Miss a word in a review | It comes back about 3 cards later, at most twice | | |

## 5. Grammar drills
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 5.1 | Measure words | 一 ___ noun; only one of the three options is right (report any second right one) | | |
| 5.2 | 是/在/有, 吗/呢, 二/两, 不/没 | One right answer per sentence (report any second right one); the rule text is readable | | |
| 5.3 | Look for article or case wording anywhere | **None** | | |

## 6. Languages
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 6.1 | Switch between Italian and English | Only these two are offered; all texts change | | |
| 6.2 | Phone set to another language | The app opens in one of its two languages | | |

## 7. Notifications
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 7.1 | Daily word and review reminders | Show "ChineseBuddy", in the chosen language, characters readable | | |
| 7.2 | Tap a reminder | Opens the right screen | | |

## 8. Backup
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 8.1 | Export and restore on a clean install | All data back; file name contains `ChineseBuddy` | | |
| 8.2 | Automatic backup to a phone-storage folder | Files named `chinesebuddy-auto-…` | | |
| 8.3 | App info → Permissions | No storage permission listed | | |

## 9. AI (optional)
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 9.1 | With a test key, open the extra note of a word | Chinese in simplified characters; each example translation starts with the sentence's pinyin in [square brackets]; translations and usage note in the app language | | |

## 10. Edges
| # | Steps | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| 10.1 | Vault of 100+ words | Scrolling smooth, also with pinyin shown | | |
| 10.2 | Airplane mode | Everything works offline | | |
| 10.3 | Rotate, background, kill during a session | No crash, no lost data | | |

## Sign-off
- [ ] No Bug in sections 1–5, 8 or test 10.2 (any such Bug blocks the first upload).

Tested by: ____________  Date: ____________
