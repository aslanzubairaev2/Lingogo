import type { LanguageCode } from '../types';

/**
 * Mapping of language codes to full language names in English
 * Used for AI prompts and backend communication
 */
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  de: 'German',
  ru: 'Russian',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  pl: 'Polish',
  zh: 'Chinese',
  ja: 'Japanese',
  ar: 'Arabic',
  hi: 'Hindi',
};

/**
 * Languages that require romanization/transcription
 * Non-European languages with non-Latin scripts
 */
export const NEEDS_TRANSCRIPTION: LanguageCode[] = ['zh', 'ja', 'ar', 'ru'];

/**
 * Get full language name for use in prompts
 * @param code - Language code (e.g., 'de')
 * @returns Full language name (e.g., 'Learning')
 */
export function getLanguageName(code: LanguageCode): string {
  return LANGUAGE_NAMES[code] || code;
}

/**
 * Check if a language needs transcription/romanization
 * @param code - Language code
 * @returns true if language needs transcription
 */
export function needsTranscription(code: LanguageCode): boolean {
  return NEEDS_TRANSCRIPTION.includes(code);
}

/**
 * Get language name for prompts, with optional article
 * @param code - Language code
 * @param includeArticle - Whether to include article "in"
 * @returns "Learning" or "in Learning"
 */
export function getLanguageNameForPrompt(code: LanguageCode, includeArticle = false): string {
  const name = getLanguageName(code);
  return includeArticle ? `in ${name}` : name;
}
