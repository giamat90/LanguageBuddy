# LanguageBuddy

A family of free, **offline** Android apps for learning vocabulary and key grammar of a language, built around a daily word,
spaced repetition and several exercise formats. One codebase, one app per language.

- **GermanBuddy** — published on Google Play (this repository's first app).
- **SpanishBuddy, FrenchBuddy, ItalianBuddy, …** — planned; each language is a build variant that produces its own Android App Bundle.

No backend, no account, no analytics. An optional AI feature works only with the learner's own API key.
The app interface is available in 13 languages.

## Repository

| Path | What |
|------|------|
| `mobile/` | the React Native (Expo SDK 53) app, tests, word-bank scripts |
| `tasks/` | task specs (what is built and what is next) |
| `CLAUDE.md` | how we work here: architecture, rules, conventions |
| `CONTEXT.md` | what exists right now: status, decisions, known issues |

## Develop

```
cd mobile
npm install
npx tsc --noEmit
npm test
```

Release builds need your own keystore (`mobile/release.keystore`, `mobile/release.properties`; both gitignored). Never commit keys.

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
