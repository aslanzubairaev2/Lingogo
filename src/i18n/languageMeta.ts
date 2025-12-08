import type { LanguageCode } from '../../types.ts';

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  ar: 'العربية',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  hi: 'हिन्दी',
  it: 'Italiano',
  ja: '日本語',
  mr: 'मराठी',
  pl: 'Polski',
  pt: 'Português',
  ru: 'Русский',
  zh: '中文',
};

export const getLanguageLabel = (code: LanguageCode): string => LANGUAGE_LABELS[code] ?? code.toUpperCase();
