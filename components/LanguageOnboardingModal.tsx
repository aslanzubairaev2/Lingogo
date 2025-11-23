import React, { useState } from 'react';
import type { LanguageCode } from '../types';

interface LanguageOnboardingModalProps {
  isOpen: boolean;
  detectedBrowserLanguage: LanguageCode;
  isGeneratingData?: boolean;
  onComplete: (nativeLanguage: LanguageCode, learningLanguage: LanguageCode) => void;
}

const LANGUAGE_OPTIONS: { code: LanguageCode; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ru', name: 'Native', nativeName: 'Русский' },
  { code: 'de', name: 'Learning', nativeName: 'Deutsch' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
];

const LanguageOnboardingModal: React.FC<LanguageOnboardingModalProps> = ({
  isOpen,
  detectedBrowserLanguage,
  isGeneratingData = false,
  onComplete,
}) => {
  const [step, setStep] = useState<'learning' | 'generating'>('learning');
  // Native language is ALWAYS auto-detected, never asked
  const nativeLanguage = detectedBrowserLanguage;
  const [learningLanguage, setLearningLanguage] = useState<LanguageCode>('de');

  // Show generating state when isGeneratingData changes
  React.useEffect(() => {
    if (isGeneratingData) {
      setStep('generating');
    }
  }, [isGeneratingData]);

  if (!isOpen) return null;

  const handleLearningConfirm = () => {
    setStep('generating');
    // Use auto-detected native language
    onComplete(nativeLanguage, learningLanguage);
  };

  const availableLearningLanguages = LANGUAGE_OPTIONS.filter(
    (lang) => lang.code !== nativeLanguage
  );

  // Get the native language name for display
  const nativeLanguageName = LANGUAGE_OPTIONS.find(l => l.code === nativeLanguage)?.nativeName || 'English';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {step === 'generating' ? (
          <>
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                Setting up your learning journey... 🚀
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                We're generating personalized flashcards for you.
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                This may take 30-60 seconds. Please don't close this window.
              </p>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Welcome! 🌍
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Your native language: <span className="font-semibold text-blue-600 dark:text-blue-400">{nativeLanguageName}</span>
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Which language do you want to learn?
            </p>
            <div className="space-y-2 mb-6 max-h-96 overflow-y-auto hide-scrollbar pr-1">
              {availableLearningLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLearningLanguage(lang.code)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${learningLanguage === lang.code
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  <div className="font-semibold">{lang.nativeName}</div>
                  <div className="text-sm opacity-75">{lang.name}</div>
                </button>
              ))}
            </div>
            <button
              onClick={handleLearningConfirm}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Start Learning
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LanguageOnboardingModal;
