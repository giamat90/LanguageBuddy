/** Platform glue of the active app: speech, notifications, AI prompt. */
import * as Speech from 'expo-speech';
import { speak, speechText } from '../../src/lib/speech';
import { setAppLocale, t } from '../../src/i18n';
import {
  setNotificationsEnabled, setReminderTime, scheduleWordReadyReminder, scheduleReviewReminder, sendTestNotification,
} from '../../src/lib/notifications';
import { setKey } from '../../src/lib/ai/keys';
import { generateWordInsight } from '../../src/lib/ai/wordInsight';
import { allEntries } from '../../src/data/wordbank';
import { getActivePack } from '../../src/languages';
import { EXPECT, current } from '../../test-support/appExpectations';

const speechMock = Speech as unknown as { __last(): { text: string; opts: any } | null; __reset(): void };
const notifs = require('expo-notifications');
const { MMKV } = require('react-native-mmkv');

describe('speech', () => {
  beforeEach(() => speechMock.__reset());
  it('speaks with the language locale and rate of the pack (prevents reading Spanish with a German voice)', () => {
    speak('hola', { onDone: jest.fn(), onStopped: jest.fn(), onError: jest.fn() });
    expect(speechMock.__last()!.opts.language).toBe(current().speechLocale);
    expect(speechMock.__last()!.opts.rate).toBe(getActivePack().speech.rate);
  });
  it('a noun is read with its article, any other word bare', () => {
    const noun = allEntries().find(({ entry }) => entry.article)!.entry;
    expect(speechText(noun.word, noun.article)).toBe(`${noun.article} ${noun.word}`);
    expect(speechText('x', null)).toBe('x');
  });
});

describe('notifications', () => {
  beforeEach(() => { notifs.__reset(); new MMKV().clearAll(); setNotificationsEnabled(true); setReminderTime(9, 0); });
  afterEach(() => setAppLocale('it'));

  it('name the app (not the other one) in every offered language where the text shows it', async () => {
    const others = Object.values(EXPECT).filter((x) => x.appName !== current().appName).map((x) => x.appName);
    for (const lang of getActivePack().uiLanguages) {
      setAppLocale(lang);
      notifs.__reset();
      await scheduleWordReadyReminder();
      await scheduleReviewReminder(new Date(Date.now() + 86400000), 0);
      await sendTestNotification();
      const all = JSON.stringify(notifs.__scheduled());
      for (const o of others) expect(all).not.toContain(o);
      expect(t('notif_test_body')).toContain(current().appName);
    }
  });

  it('the daily reminder is in the learner\'s language', async () => {
    setAppLocale('en');
    await scheduleWordReadyReminder();
    expect(t('notif_word_title')).toMatch(/word of the day/i);
  });
});

describe('AI prompt', () => {
  it('names the language being learned and sends only the word, level and native language (CLAUDE.md §6)', async () => {
    new MMKV().clearAll();
    setKey('anthropic', 'sk-ant-test');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"examples":[{"target":"a b","native":"c"}],"note":"n","exercise":null}' }] }),
    }) as jest.Mock;
    const word = current().sampleWord.A1;
    await generateWordInsight({ word, article: null, meaningNative: 'm', cefrLevel: 'A1', nativeLanguage: 'it' });
    const body = JSON.stringify(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body));
    expect(body).toContain(current().aiLanguageName);
    for (const other of Object.values(EXPECT).filter((x) => x.aiLanguageName !== current().aiLanguageName)) {
      expect(body).not.toContain(other.aiLanguageName);
    }
    expect(body).toContain(word);
    expect(body).not.toMatch(/installId|streak|retention|vocabulary/i);
  });
});
