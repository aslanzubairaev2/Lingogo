export const SUPPORTED_LANGUAGE_CODES = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'mr', 'pt', 'pl', 'ru', 'zh'];
export type LanguageCode = typeof SUPPORTED_LANGUAGE_CODES[number];

export const LANGUAGE_OPTIONS: { code: LanguageCode; name: string; nativeName: string; needsTranscription: boolean; speechLocale: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English', needsTranscription: false, speechLocale: 'en-US' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', needsTranscription: true, speechLocale: 'ru-RU' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', needsTranscription: false, speechLocale: 'de-DE' },
  { code: 'fr', name: 'French', nativeName: 'Français', needsTranscription: false, speechLocale: 'fr-FR' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', needsTranscription: false, speechLocale: 'es-ES' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', needsTranscription: false, speechLocale: 'it-IT' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', needsTranscription: false, speechLocale: 'pt-PT' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', needsTranscription: false, speechLocale: 'pl-PL' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', needsTranscription: true, speechLocale: 'zh-CN' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', needsTranscription: true, speechLocale: 'ja-JP' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', needsTranscription: true, speechLocale: 'ar-SA' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', needsTranscription: true, speechLocale: 'hi-IN' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', needsTranscription: true, speechLocale: 'mr-IN' },
];

/**
 * Check if a language needs transcription/romanization
 * @param code - Language code
 * @returns true if language needs transcription
 */
export function needsTranscription(code: LanguageCode): boolean {
  const language = LANGUAGE_OPTIONS.find(l => l.code === code);
  return language?.needsTranscription ?? false;
}

/**
 * Get speech locale code for a language
 * @param languageCode - Language code (e.g., 'en', 'de')
 * @returns Web Speech API locale code (e.g., 'en-US', 'de-DE')
 */
export const getSpeechLocale = (languageCode: LanguageCode): string => {
  const language = LANGUAGE_OPTIONS.find(l => l.code === languageCode);
  return language?.speechLocale || 'en-US';
};


/**
 * Get language name 
 */
export const getLanguageName = (code: LanguageCode): string => {
  const language = LANGUAGE_OPTIONS.find(l => l.code === code);
  return language?.nativeName || code.toUpperCase();
};

/**
 * Get a short language label for display (e.g., 'EN', 'DE', 'RU')
 * Used for voice input indicators
 */
export function getLanguageLabel(languageCode: LanguageCode): string {
  return languageCode.toUpperCase();
}

/**
 * Get language name in English (for tooltips, etc.)
 */
export function getLanguageNameInEnglish(code: LanguageCode): string {
  const language = LANGUAGE_OPTIONS.find(l => l.code === code);
  return language?.name || code.toUpperCase();
}
