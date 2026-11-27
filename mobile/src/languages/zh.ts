import it from './zh/strings/it';
import en from './zh/strings/en';
import { pinyinReading } from '../lib/reading/pinyin';
import type { LanguagePack } from './types';

export const zh: LanguagePack = {
  code: 'zh',
  name: 'Chinese',
  app: { name: 'ChineseBuddy', backupTag: 'ChineseBuddy', dbFile: 'chinesebuddy.db' },
  levels: ['A1'],
  // No spaces between words: the bank says where they are.
  sentences: 'segmented',
  letters: /([㐀-鿿]+)/,
  // There is no letter to slip on: only stray spaces are forgiven, and a wrong character is wrong.
  fold: (s) => s.replace(/\s+/g, ''),
  typoMinLength: Number.POSITIVE_INFINITY,
  punctuation: {
    lead: /^[“‘《（]+/,
    trail: /[。，、？！：；”’》）…]+$/,
  },
  pronunciation: 'pinyin',
  // Pinyin can be typed, hidden and practised.
  reading: pinyinReading,
  // A slanted Chinese character is only a distorted one.
  italics: false,
  collation: 'zh',
  // Mainland Mandarin, a little slower than the others so the tones can be heard.
  speech: { locale: 'zh-CN', rate: 0.8 },
  ai: {
    languageName: 'Mandarin Chinese',
    rules: [
      'write all Chinese in simplified characters, as used in mainland China',
      'begin every "native" text of an example with the pinyin (with tone marks) of its Chinese sentence in square brackets',
    ],
  },
  articles: null,
  gender: null,
  cases: null,
  // Only tagged sentences with exactly one member word are drilled (the bank validator checks it).
  choices: {
    ruleSets: {
      SHI_ZAI_YOU: [['是', '在', '有']],
      QUESTION_PARTICLE: [['吗', '呢']],
      ER_LIANG: [['二', '两']],
      BU_MEI: [['不', '没']],
    },
    readings: { 是: 'shì', 在: 'zài', 有: 'yǒu', 吗: 'ma', 呢: 'ne', 二: 'èr', 两: 'liǎng', 不: 'bù', 没: 'méi' },
  },
  classifiers: {
    rule: 'MEASURE_WORD',
    number: '一',
    // Sortal words only: a container (杯, 碗, 瓶) or a portion (块, 口) goes with too many nouns to be wrong.
    distractors: ['本', '张', '条', '件', '只', '辆', '台', '位'],
    never: ['个'],
    determiners: ['一', '二', '两', '三', '四', '五', '六', '七', '八', '九', '十', '几', '这', '那', '哪', '每'],
    readings: {
      个: 'gè', 本: 'běn', 张: 'zhāng', 件: 'jiàn', 位: 'wèi', 只: 'zhī', 条: 'tiáo', 辆: 'liàng', 杯: 'bēi',
      瓶: 'píng', 碗: 'wǎn', 块: 'kuài', 口: 'kǒu', 家: 'jiā', 间: 'jiān', 台: 'tái', 把: 'bǎ', 双: 'shuāng',
      岁: 'suì', 些: 'xiē', 所: 'suǒ', 部: 'bù', 场: 'chǎng', 名: 'míng', 份: 'fèn', 套: 'tào',
      座: 'zuò', 支: 'zhī', 架: 'jià', 列: 'liè', 趟: 'tàng', 班: 'bān', 片: 'piàn', 根: 'gēn',
      节: 'jié', 门: 'mén', 种: 'zhǒng', 首: 'shǒu', 阵: 'zhèn', 道: 'dào', 顿: 'dùn',
    },
  },
  primer: {
    sections: [
      {
        id: 'tones',
        examples: [
          { text: '妈', reading: 'mā' }, { text: '麻', reading: 'má' }, { text: '马', reading: 'mǎ' },
          { text: '骂', reading: 'mà' }, { text: '妈妈', reading: 'māma' },
        ],
      },
      {
        id: 'tone_changes',
        examples: [
          { text: '你好', reading: 'nǐ hǎo' }, { text: '不是', reading: 'bú shì' },
          { text: '一个', reading: 'yí ge' }, { text: '一台', reading: 'yì tái' },
        ],
      },
      {
        id: 'breath',
        examples: [
          { text: '爸', reading: 'bà' }, { text: '怕', reading: 'pà' }, { text: '大', reading: 'dà' },
          { text: '他', reading: 'tā' }, { text: '个', reading: 'gè' }, { text: '渴', reading: 'kě' },
        ],
      },
      {
        id: 'jqx',
        examples: [{ text: '家', reading: 'jiā' }, { text: '七', reading: 'qī' }, { text: '小', reading: 'xiǎo' }],
      },
      {
        id: 'retroflex',
        examples: [
          { text: '这', reading: 'zhè' }, { text: '吃', reading: 'chī' }, { text: '是', reading: 'shì' },
          { text: '热', reading: 'rè' },
        ],
      },
      {
        id: 'zcs',
        examples: [{ text: '在', reading: 'zài' }, { text: '菜', reading: 'cài' }, { text: '三', reading: 'sān' }],
      },
      {
        id: 'vowels',
        examples: [
          { text: '女', reading: 'nǚ' }, { text: '去', reading: 'qù' }, { text: '喝', reading: 'hē' },
          { text: '四', reading: 'sì' }, { text: '十', reading: 'shí' }, { text: '天', reading: 'tiān' },
        ],
      },
    ],
  },
  // One level, so no placement quiz.
  quiz: [],
  // No Chinese: a native speaker does not learn Chinese here.
  uiLanguages: ['it', 'en'],
  strings: { it, en },
};
