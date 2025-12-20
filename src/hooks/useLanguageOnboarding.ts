import { useState, useEffect } from 'react';
import * as backendService from '../../services/backendService';
import * as configService from '../../services/configService';
import { SUPPORTED_LANGUAGE_CODES, type LanguageCode } from '../../types';

interface UseLanguageOnboardingResult {
  needsOnboarding: boolean;
  isLoading: boolean;
  isGeneratingData: boolean;
  detectedLanguage: LanguageCode;
  completeOnboarding: (native: LanguageCode, learning: LanguageCode) => Promise<void>;
}

const DEV_OVERRIDE_KEY = 'devLanguageOverride';

const detectBrowserLanguage = (): LanguageCode => {
  // In DEV mode, check if DevLanguageSelector has set an override
  if (import.meta.env.DEV) {
    const devOverride = localStorage.getItem(DEV_OVERRIDE_KEY);
    if (devOverride) {
      return devOverride as LanguageCode;
    }
  }

  // Otherwise use browser language
  if (typeof navigator === 'undefined' || !navigator.language) {
    return 'en';
  }
  const base = navigator.language.split('-')[0].toLowerCase();
  return (SUPPORTED_LANGUAGE_CODES.includes(base) ? base : 'en') as LanguageCode;
};

export const useLanguageOnboarding = (userId: string | null): UseLanguageOnboardingResult => {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingData, setIsGeneratingData] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageCode>(detectBrowserLanguage());

  useEffect(() => {
    console.log('🔍 [useLanguageOnboarding] useEffect triggered, userId:', userId);

    if (!userId) {
      console.log('⚠️ [useLanguageOnboarding] No userId, skipping onboarding check');
      setIsLoading(false);
      setNeedsOnboarding(false);
      return;
    }

    const checkProfile = async () => {
      console.log('🔍 [useLanguageOnboarding] Starting profile check...');

      // Re-check detected language at the start (for DEV mode updates)
      setDetectedLanguage(detectBrowserLanguage());
      try {
        setIsLoading(true);

        // Try to get existing profile from backend
        console.log('📡 [useLanguageOnboarding] Fetching user profile...');
        const profile = await backendService.getUserProfile();
        console.log('✅ [useLanguageOnboarding] Profile fetched:', profile);

        // If profile is null, user is brand new - needs onboarding
        if (!profile) {
          console.log('🆕 [useLanguageOnboarding] No profile found - new user needs onboarding');
          setNeedsOnboarding(true);
          setIsLoading(false);
          return;
        }

        // Check if user has any data
        console.log('📡 [useLanguageOnboarding] Fetching initial data...');
        const initialData = await backendService.fetchInitialData();
        console.log('✅ [useLanguageOnboarding] Initial data fetched:', {
          categoriesCount: initialData.categories.length,
          phrasesCount: initialData.phrases.length,
        });

        const hasData = initialData.categories.length > 0 || initialData.phrases.length > 0;
        console.log('🔍 [useLanguageOnboarding] Has data?', hasData);

        // User needs onboarding if they have no data
        if (!hasData) {
          console.log('❌ [useLanguageOnboarding] No data found - user needs onboarding');
          console.log('🧹 [useLanguageOnboarding] Clearing localStorage to ensure fresh start...');

          // Clear localStorage data for this user to avoid stale cache
          // This ensures that when data is regenerated, we start from scratch
          let clearedKeys = 0;
          Object.keys(localStorage).forEach(key => {
            if (key.includes(userId) && (key.includes('Phrases') || key.includes('Categories'))) {
              console.log(`🗑️ [useLanguageOnboarding] Removing stale localStorage key: ${key}`);
              localStorage.removeItem(key);
              clearedKeys++;
            }
          });
          console.log(`🧹 [useLanguageOnboarding] Cleared ${clearedKeys} localStorage keys`);

          setNeedsOnboarding(true);
          console.log('✅ [useLanguageOnboarding] needsOnboarding set to TRUE');
        } else {
          console.log('✅ [useLanguageOnboarding] User has profile and data - no onboarding needed');
          setNeedsOnboarding(false);
          console.log('✅ [useLanguageOnboarding] needsOnboarding set to FALSE');
        }
      } catch (error) {
        console.error('❌ [useLanguageOnboarding] Error checking user profile:', error);
        // If the error is a 404 (no data found), show onboarding
        // Otherwise, it might be a temporary network issue - don't force onboarding
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log('🔍 [useLanguageOnboarding] Error message:', errorMessage);

        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          console.log('🆕 [useLanguageOnboarding] Data not found error - user needs onboarding');
          setNeedsOnboarding(true);
        } else {
          console.log('⚠️ [useLanguageOnboarding] Network error - skipping onboarding');
          setNeedsOnboarding(false);
        }
      } finally {
        setIsLoading(false);
        console.log('🏁 [useLanguageOnboarding] Check complete');
      }
    };

    checkProfile();
  }, [userId]); // detectedLanguage updated inside, not a dependency

  const completeOnboarding = async (native: LanguageCode, learning: LanguageCode) => {
    if (!userId) return;

    try {
      setIsGeneratingData(true);

      const newProfile = { ui: native, native, learning };

      // Save profile to backend
      await backendService.updateUserProfile(newProfile);

      // IMPORTANT: Also save to localStorage with uiLocked=true
      // This ensures the UI language persists after page reload
      configService.saveLanguageProfile(newProfile);
      configService.saveLanguageProfileMeta({
        uiLocked: true,
        lastDetected: native,
      });

      // Load initial data for this language pair - this may take a while
      console.log('Starting initial data generation...');
      await backendService.loadInitialData();
      console.log('Initial data generation completed!');

      setNeedsOnboarding(false);
      setIsGeneratingData(false);

      // Reload the page to reinitialize with new language profile
      window.location.reload();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsGeneratingData(false);
      throw error;
    }
  };

  return {
    needsOnboarding,
    isLoading,
    isGeneratingData,
    detectedLanguage,
    completeOnboarding,
  };
};
