
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Phrase, ChatMessage, WordAnalysis, ExamplePair } from '../types';
import { getCache, setCache } from '../services/cacheService';
import { ApiProviderType } from '../services/apiProvider';
import GeminiLogo from './icons/GeminiLogo';
import DeepSeekLogo from './icons/DeepSeekLogo';
import CloseIcon from './icons/CloseIcon';
import SendIcon from './icons/SendIcon';
import SoundIcon from './icons/SoundIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import ChatContextMenu from './ChatContextMenu';
import { useTranslation } from '../src/hooks/useTranslation';
import { useLanguage } from '../src/contexts/languageContext';
import { SPEECH_LOCALE_MAP, getNativeSpeechLocale } from '../services/speechService';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  phrase: Phrase;
  onGenerateInitialExamples: (phrase: Phrase) => Promise<ChatMessage>;
  onContinueChat: (phrase: Phrase, history: ChatMessage[], newMessage: string) => Promise<ChatMessage>;
  apiProviderType: ApiProviderType;
  onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
  allPhrases: Phrase[];
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
  basePhrase?: Phrase;
  onOpenWordAnalysis?: (phrase: Phrase, word: string) => void;
  onOpenContextMenu: (target: { sentence: { learning: string, native: string }, word: string }) => void;
}> = ({ message, onSpeak, basePhrase, onOpenWordAnalysis, onOpenContextMenu }) => {
  const { text, examples, suggestions, contentParts } = message;
  const wordLongPressTimer = useRef<number | null>(null);

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

  const handleWordClick = (contextText: string, word: string, nativeText: string) => {
    if (!onOpenWordAnalysis || !basePhrase) return;
    const proxyPhrase: Phrase = {
      ...basePhrase,
      id: `${basePhrase.id}_proxy_${contextText.slice(0, 5)}`,
      text: { learning: contextText, native: nativeText }
    };
    onOpenWordAnalysis(proxyPhrase, word);
  };

  const renderClickableLearning = (sentence: { learning: string, native: string }) => {
    if (!sentence.learning) return null;
    return sentence.learning.split(' ').map((word, i, arr) => (
      <span
        key={i}
        onClick={(e) => {
          e.stopPropagation();
          const cleanedWord = word.replace(/[.,!?()"“”:;]/g, '');
          if (cleanedWord) handleWordClick(sentence.learning, cleanedWord, sentence.native);
        }}
        onPointerDown={(e) => handleWordPointerDown(e, sentence, word)}
        onPointerUp={clearWordLongPress}
        onPointerLeave={clearWordLongPress}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const cleanedWord = word.replace(/[.,!?()"“”:;]/g, '');
          if (cleanedWord) onOpenContextMenu({ sentence, word: cleanedWord });
        }}
        className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded-md transition-colors"
      >
        {word}{i < arr.length - 1 ? ' ' : ''}
      </span>
    ));
  };

  // Render structured model responses with inline speakable parts
  if (contentParts) {
    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {contentParts.map((part, index) =>
          part.type === 'learning' || part.type === 'learning' ? (
            <span key={index} className="inline-flex items-center align-middle bg-slate-600/50 px-1.5 py-0.5 rounded-md mx-0.5">
              <span className="font-medium text-purple-300">{renderClickableLearning({ learning: part.text, native: part.translation || '' })}</span>
              <button
                onClick={() => onSpeak(part.text)}
                className="p-0.5 rounded-full hover:bg-white/20 flex-shrink-0 ml-1.5"
                aria-label={`Speak: ${part.text}`}
              >
                <SoundIcon className="w-3.5 h-3.5 text-slate-300" />
              </button>
            </span>
          ) : (
            <span key={index}>{part.text}</span>
          )
        )}
      </div>
    );
  }

  // Render initial structured model responses
  if (message.role === 'model' && (examples?.length || suggestions?.length)) {
    return (
      <div className="space-y-4 text-left">
        {text && <p className="text-slate-300">{text}</p>}

        {examples && examples.length > 0 && (
          <div className="space-y-3 pt-2">
            {examples.map((example, index) => (
              <div key={`ex-${index}`}>
                <div className="flex items-start">
                  <button
                    onClick={() => onSpeak(example.learning)}
                    className="p-1 rounded-full hover:bg-white/20 flex-shrink-0 mt-0.5 mr-2"
                    aria-label={`Speak: ${example.learning}`}
                  >
                    <SoundIcon className="w-4 h-4 text-slate-300" />
                  </button>
                  <p className="flex-1 text-slate-100 leading-relaxed">{renderClickableLearning({ learning: example.learning, native: example.native })}</p>
                </div>
                <p className="pl-7 text-sm text-slate-400 italic">{example.native}</p>
              </div>
            ))}
          </div>
        )}

        {suggestions && suggestions.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-600/50">
            {suggestions.map((suggestion, index) => (
              <div key={`sug-${index}`} className="italic bg-slate-600/10 p-2 rounded-lg">
                <h5 className="font-semibold text-purple-300 mb-1">{suggestion.title}</h5>
                <div className="whitespace-pre-wrap leading-relaxed text-slate-400">
                  {suggestion.contentParts && suggestion.contentParts.map((part, partIndex) =>
                    part.type === 'learning' || part.type === 'learning' ? (
                      <span key={partIndex} className="inline-flex items-center align-middle bg-slate-500/50 px-1.5 py-0.5 rounded-md mx-0.5">
                        <span className="font-medium text-purple-200">{renderClickableLearning({ learning: part.text, native: part.translation || '' })}</span>
                        <button
                          onClick={() => onSpeak(part.text)}
                          className="p-0.5 rounded-full hover:bg-white/20 flex-shrink-0 ml-1.5"
                          aria-label={`Speak: ${part.text}`}
                        >
                          <SoundIcon className="w-3.5 h-3.5 text-slate-200" />
                        </button>
                      </span>
                    ) : (
                      <span key={partIndex}>{part.text}</span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback for user messages and simple text responses
  return text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown> : null;
};

const ChatSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="flex justify-start">
      <div className="max-w-[85%] w-full px-4 py-3 rounded-2xl bg-slate-700 rounded-bl-lg space-y-3">
        <div className="h-4 bg-slate-600 rounded w-5/6"></div>
        <div className="h-4 bg-slate-600 rounded w-full"></div>
        <div className="h-4 bg-slate-600 rounded w-3/4"></div>
        <div className="space-y-3 pt-3 border-t border-slate-600/50">
          <div className="h-5 bg-slate-600 rounded w-1/3"></div>
          <div className="h-4 bg-slate-600 rounded w-full"></div>
        </div>
      </div>
    </div>
  </div>
);


const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, phrase, onGenerateInitialExamples, onContinueChat, apiProviderType, onOpenWordAnalysis, allPhrases, onCreateCard, onAnalyzeWord, onOpenVerbConjugation, onOpenNounDeclension, onOpenAdjectiveDeclension, onTranslateLearningToNative }) => {
  const { t } = useTranslation();
  const { profile } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [input, setInput] = useState('');
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [contextMenuTarget, setContextMenuTarget] = useState<{ sentence: { learning: string, native: string }, word: string } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = getNativeSpeechLocale(profile);
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error, event.message);
        setIsListening(false);
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => (prev ? prev + ' ' : '') + transcript);
      };
      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setMessages([]);
      setPromptSuggestions([]);
      setUsedSuggestions([]);
      setIsLoading(true);

      const fetchInitialMessage = async () => {
        const cacheKey = `chat_initial_${phrase.id}`;
        const cachedMessage = getCache<ChatMessage>(cacheKey);

        if (cachedMessage) {
          setMessages([cachedMessage]);
          setPromptSuggestions(cachedMessage.promptSuggestions || []);
          setIsLoading(false);
        } else {
          try {
            const initialMessage = await onGenerateInitialExamples(phrase);
            setPromptSuggestions(initialMessage.promptSuggestions || []);
            if (initialMessage.examples && initialMessage.examples.length > 0) {
              setCache(cacheKey, initialMessage);
            }
            setMessages([initialMessage]);
          } catch (err) {
            setMessages([{ role: 'model', contentParts: [{ type: 'text', text: t('modals.chat.errors.generic', { message: (err as Error).message }) }] }]);
          } finally {
            setIsLoading(false);
          }
        }
      };

      fetchInitialMessage();

    } else {
      document.body.style.overflow = 'auto';
      if (isListening) {
        recognitionRef.current?.abort();
      }
    }
    return () => {
      document.body.style.overflow = 'auto';
      if (isListening) {
        recognitionRef.current?.abort();
      }
    };
  }, [isOpen, phrase, onGenerateInitialExamples]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    if (isListening) {
      recognitionRef.current?.stop();
    }

    const userMessage: ChatMessage = { role: 'user', text: messageText };
    const messagesWithUser = [...messages, userMessage];
    setMessages(messagesWithUser);
    setInput('');
    setIsLoading(true);

    try {
      const modelResponse = await onContinueChat(phrase, messagesWithUser, messageText);
      setMessages(prev => [...prev, modelResponse]);
      if (modelResponse.promptSuggestions && modelResponse.promptSuggestions.length > 0) {
        setPromptSuggestions(prev => {
          const newPrompts = modelResponse.promptSuggestions || [];
          const combined = [...newPrompts, ...prev];
          const uniquePrompts = Array.from(new Set(combined));
          return uniquePrompts;
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', contentParts: [{ type: 'text', text: t('modals.chat.errors.generic', { message: (error as Error).message }) }] }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, phrase, isListening, onContinueChat]);

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
    setPromptSuggestions(prev => {
      const otherSuggestions = prev.filter(s => s !== suggestion);
      return [...otherSuggestions, suggestion];
    });
    setUsedSuggestions(prev => {
      if (!prev.includes(suggestion)) {
        return [...prev, suggestion];
      }
      return prev;
    });
  };

  const handleToggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex justify-center items-end" onClick={onClose}>
      <div
        className={`bg-slate-800 w-full max-w-2xl h-[90%] max-h-[90vh] rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            {apiProviderType === 'deepseek' ? <DeepSeekLogo className="w-7 h-7" /> : <GeminiLogo className="w-7 h-7" />}
            <h2 className="text-lg font-bold text-slate-100">{phrase.text.learning}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700">
            <CloseIcon className="w-6 h-6 text-slate-400" />
          </button>
        </header>

        {/* Chat Body */}
        <div className="flex-grow p-0 overflow-y-auto hide-scrollbar">
          <div className="space-y-6">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-2 py-2 rounded-2xl break-words bg l${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-lg' : 'bg-slate-700 text-slate-200 rounded-bl-lg'}`}>
                  <ChatMessageContent message={msg} onSpeak={onSpeak} basePhrase={phrase} onOpenWordAnalysis={onOpenWordAnalysis} onOpenContextMenu={setContextMenuTarget} />
                </div>
              </div>
            ))}
            {isLoading && messages.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-slate-700 text-slate-200 rounded-bl-lg flex items-center">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse mr-2"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse mr-2 delay-150"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-300"></div>
                </div>
              </div>
            )}
            {isLoading && messages.length === 0 && (
              <ChatSkeleton />
            )}
          </div>
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 pt-2 border-t border-slate-700 flex-shrink-0 bg-slate-800/80 backdrop-blur-sm">
          {promptSuggestions.length > 0 && (
            <div className="flex space-x-2 overflow-x-auto pb-0 mb-2 -mx-4 px-4 hide-scrollbar">
              {promptSuggestions.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestionClick(prompt)}
                  disabled={isLoading}
                  className={`text-nowrap px-3 py-1 bg-slate-700/80 hover:bg-slate-600/60 text-slate-300 text-sm font-medium rounded-full transition-all duration-300 disabled:opacity-50 ${usedSuggestions.includes(prompt) ? 'opacity-40' : ''}`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }} className="flex items-end space-x-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(input);
                }
              }}
              placeholder={isListening ? t('modals.chat.placeholders.listening') : t('modals.chat.placeholders.ask')}
              className="flex-grow bg-slate-700 rounded-lg p-3 text-slate-200 resize-none max-h-32 min-h-12 focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={1}
              disabled={isLoading}
            />
            {speechSupported && (
              <button
                type="button"
                onClick={handleToggleListening}
                disabled={isLoading}
                aria-label={isListening ? t('modals.chat.aria.stopListening') : t('modals.chat.aria.startListening')}
                className={`p-3 rounded-lg transition-colors flex-shrink-0 ${isListening ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-slate-600 hover:bg-slate-500'} disabled:bg-slate-600 disabled:cursor-not-allowed`}
              >
                <MicrophoneIcon className="w-6 h-6 text-white" />
              </button>
            )}
            <button type="submit" disabled={!input.trim() || isLoading} className="p-3 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex-shrink-0">
              <SendIcon className="w-6 h-6 text-white" />
            </button>
          </form>
        </div>
      </div>
      {contextMenuTarget && (
        <ChatContextMenu
          target={contextMenuTarget}
          onClose={() => setContextMenuTarget(null)}
          onAnalyzeWord={onAnalyzeWord}
          onCreateCard={onCreateCard}
          onGenerateMore={handleSendMessage}
          onSpeak={onSpeak}
          onOpenVerbConjugation={onOpenVerbConjugation}
          onOpenNounDeclension={onOpenNounDeclension}
          onOpenAdjectiveDeclension={onOpenAdjectiveDeclension}
          onOpenWordAnalysis={onOpenWordAnalysis}
          allPhrases={allPhrases}
          onTranslateLearningToNative={onTranslateLearningToNative}
        />
      )}
    </div>
  );
};

export default ChatModal;
