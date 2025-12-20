import React, { useState, useEffect } from 'react';
import type { LanguageCode } from '../types';
import { LANGUAGE_OPTIONS } from '../src/i18n/languageMeta';


interface LanguageOnboardingModalProps {
  isOpen: boolean;
  detectedBrowserLanguage: LanguageCode;
  isGeneratingData?: boolean;
  onComplete: (nativeLanguage: LanguageCode, learningLanguage: LanguageCode) => void;
}

// Status messages for progress display
const GENERATION_STEPS = [
  'Connecting to AI',
  'Generating categories',
  'Translating phrases',
  'Building vocabulary',
  'Preparing flashcards',
  'Almost ready',
];

const LanguageOnboardingModal: React.FC<LanguageOnboardingModalProps> = ({
  isOpen,
  detectedBrowserLanguage,
  isGeneratingData = false,
  onComplete,
}) => {
  const [step, setStep] = useState<'selection' | 'generating'>('selection');
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>(detectedBrowserLanguage || 'en');
  const [isChangingNative, setIsChangingNative] = useState(false);
  const [learningLanguage, setLearningLanguage] = useState<LanguageCode>('de');

  // Progress state
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Show generating state when isGeneratingData changes
  useEffect(() => {
    if (isGeneratingData) {
      setStep('generating');
    }
  }, [isGeneratingData]);

  // Animate progress and steps
  useEffect(() => {
    if (step !== 'generating') return;

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.random() * 3 + 1;
        return next > 95 ? 95 : next;
      });
    }, 2000);

    const stepInterval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStepIndex(prev => {
          const next = prev + 1;
          return next >= GENERATION_STEPS.length ? 0 : next;
        });
        setIsTransitioning(false);
      }, 300);
    }, 8000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, [step]);

  // Update native language if detected language changes
  useEffect(() => {
    if (detectedBrowserLanguage) {
      setNativeLanguage(detectedBrowserLanguage);
    }
  }, [detectedBrowserLanguage]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    setStep('generating');
    onComplete(nativeLanguage, learningLanguage);
  };

  const handleNativeLanguageChange = (code: LanguageCode) => {
    setNativeLanguage(code);
    setIsChangingNative(false);
    if (learningLanguage === code) {
      const firstAvailable = LANGUAGE_OPTIONS.find(l => l.code !== code);
      if (firstAvailable) setLearningLanguage(firstAvailable.code);
    }
  };

  const availableLearningLanguages = LANGUAGE_OPTIONS.filter(
    (lang) => lang.code !== nativeLanguage
  );

  const nativeLanguageInfo = LANGUAGE_OPTIONS.find(l => l.code === nativeLanguage);
  const nativeLanguageName = nativeLanguageInfo?.nativeName || 'English';
  const learningLanguageInfo = LANGUAGE_OPTIONS.find(l => l.code === learningLanguage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">

        {step === 'generating' ? (
          /* Generating State - Animated Single Step */
          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-lg font-medium text-white mb-1">
                Creating your learning experience
              </h2>
              <p className="text-slate-500 text-sm">
                {nativeLanguageInfo?.nativeName} → {learningLanguageInfo?.nativeName}
              </p>
            </div>

            {/* Animated Current Step */}
            <div className="h-16 flex items-center justify-center mb-8 relative overflow-hidden">
              <div
                className={`flex items-center gap-3 transition-all duration-300 ease-out ${isTransitioning
                  ? 'opacity-0 translate-y-4'
                  : 'opacity-100 translate-y-0'
                  }`}
              >
                {/* Animated Dot */}
                <div className="relative">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <div className="absolute inset-0 w-2 h-2 bg-purple-500 rounded-full animate-ping" />
                </div>
                <span className="text-slate-300 text-base">
                  {GENERATION_STEPS[currentStepIndex]}
                </span>
              </div>
            </div>

            {/* Minimal Progress Bar */}
            <div className="mb-4">
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Time Estimate */}
            <p className="text-center text-slate-600 text-xs">
              This usually takes 1-2 minutes
            </p>
          </div>
        ) : (
          /* Selection State */
          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-white">
                Welcome to Lingogo
              </h2>
            </div>

            {/* Native Language */}
            <div className="mb-6">
              <label className="text-sm text-slate-400 mb-2 block">
                Your native language
              </label>
              {isChangingNative ? (
                <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 max-h-40 overflow-y-auto custom-scrollbar">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleNativeLanguageChange(lang.code)}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${nativeLanguage === lang.code
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                    >
                      <span>{lang.nativeName}</span>
                      <span className="text-sm text-slate-500">{lang.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setIsChangingNative(true)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white hover:border-purple-500/30 transition-colors"
                >
                  <span className="font-medium">{nativeLanguageName}</span>
                  <span className="text-sm text-purple-400 hover:text-purple-300">Change</span>
                </button>
              )}
            </div>

            {/* Learning Language */}
            <div className="mb-6">
              <label className="text-sm text-slate-400 mb-2 block">
                I want to learn
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {availableLearningLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLearningLanguage(lang.code)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center justify-between transition-all ${learningLanguage === lang.code
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700/50'
                      }`}
                  >
                    <span className="font-medium">{lang.nativeName}</span>
                    <span className={`text-sm ${learningLanguage === lang.code ? 'text-purple-200' : 'text-slate-500'}`}>
                      {lang.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirm}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Start Learning
            </button>
          </div>
        )}
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.5);
        }
      `}</style>
    </div>
  );
};

export default LanguageOnboardingModal;
