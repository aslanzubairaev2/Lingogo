import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { SpeechRecognition, SpeechRecognitionErrorEvent, LanguageCode } from '../types';
import MicrophoneIcon from './icons/MicrophoneIcon';
import CloseIcon from './icons/CloseIcon';
import KeyboardIcon from './icons/KeyboardIcon';
import SendIcon from './icons/SendIcon';
import PhraseCardSkeleton from './PhraseCardSkeleton';
import { useTranslation } from '../src/hooks/useTranslation.ts';
import { LanguageContext } from '../src/contexts/languageContext.tsx';
import { getSpeechLocale, getLanguageLabel } from '../src/i18n/languageMeta.ts';

interface AddPhraseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (nativePhrase: string) => Promise<{ learning: string; native: string }>;
  onTranslateLearning: (learningPhrase: string) => Promise<{ native: string }>;
  onPhraseCreated: (phraseData: { learning: string; native: string }) => void;
  language: LanguageCode;
  autoSubmit: boolean;
}

const AddPhraseModal: React.FC<AddPhraseModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  onTranslateLearning,
  onPhraseCreated,
  language,
  autoSubmit,
}) => {
  const { t } = useTranslation();
  const languageContext = useContext(LanguageContext);
  const profile = languageContext?.profile;
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const languagePrepositional = t(`languages.prepositional.${language}`);
  const placeholderText = t(`modals.addPhrase.placeholders.${language}`);
  const ariaTextField = t(`modals.addPhrase.aria.textField.${language}`);
  const instructionVoice = t('modals.addPhrase.body.instructions.voice', { language: languagePrepositional });
  const instructionText = t('modals.addPhrase.body.instructions.text', { language: languagePrepositional });
  const listeningText = t('modals.addPhrase.status.listening');

  const handleSubmit = useCallback(
    async (textToSubmit: string) => {
      const trimmedText = textToSubmit.trim();
      if (!trimmedText || isLoading || !profile) return;

      setIsLoading(true);
      setError(null);

      try {
        let newPhraseData: { learning: string; native: string };
        // Check if the input language is the native language
        if (language === profile.native) {
          newPhraseData = await onGenerate(trimmedText);
        } else {
          const { native } = await onTranslateLearning(trimmedText);
          newPhraseData = { learning: trimmedText, native };
        }
        await onPhraseCreated(newPhraseData);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('modals.addPhrase.errors.generic'));
        setIsLoading(false);
      }
      // Parent component closes the modal, which resets `isLoading` on success.
    },
    [isLoading, onGenerate, onPhraseCreated, language, onTranslateLearning, t, profile],
  );

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = getSpeechLocale(language);
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);

      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      console.error('Speech recognition error:', event.error, event.message);

      if (event.error === 'network') {
        setError(t('modals.addPhrase.errors.network'));
        setMode('text');
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError(t('modals.addPhrase.errors.permission'));
        setMode('text');
      } else {
        setError(t('modals.addPhrase.errors.recognition'));
      }
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('');

      setInputText(transcript);

      if (autoSubmit && event.results[event.results.length - 1].isFinal && transcript.trim()) {
        handleSubmit(transcript.trim());
      }
    };

    recognitionRef.current = recognition;
  }, [handleSubmit, language, autoSubmit, t]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsLoading(false);
      setInputText('');
      setMode('voice');
    } else {
      recognitionRef.current?.abort();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'voice') {
      recognitionRef.current?.start();
      inputRef.current?.blur();
    } else {
      recognitionRef.current?.stop();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  const handleToggleMode = () => {
    setMode((prev) => (prev === 'voice' ? 'text' : 'voice'));
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && inputText.trim()) {
      event.preventDefault();
      handleSubmit(inputText);
    }
  };

  if (!isOpen) return null;

  const hasText = Boolean(inputText.trim());

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[80] flex justify-center items-center backdrop-blur-sm p-4"
      onClick={isLoading ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-lg min-h-[30rem] bg-slate-800/80 rounded-lg shadow-2xl flex flex-col items-center justify-between p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full w-full">
            <PhraseCardSkeleton />
            <p className="mt-6 text-slate-400 text-lg">{t('modals.addPhrase.loading')}</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-100">{t('modals.addPhrase.title')}</h2>
              <p className="text-slate-400 mt-1">
                {mode === 'voice' ? instructionVoice : instructionText}
              </p>
            </div>

            <div className="flex-grow flex items-center justify-center w-full">
              {mode === 'voice' ? (
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => recognitionRef.current?.start()}
                      aria-label={t('modals.addPhrase.aria.microphone')}
                      className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-purple-500/50 ${isListening ? 'listening-glow' : 'bg-slate-700/50 hover:bg-slate-700'
                        }`}
                    >
                      <MicrophoneIcon className="w-12 h-12 text-white" />
                    </button>
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full shadow-lg">
                      {getLanguageLabel(language)}
                    </span>
                  </div>
                  <p className="mt-6 text-slate-200 text-lg h-8">{inputText || (isListening ? listeningText : ' ')}</p>
                </div>
              ) : (
                <div className="relative w-full max-w-md">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder={placeholderText}
                    className="w-full bg-slate-700 text-white text-lg rounded-full placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 py-3 pl-5 pr-14 transition-colors"
                    aria-label={ariaTextField}
                  />
                  <button
                    type="button"
                    onClick={() => handleSubmit(inputText)}
                    disabled={!hasText}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed"
                    aria-label={t('modals.addPhrase.actions.create')}
                  >
                    <SendIcon className="w-5 h-5 text-white" />
                  </button>
                </div>
              )}
            </div>

            {error && !isLoading && (
              <div className="text-center bg-red-900/50 text-red-300 p-3 rounded-md text-sm w-full">
                <strong>{t('modals.addPhrase.errorLabel')}:</strong> {error}
              </div>
            )}

            <div className="w-full flex justify-center items-center space-x-4 mt-auto pt-4">
              <button
                onClick={handleToggleMode}
                className="p-3 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors"
                aria-label={mode === 'voice' ? t('modals.addPhrase.aria.toggleToText') : t('modals.addPhrase.aria.toggleToVoice')}
              >
                {mode === 'voice' ? (
                  <KeyboardIcon className="w-6 h-6 text-slate-200" />
                ) : (
                  <MicrophoneIcon className="w-6 h-6 text-slate-200" />
                )}
              </button>

              {mode === 'voice' && !autoSubmit && (
                <button
                  type="button"
                  onClick={() => handleSubmit(inputText)}
                  disabled={!hasText}
                  className="p-4 bg-purple-600 rounded-full hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                  aria-label={t('modals.addPhrase.aria.send')}
                >
                  <SendIcon className="w-6 h-6 text-white" />
                </button>
              )}

              <button
                onClick={onClose}
                className="p-3 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors"
                disabled={isLoading}
                aria-label={t('modals.addPhrase.aria.close')}
              >
                <CloseIcon className="w-6 h-6 text-slate-200" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddPhraseModal;
