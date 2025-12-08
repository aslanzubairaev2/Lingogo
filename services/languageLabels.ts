import type { LanguageCode } from '../types';

/**
 * Get a short language label for display (e.g., 'EN', 'DE', 'RU')
 * Used for voice input indicators
 */
export function getLanguageLabel(languageCode: LanguageCode): string {
  const labels: Record<LanguageCode, string> = {
    en: 'EN',
    de: 'DE',
    ru: 'RU',
    fr: 'FR',
    es: 'ES',
    it: 'IT',
    pt: 'PT',
    pl: 'PL',
    zh: 'ZH',
    ja: 'JA',
    ar: 'AR',
    hi: 'HI',
    mr: 'MR',
  };
  return labels[languageCode] || languageCode.toUpperCase();
}

/**
 * Get language name in English (for tooltips, etc.)
 */
export function getLanguageNameInEnglish(languageCode: LanguageCode): string {
  const names: Record<LanguageCode, string> = {
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
    mr: 'Marathi',
  };
  return names[languageCode] || languageCode;
}
