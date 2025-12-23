/**
 * Practice Chat Modal - Redesigned (v2)
 *
 * Natural conversation practice with AI tutor using user's learned phrases.
 * Features:
 * - Full-screen modal with slide-up animation
 * - Natural dialogue flow (AI doesn't parrot user)
 * - Explanations/corrections in native language
 * - Selective TTS (only dialogue, not corrections)
 * - Voice input support
 * - Matches app design style
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Phrase, PracticeChatMessage, PracticeChatSessionStats, PracticeChatSessionRecord, SpeechRecognition, SpeechRecognitionErrorEvent, WordAnalysis } from '../types';
import { sendPracticeChatMessage, createInitialGreeting } from '../services/practiceChatService';
import { useLanguage } from '../src/contexts/languageContext';
import { useTranslation } from '../src/hooks/useTranslation';
import { getSpeechLocale } from '../src/i18n/languageMeta';
import { getLearningSpeechLocale } from '../services/speechService';
import CloseIcon from './icons/CloseIcon';
import SendIcon from './icons/SendIcon';
import SoundIcon from './icons/SoundIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import MessageQuestionIcon from './icons/MessageQuestionIcon';
import ChatContextMenu from './ChatContextMenu';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  allPhrases: Phrase[];
  settings?: {
    autoSpeak?: boolean;
  };
  onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
  onAnalyzeWord: (phrase: Phrase, word: string) => Promise<WordAnalysis | null>;
  onCreateCard: (phraseData: { learning: string; native: string }) => void;
  onOpenVerbConjugation: (infinitive: string) => void;
  onOpenNounDeclension: (noun: string, article: string) => void;
  onOpenAdjectiveDeclension: (adjective: string) => void;
  onTranslateLearningToNative: (learningPhrase: string) => Promise<{ native: string }>;
  onSessionComplete?: (session: PracticeChatSessionRecord) => void;
}

/**
 * Message Bubble Component
 */
const MessageBubble: React.FC<{
  message: PracticeChatMessage;
  onSpeak?: (text: string) => void;
  isUser: boolean;
  onOpenWordAnalysis?: (phrase: Phrase, word: string) => void;
  onOpenContextMenu?: (target: { sentence: { learning: string, native: string }, word: string }) => void;
  messageIndex?: number;
  revealedTranslations?: Set<number>;
  onRevealTranslation?: (messageIndex: number) => void;
}> = ({ message, onSpeak, isUser, onOpenWordAnalysis, onOpenContextMenu, messageIndex, revealedTranslations, onRevealTranslation }) => {
  const { t } = useTranslation();
  const wordLongPressTimer = useRef<number | null>(null);

  const handleWordClick = (contextText: string, word: string, nativeText: string) => {
    if (!onOpenWordAnalysis) return;
    const proxyPhrase: Phrase = {
      id: `proxy_practice_v2_${contextText.slice(0, 5)}`,
      text: { learning: contextText, native: nativeText },
      category: 'general' as const,
      masteryLevel: 0,
      lastReviewedAt: null,
      nextReviewAt: Date.now(),
      knowCount: 0,
      knowStreak: 0,
      isMastered: false,
      lapses: 0,
    };
    onOpenWordAnalysis(proxyPhrase, word);
  };

  const handleWordPointerDown = (e: React.PointerEvent<HTMLSpanElement>, sentence: { learning: string, native: string }, word: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    const cleanedWord = word.replace(/[.,!?()""":;]/g, '');
    if (!cleanedWord || !onOpenContextMenu) return;

    wordLongPressTimer.current = window.setTimeout(() => {
      onOpenContextMenu({ sentence, word: cleanedWord });
      wordLongPressTimer.current = null;
    }, 500);
  };

  const clearWordLongPress = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    if (wordLongPressTimer.current) {
      clearTimeout(wordLongPressTimer.current);
    }
  };

  const renderClickableLearning = (text: string, translation: string) => {
    if (!text || !onOpenWordAnalysis) return text;
    return text.split(' ').map((word, i, arr) => (
      <span
        key={i}
        onClick={(e) => {
          e.stopPropagation();
          const cleaned = word.replace(/[.,!?()""":;]/g, '');
          if (cleaned) handleWordClick(text, cleaned, translation);
        }}
        onPointerDown={(e) => handleWordPointerDown(e, { learning: text, native: translation }, word)}
        onPointerUp={clearWordLongPress}
        onPointerLeave={clearWordLongPress}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const cleaned = word.replace(/[.,!?()""":;]/g, '');
          if (cleaned && onOpenContextMenu) onOpenContextMenu({ sentence: { learning: text, native: translation }, word: cleaned });
        }}
        className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded-md transition-colors"
      >
        {word}{i < arr.length - 1 ? ' ' : ''}
      </span>
    ));
  };
  if (isUser) {
    // User message - simple bubble
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-lg bg-purple-600 text-white">
          <p className="text-base">{message.content.primary.text}</p>
        </div>
      </div>
    );
  }

  // AI message - with translation and optional explanation
  const isTranslationRevealed = messageIndex !== undefined && revealedTranslations?.has(messageIndex);

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] space-y-2">
        {/* Main dialogue in learning language */}
        <div className="px-2 py-2 rounded-2xl rounded-bl-lg bg-slate-700 text-slate-200 border border-slate-600">
          <div className="flex items-start justify-between gap-2">
            <p className="text-base flex-1 font-medium text-purple-300">
              {renderClickableLearning(message.content.primary.text, message.content.primary.translation || '')}
            </p>
            {onSpeak && (
              <button
                onClick={() => onSpeak(message.content.primary.text)}
                className="p-1.5 rounded-full hover:bg-white/10 flex-shrink-0 transition-colors"
                title={t('practice.chat.actions.speak', { defaultValue: 'Speak' })}
              >
                <SoundIcon className="w-4 h-4 text-slate-300" />
              </button>
            )}
          </div>

          {/* Translation in native language - BLURRED */}
          {message.content.primary.translation && (
            <p
              className={`text-sm text-slate-400 mt-1 italic cursor-pointer transition-all duration-200 ${isTranslationRevealed ? '' : 'blur-sm select-none hover:blur-[3px]'
                }`}
              onClick={(e) => {
                e.stopPropagation();
                if (messageIndex !== undefined) {
                  onRevealTranslation?.(messageIndex);
                }
              }}
              title={
                isTranslationRevealed
                  ? ''
                  : t('practice.chat.messages.revealTranslation', {
                    defaultValue: 'Click to reveal translation',
                  })
              }
            >
              {message.content.primary.translation}
            </p>
          )}
        </div>

        {/* Secondary explanation (corrections, hints) - in native language */}
        {message.content.secondary && (
          <div className="px-3 py-2 rounded-lg bg-slate-600/0 text-slate-300 text-sm border border-slate-700 border-none">
            <span className="opacity-60 italic">{t('practice.chat.messages.secondaryPrefix')} {message.content.secondary.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Quick Reply Suggestions Component
 */
const QuickReplies: React.FC<{
  suggestions: string[];
  onSelect: (text: string) => void;
}> = ({ suggestions, onSelect }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex space-x-2 overflow-x-auto pb-2 mb-0 hide-scrollbar">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          className="text-nowrap px-3 py-1 bg-slate-700/80 hover:bg-slate-600/80 text-slate-300 text-sm font-medium rounded-full transition-colors"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};

/**
 * Typing Indicator Component
 */
const TypingIndicator: React.FC = () => (
  <div className="flex justify-start mb-4">
    <div className="px-4 py-3 rounded-2xl rounded-bl-lg bg-slate-700 flex items-center gap-1">
      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-150"></div>
      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-300"></div>
    </div>
  </div>
);

const buildInitialStats = (): PracticeChatSessionStats => ({
  phrasesUsedIds: [],
  correctCount: 0,
  incorrectCount: 0,
  partialCount: 0,
  hintsUsed: 0,
  duration: 0,
  messagesExchanged: 0,
  sessionStartTime: Date.now(),
});

/**
 * Main Practice Chat Modal Component
 */
export const PracticeChatModal_v2: React.FC<Props> = ({
  isOpen,
  onClose,
  allPhrases,
  settings,
  onOpenWordAnalysis,
  onAnalyzeWord,
  onCreateCard,
  onOpenVerbConjugation,
  onOpenNounDeclension,
  onOpenAdjectiveDeclension,
  onTranslateLearningToNative,
  onSessionComplete
}) => {
  const { t } = useTranslation();
  const { profile } = useLanguage();
  const [messages, setMessages] = useState<PracticeChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [revealedTranslations, setRevealedTranslations] = useState<Set<number>>(new Set());
  const [contextMenuTarget, setContextMenuTarget] = useState<{ sentence: { learning: string, native: string }, word: string } | null>(null);

  // Session stats
  const [stats, setStats] = useState<PracticeChatSessionStats>(() => buildInitialStats());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const prevIsLoadingRef = useRef(isLoading);
  const statsRef = useRef(stats);
  const messagesRef = useRef<PracticeChatMessage[]>(messages);
  const sessionFinalizedRef = useRef(true);
  const prevIsOpenRef = useRef(isOpen);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Speech synthesis
  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const learningLang = profile.learning || 'de';
      utterance.lang = getSpeechLocale(learningLang);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, [profile.learning]);

  const handleRevealTranslation = useCallback((messageIndex: number) => {
    setRevealedTranslations(prev => {
      if (prev.has(messageIndex)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(messageIndex);
      setStats(prevStats => ({
        ...prevStats,
        hintsUsed: prevStats.hintsUsed + 1,
      }));
      return next;
    });
  }, []);

  const finalizeSession = useCallback(() => {
    if (sessionFinalizedRef.current) {
      return;
    }

    sessionFinalizedRef.current = true;

    const statsSnapshot = statsRef.current;
    const endTime = Date.now();
    const ensuredDuration = Math.max(statsSnapshot.duration, endTime - statsSnapshot.sessionStartTime);
    const hasConversation = messagesRef.current.length > 1;

    if (hasConversation) {
      const randomSource = typeof globalThis !== 'undefined' ? (globalThis as typeof globalThis & { crypto?: Crypto }).crypto : undefined;
      const sessionId =
        randomSource && typeof randomSource.randomUUID === 'function'
          ? randomSource.randomUUID()
          : `session_${statsSnapshot.sessionStartTime}_${endTime}`;

      onSessionComplete?.({
        ...statsSnapshot,
        duration: ensuredDuration,
        sessionEndTime: endTime,
        sessionId,
      });
    }

    const nextStats = buildInitialStats();
    statsRef.current = nextStats;
    setStats(nextStats);
    setMessages([]);
    setUserInput('');
    setRevealedTranslations(new Set<number>());
    setContextMenuTarget(null);
    setError(null);
    setIsLoading(false);
  }, [onSessionComplete]);

  // Initialize greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      sessionFinalizedRef.current = false;
      setStats(buildInitialStats());
      setRevealedTranslations(new Set<number>());
      setContextMenuTarget(null);
      const greeting = createInitialGreeting(profile, allPhrases);
      setMessages([greeting]);

      // Auto-speak greeting if enabled
      if (settings?.autoSpeak && greeting.content.primary.text) {
        // Only speak the dialogue part, not the explanation
        setTimeout(() => speakText(greeting.content.primary.text), 300);
      }
    }
  }, [isOpen, profile, allPhrases, settings?.autoSpeak, speakText]);

  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      finalizeSession();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, finalizeSession]);

  useEffect(() => {
    return () => {
      finalizeSession();
    };
  }, [finalizeSession]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = getSpeechLocale(profile.learning);
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          console.error('Speech recognition error:', event.error);
        }
        setIsListening(false);
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setUserInput(prev => (prev ? prev + ' ' : '') + transcript);
      };
      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.abort();
    };
  }, [profile.learning]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-focus textarea
  useEffect(() => {
    if (isOpen && !isLoading) {
      textareaRef.current?.focus();
    }
  }, [isOpen, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userInput]);

  // Auto-speak AI responses (only dialogue, not corrections/explanations)
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    const lastMessage = messages[messages.length - 1];

    if (wasLoading && !isLoading && lastMessage?.role === 'assistant' && settings?.autoSpeak) {
      // Only speak the primary dialogue text, not the secondary explanation
      if (lastMessage.content.primary.text) {
        speakText(lastMessage.content.primary.text);
      }
    }

    prevIsLoadingRef.current = isLoading;
  }, [messages, isLoading, settings?.autoSpeak, speakText]);

  // Cleanup on unmount
  useEffect(() => {
    if (!isOpen) {
      recognitionRef.current?.abort();
      window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  const normalizeAssistantTranslation = useCallback(async (message: PracticeChatMessage) => {
    const primaryContent = message.content?.primary;
    if (!primaryContent?.text) return message;

    try {
      const translationResult = await onTranslateLearningToNative(primaryContent.text);
      const normalized = translationResult?.native?.trim();

      if (normalized && normalized !== primaryContent.translation?.trim()) {
        return {
          ...message,
          content: {
            ...message.content,
            primary: {
              ...primaryContent,
              translation: normalized,
            },
          },
        };
      }
    } catch (error) {
      console.error('[PracticeChatModal] Failed to normalize translation:', error);
    }

    return message;
  }, [onTranslateLearningToNative]);

  // Handle sending message
  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    if (isListening) recognitionRef.current?.stop();

    const userMessage: PracticeChatMessage = {
      role: 'user',
      content: {
        primary: { text: text.trim() }
      },
      metadata: {
        timestamp: Date.now()
      }
    };

    // Capture current history and add user message
    let historySnapshot: PracticeChatMessage[] = [];
    setMessages(prev => {
      historySnapshot = prev; // Capture the current state
      return [...prev, userMessage];
    });

    setUserInput('');
    setIsLoading(true);
    setError(null);
    const userMessageTimestamp = Date.now();
    setStats(prev => ({
      ...prev,
      messagesExchanged: prev.messagesExchanged + 1,
      duration: Math.max(prev.duration, userMessageTimestamp - prev.sessionStartTime),
    }));

    try {
      // Pass history without the user message (it will be added by the service)
      const aiResponse = await sendPracticeChatMessage(
        historySnapshot,
        text.trim(),
        allPhrases,
        profile
      );

      const normalizedResponse = await normalizeAssistantTranslation(aiResponse);

      setMessages(prev => [...prev, normalizedResponse]);

      const now = Date.now();
      setStats(prev => {
        const phraseId = normalizedResponse.actions?.phraseUsed;
        const hasPhrase = phraseId ? prev.phrasesUsedIds.includes(phraseId) : false;
        const correctness = normalizedResponse.metadata?.correctness;

        return {
          ...prev,
          phrasesUsedIds: phraseId
            ? hasPhrase
              ? prev.phrasesUsedIds
              : [...prev.phrasesUsedIds, phraseId]
            : prev.phrasesUsedIds,
          correctCount: correctness === 'correct' ? prev.correctCount + 1 : prev.correctCount,
          incorrectCount: correctness === 'incorrect' ? prev.incorrectCount + 1 : prev.incorrectCount,
          partialCount: correctness === 'partial' ? prev.partialCount + 1 : prev.partialCount,
          messagesExchanged: prev.messagesExchanged + 1,
          duration: Math.max(prev.duration, now - prev.sessionStartTime),
        };
      });
    } catch (err) {
      const unknownError = t('practice.chat.messages.unknownError', { defaultValue: 'Unknown error' });
      const errorMsg = err instanceof Error ? err.message : unknownError;
      setError(errorMsg);
      console.error('[PracticeChatModal] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, allPhrases, profile, isListening, normalizeAssistantTranslation, t]);

  // Handle quick reply
  const handleQuickReply = useCallback((text: string) => {
    handleSendMessage(text);
  }, [handleSendMessage]);

  // Handle microphone
  const handleMicClick = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }, [isListening]);

  const handleModalClose = useCallback(() => {
    finalizeSession();
    onClose();
  }, [finalizeSession, onClose]);

  // Get last assistant message for quick replies
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end"
      onClick={handleModalClose}
    >
      <div
        className={`bg-slate-900 w-full max-w-2xl h-full rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between p-2 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <MessageQuestionIcon className="w-7 h-7 text-purple-400" />
            <div>
              <h3 className="text-lg font-bold text-slate-100">{t('practice.chat.title')}</h3>
              <p className="text-xs text-slate-400">
                {t('practice.chat.stats.phrasesUsed', {
                  count: stats.phrasesUsedIds.length,
                  defaultValue: '{{count}} phrases practiced',
                })}
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors"
          >
            <CloseIcon className="w-6 h-6 text-slate-400" />
          </button>
        </header>

        {/* Messages Area */}
        <div className="flex-grow p-4 overflow-y-auto hide-scrollbar">
          <div className="space-y-2">
            {messages.map((msg, index) => (
              <MessageBubble
                key={index}
                message={msg}
                isUser={msg.role === 'user'}
                onSpeak={msg.role === 'assistant' ? speakText : undefined}
                onOpenWordAnalysis={onOpenWordAnalysis}
                onOpenContextMenu={setContextMenuTarget}
                messageIndex={index}
                revealedTranslations={revealedTranslations}
                onRevealTranslation={handleRevealTranslation}
              />
            ))}

            {isLoading && <TypingIndicator />}

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-200">
                {t('practice.chat.messages.errorPrefix', {
                  message: error,
                  defaultValue: `Error: ${error}`,
                })}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-2 border-t border-slate-700 flex-shrink-0 bg-slate-800/80 backdrop-blur-sm">
          {/* Quick Replies */}
          {lastAssistantMessage?.actions?.suggestions && !isLoading && (
            <QuickReplies
              suggestions={lastAssistantMessage.actions.suggestions}
              onSelect={handleQuickReply}
            />
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(userInput);
            }}
            className="flex items-end space-x-3"
          >
            <textarea
              ref={textareaRef}
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(userInput);
                }
              }}
              placeholder={
                isListening
                  ? t('practice.chat.listeningPlaceholder', { defaultValue: 'Listening...' })
                  : t('practice.chat.placeholder', { defaultValue: 'Your message...' })
              }
              className="flex-grow bg-slate-700 rounded-lg p-3 text-slate-200 placeholder-slate-400 resize-none max-h-32 min-h-12 focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={1}
              disabled={isLoading}
            />

            {/* Microphone Button */}
            {recognitionRef.current && (
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isLoading}
                className={`p-3 rounded-lg transition-colors flex-shrink-0 ${isListening
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                  : 'bg-slate-600 hover:bg-slate-500'
                  } disabled:bg-slate-600 disabled:opacity-50`}
              >
                <MicrophoneIcon className="w-6 h-6 text-white" />
              </button>
            )}

            {/* Send Button */}
            <button
              type="submit"
              disabled={!userInput.trim() || isLoading}
              className="p-3 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-slate-600 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              <SendIcon className="w-6 h-6 text-white" />
            </button>
          </form>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenuTarget && (
        <ChatContextMenu
          target={contextMenuTarget}
          onClose={() => setContextMenuTarget(null)}
          allPhrases={allPhrases}
          onGenerateMore={handleSendMessage}
          onSpeak={speakText}
          onOpenWordAnalysis={onOpenWordAnalysis}
          onAnalyzeWord={onAnalyzeWord}
          onCreateCard={onCreateCard}
          onOpenVerbConjugation={onOpenVerbConjugation}
          onOpenNounDeclension={onOpenNounDeclension}
          onOpenAdjectiveDeclension={onOpenAdjectiveDeclension}
          onTranslateLearningToNative={onTranslateLearningToNative}
        />
      )}
    </div>
  );
};

export default PracticeChatModal_v2;
