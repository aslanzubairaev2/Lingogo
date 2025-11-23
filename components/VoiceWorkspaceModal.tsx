import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Phrase, PhraseEvaluation, PhraseBuilderOptions } from '../types';
import CloseIcon from './icons/CloseIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import CheckIcon from './icons/CheckIcon';
import XCircleIcon from './icons/XCircleIcon';
import AudioPlayer from './AudioPlayer';
import BackspaceIcon from './icons/BackspaceIcon';
import ArrowRightIcon from './icons/ArrowRightIcon';
import * as cacheService from '../services/cacheService';
import BookOpenIcon from './icons/BookOpenIcon';
import FeedbackMessage from './FeedbackMessage';
import { useTranslation } from '../src/hooks/useTranslation';
import { useLanguage } from '../src/contexts/languageContext';
import { getLearningSpeechLocale } from '../services/speechService';

interface VoiceWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  phrase: Phrase | null;
  onEvaluate: (phrase: Phrase, attempt: string) => Promise<PhraseEvaluation>;
  onSuccess: (phrase: Phrase) => void;
  onFailure: (phrase: Phrase) => void;
  onNextPhrase: () => void;
  onPracticeNext: () => void;
  onGeneratePhraseBuilderOptions: (phrase: Phrase) => Promise<PhraseBuilderOptions>;
  settings: {
    automation: {
      autoCheckShortPhrases: boolean;
      learnNextPhraseHabit: boolean;
    }
  };
  buttonUsage: { close: number; continue: number; next: number };
  onLogButtonUsage: (button: 'close' | 'continue' | 'next') => void;
  habitTracker: { quickNextCount: number, quickBuilderNextCount?: number };
  onHabitTrackerChange: (updater: React.SetStateAction<{ quickNextCount: number, quickBuilderNextCount?: number }>) => void;
  showToast: (config: { message: string; type?: 'default' | 'automationSuccess' }) => void;
  onOpenLearningAssistant: (phrase: Phrase) => void;
}

interface Word {
  text: string;
  id: string; // unique identifier
}

interface AvailableWord extends Word {
  originalIndex: number;
}

type DraggedItem = {
  word: Word;
  from: 'constructed' | 'available';
  index: number;
}

const WordBankSkeleton = () => (
  <div className="flex flex-wrap justify-center gap-2 w-full animate-pulse">
    {['w-20', 'w-28', 'w-24', 'w-16', 'w-32', 'w-20', 'w-24', 'w-28', 'w-16', 'w-24'].map((width, index) => (
      <div key={index} className={`h-11 bg-slate-700 rounded-lg ${width}`}></div>
    ))}
  </div>
);

const normalizeString = (str: string) => str.toLowerCase().replace(/[.,!?]/g, '').trim();

// FIX: Changed to a named export to resolve "no default export" error.
export const VoiceWorkspaceModal: React.FC<VoiceWorkspaceModalProps> = ({
  isOpen, onClose, phrase, onEvaluate, onSuccess, onFailure, onNextPhrase, onGeneratePhraseBuilderOptions, onPracticeNext,
  settings, buttonUsage, onLogButtonUsage, habitTracker, onHabitTrackerChange, showToast, onOpenLearningAssistant
}) => {
  const [allWordOptions, setAllWordOptions] = useState<AvailableWord[]>([]);
  const [constructedWords, setConstructedWords] = useState<Word[]>([]);
  const [evaluation, setEvaluation] = useState<PhraseEvaluation | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [transientFeedback, setTransientFeedback] = useState<{ message: string; key: number } | null>(null);
  const [isFeedbackFading, setIsFeedbackFading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const { t } = useTranslation();
  const { profile } = useLanguage();

  // Drag & Drop State
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number, y: number } | null>(null);

  // Automation State
  const [successTimestamp, setSuccessTimestamp] = useState<number | null>(null);
  const [hasUserPausedInSession, setHasUserPausedInSession] = useState(false);
  const thinkTimerRef = useRef<number | null>(null);
  const interactionRef = useRef<HTMLDivElement>(null);

  // Help State
  const [isStuck, setIsStuck] = useState(false);
  const [hintWordId, setHintWordId] = useState<string | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [showPostHintButtons, setShowPostHintButtons] = useState(false);
  const inactivityTimerRef = useRef<number | null>(null);

  const recognitionRef = useRef<any>(null);
  const constructedPhraseRef = useRef<HTMLDivElement>(null);

  const constructedWordIds = useMemo(() => new Set(constructedWords.map(w => w.id)), [constructedWords]);
  const availableWords = useMemo(() => allWordOptions.filter(w => !constructedWordIds.has(w.id)), [allWordOptions, constructedWordIds]);

  const resetState = useCallback(() => {
    setConstructedWords([]);
    setAllWordOptions([]);
    setEvaluation(null);
    setIsChecking(false);
    setIsListening(false);
    setIsLoadingOptions(false);
    setDraggedItem(null);
    setDropIndex(null);
    setGhostPosition(null);
    setAttemptNumber(1);
    setTransientFeedback(null);
    setIsFeedbackFading(false);
    setOptionsError(null);
    setSpeechError(null);
    setSuccessTimestamp(null);
    setHasUserPausedInSession(false);
    if (thinkTimerRef.current) clearTimeout(thinkTimerRef.current);
    // Help state reset
    setIsStuck(false);
    setHintWordId(null);
    setHintCount(0);
    setShowPostHintButtons(false);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
  }, []);

  const loadWordOptions = useCallback(async () => {
    if (!phrase) return;
    setIsLoadingOptions(true);
    setOptionsError(null);

    const cacheKey = `phrase_builder_${phrase.id}`;
    const cachedOptions = cacheService.getCache<PhraseBuilderOptions>(cacheKey);

    if (cachedOptions) {
      setAllWordOptions(cachedOptions.words.map((w, i) => ({ text: w, id: `avail-${i}`, originalIndex: i })));
      setIsLoadingOptions(false);
      return;
    }

    try {
      const options = await onGeneratePhraseBuilderOptions(phrase);
      cacheService.setCache(cacheKey, options);
      setAllWordOptions(options.words.map((w, i) => ({ text: w, id: `avail-${i}`, originalIndex: i })));
    } catch (err) {
      let displayError = t('modals.voiceWorkspace.errors.unexpected');
      console.error("Failed to load phrase builder options:", err);
      if (err instanceof Error) {
        if (err.message.includes("500") || err.message.includes("Internal Server Error")) {
          displayError = t('modals.voiceWorkspace.errors.serviceUnavailable');
        } else if (err.message.includes("API key")) {
          displayError = t('modals.voiceWorkspace.errors.apiKey');
        } else {
          displayError = t('modals.voiceWorkspace.errors.requestFailed');
        }
      }
      setOptionsError(`${t('modals.voiceWorkspace.errors.loadWords')} ${displayError}`);
    } finally {
      setIsLoadingOptions(false);
    }
  }, [phrase, onGeneratePhraseBuilderOptions]);


  // Effect to handle modal opening and closing.
  useEffect(() => {
    if (isOpen && phrase) {
      resetState();
      loadWordOptions();
    }

    return () => {
      recognitionRef.current?.abort();
    };
  }, [isOpen, phrase, resetState, loadWordOptions]);

  // Effect for transient feedback visibility
  useEffect(() => {
    if (transientFeedback) {
      const timer = setTimeout(() => {
        setIsFeedbackFading(true);
        const fadeOutTimer = setTimeout(() => {
          setTransientFeedback(null);
        }, 500); // match animation duration
        return () => clearTimeout(fadeOutTimer);
      }, 3000); // 3 seconds visible
      return () => clearTimeout(timer);
    }
  }, [transientFeedback]);

  // Effect for detecting "thinking"
  useEffect(() => {
    if (isOpen && phrase && !evaluation && !hasUserPausedInSession) {
      const resetThinkTimer = () => {
        if (thinkTimerRef.current) clearTimeout(thinkTimerRef.current);
        thinkTimerRef.current = window.setTimeout(() => {
          setHasUserPausedInSession(true);
        }, 5000); // 5 seconds
      };

      resetThinkTimer();
      const interactionNode = interactionRef.current;
      interactionNode?.addEventListener('mousemove', resetThinkTimer);
      interactionNode?.addEventListener('touchstart', resetThinkTimer);

      return () => {
        if (thinkTimerRef.current) clearTimeout(thinkTimerRef.current);
        interactionNode?.removeEventListener('mousemove', resetThinkTimer);
        interactionNode?.removeEventListener('touchstart', resetThinkTimer);
      };
    }
  }, [isOpen, phrase, evaluation, constructedWords, hasUserPausedInSession]);

  // Effect for inactivity and hinting
  useEffect(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    if (!isOpen || !phrase || isChecking || evaluation || isListening || isLoadingOptions) {
      return;
    }

    const handleTimeout = () => {
      const constructedPhrase = constructedWords.map(w => w.text).join(' ');
      if (constructedWords.length === 0) {
        setIsStuck(true);
      } else {
        const correctPrefix = phrase.text.learning.startsWith(constructedPhrase + ' ');
        if (correctPrefix && constructedWords.length >= 2) {
          if (hintCount < 2) {
            const nextWordIndex = constructedWords.length;
            const learningWords = phrase.text.learning.split(' ');
            if (nextWordIndex < learningWords.length) {
              const nextCorrectWord = learningWords[nextWordIndex];
              const hintedWord = availableWords.find(aw => normalizeString(aw.text) === normalizeString(nextCorrectWord));
              if (hintedWord) {
                setHintWordId(hintedWord.id);
                setHintCount(prev => prev + 1);
                setTimeout(() => setHintWordId(null), 6000); // Reset after 3*2s animation
              }
            }
          } else {
            setShowPostHintButtons(true);
          }
        }
      }
    };

    const delay = (constructedWords.length === 0) ? 5000 : 5000;
    inactivityTimerRef.current = window.setTimeout(handleTimeout, delay);

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [isOpen, phrase, isChecking, evaluation, isListening, isLoadingOptions, constructedWords, hintCount, availableWords]);

  const handleCheck = useCallback(async () => {
    if (!phrase) return;
    const userAttempt = constructedWords.map(w => w.text).join(' ');
    if (!userAttempt) return;

    setSuccessTimestamp(null);
    if (thinkTimerRef.current) clearTimeout(thinkTimerRef.current);

    const isCorrectLocally = normalizeString(userAttempt) === normalizeString(phrase.text.learning);
    const habitLearned = (habitTracker.quickBuilderNextCount || 0) >= 5;
    const shouldAutoAdvance = isCorrectLocally && settings.automation.learnNextPhraseHabit && habitLearned && !hasUserPausedInSession;

    if (shouldAutoAdvance) {
      onSuccess(phrase);
      setSuccessTimestamp(Date.now());
      onPracticeNext();
      showToast({ message: t('modals.voiceWorkspace.automation.nextPhrase'), type: 'automationSuccess' });
      return;
    }

    if (isCorrectLocally) {
      setEvaluation({ isCorrect: true, feedback: t('modals.voiceWorkspace.feedback.correct') });
      onSuccess(phrase);
      setSuccessTimestamp(Date.now());
      return;
    }

    if (attemptNumber === 1) {
      setAttemptNumber(2);
      setTransientFeedback({ message: t('modals.voiceWorkspace.feedback.incorrect'), key: Date.now() });
      setIsFeedbackFading(false);
      recognitionRef.current?.stop();
    } else {
      setIsChecking(true);
      setEvaluation(null);
      try {
        const result = await onEvaluate(phrase, userAttempt);
        setEvaluation(result);
        if (result.isCorrect) {
          onSuccess(phrase);
          setSuccessTimestamp(Date.now());
        } else {
          onFailure(phrase);
        }
      } catch (err) {
        setEvaluation({ isCorrect: false, feedback: err instanceof Error ? err.message : t('modals.voiceWorkspace.errors.check') });
        onFailure(phrase);
      } finally {
        setIsChecking(false);
      }
    }
  }, [phrase, constructedWords, onSuccess, onFailure, onEvaluate, attemptNumber, habitTracker.quickBuilderNextCount, settings.automation.learnNextPhraseHabit, hasUserPausedInSession, onPracticeNext, showToast]);

  // Effect for intelligent auto-checking
  useEffect(() => {
    if (!settings.automation.autoCheckShortPhrases) return;

    const autoCheck = () => {
      if (!isOpen || !phrase || isLoadingOptions || isChecking || evaluation || isListening) {
        return;
      }

      const userAttempt = constructedWords.map(w => w.text).join(' ');
      if (!userAttempt) {
        return;
      }

      const wordCount = phrase.text.learning.split(' ').length;
      if (wordCount > 3) {
        return;
      }

      if (normalizeString(userAttempt) === normalizeString(phrase.text.learning)) {
        const timer = setTimeout(() => {
          if (isOpen && !isChecking && !evaluation) {
            handleCheck();
          }
        }, 400);

        return () => clearTimeout(timer);
      }
    };

    const cleanup = autoCheck();
    return cleanup;
  }, [constructedWords, phrase, isOpen, isLoadingOptions, isChecking, evaluation, isListening, handleCheck, settings.automation.autoCheckShortPhrases]);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = getLearningSpeechLocale(profile);
      recognition.continuous = false; // Changed to false for better reliability
      recognition.interimResults = true;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error !== 'aborted' && e.error !== 'no-speech') {
          console.error('Speech error:', e.error);
          let userFriendlyError = t('modals.voiceWorkspace.errors.speech');
          if (e.error === 'network') {
            userFriendlyError = t('modals.voiceWorkspace.errors.speechNetwork');
          } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            userFriendlyError = t('modals.voiceWorkspace.errors.microphoneDenied');
          }
          setSpeechError(userFriendlyError);
        }
        setIsListening(false);
      };

      recognition.onresult = (event) => {
        // With continuous=false, we only process the final result of an utterance.
        const result = event.results[event.results.length - 1];
        if (result.isFinal) {
          const finalTranscript = result[0].transcript;
          if (finalTranscript.trim()) {
            const newWords = finalTranscript.trim().split(' ').map((text, index) => ({ text, id: `spoken-${Date.now()}-${index}` }));
            setConstructedWords(prev => [...prev, ...newWords]);
          }
        }
      };
      recognitionRef.current = recognition;
    }
    return () => recognitionRef.current?.abort();
  }, []);

  const handleUserInteraction = (callback: () => void) => {
    setIsStuck(false);
    setShowPostHintButtons(false);
    setHintWordId(null);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    callback();
  };

  const handleMicClick = () => handleUserInteraction(() => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setSpeechError(null);
      recognitionRef.current?.start();
    }
  });

  const handleDeselectWord = (word: Word) => handleUserInteraction(() => {
    setConstructedWords(prev => prev.filter(w => w.id !== word.id));
  });

  const handleReset = () => handleUserInteraction(() => {
    setConstructedWords([]);
  });

  const handleSelectWord = (word: AvailableWord) => handleUserInteraction(() => {
    if (!!evaluation) return;
    setConstructedWords(prev => [...prev, word]);
  });

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, word: Word, from: 'available' | 'constructed', index: number) => {
    setDraggedItem({ word, from, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', word.id);
    const emptyImage = new Image();
    e.dataTransfer.setDragImage(emptyImage, 0, 0);
    setGhostPosition({ x: e.clientX, y: e.clientY });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItem) return;
    if (ghostPosition) setGhostPosition({ x: e.clientX, y: e.clientY });
    const dropZone = constructedPhraseRef.current;
    if (!dropZone) return;
    const children = Array.from(dropZone.children).filter(child => (child as Element).hasAttribute('data-word-id')) as HTMLElement[];
    let newIndex = children.length;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const rect = child.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) {
        newIndex = i;
        break;
      }
    }
    setDropIndex(newIndex);
  };

  const handleDrop = () => handleUserInteraction(() => {
    if (!draggedItem || dropIndex === null) return;
    const { word, from, index } = draggedItem;
    let newConstructed = [...constructedWords];
    if (from === 'constructed') newConstructed.splice(index, 1);
    newConstructed.splice(dropIndex, 0, word);
    setConstructedWords(newConstructed);
    setDraggedItem(null); setDropIndex(null); setGhostPosition(null);
  });

  const handleDragEnd = () => {
    setDraggedItem(null); setDropIndex(null); setGhostPosition(null);
  };

  const handleActionButtonClick = useCallback((key: 'close' | 'continue' | 'next', action: () => void) => {
    onLogButtonUsage(key);
    if (successTimestamp) {
      const timeSinceSuccess = Date.now() - successTimestamp;
      if (timeSinceSuccess < 2000) { // 2 seconds threshold
        onHabitTrackerChange(prev => ({ ...prev, quickBuilderNextCount: (prev.quickBuilderNextCount || 0) + 1 }));
      } else {
        onHabitTrackerChange(prev => ({ ...prev, quickBuilderNextCount: 0 }));
      }
    }
    action();
  }, [onLogButtonUsage, successTimestamp, onHabitTrackerChange]);

  const buttons = useMemo(() => {
    const buttonData = [
      {
        key: 'close' as const,
        action: () => handleActionButtonClick('close', onClose),
        icon: <CloseIcon className="w-6 h-6" />,
        className: 'bg-slate-600 hover:bg-slate-700',
        label: t('modals.voiceWorkspace.actions.close'),
      },
      {
        key: 'continue' as const,
        action: () => handleActionButtonClick('continue', onNextPhrase),
        icon: <CheckIcon className="w-6 h-6" />,
        className: 'bg-green-600 hover:bg-green-700',
        label: t('modals.voiceWorkspace.actions.continue'),
      },
      {
        key: 'next' as const,
        action: () => handleActionButtonClick('next', onPracticeNext),
        icon: <ArrowRightIcon className="w-6 h-6" />,
        className: 'bg-purple-600 hover:bg-purple-700',
        label: t('modals.voiceWorkspace.actions.nextPhrase'),
      },
    ];
    // Dynamic button layout has been removed for a consistent UI.
    return buttonData;
  }, [handleActionButtonClick, onClose, onNextPhrase, onPracticeNext, t]);

  const handleFailureAndReveal = useCallback(() => {
    if (!phrase) return;
    onFailure(phrase);
    setEvaluation({
      isCorrect: false,
      feedback: t('modals.voiceWorkspace.feedback.revealAnswer'),
      correctedPhrase: phrase.text.learning,
    });
    setIsStuck(false);
    setShowPostHintButtons(false);
  }, [phrase, onFailure, t]);

  const handleLearn = useCallback(() => {
    if (!phrase) return;
    onOpenLearningAssistant(phrase);
  }, [phrase, onOpenLearningAssistant]);

  if (!isOpen || !phrase) return null;

  const userAttempt = constructedWords.map(w => w.text).join(' ');

  return (
    <>
      {draggedItem && ghostPosition && (
        <div className="drag-ghost" style={{ left: ghostPosition.x, top: ghostPosition.y, transform: 'translate(-50%, -50%) rotate(-5deg) scale(1.1)' }}>
          {draggedItem.word.text}
        </div>
      )}
      <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end" onClick={onClose}>
        <div
          className={`bg-slate-800 w-full max-w-3xl h-[90%] max-h-[90vh] rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-700">
            <h2 className="text-xl font-bold text-purple-300 text-center flex-grow">{phrase.text.native}</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700">
              <CloseIcon className="w-6 h-6 text-slate-400" />
            </button>
          </header>

          <div ref={interactionRef} className="flex-grow flex flex-col p-4 overflow-hidden relative">
            <div className="flex-shrink-0 flex items-center gap-x-2">
              <AudioPlayer textToSpeak={userAttempt} />
              <div
                ref={constructedPhraseRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={() => setDropIndex(null)}
                className="flex-grow bg-slate-700/50 p-4 rounded-lg min-h-[80px] flex flex-wrap items-center justify-start gap-2 border-2 border-dashed border-slate-600"
              >
                {constructedWords.length === 0 && dropIndex === null && <p className="text-slate-500 w-full text-center">{t('modals.voiceWorkspace.instructions')}</p>}

                {constructedWords.map((word, index) => (
                  <React.Fragment key={word.id}>
                    {dropIndex === index && <div className="drop-indicator"></div>}
                    <button
                      data-word-id={word.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, word, 'constructed', index)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleDeselectWord(word)}
                      disabled={!!evaluation}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-grab active:cursor-grabbing"
                    >
                      {word.text}
                    </button>
                  </React.Fragment>
                ))}
                {dropIndex === constructedWords.length && <div className="drop-indicator"></div>}
              </div>
              <button
                onClick={handleReset}
                disabled={isChecking || !!evaluation || constructedWords.length === 0}
                className="p-3 self-center rounded-full bg-slate-600/50 hover:bg-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={t('modals.voiceWorkspace.actions.clear')}
              >
                <BackspaceIcon className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-grow my-4 flex flex-col justify-end min-h-0 relative">
              {transientFeedback && (
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 z-10 transition-all duration-500 ${isFeedbackFading ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'}`}>
                  <FeedbackMessage type="warning" message={transientFeedback.message} />
                </div>
              )}
              {speechError && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <FeedbackMessage type="error" message={speechError} />
                </div>
              )}
              {optionsError ? (
                <div className="flex-grow flex items-center justify-center">
                  <FeedbackMessage type="error" message={optionsError} />
                </div>
              ) : isLoadingOptions ? (
                <div className="flex-grow flex flex-col justify-center items-center">
                  <WordBankSkeleton />
                  <p className="mt-4 text-slate-400">{t('modals.voiceWorkspace.loading')}</p>
                </div>
              ) : (
                <div className="w-full bg-slate-900/50 flex flex-wrap items-start content-start justify-center gap-2 p-4 rounded-lg overflow-y-auto hide-scrollbar">
                  {availableWords.map((word, index) => (
                    <button
                      key={word.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, word, 'available', index)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleSelectWord(word)}
                      disabled={!!evaluation}
                      className={`px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg transition-all text-lg font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-grab active:cursor-grabbing ${hintWordId === word.id ? 'hint-glow' : ''}`}
                    >
                      {word.text}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <footer className="flex-shrink-0 pt-4 border-t border-slate-700/50 min-h-[80px] flex justify-center items-center">
              {!evaluation && (
                <div className="flex flex-col items-center justify-center w-full gap-y-4">
                  <div className="flex items-center gap-x-4">
                    <button
                      onClick={handleCheck}
                      disabled={constructedWords.length === 0 || isChecking}
                      className="relative px-8 py-3 rounded-lg bg-green-600 hover:bg-green-700 transition-colors font-semibold text-white shadow-md disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px] h-[48px]"
                    >
                      <span className={`flex items-center transition-opacity ${isChecking ? 'opacity-0' : 'opacity-100'}`}>
                        <CheckIcon className="w-5 h-5 mr-2" />
                        <span>{t('modals.voiceWorkspace.actions.check')}</span>
                      </span>
                      {isChecking && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin"></div></div>}
                    </button>
                    <button
                      onClick={handleMicClick}
                      disabled={isChecking}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-600 hover:bg-slate-500'}`}
                    >
                      <MicrophoneIcon className="w-6 h-6 text-white" />
                    </button>
                  </div>

                  {(isStuck || showPostHintButtons) && (
                    <div className="flex items-center gap-x-2 animate-fade-in">
                      <button onClick={handleLearn} className="flex items-center gap-x-2 px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors text-sm text-purple-300 font-medium"><BookOpenIcon className="w-4 h-4" /> {t('modals.voiceWorkspace.actions.learnWithAI')}</button>
                      <button onClick={handleFailureAndReveal} className="px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors text-sm text-slate-300 font-medium">{t('modals.voiceWorkspace.actions.showAnswer')}</button>
                    </div>
                  )}
                </div>
              )}
              {evaluation && (
                <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
                  <div className={`flex-grow w-full sm:w-auto p-3 rounded-lg ${evaluation.isCorrect ? 'bg-green-500/20' : 'bg-red-500/20'} flex items-start space-x-3`}>
                    <div className="flex-shrink-0 mt-0.5">
                      {evaluation.isCorrect ? <CheckIcon className="w-5 h-5 text-green-400" /> : <XCircleIcon className="w-5 h-5 text-red-400" />}
                    </div>
                    <div>
                      <p className="text-slate-200 text-sm">{evaluation.feedback}</p>
                      {evaluation.correctedPhrase && (
                        <div className="mt-2 flex items-center gap-x-2 text-sm bg-slate-800/50 p-1.5 rounded-md">
                          <AudioPlayer textToSpeak={evaluation.correctedPhrase} />
                          <p className="text-slate-300"><strong className="font-semibold text-slate-100">{evaluation.correctedPhrase}</strong></p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-3">
                    {buttons.map(btn => (
                      <button
                        key={btn.key}
                        onClick={btn.action}
                        className={`p-3 rounded-full transition-colors text-white ${btn.className}`}
                        aria-label={btn.label}
                      >
                        {btn.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </footer>
          </div>
        </div>
      </div>
    </>
  );
};