// Texts that belong to the Chinese pack (the target language), in this app language. (TASK-072)
const strings: Record<string, string> = {
  welcome_subtitle: `Una parola di cinese al giorno, da imparare davvero.`,
  review_mc_prompt_target: `Come si dice in cinese?`,
  speech_unavailable_title: `Audio non disponibile`,
  speech_unavailable_body: `Il telefono non riesce a leggere il cinese. In Impostazioni di Android > Sistema > Lingua e input > Sintesi vocale installa una voce cinese (mandarino), poi riprova.`,
  practice_format_tone_choice: `Scegli i toni`,
  practice_desc_tone_choice: `Guarda i caratteri e scegli il pinyin con i toni giusti.`,
  reading_tone_prompt: `Quali toni sono giusti?`,
  reading_show_pinyin: `Mostra il pinyin`,
  reading_cloze_placeholder: `Pinyin o caratteri`,
  reading_hint_text: `Inizia con «%{initial}» · sillabe: %{count}`,
  reading_wrong_tone: `I suoni sono giusti, ma un tono è sbagliato.`,
  reading_missing_tones: `Quasi: scrivi anche i toni.`,
  settings_pinyin_title: `Pinyin`,
  settings_pinyin_desc: `Quando compare il pinyin accanto ai caratteri. Negli esercizi, chiederlo prima di rispondere vale come un suggerimento.`,
  settings_pinyin_auto: `Automatico: sparisce man mano che impari la parola`,
  settings_pinyin_always: `Sempre`,
  settings_pinyin_tap: `Solo quando tocco`,
};

export default strings;
