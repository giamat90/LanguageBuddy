/**
 * Store listing and public pages per app (TASK-048): tokens, rendering and validation.
 * Plain CommonJS (node scripts and Jest). No dependency on the app code or on TypeScript.
 */
const fs = require('fs');
const path = require('path');
const { SCRIPT_BY_LANG } = require('../wordbank-i18n-lib.cjs');

const MOBILE = path.join(__dirname, '..', '..');
const REPO = path.join(MOBILE, '..');

const TOKENS = [
  'APP', 'TARGET', 'CODE', 'SLUG', 'SLUG_UPPER', 'DEV', 'UPDATED', 'YEAR', 'SUPPORT_EMAIL',
  'UI_LANGS', 'WORDS', 'LEVEL_RANGE', 'SUPPORT_URL', 'PRIVACY_URL',
  'C_PRIMARY', 'C_PRIMARY_DARK', 'C_SECONDARY', 'C_GOLD', 'C_CREAM', 'C_PRIMARY_LIGHT', 'C_TEXT', 'C_TEXT_MUTED', 'C_INK_RGB',
];
const LIMITS = { title: 30, short: 80, full: 4000 };
// English only: other languages are covered by the native review of the translations.
const BANNED_EN = /\b(best|official|guarantee[sd]?|fluent in|the only)\b|#1|number one/i;
const SUPPORT_FIELDS = ['developer', 'year', 'lastUpdated', 'supportUrl', 'supportEmail'];

/** Replaces every {{TOKEN}}; unknown tokens and tokens without a value throw. */
function render(text, values, name = 'text') {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (_m, t) => {
    if (!TOKENS.includes(t)) throw new Error(`unknown token {{${t}}} in ${name}`);
    const v = values[t];
    if (v === undefined || v === null || v === '') throw new Error(`unresolved token {{${t}}} in ${name}`);
    return String(v);
  });
}

function loadSupport(code, { root = REPO } = {}) {
  const file = path.join(root, 'store', code, 'support.json');
  if (!fs.existsSync(file)) throw new Error(`store/${code}/support.json not found`);
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const f of SUPPORT_FIELDS) {
    if (typeof s[f] !== 'string' || !s[f].trim()) throw new Error(`store/${code}/support.json: "${f}" is missing or empty`);
  }
  if (!s.supportUrl.endsWith('/')) throw new Error(`store/${code}/support.json: supportUrl must end with "/"`);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.supportEmail)) throw new Error(`store/${code}/support.json: "supportEmail" is not an email address`);
  return s;
}

/** scripts/wordbank/<code>/language.json (name, i18nLanguages). */
function languageConfig(code, { mobile = MOBILE } = {}) {
  const file = path.join(mobile, 'scripts', 'wordbank', code, 'language.json');
  if (!fs.existsSync(file)) throw new Error(`unknown app "${code}": ${file} not found`);
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!cfg.i18nLanguages) {
    // German lists no languages in language.json: its translated tables are the folders under i18n/.
    const dir = path.join(path.dirname(file), 'i18n');
    cfg.i18nLanguages = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()).sort() : [];
  }
  return cfg;
}

const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** The CEFR levels of an app; a language.json that names none (German) has them all. */
const levelsOf = (cfg) => cfg.levels ?? ALL_LEVELS;

/** "A1" for one level, "A1–C2" for several. */
const levelRange = (levels) => (levels.length === 1 ? levels[0] : `${levels[0]}–${levels[levels.length - 1]}`);

/** The UI languages of an app: its translated-content languages plus Italian and English (the base files). */
function uiLangCount(cfg) {
  return new Set([...(cfg.i18nLanguages ?? []), 'it', 'en']).size;
}

// Colours of the public pages per app: the app palette (src/theme/palettes.ts) with the muted text
// a touch darker for AA contrast on tinted boxes. A test keeps primary and ink equal to the palette.
const SUPPORT_COLORS = {
  de: { C_PRIMARY: '#1E4A67', C_PRIMARY_DARK: '#0C2A3E', C_SECONDARY: '#0C447C', C_GOLD: '#8F6108', C_CREAM: '#EAF0F4',
        C_PRIMARY_LIGHT: '#E3EDF3', C_TEXT: '#0C2A3E', C_TEXT_MUTED: '#5C697C', C_INK_RGB: '12, 42, 62' },
  es: { C_PRIMARY: '#AA151B', C_PRIMARY_DARK: '#35120F', C_SECONDARY: '#7F0F14', C_GOLD: '#8F6108', C_CREAM: '#F5EDE8',
        C_PRIMARY_LIGHT: '#F7E4E3', C_TEXT: '#35120F', C_TEXT_MUTED: '#6B514B', C_INK_RGB: '53, 18, 15' },
  fr: { C_PRIMARY: '#0055A4', C_PRIMARY_DARK: '#0B1F3A', C_SECONDARY: '#003B73', C_GOLD: '#8F6108', C_CREAM: '#EAF0F8',
        C_PRIMARY_LIGHT: '#E1ECF8', C_TEXT: '#0B1F3A', C_TEXT_MUTED: '#4A5C75', C_INK_RGB: '11, 31, 58' },
  zh: { C_PRIMARY: '#0F6B50', C_PRIMARY_DARK: '#0B2A20', C_SECONDARY: '#0A4F3B', C_GOLD: '#8F6108', C_CREAM: '#EAF3EE',
        C_PRIMARY_LIGHT: '#DFEFE8', C_TEXT: '#0B2A20', C_TEXT_MUTED: '#47645A', C_INK_RGB: '11, 42, 32' },
};

function tokenValues({ variant, targetName, support, wordCount, uiLangCount: n, levels = ALL_LEVELS }) {
  return {
    APP: variant.name,
    TARGET: targetName,
    CODE: variant.code,
    SLUG: variant.slug,
    SLUG_UPPER: variant.slug.toUpperCase(),
    DEV: support.developer,
    UPDATED: support.lastUpdated,
    YEAR: support.year,
    SUPPORT_EMAIL: support.supportEmail,
    UI_LANGS: n,
    WORDS: wordCount,
    LEVEL_RANGE: levelRange(levels),
    SUPPORT_URL: support.supportUrl,
    PRIVACY_URL: `${support.supportUrl}privacy-policy.html`,
    ...(SUPPORT_COLORS[variant.code] ?? SUPPORT_COLORS.de),
  };
}

/** Returns a list of human-readable problems (empty = valid). `values` are the token values. */
function validateListing(listing, { lang, values }) {
  const p = [];
  if (!listing || typeof listing !== 'object') return ['listing is not an object'];
  if (!['draft', 'reviewed'].includes(listing.status)) p.push(`status must be draft or reviewed, got "${listing.status}"`);
  const rendered = {};
  for (const f of ['title', 'short', 'full']) {
    if (typeof listing[f] !== 'string' || !listing[f].trim()) { p.push(`${f} is empty`); continue; }
    try {
      rendered[f] = render(listing[f], values, `${lang}.${f}`);
    } catch (e) {
      p.push(e.message);
      continue;
    }
    if (rendered[f].length > LIMITS[f]) p.push(`${f} is too long (${rendered[f].length} > ${LIMITS[f]})`);
    if (SCRIPT_BY_LANG[lang] && !SCRIPT_BY_LANG[lang].test(rendered[f])) p.push(`${f} is not in the ${lang} script`);
    if (/TODO|XXX|\?\?\?/.test(rendered[f])) p.push(`${f} has a leftover marker`);
    if (lang === 'en' && BANNED_EN.test(rendered[f])) p.push(`${f} has a banned phrase (${rendered[f].match(BANNED_EN)[0]})`);
  }
  if (rendered.title && rendered.short && rendered.title.trim() === rendered.short.trim()) p.push('short must differ from the title');
  if (rendered.title && !rendered.title.includes(values.APP)) p.push(`title lacks the app name ${values.APP}`);
  if (rendered.full && !rendered.full.includes(values.APP)) p.push(`full text lacks the app name ${values.APP}`);
  if (rendered.full && !rendered.full.includes(values.PRIVACY_URL)) p.push('full text lacks the privacy policy URL');
  return p;
}

module.exports = {
  TOKENS, LIMITS, SUPPORT_COLORS, render, loadSupport, languageConfig, levelsOf, levelRange, uiLangCount, tokenValues,
  validateListing,
};
