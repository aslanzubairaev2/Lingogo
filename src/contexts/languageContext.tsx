import React, { createContext, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import DevLanguageSelector from '../components/DevLanguageSelector.tsx';
import LocalizationOverlay from '../components/LocalizationOverlay.tsx';
import i18n, { DEFAULT_LANG, LOCALE_SCHEMA_VERSION, SUPPORTED_LANGS } from '../i18n/config.ts';
import type { LocalizationPhase } from '../i18n/localizationPhases.ts';
import * as backendService from '../services/backendService.ts';
import * as configService from '../services/configService.ts';
import { hasLocaleGaps, loadLocaleResources, validateLocaleShape } from '../services/languageService.ts';
import { readLocaleCache } from '../services/localeCache.ts';
import type { LanguageCode, LanguageProfile } from '../types.ts';
import { useAuth } from './authContext.tsx';

const DEV_OVERRIDE_KEY = 'devLanguageOverride';

type ProfileUpdater = LanguageProfile | ((prev: LanguageProfile) => LanguageProfile);
interface SetProfileOptions {
  lockUi?: boolean;
}

interface LanguageContextType {
  profile: LanguageProfile;
  setProfile: (profile: ProfileUpdater, options?: SetProfileOptions) => void;
  currentLanguage: string;
  isLocalizing: boolean;
  localizationPhase: LocalizationPhase;
  localizationLanguage: LanguageCode;
  isDev: boolean;
  openDevLanguageSelector?: () => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const detectBrowserLanguage = (): LanguageCode => {
  if (typeof navigator === 'undefined' || !navigator.language) {
    return DEFAULT_LANG as LanguageCode;
  }
  const base = navigator.language.split('-')[0].toLowerCase();
  return (SUPPORTED_LANGS.includes(base as LanguageCode) ? base : DEFAULT_LANG) as LanguageCode;
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const isDev = import.meta.env.DEV;
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Add test function to window for debugging AI generation
  if (isDev && typeof window !== 'undefined') {
    (window as any).testAIGeneration = async () => {
      console.log('Testing AI generation...');

      try {
        const { translateLocaleTemplate } = await import('../services/geminiService.ts');
        const { STATIC_RESOURCES } = await import('../i18n/config.ts');

        const baseTemplate = STATIC_RESOURCES.en?.translation;
        if (!baseTemplate) {
          throw new Error('Could not load base template');
        }

        console.log(`Base template has ${Object.keys(baseTemplate).length} top-level keys`);

        const testLang = 'fr';
        console.log(`Testing AI generation for ${testLang}...`);

        const startTime = Date.now();
        const generated = await translateLocaleTemplate(baseTemplate, testLang);
        const endTime = Date.now();

        console.log(`AI generation completed in ${(endTime - startTime) / 1000} seconds`);

        if (typeof generated !== 'object' || generated === null || Array.isArray(generated)) {
          throw new Error('Generated locale is not a valid object');
        }

        console.log(`Generated locale has ${Object.keys(generated).length} top-level keys`);

        let translatedCount = 0;
        let emptyCount = 0;

        function countTranslations(obj: any, path = '') {
          Object.entries(obj).forEach(([key, value]) => {
            if (typeof value === 'string') {
              if (value.trim().length > 0) {
                translatedCount++;
              } else {
                emptyCount++;
              }
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
              countTranslations(value, `${path}.${key}`);
            }
          });
        }

        countTranslations(generated);
        console.log(`Generated locale has ${translatedCount} translated strings and ${emptyCount} empty strings`);

        if (translatedCount > 0) {
          console.log('✅ AI generation test PASSED - generated some translations');
          return { success: true, translatedCount, emptyCount, generated };
        } else {
          console.log('❌ AI generation test FAILED - generated only empty strings');
          return { success: false, translatedCount, emptyCount, generated };
        }
      } catch (error) {
        console.error('❌ AI generation test FAILED with error:', error);
        return { success: false, error: error.message };
      }
    };
  }

  const [profile, setProfileState] = useState<LanguageProfile>(() => {
    const { profile: storedProfile, source } = configService.getLanguageProfile();
    const meta = configService.getLanguageProfileMeta();
    const detected = detectBrowserLanguage();

    let resolvedProfile = storedProfile;
    let uiLocked = meta.uiLocked ?? false;

    if (source === 'default') {
      uiLocked = false;
    }

    if (!uiLocked && resolvedProfile.ui !== detected) {
      resolvedProfile = { ...resolvedProfile, ui: detected };
    }

    if (isDev) {
      const override = localStorage.getItem(DEV_OVERRIDE_KEY) as LanguageCode | null;
      if (override && SUPPORTED_LANGS.includes(override)) {
        resolvedProfile = { ...resolvedProfile, ui: override };
        uiLocked = true;
      }
    }

    configService.saveLanguageProfile(resolvedProfile);
    configService.saveLanguageProfileMeta({
      uiLocked,
      lastDetected: detected,
    });

    return resolvedProfile;
  });

  const [currentLanguage, setCurrentLanguage] = useState<string>(i18n.language || DEFAULT_LANG);
  const [localizationPhase, setLocalizationPhase] = useState<LocalizationPhase>('idle');
  const [isLocalizing, setIsLocalizing] = useState<boolean>(false);
  const [localizationLanguage, setLocalizationLanguage] = useState<LanguageCode>(profile.ui as LanguageCode);
  const [overlayVisible, setOverlayVisible] = useState<boolean>(false);
  const [showDevSelector, setShowDevSelector] = useState<boolean>(
    () => isDev && !localStorage.getItem(DEV_OVERRIDE_KEY)
  );

  const activeController = useRef<AbortController | null>(null);
  const hideOverlayTimeout = useRef<number | null>(null);

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setCurrentLanguage(lng);
    };
    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    if (!isDev) {
      return;
    }
    const override = localStorage.getItem(DEV_OVERRIDE_KEY) as LanguageCode | null;
    if (override && override !== profile.ui && SUPPORTED_LANGS.includes(override)) {
      setProfileState((prev) => ({ ...prev, ui: override }));
      configService.saveLanguageProfile({ ...profile, ui: override });
      configService.saveLanguageProfileMeta({
        uiLocked: true,
        lastDetected: detectBrowserLanguage(),
      });
    }
  }, []);

  useEffect(() => {
    const targetLang = (SUPPORTED_LANGS.includes(profile.ui) ? profile.ui : DEFAULT_LANG) as LanguageCode;
    setLocalizationLanguage(targetLang);

    if (hideOverlayTimeout.current !== null) {
      window.clearTimeout(hideOverlayTimeout.current);
      hideOverlayTimeout.current = null;
    }

    if (activeController.current) {
      activeController.current.abort();
    }

    if (isDev && showDevSelector) {
      setOverlayVisible(false);
      setIsLocalizing(false);
      setLocalizationPhase('idle');
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;

    const runLocalization = async () => {
      let overlayNeeded = false;

      const staticHasGaps = hasLocaleGaps(targetLang);
      if (staticHasGaps) {
        try {
          const cached = await readLocaleCache(targetLang, LOCALE_SCHEMA_VERSION);
          if (!cached || !validateLocaleShape(cached)) {
            overlayNeeded = true;
          }
        } catch (cacheError) {
          console.warn('Failed to read locale cache:', cacheError);
          overlayNeeded = true;
        }
      }

      if (overlayNeeded) {
        setOverlayVisible(true);
        setIsLocalizing(true);
        setLocalizationPhase('checkingStatic');
      } else {
        setOverlayVisible(false);
        setIsLocalizing(false);
        setLocalizationPhase('completed');
      }

      let finalPhase: LocalizationPhase = 'completed';

      try {
        const result = await loadLocaleResources(targetLang, {
          signal: controller.signal,
          onPhase: overlayNeeded
            ? (phase) => {
                if (!controller.signal.aborted) {
                  setLocalizationPhase(phase);
                }
              }
            : undefined,
        });

        if (controller.signal.aborted) {
          return;
        }

        if (!i18n.hasResourceBundle(result.lang, 'translation') || result.source !== 'static') {
          i18n.addResourceBundle(result.lang, 'translation', result.resources, true, true);
        }

        await i18n.changeLanguage(result.lang);
        finalPhase = 'completed';
        if (!overlayNeeded) {
          setLocalizationPhase('completed');
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('Failed to localize UI for language:', targetLang, error);
        finalPhase = 'fallback';
        setLocalizationPhase('fallback');

        // Log more details about the failure
        if (error instanceof Error) {
          console.error('Localization error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
          });
        }

        i18n.changeLanguage(DEFAULT_LANG).catch((changeError) => {
          console.error('Failed to revert to default language', changeError);
        });
      } finally {
        if (controller.signal.aborted) {
          return;
        }
        if (overlayNeeded) {
          const delay = finalPhase === 'fallback' ? 1800 : 600;
          hideOverlayTimeout.current = window.setTimeout(() => {
            setOverlayVisible(false);
            setIsLocalizing(false);
            hideOverlayTimeout.current = null;
          }, delay);
        } else {
          setIsLocalizing(false);
        }
      }
    };

    runLocalization().catch((error) => {
      if (!controller.signal.aborted) {
        console.error('Failed to initialize localization', error);
      }
    });

    return () => {
      controller.abort();
    };
  }, [profile.ui, isDev, showDevSelector]);

  // Sync language profile with database when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const syncProfileWithDatabase = async () => {
      try {
        // Try to load profile from database
        const dbProfile = await backendService.getUserProfile();

        // Null means no profile yet (new user)
        if (!dbProfile) {
          console.log('[LanguageContext] No profile in database - new user will see onboarding');
          return;
        }

        console.log('[LanguageContext] Loaded profile from database:', dbProfile);

        // In PRODUCTION: always sync UI language from database (ignore DevSelector)
        // In DEV: only sync if there's no DevSelector override
        const hasDevOverride = isDev && localStorage.getItem('devLanguageOverride');
        const shouldSyncUI = !isDev || !hasDevOverride;

        // Update local profile if database has different values
        if (
          dbProfile.native !== profile.native ||
          dbProfile.learning !== profile.learning ||
          (shouldSyncUI && dbProfile.ui !== profile.ui)
        ) {
          console.log('[LanguageContext] Syncing profile from database');
          setProfileState((prev) => ({
            ui: shouldSyncUI ? dbProfile.ui : prev.ui,
            native: dbProfile.native,
            learning: dbProfile.learning,
          }));
          configService.saveLanguageProfile({
            ui: shouldSyncUI ? dbProfile.ui : profile.ui,
            native: dbProfile.native,
            learning: dbProfile.learning,
          });
        }
      } catch (error) {
        console.warn('[LanguageContext] Could not load profile from database, using local:', error);
        // If database profile doesn't exist, create it with current profile
        try {
          await backendService.upsertUserProfile(profile);
          console.log('[LanguageContext] Created profile in database');
        } catch (upsertError) {
          console.error('[LanguageContext] Failed to create profile in database:', upsertError);
        }
      }
    };

    syncProfileWithDatabase();
  }, [isAuthenticated]); // Only run when auth status changes

  const setProfile = (update: ProfileUpdater, options: SetProfileOptions = {}) => {
    const { lockUi = true } = options;
    const detected = detectBrowserLanguage();
    setProfileState((prev) => {
      const next =
        typeof update === 'function' ? (update as (value: LanguageProfile) => LanguageProfile)(prev) : update;
      configService.saveLanguageProfile(next);
      configService.saveLanguageProfileMeta({
        uiLocked: lockUi,
        lastDetected: detected,
      });

      // Sync with database if authenticated
      if (isAuthenticated) {
        backendService
          .upsertUserProfile(next)
          .then(() => {
            console.log('[LanguageContext] Profile synced to database');
          })
          .catch((error) => {
            console.error('[LanguageContext] Failed to sync profile to database:', error);
          });
      }

      return next;
    });
  };

  const handleDevLanguageSelect = (lang: LanguageCode) => {
    if (!isDev) {
      return;
    }
    localStorage.setItem(DEV_OVERRIDE_KEY, lang);
    setShowDevSelector(false);
    setProfile((prev) => ({ ...prev, ui: lang }), { lockUi: true });
  };

  const handleUseSystemLanguage = () => {
    if (!isDev) {
      return;
    }
    localStorage.removeItem(DEV_OVERRIDE_KEY);
    const detected = detectBrowserLanguage();
    setShowDevSelector(false);
    setProfile((prev) => ({ ...prev, ui: detected }), { lockUi: false });
  };

  const openDevLanguageSelector = () => {
    if (isDev) {
      setShowDevSelector(true);
    }
  };

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      currentLanguage,
      isLocalizing,
      localizationPhase,
      localizationLanguage,
      isDev,
      openDevLanguageSelector: isDev ? openDevLanguageSelector : undefined,
    }),
    [profile, currentLanguage, isLocalizing, localizationPhase, localizationLanguage, isDev]
  );

  return (
    <LanguageContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>
        {children}
        <LocalizationOverlay visible={overlayVisible} phase={localizationPhase} languageCode={localizationLanguage} />
        {isDev && (
          <DevLanguageSelector
            visible={showDevSelector}
            selectedLanguage={profile.ui as LanguageCode}
            onSelect={handleDevLanguageSelect}
            onUseSystem={handleUseSystemLanguage}
          />
        )}
      </I18nextProvider>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = React.useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
