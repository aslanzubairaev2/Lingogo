import { t } from 'i18next';
import { useEffect, useRef, useState } from 'react';

import { ToastType } from '../components/Toast';
import { useAuth } from '../contexts/authContext';
import { AiService } from '../services/aiService';
import { ApiProviderType, getFallbackProvider, getProviderPriorityList } from '../services/apiProvider';
import * as backendService from '../services/backendService';
import * as cacheService from '../services/cacheService';
import { setCurrentLanguageProfile } from '../services/languageAwareAiService';
import { playCorrectSound, playIncorrectSound } from '../services/soundService';
import * as srsService from '../services/srsService';
/**
 * useDataOperations.ts
 *
 * A monolithic custom hook that encapsulates most of the application's data management logic,
 * including:
 * - Loading and saving user phrases and categories (to/from localStorage and backend).
 * - Managing SRS (Spaced Repetition System) state and mastery updates.
 * - Handling AI service interactions with fallback support.
 * - Tracking user habits and button usage stats.
 * - Managing practice sessions and chat history.
 */
import {
  Category,
  ChatMessage,
  DiscussCacheEntry,
  LanguageProfile,
  Phrase,
  PhraseBuilderOptions,
  PhraseCategory,
  PracticeChatSessionRecord,
  PracticeReviewAction,
  PracticeReviewLogEntry,
  View,
} from '../types';

// Helper function for retrying API calls with a delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Settings {
  autoSpeak: boolean;
  soundEffects: boolean;
  automation: {
    autoCheckShortPhrases: boolean;
    learnNextPhraseHabit: boolean;
  };
  enabledCategories: Record<PhraseCategory, boolean>;
}

const defaultSettings: Settings = {
  autoSpeak: true,
  soundEffects: true,
  automation: {
    autoCheckShortPhrases: true,
    learnNextPhraseHabit: true,
  },
  enabledCategories: {}, // enabledCategories is now loaded dynamically from fetched categories
};

const defaultHabitTracker = {
  quickNextCount: 0,
  quickBuilderNextCount: 0,
};

const defaultCardActionUsage = {
  learningAssistant: 0,
  sentenceChain: 0,
  phraseBuilder: 0,
  chat: 0,
  deepDive: 0,
  movieExamples: 0,
};

/**
 * useDataOperations Hook
 *
 * @param view - The current view of the application (e.g., 'practice', 'library').
 * @param userId - The ID of the currently authenticated user.
 * @param needsOnboarding - Boolean flag indicating if the user needs onboarding.
 * @param isOnboardingLoading - Boolean flag indicating if onboarding status is being checked.
 * @param languageProfile - The user's current language profile (native/learning).
 * @param showToast - Function to display toast notifications.
 */
export const useDataOperations = (
  view: View,
  userId: string,
  needsOnboarding: boolean,
  isOnboardingLoading: boolean,
  languageProfile: LanguageProfile,
  showToast: (config: { message: string; type?: ToastType }) => void
) => {
  const { userChanged, resetUserChanged, user } = useAuth();

  // Helper function to create user-aware and language-aware storage keys
  const getStorageKey = (
    baseKey: string,
    userId?: string,
    languageProfile?: { native: string; learning: string }
  ): string => {
    if (!userId) return baseKey; // Fallback to base key if no user
    if (!languageProfile) return `${baseKey}_${userId}`; // User-aware only
    return `${baseKey}_${userId}_${languageProfile.native}_${languageProfile.learning}`; // Full isolation
  };

  // Storage key generators
  const PHRASES_KEY = (userId?: string, langProfile?: { native: string; learning: string }) =>
    getStorageKey('userPhrases', userId, langProfile);
  const CATEGORIES_KEY = (userId?: string, langProfile?: { native: string; learning: string }) =>
    getStorageKey('userCategories', userId, langProfile);
  const SETTINGS_KEY = (userId?: string) => getStorageKey('userSettings', userId);
  const BUTTON_USAGE_KEY = (userId?: string) => getStorageKey('userButtonUsage', userId);
  const MASTERY_BUTTON_USAGE_KEY = (userId?: string) => getStorageKey('userMasteryButtonUsage', userId);
  const HABIT_TRACKER_KEY = (userId?: string) => getStorageKey('userHabitTracker', userId);
  const CARD_ACTION_USAGE_KEY = (userId?: string) => getStorageKey('userCardActionUsage', userId);
  const PRACTICE_CHAT_HISTORY_KEY = (userId?: string, langProfile?: { native: string; learning: string }) =>
    getStorageKey('userPracticeChatHistory', userId, langProfile);
  const PRACTICE_CHAT_SESSIONS_KEY = (userId?: string, langProfile?: { native: string; learning: string }) =>
    getStorageKey('userPracticeChatSessions', userId, langProfile);
  const PRACTICE_REVIEW_LOG_KEY = (userId?: string, langProfile?: { native: string; learning: string }) =>
    getStorageKey('userPracticeReviewLog', userId, langProfile);
  const DISCUSS_CHAT_CACHE_KEY = (userId?: string, langProfile?: { native: string; learning: string }) =>
    getStorageKey('userDiscussChatCache', userId, langProfile);

  const PRACTICE_REVIEW_LOG_LIMIT = 5000;

  const [currentPracticePhrase, setCurrentPracticePhrase] = useState<Phrase | null>(null);
  const [allPhrases, setAllPhrases] = useState<Phrase[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [buttonUsage, setButtonUsage] = useState({
    close: 0,
    continue: 0,
    next: 0,
  });
  const [masteryButtonUsage, setMasteryButtonUsage] = useState({
    know: 0,
    forgot: 0,
    dont_know: 0,
  });
  const [habitTracker, setHabitTracker] = useState(defaultHabitTracker);
  const [cardActionUsage, setCardActionUsage] = useState(defaultCardActionUsage);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [practiceChatHistory, setPracticeChatHistory] = useState<ChatMessage[]>([]);
  const [practiceChatSessions, setPracticeChatSessions] = useState<PracticeChatSessionRecord[]>([]);
  const [practiceReviewLog, setPracticeReviewLog] = useState<PracticeReviewLogEntry[]>([]);
  const [discussCache, setDiscussCache] = useState<DiscussCacheEntry[]>([]);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [apiProvider, setApiProvider] = useState<AiService | null>(null);
  const [apiProviderType, setApiProviderType] = useState<ApiProviderType | null>(null);

  const isPrefetchingRef = useRef(false);

  // Legacy keys (for migration)
  const LEGACY_PHRASES_KEY = 'learningPhrases';
  const LEGACY_CATEGORIES_KEY = 'learningAppCategories';

  /**
   * Migrate legacy localStorage data to new user+language aware keys
   */
  const migrateLegacyStorage = (userId: string, languageProfile: { native: string; learning: string }) => {
    console.log('[Migration] Checking for legacy data...');

    // Migrate phrases
    const legacyPhrases = localStorage.getItem(LEGACY_PHRASES_KEY);
    if (legacyPhrases && !localStorage.getItem(PHRASES_KEY(userId, languageProfile))) {
      console.log('[Migration] Migrating legacy phrases...');
      localStorage.setItem(PHRASES_KEY(userId, languageProfile), legacyPhrases);
      localStorage.removeItem(LEGACY_PHRASES_KEY);
      console.log('[Migration] Phrases migrated successfully');
    }

    // Migrate categories
    const legacyCategories = localStorage.getItem(LEGACY_CATEGORIES_KEY);
    if (legacyCategories && !localStorage.getItem(CATEGORIES_KEY(userId, languageProfile))) {
      console.log('[Migration] Migrating legacy categories...');
      localStorage.setItem(CATEGORIES_KEY(userId, languageProfile), legacyCategories);
      localStorage.removeItem(LEGACY_CATEGORIES_KEY);
      console.log('[Migration] Categories migrated successfully');
    }
  };

  // Migrate legacy data on mount
  useEffect(() => {
    if (userId && languageProfile) {
      migrateLegacyStorage(userId, languageProfile);
    }
  }, [userId, languageProfile]);

  /**
   * Wrapper for API calls that implements:
   * 1. Retry logic with exponential backoff for specific error types (429, 503).
   * 2. Fallback provider switching (e.g., trying DeepSeek if Gemini fails).
   *
   * @param apiCall - A function that takes an AiService provider and returns a Promise.
   */
  const callApiWithFallback = async <T>(apiCall: (provider: AiService) => Promise<T>): Promise<T> => {
    if (!apiProvider || !apiProviderType) throw new Error('AI provider not initialized.');

    const maxRetries = 3;

    const executeWithRetries = async (provider: AiService, type: ApiProviderType): Promise<T> => {
      let attempt = 0;
      let delay = 1000; // 1s initial delay
      while (attempt < maxRetries) {
        try {
          return await apiCall(provider);
        } catch (error: any) {
          attempt++;
          let isRetryableError = false;
          let errorType = 'generic';

          if (type === 'gemini') {
            try {
              const message = error.message || '';
              const jsonMatch = message.match(/{.*}/s);
              if (jsonMatch) {
                const errorJson = JSON.parse(jsonMatch[0]);
                const errorCode = errorJson?.error?.code;
                const errorStatus = errorJson?.error?.status;

                if (errorCode === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
                  isRetryableError = true;
                  errorType = 'rate limit';
                } else if (errorCode === 503 || errorStatus === 'UNAVAILABLE') {
                  isRetryableError = true;
                  errorType = 'server overloaded';
                }
              } else {
                if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
                  isRetryableError = true;
                  errorType = 'rate limit';
                } else if (message.includes('503') || message.includes('UNAVAILABLE')) {
                  isRetryableError = true;
                  errorType = 'server overloaded';
                }
              }
            } catch (e) {
              const message = error.message || '';
              if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
                isRetryableError = true;
                errorType = 'rate limit';
              } else if (message.includes('503') || message.includes('UNAVAILABLE')) {
                isRetryableError = true;
                errorType = 'server overloaded';
              }
            }
          }

          if (isRetryableError && attempt < maxRetries) {
            const jitter = Math.random() * 500;
            console.warn(
              `API call failed (${errorType}) on attempt ${attempt} with ${type}. Retrying in ${(delay + jitter) / 1000
              }s...`
            );
            await sleep(delay + jitter);
            delay *= 2; // Exponential backoff
          } else {
            throw error;
          }
        }
      }
      throw new Error(`API call failed with ${type} after ${maxRetries} attempts.`);
    };

    try {
      return await executeWithRetries(apiProvider, apiProviderType);
    } catch (primaryError) {
      console.warn(`API call with ${apiProviderType} failed:`, primaryError);
      const fallback = getFallbackProvider(apiProviderType);
      if (fallback) {
        console.log(`Attempting fallback to ${fallback.type}...`);
        setApiProvider(fallback.provider);
        setApiProviderType(fallback.type);
        try {
          return await executeWithRetries(fallback.provider, fallback.type);
        } catch (fallbackError) {
          console.error(`Fallback API call with ${fallback.type} also failed:`, fallbackError);
          throw new Error(
            `Primary API failed: ${(primaryError as Error).message
            }. Fallback API also failed: ${(fallbackError as Error).message}`
          );
        }
      }
      throw primaryError;
    }
  };

  const updateAndSavePhrases = (updater: React.SetStateAction<Phrase[]>) => {
    setAllPhrases((prevPhrases) => {
      const newPhrases = typeof updater === 'function' ? updater(prevPhrases) : updater;
      try {
        localStorage.setItem(PHRASES_KEY(userId, languageProfile), JSON.stringify(newPhrases));
      } catch (e) {
        console.error('Failed to save phrases to storage', e);
      }
      return newPhrases;
    });
  };

  /**
   * Loads initial user data (phrases, categories, settings) from localStorage first,
   * then attempts to sync with the backend server in the background.
   */
  const loadUserData = async () => {
    setIsLoading(true);
    setError(null);

    // --- AI Provider Setup ---
    const providerList = getProviderPriorityList();
    let activeProvider: AiService | null = null;
    let activeProviderType: ApiProviderType | null = null;
    if (providerList.length > 0) {
      for (const providerInfo of providerList) {
        if (await providerInfo.provider.healthCheck()) {
          activeProvider = providerInfo.provider;
          activeProviderType = providerInfo.type;
          break;
        }
      }
    }
    if (activeProvider) {
      setApiProvider(activeProvider);
      setApiProviderType(activeProviderType);
    } else {
      setError(providerList.length === 0 ? 'No AI provider configured.' : 'AI features are temporarily unavailable.');
    }

    // --- Data Loading (Categories & Phrases) ---
    const storedCategories = localStorage.getItem(CATEGORIES_KEY(userId, languageProfile));
    const storedPhrases = localStorage.getItem(PHRASES_KEY(userId, languageProfile));
    let dataLoaded = false;

    if (storedCategories && storedPhrases) {
      console.log('Loading data from localStorage cache...');
      const loadedCategories = JSON.parse(storedCategories);
      let loadedPhrases: Phrase[] = JSON.parse(storedPhrases);
      loadedPhrases = loadedPhrases.map((p) => ({
        ...p,
        isMastered: srsService.isPhraseMastered(p, loadedCategories),
      }));
      setCategories(loadedCategories);
      setAllPhrases(loadedPhrases);
      dataLoaded = true;

      // Background sync with server
      backendService
        .fetchInitialData(userId)
        .then((serverData) => {
          console.log('Syncing with server in background...');
          const { loadedCategories: serverCategories, loadedPhrases: serverPhrases } =
            processInitialServerData(serverData);
          localStorage.setItem(CATEGORIES_KEY(userId, languageProfile), JSON.stringify(serverCategories));
          updateAndSavePhrases(serverPhrases);
          setCategories(serverCategories);
          showToast({ message: t('notifications.sync.synced') });
        })
        .catch((syncError) => {
          console.warn('Background sync failed:', (syncError as Error).message);
        });
    } else {
      console.log('No local data, fetching from server...');
      try {
        const serverData = await backendService.fetchInitialData(userId);
        const { loadedCategories, loadedPhrases } = processInitialServerData(serverData);

        localStorage.setItem(CATEGORIES_KEY(userId, languageProfile), JSON.stringify(loadedCategories));
        localStorage.setItem(PHRASES_KEY(userId, languageProfile), JSON.stringify(loadedPhrases));
        setCategories(loadedCategories);
        setAllPhrases(loadedPhrases);
        dataLoaded = true;
        showToast({ message: t('notifications.sync.loaded') });
      } catch (fetchError) {
        console.error('Server not available, initializing with empty data:', (fetchError as Error).message);
        // Initialize with empty data if server is not available
        const defaultCategories = [
          {
            id: '1',
            name: 'Общие',
            color: 'bg-slate-500',
            isFoundational: true,
          },
        ];
        const defaultPhrases: Phrase[] = [];

        localStorage.setItem(CATEGORIES_KEY(userId, languageProfile), JSON.stringify(defaultCategories));
        localStorage.setItem(PHRASES_KEY(userId, languageProfile), JSON.stringify(defaultPhrases));
        setCategories(defaultCategories);
        setAllPhrases(defaultPhrases);
        dataLoaded = true;
        showToast({ message: 'Инициализация с пустыми данными' });
      }
    }

    if (dataLoaded) {
      try {
        const loadedCategories = JSON.parse(localStorage.getItem(CATEGORIES_KEY(userId, languageProfile)) || '[]');
        const storedSettings = localStorage.getItem(SETTINGS_KEY(userId));
        const defaultEnabledCategories = loadedCategories.reduce(
          (acc: any, cat: Category) => ({ ...acc, [cat.id]: true }),
          {} as Record<PhraseCategory, boolean>
        );

        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          const enabledCategories = {
            ...defaultEnabledCategories,
            ...parsedSettings.enabledCategories,
          };
          loadedCategories.forEach((cat: Category) => {
            if (!(cat.id in enabledCategories)) enabledCategories[cat.id] = true;
          });
          setSettings({
            ...defaultSettings,
            ...parsedSettings,
            enabledCategories,
          });
        } else {
          setSettings({
            ...defaultSettings,
            enabledCategories: defaultEnabledCategories,
          });
        }

        const storedUsage = localStorage.getItem(BUTTON_USAGE_KEY(userId));
        if (storedUsage) setButtonUsage(JSON.parse(storedUsage));
        const storedMasteryUsage = localStorage.getItem(MASTERY_BUTTON_USAGE_KEY(userId));
        if (storedMasteryUsage) setMasteryButtonUsage(JSON.parse(storedMasteryUsage));
        const storedCardActionUsage = localStorage.getItem(CARD_ACTION_USAGE_KEY(userId));
        if (storedCardActionUsage) setCardActionUsage(JSON.parse(storedCardActionUsage));
        const storedHabitTracker = localStorage.getItem(HABIT_TRACKER_KEY(userId));
        if (storedHabitTracker) setHabitTracker(JSON.parse(storedHabitTracker));

        const storedPracticeChat = localStorage.getItem(PRACTICE_CHAT_HISTORY_KEY(userId, languageProfile));
        if (storedPracticeChat) setPracticeChatHistory(JSON.parse(storedPracticeChat));
        const storedPracticeChatSessions = localStorage.getItem(PRACTICE_CHAT_SESSIONS_KEY(userId, languageProfile));
        if (storedPracticeChatSessions) setPracticeChatSessions(JSON.parse(storedPracticeChatSessions));
        const storedPracticeReviewLog = localStorage.getItem(PRACTICE_REVIEW_LOG_KEY(userId, languageProfile));
        if (storedPracticeReviewLog) setPracticeReviewLog(JSON.parse(storedPracticeReviewLog));
        const storedDiscussCache = localStorage.getItem(DISCUSS_CHAT_CACHE_KEY(userId, languageProfile));
        if (storedDiscussCache) {
          setDiscussCache(JSON.parse(storedDiscussCache));
        }
      } catch (e) {
        console.error('Failed to load settings or trackers', e);
      }
    }

    setIsLoading(false);
  };

  const processInitialServerData = (serverData: { categories: Category[]; phrases: Phrase[] }) => {
    let loadedPhrases = serverData.phrases.map((p) => ({
      ...p,
      isMastered: srsService.isPhraseMastered(p, serverData.categories),
    }));
    return { loadedCategories: serverData.categories, loadedPhrases };
  };

  // Sync language profile with AI service
  useEffect(() => {
    setCurrentLanguageProfile(languageProfile);
    console.log('[App] Language profile updated for AI services:', languageProfile);
  }, [languageProfile]);

  useEffect(() => {
    console.log('🔍 [App] loadUserData useEffect triggered:', {
      needsOnboarding,
      isOnboardingLoading,
      willLoadData: !needsOnboarding && !isOnboardingLoading,
    });

    // Don't load data if user needs onboarding or onboarding is still checking
    if (!needsOnboarding && !isOnboardingLoading) {
      console.log('✅ [App] Conditions met, calling loadUserData()');
      loadUserData();
    } else {
      console.log('⏸️ [App] Skipping loadUserData because:', {
        needsOnboarding,
        isOnboardingLoading,
      });
    }
  }, [needsOnboarding, isOnboardingLoading]);

  // Handle user change - reload data for new user
  useEffect(() => {
    if (userChanged) {
      console.log('User changed, reloading data...');
      // Clear current state
      setAllPhrases([]);
      setCategories([]);
      setCurrentPracticePhrase(null);
      setIsLoading(true);
      setError(null);
      setPracticeChatHistory([]);
      setPracticeChatSessions([]);
      setPracticeReviewLog([]);

      // Clear localStorage for user data
      localStorage.removeItem(PHRASES_KEY(userId, languageProfile));
      localStorage.removeItem(CATEGORIES_KEY(userId, languageProfile));
      localStorage.removeItem(PRACTICE_CHAT_HISTORY_KEY(userId, languageProfile));
      localStorage.removeItem(PRACTICE_CHAT_SESSIONS_KEY(userId, languageProfile));
      localStorage.removeItem(PRACTICE_REVIEW_LOG_KEY(userId, languageProfile));

      // Reload data from server
      loadUserData();
      resetUserChanged();
    }
  }, [userChanged, resetUserChanged, loadUserData]);

  const updateAndSaveCategories = (updater: React.SetStateAction<Category[]>) => {
    setCategories((prev) => {
      const newCategories = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem(CATEGORIES_KEY(userId, languageProfile), JSON.stringify(newCategories));
      return newCategories;
    });
  };

  /**
   * Generates new phrases using the current AI provider.
   * Prevents duplicates by sending a list of existing phrases to the prompt.
   *
   * @param count - Number of phrases to generate.
   */
  const fetchNewPhrases = async (count: number = 5) => {
    if (isGenerating || !apiProvider) {
      if (!apiProvider) setError('AI provider is not available for generating new phrases.');
      return;
    }
    setIsGenerating(true);
    if (!error?.includes('AI features are temporarily unavailable')) setError(null);
    try {
      // FIX: Use phrase.text.learning to match the updated Phrase type
      const existingLearningPhrases = allPhrases.map((p) => p.text.learning).join('; ');
      const prompt = `Сгенерируй ${count} новых, полезных в быту немецких фраз уровня A1. Не повторяй: "${existingLearningPhrases}". Верни JSON-массив объектов с ключами 'learning' и 'native'.`;
      const newPhrasesData = await callApiWithFallback((provider) => provider.generatePhrases(prompt));

      const generalCategory = categories.find((c) => c.name.toLowerCase() === 'общие');
      const defaultCategoryId = generalCategory?.id || (categories.length > 0 ? categories[0].id : '1');

      const phrasesToCreate = newPhrasesData.map((p) => ({
        // FIX: Map flat structure to nested `text` object
        text: { learning: p.learning, native: p.native },
        category: defaultCategoryId,
      }));

      const createdPhrases: Phrase[] = [];
      for (const p of phrasesToCreate) {
        try {
          const newPhrase = await backendService.createPhrase(userId, p);
          createdPhrases.push(newPhrase);
        } catch (err) {
          console.error('Failed to save new phrase to backend:', err);
        }
      }

      if (createdPhrases.length > 0) {
        updateAndSavePhrases((prev) => [...prev, ...createdPhrases]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error during phrase generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const prefetchPhraseBuilderOptions = async (startingPhraseId: string | null) => {
    if (isPrefetchingRef.current || !apiProvider) return;
    isPrefetchingRef.current = true;

    try {
      const PREFETCH_COUNT = 2;
      let nextPhraseId = startingPhraseId;
      const phrasesToFetch: Phrase[] = [];
      const unmastered = allPhrases.filter((p) => p && !p.isMastered);

      for (let i = 0; i < PREFETCH_COUNT; i++) {
        const nextPhrase = srsService.selectNextPhrase(unmastered, nextPhraseId);
        if (nextPhrase) {
          if (phrasesToFetch.some((p) => p.id === nextPhrase.id)) break;
          phrasesToFetch.push(nextPhrase);
          nextPhraseId = nextPhrase.id;
        } else {
          break;
        }
      }

      await Promise.all(
        phrasesToFetch.map(async (phrase) => {
          const cacheKey = `phrase_builder_${phrase.id}`;
          if (!cacheService.getCache<PhraseBuilderOptions>(cacheKey)) {
            try {
              const options = await callApiWithFallback((provider) => provider.generatePhraseBuilderOptions(phrase));
              cacheService.setCache(cacheKey, options);
            } catch (err) {
              console.warn(`Background prefetch failed for phrase ${phrase.id}:`, err);
            }
          }
        })
      );
    } finally {
      isPrefetchingRef.current = false;
    }
  };

  // New proactive pre-fetching effect for both phrase builder and quick replies
  useEffect(() => {
    if (view === 'practice' && currentPracticePhrase) {
      prefetchPhraseBuilderOptions(currentPracticePhrase.id);
    }
  }, [view, currentPracticePhrase]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(SETTINGS_KEY(userId), JSON.stringify(updated));
      return updated;
    });
  };

  const updatePracticeChatHistory = (updater: React.SetStateAction<ChatMessage[]>) => {
    setPracticeChatHistory((prev) => {
      const newHistory = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem(PRACTICE_CHAT_HISTORY_KEY(userId, languageProfile), JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const updatePracticeChatSessionComplete = (session: PracticeChatSessionRecord) => {
    setPracticeChatSessions((prev) => {
      const updatedSessions = [...prev, session];
      const trimmed = updatedSessions.slice(-50);
      localStorage.setItem(PRACTICE_CHAT_SESSIONS_KEY(userId, languageProfile), JSON.stringify(trimmed));
      return trimmed;
    });
  };

  const appendPracticeReviewLog = (entry: PracticeReviewLogEntry) => {
    if (!userId) return;
    const storageKey = PRACTICE_REVIEW_LOG_KEY(userId, languageProfile);
    setPracticeReviewLog((prev) => {
      const next = [...prev, entry];
      const trimmed =
        next.length > PRACTICE_REVIEW_LOG_LIMIT ? next.slice(next.length - PRACTICE_REVIEW_LOG_LIMIT) : next;
      try {
        localStorage.setItem(storageKey, JSON.stringify(trimmed));
      } catch (error) {
        console.error('[PracticeReviewLog] Failed to persist log', error);
      }
      return trimmed;
    });
  };

  const updateHabitTrackerChange = (updater: React.SetStateAction<typeof habitTracker>) => {
    setHabitTracker((prev) => {
      const newTracker = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem(HABIT_TRACKER_KEY(userId), JSON.stringify(newTracker));
      return newTracker;
    });
  };

  const updateButtonUsage = (button: 'close' | 'continue' | 'next') => {
    const DECAY_FACTOR = 0.95;
    const INCREMENT = 1;
    setButtonUsage((prev) => {
      const newUsage = {
        close: prev.close * DECAY_FACTOR,
        continue: prev.continue * DECAY_FACTOR,
        next: prev.next * DECAY_FACTOR,
      };
      newUsage[button] += INCREMENT;
      localStorage.setItem(BUTTON_USAGE_KEY(userId), JSON.stringify(newUsage));
      return newUsage;
    });
  };

  const updateMasteryButtonUsage = (button: PracticeReviewAction) => {
    const DECAY_FACTOR = 0.95;
    const INCREMENT = 1;
    setMasteryButtonUsage((prev) => {
      const newUsage = {
        know: prev.know * DECAY_FACTOR,
        forgot: prev.forgot * DECAY_FACTOR,
        dont_know: prev.dont_know * DECAY_FACTOR,
      };
      newUsage[button] += INCREMENT;
      localStorage.setItem(MASTERY_BUTTON_USAGE_KEY(userId), JSON.stringify(newUsage));
      return newUsage;
    });
  };

  const updateCardActionUsage = (button: keyof typeof cardActionUsage) => {
    const DECAY_FACTOR = 0.95;
    const INCREMENT = 1;
    setCardActionUsage((prev) => {
      const newUsage = { ...prev };
      for (const key in newUsage) {
        (newUsage as any)[key] *= DECAY_FACTOR;
      }
      newUsage[button] += INCREMENT;
      localStorage.setItem(CARD_ACTION_USAGE_KEY(userId), JSON.stringify(newUsage));
      return newUsage;
    });
  };

  /**
   * Updates the mastery level of a phrase based on the user's review action (know/forgot).
   * Also updates the local cache and syncs the change to the backend.
   *
   * @param phrase - The phrase being reviewed.
   * @param action - The action taken ('know', 'forgot', etc.).
   */
  const updatePhraseMasteryAndCache = async (phrase: Phrase, action: PracticeReviewAction) => {
    const updatedPhrase = srsService.updatePhraseMastery(phrase, action, categories);

    if (settings.soundEffects && action === 'know') playCorrectSound();
    else if (settings.soundEffects) playIncorrectSound();

    // Optimistic UI update
    updateAndSavePhrases((prev) => prev.map((p) => (p.id === phrase.id ? updatedPhrase : p)));
    if (updatedPhrase.isMastered && !phrase.isMastered) {
      cacheService.clearCacheForPhrase(phrase.id);
    }

    try {
      // Background sync
      await backendService.updatePhrase(userId, updatedPhrase);
    } catch (err) {
      // On failure, just show a toast. Do NOT revert the UI state.
      showToast({
        message: t('notifications.sync.error', {
          message: (err as Error).message,
        }),
      });
      console.error('Background sync failed for phrase ' + phrase.id, err);
    }

    if (currentPracticePhrase?.id === phrase.id) {
      setCurrentPracticePhrase(updatedPhrase);
    }

    const logTimestamp = Date.now();
    const randomSource =
      typeof globalThis !== 'undefined' ? (globalThis as typeof globalThis & { crypto?: Crypto }).crypto : undefined;
    const logEntry: PracticeReviewLogEntry = {
      id:
        randomSource && typeof randomSource.randomUUID === 'function'
          ? randomSource.randomUUID()
          : `review_${phrase.id}_${logTimestamp}`,
      timestamp: logTimestamp,
      phraseId: phrase.id,
      categoryId: phrase.category,
      action,
      wasCorrect: action === 'know',
      wasNew: phrase.lastReviewedAt === null,
      previousMasteryLevel: phrase.masteryLevel,
      newMasteryLevel: updatedPhrase.masteryLevel,
      previousKnowStreak: phrase.knowStreak,
      newKnowStreak: updatedPhrase.knowStreak,
      previousLapses: phrase.lapses ?? 0,
      newLapses: updatedPhrase.lapses ?? 0,
      previousNextReviewAt: phrase.nextReviewAt,
      nextReviewAt: updatedPhrase.nextReviewAt,
      previousIsMastered: phrase.isMastered,
      newIsMastered: updatedPhrase.isMastered,
      previousKnowCount: phrase.knowCount,
      newKnowCount: updatedPhrase.knowCount,
      intervalMs: Math.max(updatedPhrase.nextReviewAt - logTimestamp, 0),
      languageLearning: languageProfile?.learning ?? '',
      languageNative: languageProfile?.native ?? '',
      isLeechAfter: srsService.isLeech(updatedPhrase),
    };

    appendPracticeReviewLog(logEntry);

    return updatedPhrase; // Return the optimistically updated phrase.
  };

  const updateDiscussTranslation = (request: any) =>
    callApiWithFallback((provider) => provider.discussTranslation(request));

  const updateDiscussHistory = (phraseId: string, messages: ChatMessage[]) => {
    setDiscussCache((prev) => {
      const newCache = { ...prev, [phraseId]: messages };
      try {
        localStorage.setItem(DISCUSS_CHAT_CACHE_KEY(userId, languageProfile), JSON.stringify(newCache));
      } catch (error) {
        console.error('Failed to save discuss cache', error);
      }
      return newCache;
    });
  };

  return {
    updateAndSavePhrases,
    updateAndSaveCategories,
    fetchNewPhrases,
    allPhrases,
    categories,
    isLoading,
    error,
    callApiWithFallback,
    updateSettings,
    updatePracticeChatHistory,
    updatePracticeChatSessionComplete,
    updateHabitTrackerChange,
    updateButtonUsage,
    updateMasteryButtonUsage,
    updateCardActionUsage,
    currentPracticePhrase,
    setCurrentPracticePhrase,
    settings,
    apiProvider,
    apiProviderType,
    buttonUsage,
    habitTracker,
    practiceChatSessions,
    isGenerating,
    cardActionUsage,
    masteryButtonUsage,
    updatePhraseMasteryAndCache,
    practiceReviewLog,
  };
};

export default useDataOperations;
