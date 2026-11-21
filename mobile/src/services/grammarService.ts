import { getDb } from '../data/db';
import { updateMastery } from '../data/srs';
import { CEFR_ORDER, WORD_BANK, type CefrLevel } from '../data/wordbank';
import {
  caseRules,
  buildArticleQuestion,
  buildCaseQuestion,
  pickWeighted,
  type GrammarQuestion,
  type Rng,
} from '../lib/grammar';

const DEFAULT_MASTERY = 0.5;
const VAULT_BOOST = 3;

interface MasteryRow {
  rule_code: string;
  mastery: number;
}

async function loadMastery(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<MasteryRow>('SELECT rule_code, mastery FROM grammar_mastery');
  return new Map(rows.map((r) => [r.rule_code, r.mastery]));
}

async function loadVaultWords(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ word: string }>('SELECT word FROM vocabulary_items');
  return new Set(rows.map((r) => r.word));
}

/** Questions grouped by rule, drawn from every word at or below the learner's level. */
function buildPools(level: CefrLevel, rng: Rng): Map<string, GrammarQuestion[]> {
  const pools = new Map<string, GrammarQuestion[]>();
  const add = (q: GrammarQuestion | null) => {
    if (!q) return;
    const list = pools.get(q.ruleCode) ?? [];
    list.push(q);
    pools.set(q.ruleCode, list);
  };
  const rules = caseRules();
  for (const lvl of CEFR_ORDER.slice(0, CEFR_ORDER.indexOf(level) + 1)) {
    for (const entry of WORD_BANK[lvl]) {
      if (entry.part_of_speech === 'noun') add(buildArticleQuestion(entry, rng));
      if (rules.includes(entry.grammar_angle)) add(buildCaseQuestion(entry, rng));
    }
  }
  return pools;
}

/**
 * Picks `count` questions: rule chosen with weight (1 - mastery) so weak rules
 * come up more, then a question within the rule, favouring the learner's vault words.
 */
export async function buildDrill(
  level: CefrLevel,
  count = 10,
  rng: Rng = Math.random,
): Promise<GrammarQuestion[]> {
  const [mastery, vault] = await Promise.all([loadMastery(), loadVaultWords()]);
  const pools = buildPools(level, rng);
  const questions: GrammarQuestion[] = [];

  while (questions.length < count && pools.size > 0) {
    const rules = [...pools.keys()];
    const weights = rules.map((r) => 1 - (mastery.get(r) ?? DEFAULT_MASTERY) + 0.1);
    const rule = rules[pickWeighted(weights, rng)];
    const pool = pools.get(rule)!;
    const idx = pickWeighted(pool.map((q) => (vault.has(q.word) ? VAULT_BOOST : 1)), rng);
    const [picked] = pool.splice(idx, 1);
    if (pool.length === 0) pools.delete(rule);
    questions.push(picked);
    // One question per word per drill.
    for (const [r, list] of pools) {
      const rest = list.filter((q) => q.word !== picked.word);
      if (rest.length === 0) pools.delete(r);
      else pools.set(r, rest);
    }
  }
  return questions;
}

export async function recordAnswer(ruleCode: string, wasCorrect: boolean): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ mastery: number; seen_count: number; error_count: number }>(
    'SELECT mastery, seen_count, error_count FROM grammar_mastery WHERE rule_code = ?',
    [ruleCode],
  );
  const seen = row?.seen_count ?? 0;
  const next = updateMastery(row?.mastery ?? DEFAULT_MASTERY, wasCorrect, seen);
  await db.runAsync(
    `INSERT INTO grammar_mastery (rule_code, mastery, seen_count, error_count, last_seen_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(rule_code) DO UPDATE SET
       mastery = excluded.mastery,
       seen_count = excluded.seen_count,
       error_count = excluded.error_count,
       last_seen_at = excluded.last_seen_at`,
    [ruleCode, next, seen + 1, (row?.error_count ?? 0) + (wasCorrect ? 0 : 1), new Date().toISOString()],
  );
}
