import type { LanguageCode } from '../types';

/**
 * Mapping of language codes to Web Speech API locale codes
 * Used for text-to-speech synthesis across the application
 */
export const SPEECH_LOCALE_MAP: Record<LanguageCode, string> = {
  en: 'en-US',
  de: 'de-DE',
  ru: 'ru-RU',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  pl: 'pl-PL',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ar: 'ar-SA',
  hi: 'hi-IN',
  mr: 'mr-IN',
};

/**
 * Get speech locale code for a language
 * @param languageCode - Language code (e.g., 'en', 'de')
 * @returns Web Speech API locale code (e.g., 'en-US', 'de-DE')
 */
export const getSpeechLocale = (languageCode: LanguageCode): string => {
  return SPEECH_LOCALE_MAP[languageCode] || 'en-US';
};
