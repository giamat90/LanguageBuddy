import { allEntries } from '../src/data/wordbank';
import {
  buildFindMistake, splitToken, ruleForCaseForm, mistakeQuality,
  MISTAKE_MIN_TOKENS, MISTAKE_MAX_TOKENS,
  pickExercise, FORMAT_QUALITY, PASS_QUALITY,
} from '../src/lib/exercises';
import { type Rng } from '../src/lib/grammar';
import { de } from '../src/languages/de';

// The German tables, read from the pack (they used to be re-exported by the library).
const NEVER_VALID = de.gender!.neverValid;
const CASE_FORMS = new Set<string>(Object.values(de.cases!.ruleForms).flat());
const DEFINITE_FORMS = de.cases!.definiteForms;
const INDEFINITE_FORMS = de.cases!.indefiniteForms;
const TWO_WAY_PREPOSITIONS = de.cases!.twoWayPrepositions;
import itStrings from '../src/languages/de/strings/it';
import enStrings from '../src/languages/de/strings/en';
import type { ReviewCard } from '../src/services/reviewService';

function card(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'c1',
    word: 'Haus',
    article: 'das',
    translationIt: 'casa',
    translationEn: 'house',
    example: 'Das Haus ist sehr groß.',
    exampleIt: 'La casa è molto grande.',
    exampleEn: 'The house is very big.',
    partOfSpeech: 'noun',
    cefrBand: 'A1',
    topicDomain: 'home',
    timesSeen: 3,
    retentionScore: 0.7,
    ...over,
  };
}
const verb = (sentence: string) =>
  card({ word: 'gehen', article: null, partOfSpeech: 'verb', example: sentence });

function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const tokensOf = (s: string) => s.trim().split(/\s+/);
const lowerCore = (token: string) => splitToken(token).core.toLowerCase();

describe('shared grammar exports', () => {
  it('exposes the case forms, two-way prepositions and the article families', () => {
    expect([...CASE_FORMS].sort()).toEqual(['dem', 'des', 'einem', 'einen', 'eines']);
    expect(TWO_WAY_PREPOSITIONS.has('in')).toBe(true);
    expect(TWO_WAY_PREPOSITIONS.has('mit')).toBe(false);
    expect(DEFINITE_FORMS).toContain('den');
    expect(INDEFINITE_FORMS).toContain('einer');
  });
});

describe('splitToken', () => {
  it('separates attached quotes and punctuation from the word', () => {
    expect(splitToken('Haus')).toEqual({ lead: '', core: 'Haus', trail: '' });
    expect(splitToken('Haus.')).toEqual({ lead: '', core: 'Haus', trail: '.' });
    expect(splitToken('„Haus,')).toEqual({ lead: '„', core: 'Haus', trail: ',' });
    expect(splitToken('"Das"')).toEqual({ lead: '"', core: 'Das', trail: '"' });
    expect(splitToken('groß?!')).toEqual({ lead: '', core: 'groß', trail: '?!' });
  });
  it('handles tokens that are only punctuation', () => {
    expect(splitToken('...').core).toBe('');
    expect(splitToken('"')).toEqual({ lead: '"', core: '', trail: '' });
  });
  it('is lossless', () => {
    for (const t of ['Haus', '„Haus,', '"Das"', '...', "geht's"]) {
      const { lead, core, trail } = splitToken(t);
      expect(lead + core + trail).toBe(t);
    }
  });
});

describe('ruleForCaseForm', () => {
  it.each([
    ['des', 'wegen', 'GENITIV_CASE'],
    ['eines', '', 'GENITIV_CASE'],
    ['einen', 'für', 'ACCUSATIVE_PREP'],
    ['einen', 'ohne', 'ACCUSATIVE_PREP'],
    ['einen', 'sehe', 'ACCUSATIVE_MASC'],
    ['dem', 'mit', 'DATIV_PREP'],
    ['einem', 'zu', 'DATIV_PREP'],
    ['dem', 'gebe', 'DATIV_INDIRECT_OBJ'],
    ['einem', '', 'DATIV_INDIRECT_OBJ'],
  ])('%s after "%s" -> %s', (form, prev, rule) => {
    expect(ruleForCaseForm(form, prev)).toBe(rule);
  });
});

describe('mistakeQuality', () => {
  it('maps the two steps to a quality', () => {
    expect(mistakeQuality(true, true)).toBe(0.9);
    expect(mistakeQuality(true, false)).toBe(0.4);
    expect(mistakeQuality(false, false)).toBe(0);
    expect(mistakeQuality(false, true)).toBe(0);
    expect(FORMAT_QUALITY.find_mistake).toEqual({ fixed: 0.9, foundOnly: 0.4, missed: 0 });
  });
  it('finding the error without the fix is a miss for the schedule', () => {
    expect(mistakeQuality(true, false)).toBeLessThan(PASS_QUALITY);
    expect(mistakeQuality(true, true)).toBeGreaterThanOrEqual(PASS_QUALITY);
  });
});

describe('buildFindMistake — gender kind', () => {
  it('corrupts the article before the noun, keeping everything else', () => {
    const m = buildFindMistake(card(), () => 0)!;
    expect(m.kind).toBe('find_mistake');
    expect(m.mistakeKind).toBe('gender');
    expect(m.ruleCode).toBe('NOUN_GENDER');
    expect(m.wrongIndex).toBe(0);
    expect(m.correctToken).toBe('Das');
    expect(m.tokens.slice(1)).toEqual(['Haus', 'ist', 'sehr', 'groß.']);
    expect(['Der', 'Die', 'Den']).toContain(m.tokens[0]); // capital kept, never-valid for a neuter noun
  });

  it('only uses forms that are never valid for that gender', () => {
    for (const art of ['der', 'die', 'das'] as const) {
      const base = card({ article: art, example: `${art} Haus ist sehr groß.` });
      for (const r of [0, 0.3, 0.6, 0.99]) {
        const m = buildFindMistake(base, () => r)!;
        expect(NEVER_VALID[art]).toContain(lowerCore(m.tokens[0]));
      }
    }
  });

  it('keeps lower case, and quotes and punctuation attached to the slot token', () => {
    const lower = buildFindMistake(card({ example: 'Ich sehe das Haus am See.' }), () => 0.4)!;
    expect(lower.tokens[2]).toBe(lower.tokens[2].toLowerCase());
    expect(lower.correctToken).toBe('das');

    const quoted = buildFindMistake(card({ example: '„Das Haus ist sehr groß.' }), () => 0)!;
    expect(quoted.correctToken).toBe('„Das');
    expect(quoted.tokens[0].startsWith('„')).toBe(true);
    expect(quoted.tokens[0]).not.toBe('„Das');
  });

  it('offers der / die / das, capitalised like the slot, with exactly one correct', () => {
    const m = buildFindMistake(card(), seeded(3))!;
    expect([...m.options].sort()).toEqual(['Das', 'Der', 'Die']);
    expect(m.options[m.correctOption]).toBe('Das');

    const lower = buildFindMistake(card({ example: 'Ich sehe das Haus am See.' }), seeded(3))!;
    expect([...lower.options].sort()).toEqual(['das', 'der', 'die']);
    expect(lower.options[lower.correctOption]).toBe('das');
  });

  it('requires the card article directly before the word', () => {
    expect(buildFindMistake(card({ example: 'Ich sehe die Haus.' }), () => 0)).toBeNull(); // wrong article already
    expect(buildFindMistake(card({ example: 'Ich sehe ein Haus am See.' }), () => 0)).toBeNull(); // not a definite article
    expect(buildFindMistake(card({ example: 'Das schöne Haus ist sehr groß.' }), () => 0)).toBeNull(); // adjective in between
    expect(buildFindMistake(card({ example: 'Das Haustür ist sehr neu.' }), () => 0)).toBeNull(); // longer word
  });

  it('skips neuter nouns whose plural can look the same: any article form could then be a plural', () => {
    // "Die Handelsabkommen wird neu verhandelt" reads as a plural with the wrong verb, so the learner
    // could blame the verb. No form is certainly wrong for such a noun, so we do not use it.
    for (const [word, sentence] of [
      ['Handelsabkommen', 'Das Handelsabkommen wird neu verhandelt.'],
      ['Zimmer', 'Das Zimmer ist sehr klein.'],
      ['Fenster', 'Das Fenster ist noch offen.'],
      ['Mädchen', 'Das Mädchen spielt im Garten.'],
    ]) {
      expect(buildFindMistake(card({ word, example: sentence }), () => 0)).toBeNull();
    }
  });

  it('for masculine nouns whose plural can look the same only "das" is certainly wrong', () => {
    const lehrer = card({ word: 'Lehrer', article: 'der', example: 'Der Lehrer ist sehr nett.' });
    for (const r of [0, 0.4, 0.99]) {
      expect(lowerCore(buildFindMistake(lehrer, () => r)!.tokens[0])).toBe('das');
    }
  });

  it('is not used for verbs or nouns without an article', () => {
    expect(buildFindMistake(verb('Wir gehen heute nach Hause.'), () => 0)).toBeNull();
    expect(buildFindMistake(card({ article: null }), () => 0)).toBeNull();
  });
});

describe('buildFindMistake — case kind', () => {
  const lehrer = verb('Ich spreche mit dem Lehrer.');

  it('corrupts the case-fixing determiner with another form of its family', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const m = buildFindMistake(lehrer, () => r)!;
      expect(m.mistakeKind).toBe('case');
      expect(m.ruleCode).toBe('DATIV_PREP');
      expect(m.wrongIndex).toBe(3);
      expect(m.correctToken).toBe('dem');
      expect(DEFINITE_FORMS).toContain(m.tokens[3]);
      expect(m.tokens[3]).not.toBe('dem');
      expect(m.tokens.filter((_, i) => i !== 3)).toEqual(['Ich', 'spreche', 'mit', 'Lehrer.']);
    }
  });

  it('works for the indefinite family and the other rules', () => {
    const acc = buildFindMistake(verb('Möchtest du einen Kaffee?'), () => 0.5)!;
    expect(acc.ruleCode).toBe('ACCUSATIVE_MASC');
    expect(INDEFINITE_FORMS).toContain(acc.tokens[2]);
    expect(acc.tokens[2]).not.toBe('einen');

    const gen = buildFindMistake(verb('Wegen des Regens bleiben wir hier.'), () => 0.5)!;
    expect(gen.ruleCode).toBe('GENITIV_CASE');
    expect(gen.correctToken).toBe('des');
  });

  it('takes the first matching determiner, including at the start of the sentence', () => {
    const first = buildFindMistake(verb('Ich gebe dem Kind einen Ball.'), () => 0)!;
    expect(first.wrongIndex).toBe(2);

    const start = buildFindMistake(verb('Dem Kind gebe ich einen Ball.'), () => 0)!;
    expect(start.wrongIndex).toBe(0);
    expect(start.correctToken).toBe('Dem');
    expect(start.ruleCode).toBe('DATIV_INDIRECT_OBJ');
    expect(start.tokens[0][0]).toBe(start.tokens[0][0].toUpperCase()); // capital kept
    expect(start.options.every((o) => o[0] === o[0].toUpperCase())).toBe(true);
    expect(start.options[start.correctOption]).toBe('Dem');
  });

  it.each([...TWO_WAY_PREPOSITIONS])('is skipped after the two-way preposition "%s" (dem and den both fit)', (prep) => {
    expect(buildFindMistake(verb(`Ich lebe ${prep} dem Haus hier.`), () => 0)).toBeNull();
  });

  it('offers the right form plus two others of its family', () => {
    const m = buildFindMistake(lehrer, seeded(5))!;
    expect(m.options).toHaveLength(3);
    expect(new Set(m.options).size).toBe(3);
    expect(m.options[m.correctOption]).toBe('dem');
    m.options.forEach((o) => expect(DEFINITE_FORMS).toContain(o));
  });
});

describe('buildFindMistake — choosing a kind and refusing', () => {
  const both = card({ example: 'Das Haus gehört dem Mann heute.' });

  it('uses rng to choose when both kinds are possible', () => {
    expect(buildFindMistake(both, () => 0)!.mistakeKind).toBe('gender');
    expect(buildFindMistake(both, () => 0.9)!.mistakeKind).toBe('case');
  });

  it('returns null without a sentence, with a slot-less one, or outside the length window', () => {
    expect(MISTAKE_MIN_TOKENS).toBe(4);
    expect(MISTAKE_MAX_TOKENS).toBe(12);
    expect(buildFindMistake(card({ example: null }), () => 0)).toBeNull();
    expect(buildFindMistake(card({ example: 'Das Haus ist.' }), () => 0)).toBeNull(); // 3 tokens
    const long = 'Das Haus steht seit vielen Jahren an der Ecke dieser kleinen ruhigen Strasse.'; // 13 tokens
    expect(tokensOf(long)).toHaveLength(13);
    expect(buildFindMistake(card({ example: long }), () => 0)).toBeNull();
    expect(buildFindMistake(verb('Wir gehen heute nach Hause.'), () => 0)).toBeNull();
  });

  it('is deterministic for a seeded rng and changes exactly one token', () => {
    const a = buildFindMistake(both, seeded(8))!;
    const b = buildFindMistake(both, seeded(8))!;
    expect(a).toEqual(b);
    const original = tokensOf(both.example!);
    const changed = a.tokens.map((t, i) => (t !== original[i] ? i : -1)).filter((i) => i >= 0);
    expect(changed).toEqual([a.wrongIndex]);
  });
});

describe('registry: find the mistake in the ladder', () => {
  const learning = card({ timesSeen: 2, retentionScore: 0.7 });
  const strong = card({ timesSeen: 8, retentionScore: 0.95 });

  it('is offered to learning and strong words that qualify (typed 2 : reorder 1 : find 1)', () => {
    for (const c of [learning, strong]) {
      expect(pickExercise(c, undefined, () => 0).kind).toBe('typed_cloze');
      expect(pickExercise(c, undefined, () => 0.6).kind).toBe('sentence_reorder');
      expect(pickExercise(c, undefined, () => 0.9).kind).toBe('find_mistake');
    }
  });

  it('never appears for words that do not qualify, nor for new words', () => {
    const plain = card({ word: 'Wasser', example: 'Ich trinke ein Glas Wasser.' });
    for (const r of [0, 0.3, 0.6, 0.9, 0.99]) {
      expect(pickExercise(plain, undefined, () => r).kind).not.toBe('find_mistake');
      expect(pickExercise(card({ timesSeen: 1, retentionScore: 0.5 }), undefined, () => r).kind).toBe('multiple_choice');
    }
  });
});

describe('against the real word bank', () => {
  const cards: ReviewCard[] = allEntries().map(({ level, entry }, i) => ({
    id: `b${i}`,
    word: entry.word,
    article: entry.article,
    translationIt: entry.meaning_it,
    translationEn: entry.meaning_en,
    example: entry.example,
    exampleIt: entry.example_it,
    exampleEn: entry.example_en,
    partOfSpeech: entry.part_of_speech,
    cefrBand: level,
    topicDomain: entry.topic_domain,
    timesSeen: 5,
    retentionScore: 0.8,
  }));

  it('builds a valid exercise for at least 500 words, and every one keeps its invariants', () => {
    const rng = seeded(2026);
    let built = 0;
    const problems: string[] = [];

    for (const c of cards) {
      const m = buildFindMistake(c, rng);
      if (!m) continue;
      built++;
      const original = tokensOf(c.example!);
      const tag = `${c.word}: `;

      if (m.tokens.length !== original.length) {
        problems.push(tag + 'token count changed');
        continue;
      }
      const changed = m.tokens.map((t, i) => (t !== original[i] ? i : -1)).filter((i) => i >= 0);
      if (changed.length !== 1 || changed[0] !== m.wrongIndex) problems.push(tag + `changed tokens ${changed}`);
      if (original[m.wrongIndex] !== m.correctToken) problems.push(tag + 'correctToken is not the original');

      const wrong = splitToken(m.tokens[m.wrongIndex]);
      const right = splitToken(m.correctToken);
      if (wrong.lead !== right.lead || wrong.trail !== right.trail) problems.push(tag + 'punctuation changed');
      if ((wrong.core[0] === wrong.core[0].toUpperCase()) !== (right.core[0] === right.core[0].toUpperCase())) {
        problems.push(tag + 'capitalisation changed');
      }
      if (m.options.length !== 3 || new Set(m.options).size !== 3) problems.push(tag + 'options not 3 unique');
      if (m.options[m.correctOption]?.toLowerCase() !== right.core.toLowerCase()) problems.push(tag + 'correct option mismatch');

      if (m.mistakeKind === 'gender') {
        if (!NEVER_VALID[c.article as 'der' | 'die' | 'das'].includes(wrong.core.toLowerCase())) {
          problems.push(tag + `gender replacement "${wrong.core}" is not never-valid`);
        }
        if (/(er|el|en|chen|lein)$/i.test(c.word)) {
          if (c.article === 'das') problems.push(tag + 'neuter noun with a possibly identical plural was used');
          if (c.article === 'der' && wrong.core.toLowerCase() !== 'das') problems.push(tag + 'masculine plural-like noun got a non-das replacement');
        }
        if (m.ruleCode !== 'NOUN_GENDER') problems.push(tag + 'gender rule code');
      } else {
        const original1 = right.core.toLowerCase();
        const family = DEFINITE_FORMS.includes(original1) ? DEFINITE_FORMS : INDEFINITE_FORMS;
        if (!family.includes(wrong.core.toLowerCase()) || wrong.core.toLowerCase() === original1) {
          problems.push(tag + `case replacement "${wrong.core}"`);
        }
        const prev = m.wrongIndex > 0 ? lowerCore(original[m.wrongIndex - 1]) : '';
        if (TWO_WAY_PREPOSITIONS.has(prev)) problems.push(tag + 'slot after a two-way preposition');
      }

      const key = `grammar_rule_${m.ruleCode}`;
      if (!(key in itStrings) || !(key in enStrings)) problems.push(tag + `missing explanation ${key}`);
    }

    expect(problems).toEqual([]);
    expect(built).toBeGreaterThanOrEqual(500);
  }, 60000);
});
