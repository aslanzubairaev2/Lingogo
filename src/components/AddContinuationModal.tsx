import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useLanguage } from '../contexts/languageContext';
import { useTranslation } from '../hooks/useTranslation.ts';
import { getNativeSpeechLocale } from '../services/speechService';
import CloseIcon from './icons/CloseIcon';
import KeyboardIcon from './icons/KeyboardIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import SendIcon from './icons/SendIcon';

interface AddContinuationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

const AddContinuationModal: React.FC<AddContinuationModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const { profile } = useLanguage();
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognition();
    recognition.lang = getNativeSpeechLocale(profile);
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

      if (event.error === 'network' || event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMode('text');
      }
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('');

      setInputText(transcript);

      if (event.results[event.results.length - 1].isFinal && mode === 'voice' && transcript.trim()) {
        onSubmit(transcript.trim());
      }
    };

    recognitionRef.current = recognition;
  }, [mode, onSubmit]);

  useEffect(() => {
    if (!isOpen) {
      recognitionRef.current?.abort();
      return;
    }

    if (mode === 'voice') {
      recognitionRef.current?.start();
      inputRef.current?.blur();
    } else {
      recognitionRef.current?.stop();
      inputRef.current?.focus();
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (isOpen) {
      setMode('voice');
      setInputText('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(() => {
    if (inputText.trim()) {
      onSubmit(inputText.trim());
    }
  }, [inputText, onSubmit]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && inputText.trim()) {
      event.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  const hasText = inputText.trim().length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[60] flex justify-center items-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm m-4 p-6 flex flex-col items-center justify-between h-80 relative"
        onClick={(event) => event.stopPropagation()}
      >
        {mode === 'voice' ? (
          <div className="flex-grow flex items-center justify-center">
            <button
              type="button"
              onClick={() => recognitionRef.current?.start()}
              aria-label={t('modals.addContinuation.aria.microphone')}
              className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-purple-500/50 ${isListening ? 'listening-glow' : 'bg-transparent hover:bg-slate-700/50'}`}
            >
              <MicrophoneIcon className="w-12 h-12 text-white" />
            </button>
          </div>
        ) : (
          <div className="w-full flex-grow flex flex-col items-center justify-center gap-y-8">
            <div className="relative w-full flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={t('modals.addContinuation.placeholders.text')}
                className="w-full bg-slate-700 text-white text-lg rounded-full placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 p-3 pr-14 transition-colors"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!hasText}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed"
                aria-label={t('modals.addContinuation.aria.send')}
              >
                <SendIcon className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mt-6">
          {mode === 'voice' ? (
            <button
              onClick={() => setMode('text')}
              className="p-3 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors"
              aria-label={t('modals.addContinuation.aria.switchToText')}
            >
              <KeyboardIcon className="w-6 h-6 text-slate-200" />
            </button>
          ) : (
            <button
              onClick={() => setMode('voice')}
              className="p-3 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors"
              aria-label={t('modals.addContinuation.aria.switchToVoice')}
            >
              <MicrophoneIcon className="w-6 h-6 text-slate-200" />
            </button>
          )}
          <button
            onClick={() => {
              recognitionRef.current?.abort();
              onClose();
            }}
            className="p-3 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors"
            aria-label={t('modals.addPhrase.aria.close')}
          >
            <CloseIcon className="w-6 h-6 text-slate-200" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddContinuationModal;
