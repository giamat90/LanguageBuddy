// Texts that belong to the Chinese pack (the target language), in this app language. (TASK-072)
const strings: Record<string, string> = {
  welcome_subtitle: `One Chinese word a day, learned properly.`,
  review_mc_prompt_target: `How do you say it in Chinese?`,
  speech_unavailable_title: `Audio unavailable`,
  speech_unavailable_body: `Your phone can't read Chinese aloud. In Android Settings > System > Language & input > Text-to-speech, install a Chinese (Mandarin) voice, then try again.`,
  practice_format_tone_choice: `Pick the tones`,
  practice_desc_tone_choice: `See the characters, choose the pinyin with the right tones.`,
  reading_tone_prompt: `Which tones are right?`,
  reading_show_pinyin: `Show pinyin`,
  reading_cloze_placeholder: `Pinyin or characters`,
  reading_hint_text: `Starts with “%{initial}” · syllables: %{count}`,
  reading_wrong_tone: `Right sounds, but a tone is wrong.`,
  reading_missing_tones: `Almost: write the tones too.`,
  settings_pinyin_title: `Pinyin`,
  settings_pinyin_desc: `When pinyin appears next to the characters. In exercises, asking for it before you answer counts like a hint.`,
  settings_pinyin_auto: `Automatic: fades as you learn a word`,
  settings_pinyin_always: `Always`,
  settings_pinyin_tap: `Only when I tap`,
};

export default strings;
