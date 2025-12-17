import type { LanguageCode, LanguageProfile } from '../types';
import { getSpeechLocale } from '../src/i18n/languageMeta';


/**
 * Options for speech synthesis
 */
export interface SpeechOptions {
  /** Language code for the speech */
  lang: LanguageCode;
  /** Speech rate (0.1 to 10, default: 0.9) */
  rate?: number;
  /** Speech pitch (0 to 2, default: 1.0) */
  pitch?: number;
  /** Speech volume (0 to 1, default: 1.0) */
  volume?: number;
  /** Callback when speech starts */
  onStart?: () => void;
  /** Callback when speech ends */
  onEnd?: () => void;
  /** Callback when speech errors occur */
  onError?: (error: SpeechSynthesisErrorEvent) => void;
}

/**
 * Check if speech synthesis is supported in the browser
 * @returns true if speech synthesis is available
 */
export const isSpeechSupported = (): boolean => {
  return 'speechSynthesis' in window;
};

/**
 * Speak text using Web Speech API
 * @param text - Text to speak
 * @param options - Speech options including language
 * @returns void
 *
 * @example
 * ```typescript
 * speak("Hello world", { lang: 'en', rate: 0.9 });
 * ```
 */
export const speak = (text: string, options: SpeechOptions): void => {
  if (!isSpeechSupported()) {
    console.warn('[speechService] Speech synthesis not supported in this browser');
    options.onError?.(new SpeechSynthesisErrorEvent('error', {
      error: 'not-allowed'
    } as any));
    return;
  }

  if (!text || text.trim().length === 0) {
    console.warn('[speechService] Empty text provided to speak()');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  // Set language locale
  const locale = getSpeechLocale(options.lang);
  utterance.lang = locale;

  // Set speech parameters
  utterance.rate = options.rate ?? 0.9;
  utterance.pitch = options.pitch ?? 1.0;
  utterance.volume = options.volume ?? 1.0;

  // Set callbacks
  if (options.onStart) {
    utterance.onstart = options.onStart;
  }

  if (options.onEnd) {
    utterance.onend = options.onEnd;
  }

  if (options.onError) {
    utterance.onerror = options.onError;
  } else {
    // Default error handler
    utterance.onerror = (event) => {
      console.error('[speechService] Speech synthesis error:', event);
    };
  }

  // Speak
  window.speechSynthesis.speak(utterance);
};

/**
 * Stop any ongoing speech
 */
export const stopSpeaking = (): void => {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Pause ongoing speech
 */
export const pauseSpeaking = (): void => {
  if (isSpeechSupported()) {
    window.speechSynthesis.pause();
  }
};

/**
 * Resume paused speech
 */
export const resumeSpeaking = (): void => {
  if (isSpeechSupported()) {
    window.speechSynthesis.resume();
  }
};

/**
 * Check if speech is currently being spoken
 * @returns true if speaking
 */
export const isSpeaking = (): boolean => {
  if (!isSpeechSupported()) return false;
  return window.speechSynthesis.speaking;
};

/**
 * Check if a voice is available for a language
 * @param lang - Language code to check
 * @returns true if voice is available
 */
export const isVoiceAvailable = (lang: LanguageCode): boolean => {
  if (!isSpeechSupported()) return false;

  const voices = window.speechSynthesis.getVoices();
  const locale = getSpeechLocale(lang);

  if (!locale) return false;

  // Check if any voice matches the locale (exact or prefix match)
  const localePrefix = locale.split('-')[0]; // e.g., 'en' from 'en-US'

  return voices.some(voice =>
    voice.lang === locale || voice.lang.startsWith(localePrefix)
  );
};

/**
 * Get available voices for a language
 * @param lang - Language code
 * @returns Array of available voices
 */
export const getVoicesForLanguage = (lang: LanguageCode): SpeechSynthesisVoice[] => {
  if (!isSpeechSupported()) return [];

  const voices = window.speechSynthesis.getVoices();
  const locale = getSpeechLocale(lang);

  if (!locale) return [];

  const localePrefix = locale.split('-')[0];

  return voices.filter(voice =>
    voice.lang === locale || voice.lang.startsWith(localePrefix)
  );
};

/**
 * Get the speech locale string for a language code
 * @param lang - Language code
 * @returns Locale string (e.g., 'en-US')
 */
export { getSpeechLocale };

/**
 * Initialize speech synthesis (load voices)
 * Call this on app startup to ensure voices are loaded
 * @returns Promise that resolves when voices are loaded
 */
export const initializeSpeech = (): Promise<void> => {
  return new Promise((resolve) => {
    if (!isSpeechSupported()) {
      resolve();
      return;
    }

    const voices = window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      resolve();
      return;
    }

    // Voices not loaded yet, wait for them
    window.speechSynthesis.onvoiceschanged = () => {
      resolve();
    };

    // Fallback timeout
    setTimeout(() => {
      resolve();
    }, 1000);
  });
};

/**
 * Get speech recognition locale for learning language from user profile
 * @param profile - User language profile
 * @returns Speech recognition locale string (e.g., 'de-DE')
 */
export const getLearningSpeechLocale = (profile: LanguageProfile): string => {
  return getSpeechLocale(profile.learning);
};

/**
 * Get speech recognition locale for native language from user profile
 * @param profile - User language profile
 * @returns Speech recognition locale string (e.g., 'ru-RU')
 */
export const getNativeSpeechLocale = (profile: LanguageProfile): string => {
  return getSpeechLocale(profile.native);
};

/**
 * Get speech recognition locale for a specific language from user profile
 * @param profile - User language profile
 * @param languageType - 'learning' or 'native'
 * @returns Speech recognition locale string
 */
export const getSpeechLocaleFromProfile = (profile: LanguageProfile, languageType: 'learning' | 'native'): string => {
  const langCode = languageType === 'learning' ? profile.learning : profile.native;
  return getSpeechLocale(langCode);
};
