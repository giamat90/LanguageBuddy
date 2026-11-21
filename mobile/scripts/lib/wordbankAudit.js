// TASK-058: pure functions behind `npm run audit:wordbank`. No file or network access here.
// The audit informs a human; nothing in it changes a word.
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DEFAULTS = {
  tooRare: { A1: 8000, A2: 12000, B1: 20000 },
  tooCommon: { B2: 1000, C1: 2000, C2: 3000 },
  minTopicShare: 0.05,
  limit: 500,
  stop: [],
};

/** Lower-case + NFC; German ß → ss. Used for exact matches. */
function fold(word, code) {
  const w = String(word).normalize('NFC').toLowerCase();
  return code === 'de' ? w.replace(/ß/g, 'ss') : w;
}

/** Accent-insensitive key (also ß → ss), for the fallback match. */
function plain(word) {
  return String(word).normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase().replace(/ß/g, 'ss');
}

/** "word count" lines (any whitespace between) → Map<word, rank>; rank = position among valid lines, first occurrence wins. */
function parseFrequencyList(text) {
  const map = new Map();
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(\S+)\s+\d+$/.exec(line);
    if (!m) continue;
    const word = m[1].normalize('NFC').toLowerCase();
    if (!map.has(word)) map.set(word, map.size + 1);
  }
  return map;
}

const plainIndexes = new WeakMap();
function plainIndex(rankMap) {
  let idx = plainIndexes.get(rankMap);
  if (!idx) {
    idx = new Map();
    for (const [w, r] of rankMap) {
      const k = plain(w);
      if (!idx.has(k) || r < idx.get(k)) idx.set(k, r);
    }
    plainIndexes.set(rankMap, idx);
  }
  return idx;
}

function rankOf(rankMap, word, code) {
  const exact = rankMap.get(fold(word, code));
  if (exact !== undefined) return exact;
  const loose = plainIndex(rankMap).get(plain(word));
  return loose === undefined ? null : loose;
}

const byLevel = (entries) => {
  const g = {};
  for (const e of entries) (g[e.cefr_band] ||= []).push(e);
  return g;
};

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function levelStats(entries, rankMap, code) {
  const g = byLevel(entries);
  return LEVELS.filter((l) => g[l]).map((level) => {
    const ranks = g[level].map((e) => rankOf(rankMap, e.word, code));
    const found = ranks.filter((r) => r !== null);
    const share = (n) => found.filter((r) => r <= n).length / g[level].length;
    return { level, count: g[level].length, found: found.length, median: median(found), top1000: share(1000), top3000: share(3000), top10000: share(10000) };
  });
}

/** Medians must not go down from one level to the next (levels without a median are skipped). */
function isMonotone(stats) {
  const m = stats.map((s) => s.median).filter((x) => x !== null);
  return m.every((x, i) => i === 0 || x >= m[i - 1]);
}

function misplaced(entries, rankMap, code, cfg = {}) {
  const tooRareCfg = { ...DEFAULTS.tooRare, ...(cfg.tooRare || {}) };
  const tooCommonCfg = { ...DEFAULTS.tooCommon, ...(cfg.tooCommon || {}) };
  const tooRare = [];
  const tooCommon = [];
  for (const e of entries) {
    const rank = rankOf(rankMap, e.word, code);
    if (rank === null) continue;
    const row = { level: e.cefr_band, word: e.word, rank, topic: e.topic_domain, example: e.example };
    const hi = tooRareCfg[e.cefr_band];
    const lo = tooCommonCfg[e.cefr_band];
    if (hi !== undefined && rank > hi) tooRare.push({ ...row, over: rank / hi });
    if (lo !== undefined && rank < lo) tooCommon.push({ ...row, over: lo / rank });
  }
  const worst = (a, b) => b.over - a.over;
  return { tooRare: tooRare.sort(worst).map(({ over, ...r }) => r), tooCommon: tooCommon.sort(worst).map(({ over, ...r }) => r) };
}

function notFound(entries, rankMap, code) {
  const out = {};
  for (const e of entries) if (rankOf(rankMap, e.word, code) === null) (out[e.cefr_band] ||= []).push(e.word);
  return { byLevel: out };
}

function coverageGaps(rankMap, bankWords, code, cfg = {}) {
  const limit = cfg.limit ?? DEFAULTS.limit;
  const stop = new Set((cfg.stop ?? DEFAULTS.stop).map((w) => fold(w, code)));
  const exact = new Set(bankWords.map((w) => fold(w, code)));
  const loose = new Set(bankWords.map(plain));
  const candidates = [];
  let skipped = 0;
  for (const [word, rank] of rankMap) {
    if (candidates.length >= limit) break;
    if (stop.has(word) || /\d/.test(word) || [...word].length < 2) { skipped++; continue; }
    if (exact.has(word) || loose.has(plain(word))) continue;
    candidates.push({ word, rank });
  }
  return { candidates, skipped };
}

function topicBalance(entries, minShare = DEFAULTS.minTopicShare) {
  const all = new Set(entries.map((e) => e.topic_domain));
  const table = {};
  const thin = {};
  const g = byLevel(entries);
  for (const level of LEVELS.filter((l) => g[l])) {
    const counts = {};
    for (const e of g[level]) counts[e.topic_domain] = (counts[e.topic_domain] || 0) + 1;
    table[level] = counts;
    thin[level] = [...all].filter((t) => (counts[t] || 0) / g[level].length < minShare);
  }
  return { table, thin };
}

module.exports = { LEVELS, DEFAULTS, fold, plain, parseFrequencyList, rankOf, levelStats, isMonotone, misplaced, notFound, coverageGaps, topicBalance };
