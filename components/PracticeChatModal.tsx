
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phrase, ChatMessage, WordAnalysis } from '../types';
import CloseIcon from './icons/CloseIcon';
import SendIcon from './icons/SendIcon';
import SoundIcon from './icons/SoundIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import MessageQuestionIcon from './icons/MessageQuestionIcon';
import { useTranslation } from '../src/hooks/useTranslation.ts';
import { useLanguage } from '../src/contexts/languageContext';
import { SPEECH_LOCALE_MAP, getLearningSpeechLocale } from '../services/speechService';

// Reusing a similar component from other chat modals for consistent UI
import ChatContextMenu from './ChatContextMenu';

interface PracticeChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: ChatMessage[];
  setHistory: (updater: React.SetStateAction<ChatMessage[]>) => void;
  onSendMessage: (history: ChatMessage[], newMessage: string) => Promise<ChatMessage>;
  allPhrases: Phrase[];
  settings: { autoSpeak: boolean };
  onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
  onCreateCard: (phraseData: { learning: string; native: string; }) => void;
  onAnalyzeWord: (phrase: Phrase, word: string) => Promise<WordAnalysis | null>;
  onOpenVerbConjugation: (infinitive: string) => void;
  onOpenNounDeclension: (noun: string, article: string) => void;
  onOpenAdjectiveDeclension: (adjective: string) => void;
  onTranslateLearningToNative: (learningPhrase: string) => Promise<{ native: string }>;
}

const ChatMessageContent: React.FC<{
  message: ChatMessage;
  onSpeak: (text: string) => void;
  onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
  onOpenContextMenu: (target: { sentence: { learning: string, native: string }, word: string }) => void;
}> = ({ message, onSpeak, onOpenWordAnalysis, onOpenContextMenu }) => {
  const { text, contentParts } = message;
  const wordLongPressTimer = useRef<number | null>(null);
  const [revealedTranslations, setRevealedTranslations] = useState<Set<number>>(new Set());

  const handleWordClick = (contextText: string, word: string, nativeText: string) => {
    // FIX: Correctly construct the proxy Phrase with a nested text object.
    const proxyPhrase: Phrase = {
      id: `proxy_practice_chat_${contextText.slice(0, 5)}`,
      text: { learning: contextText, native: nativeText },
      category: 'general' as const, masteryLevel: 0, lastReviewedAt: null, nextReviewAt: Date.now(),
      knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0,
    };
    onOpenWordAnalysis(proxyPhrase, word);
  };

  const handleWordPointerDown = (e: React.PointerEvent<HTMLSpanElement>, sentence: { learning: string, native: string }, word: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    const cleanedWord = word.replace(/[.,!?()"“”:;]/g, '');
    if (!cleanedWord) return;

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
    if (!text) return null;
    return text.split(' ').map((word, i, arr) => (
      <span
        key={i}
        onClick={(e) => { e.stopPropagation(); const cleaned = word.replace(/[.,!?()"“”:;]/g, ''); if (cleaned) handleWordClick(text, cleaned, translation); }}
        onPointerDown={(e) => handleWordPointerDown(e, { learning: text, native: translation }, word)}
        onPointerUp={clearWordLongPress}
        onPointerLeave={clearWordLongPress}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); const cleaned = word.replace(/[.,!?()"“”:;]/g, ''); if (cleaned) onOpenContextMenu({ sentence: { learning: text, native: translation }, word: cleaned }); }}
        className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded-md transition-colors"
      >
        {word}{i < arr.length - 1 ? ' ' : ''}
      </span>
    ));
  };

  if (contentParts) {
    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {contentParts.map((part, index) =>
          part.type === 'learning' || part.type === 'learning' ? (
            <span key={index} className="inline-flex items-center align-middle bg-slate-600/50 px-1.5 py-0.5 rounded-md mx-0.5">
              <span className="font-medium text-purple-300">{renderClickableLearning(part.text, part.translation || '')}</span>
              <button onClick={() => onSpeak(part.text)} className="p-0.5 rounded-full hover:bg-white/20 flex-shrink-0 ml-1.5">
                <SoundIcon className="w-3.5 h-3.5 text-slate-300" />
              </button>
              {part.translation && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setRevealedTranslations(prev => {
                      const newSet = new Set(prev);
                      newSet.add(index);
                      return newSet;
                    });
                  }}
                  className={`ml-2 text-xs text-slate-400 italic cursor-pointer transition-all duration-200 ${revealedTranslations.has(index) ? '' : 'blur-sm select-none hover:blur-[3px]'
                    }`}
                  title={revealedTranslations.has(index) ? '' : 'Нажми чтобы показать перевод'}
                >
                  {part.translation}
                </span>
              )}
            </span>
          ) : (
            <span key={index}>{part.text}</span>
          )
        )}
      </div>
    );
  }
  return text ? <p>{text}</p> : null;
};

const PracticeChatModal: React.FC<PracticeChatModalProps> = ({ isOpen, onClose, history, setHistory, onSendMessage, allPhrases, settings, ...interactiveProps }) => {
  const { t } = useTranslation();
  const { profile } = useLanguage();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [input, setInput] = useState('');
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [contextMenuTarget, setContextMenuTarget] = useState<{ sentence: { learning: string, native: string }, word: string } | null>(null);

  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevIsLoadingRef = useRef(isLoading);

  const onSpeak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      // Use learning language from profile for correct pronunciation
      const learningLang = profile.learning || 'de';
      utterance.lang = SPEECH_LOCALE_MAP[learningLang] || 'de-DE';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, [profile.learning]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() && history.length > 0) return; // Allow initial empty message
    if (isLoading) return;

    if (isListening) recognitionRef.current?.stop();

    const userMessage: ChatMessage = { role: 'user', text: messageText };
    const newHistory = [...history, userMessage];
    setHistory(newHistory);
    setInput('');
    setIsLoading(true);
    setPromptSuggestions([]);

    try {
      const modelResponse = await onSendMessage(newHistory, messageText);
      setHistory(prev => [...prev, modelResponse]);
      if (modelResponse.promptSuggestions) setPromptSuggestions(modelResponse.promptSuggestions);
    } catch (error) {
      const errorMsg: ChatMessage = { role: 'model', contentParts: [{ type: 'text', text: `Произошла ошибка: ${(error as Error).message}` }] };
      setHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, history, onSendMessage, setHistory, isListening]);

  useEffect(() => {
    if (isOpen && history.length === 0) {
      setIsLoading(true);
      onSendMessage([], '')
        .then(initialMessage => {
          setHistory([initialMessage]);
          if (initialMessage.promptSuggestions) setPromptSuggestions(initialMessage.promptSuggestions);
        })
        .catch(error => {
          const errorMsg: ChatMessage = { role: 'model', contentParts: [{ type: 'text', text: `Произошла ошибка: ${(error as Error).message}` }] };
          setHistory([errorMsg]);
        })
        .finally(() => setIsLoading(false));
    }
    if (!isOpen) {
      recognitionRef.current?.abort();
    }
  }, [isOpen, onSendMessage, setHistory, history.length]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = getLearningSpeechLocale(profile);
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          console.error('Speech recognition error:', event.error, event.message);
        }
        setIsListening(false);
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => (prev ? prev + ' ' : '') + transcript);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();

    const wasLoading = prevIsLoadingRef.current;
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;

    // Auto-speak on transition from loading to not loading with a new model message
    if (wasLoading && !isLoading && lastMessage?.role === 'model' && settings.autoSpeak) {
      const learningParts = lastMessage.contentParts?.filter(p => p.type === 'learning' || p.type === 'learning').map(p => p.text) || [];
      const textToSpeak = learningParts.join('. ');
      if (textToSpeak) {
        onSpeak(textToSpeak);
      }
    }

    prevIsLoadingRef.current = isLoading;
  }, [history, isLoading, settings.autoSpeak, onSpeak]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleMicClick = () => {
    if (!recognitionRef.current) return;
    if (isListening) recognitionRef.current.stop();
    else recognitionRef.current.start();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 flex justify-center items-end" onClick={onClose}>
        <div
          className={`bg-slate-800 w-full max-w-2xl h-full rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <MessageQuestionIcon className="w-7 h-7 text-purple-400" />
              <h2 className="text-lg font-bold text-slate-100">{t('practice.chat.title')}</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700">
              <CloseIcon className="w-6 h-6 text-slate-400" />
            </button>
          </header>

          <div className="flex-grow p-4 overflow-y-auto hide-scrollbar">
            <div className="space-y-6">
              {history.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl break-words ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-lg' : 'bg-slate-700 text-slate-200 rounded-bl-lg'}`}>
                    <ChatMessageContent message={msg} onSpeak={onSpeak} onOpenWordAnalysis={interactiveProps.onOpenWordAnalysis} onOpenContextMenu={setContextMenuTarget} />
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-slate-700 text-slate-200 rounded-bl-lg flex items-center">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse mr-2"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse mr-2 delay-150"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-300"></div>
                  </div>
                </div>
              )}
            </div>
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-slate-700 flex-shrink-0 bg-slate-800/80 backdrop-blur-sm">
            {promptSuggestions.length > 0 && !isLoading && (
              <div className="flex space-x-2 overflow-x-auto pb-3 mb-2 -mx-4 px-4 hide-scrollbar">
                {promptSuggestions.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => handleSendMessage(prompt)}
                    className="text-nowrap px-4 py-2 bg-slate-700/80 hover:bg-slate-600/80 text-slate-300 text-sm font-medium rounded-full transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }} className="flex items-end space-x-3">
              <textarea
                ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(input); } }}
                placeholder={isListening ? t('practice.chat.listeningPlaceholder') : t('practice.chat.placeholder')}
                className="flex-grow bg-slate-700 rounded-lg p-3 text-slate-200 resize-none max-h-32 min-h-12 focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={1} disabled={isLoading}
              />
              <button type="button" onClick={handleMicClick} disabled={isLoading}
                className={`p-3 rounded-lg transition-colors flex-shrink-0 ${isListening ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-slate-600 hover:bg-slate-500'} disabled:bg-slate-600`}>
                <MicrophoneIcon className="w-6 h-6 text-white" />
              </button>
              <button type="submit" disabled={!input.trim() || isLoading} className="p-3 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-slate-600">
                <SendIcon className="w-6 h-6 text-white" />
              </button>
            </form>
          </div>
        </div>
      </div>
      {contextMenuTarget && (
        <ChatContextMenu
          target={contextMenuTarget}
          onClose={() => setContextMenuTarget(null)}
          allPhrases={allPhrases}
          onGenerateMore={handleSendMessage}
          onSpeak={onSpeak}
          {...interactiveProps}
        />
      )}
    </>
  );
};

export default PracticeChatModal;
