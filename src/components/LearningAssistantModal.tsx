/**
 * LearningAssistantModal.tsx
 *
 * This component provides an AI-powered conversational interface for learning specific phrases.
 * Features:
 * - Interactive chat with an AI tutor (Gemini).
 * - Speech-to-text (STT) support for both native and learning languages.
 * - Text-to-speech (TTS) for pronouncing learning content.
 * - Interactive word analysis (breaking down phrases into words).
 * - "Cheat sheets" for grammar assistance (verb conjugations, noun declensions, etc.).
 */

import React, { useEffect, useRef, useState } from 'react';

import { useLanguage } from '../contexts/languageContext';
import { useTranslation } from '../hooks/useTranslation';
import { getLanguageLabel } from '../i18n/languageMeta.ts';
import { getSpeechLocale, speak, SpeechOptions } from '../services/speechService';
// FIX: Added 'ContentPart' to the import to resolve 'Cannot find name' error.
import { ChatMessage, CheatSheetOption, ContentPart, LanguageCode, Phrase } from '../types.ts';
import BookOpenIcon from './icons/BookOpenIcon';
import CheckIcon from './icons/CheckIcon';
import CloseIcon from './icons/CloseIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import SendIcon from './icons/SendIcon';
import SoundIcon from './icons/SoundIcon';

/**
 * Props for the LearningAssistantModal.
 */
interface LearningAssistantModalProps {
  /** Controls visibility of the modal */
  isOpen: boolean;
  /** Callback to close the modal. didSucceed indicates if the phrase was mastered/completed. */
  onClose: (didSucceed?: boolean) => void;
  /** The phrase currently being learned or practiced */
  phrase: Phrase;
  /**
   * Core function to get AI guidance.
   * @param phrase The phrase context.
   * @param history Chat history so far.
   * @param userAnswer The user's input/question.
   * @returns Promise resolving to the AI's response message.
   */
  onGuide: (phrase: Phrase, history: ChatMessage[], userAnswer: string) => Promise<ChatMessage>;
  /** Callback invoked when the user successfully completes the learning task */
  onSuccess: (phrase: Phrase) => void;
  // --- Navigation & Helper Callbacks ---
  /** Open verb conjugation modal */
  onOpenVerbConjugation: (infinitive: string) => void;
  /** Open noun declension modal */
  onOpenNounDeclension: (noun: string, article: string) => void;
  /** Open pronouns reference modal */
  onOpenPronounsModal: () => void;
  /** Open W-questions (Who, What, Where, etc.) reference modal */
  onOpenWFragenModal: () => void;
  /** Open word-specific analysis (e.g. for individual words in a sentence) */
  onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
  /** Open adjective declension modal */
  onOpenAdjectiveDeclension: (adjective: string) => void;
  // --- Caching ---
  /** Cache of chat history for phrases, preventing loss of context on close/reopen */
  cache: { [phraseId: string]: ChatMessage[] };
  setCache: React.Dispatch<React.SetStateAction<{ [phraseId: string]: ChatMessage[] }>>;
}

/**
 * Renders a single chat message.
 * Handles parsing of message content parts (text vs. learning blocks) and interaction logic.
 */
const ChatMessageContent: React.FC<{
  message: ChatMessage;
  onSpeak: (text: string, options: SpeechOptions) => void;
  basePhrase?: Phrase;
  onOpenWordAnalysis?: (phrase: Phrase, word: string) => void;
}> = ({ message, onSpeak, basePhrase, onOpenWordAnalysis }) => {
  const { contentParts } = message;
  const { profile } = useLanguage();

  // FIX: Updated to accept nativeText and construct a valid proxy Phrase.
  /**
   * Handles clicking on a specific word within a learning block.
   * Creates a "proxy" phrase to pass to the word analysis tool.
   */
  const handleWordClick = (contextText: string, word: string, nativeText: string) => {
    if (!onOpenWordAnalysis || !basePhrase) return;
    const proxyPhrase: Phrase = {
      ...basePhrase,
      id: `${basePhrase.id}_proxy_${contextText.slice(0, 5)}`,
      text: { learning: contextText, native: nativeText },
    };
    onOpenWordAnalysis(proxyPhrase, word);
  };

  // FIX: Updated to pass the translation to handleWordClick.
  /**
   * Renders a "learning" content part (usually target language text) as clickable words.
   * Splits text by spaces and makes each word interactive.
   */
  const renderClickableLearning = (part: ContentPart) => {
    if (!part.text) return null;
    return part.text.split(' ').map((word, i, arr) => (
      <span
        key={i}
        onClick={(e) => {
          e.stopPropagation();
          const cleanedWord = word.replace(/[.,!?()"“”:;]/g, '');
          if (cleanedWord) handleWordClick(part.text, cleanedWord, part.translation || '');
        }}
        className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded-md transition-colors"
      >
        {word}
        {i < arr.length - 1 ? ' ' : ''}
      </span>
    ));
  };

  if (contentParts) {
    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {contentParts.map((part, index) =>
          part.type === 'learning' ? (
            <span
              key={index}
              className="inline-flex items-center align-middle bg-slate-600/50 px-1.5 py-0.5 rounded-md mx-0.5"
            >
              <span className="font-medium text-purple-300">{renderClickableLearning(part)}</span>
              <button
                onClick={() => onSpeak(part.text, { lang: profile.learning })}
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

  return message.text ? <p>{message.text}</p> : null;
};

const LearningAssistantModal: React.FC<LearningAssistantModalProps> = ({
  isOpen,
  onClose,
  phrase,
  onGuide,
  onSuccess,
  onOpenVerbConjugation,
  onOpenNounDeclension,
  onOpenPronounsModal,
  onOpenWFragenModal,
  cache,
  setCache,
  onOpenWordAnalysis,
  onOpenAdjectiveDeclension,
}) => {
  const { t } = useTranslation();
  const { profile } = useLanguage();

  // --- State Variables ---
  // Chat history for the current session
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Loading state for AI responses
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Current user input text
  const [input, setInput] = useState('');
  // Quick-reply options suggested by the AI
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  // Context-aware cheat sheet options (e.g. "Conjugate this verb")
  const [cheatSheetOptions, setCheatSheetOptions] = useState<CheatSheetOption[]>([]);
  // Success state (confetti/completion UI)
  const [isSuccess, setIsSuccess] = useState(false);

  // --- Speech Recognition State ---
  // Current language being listened for (Native vs Learning)
  const [recognitionLang, setRecognitionLang] = useState<LanguageCode>(profile.native);
  const [isListening, setIsListening] = useState(false);
  // Refs for speech recognition instances to avoid re-creation
  const nativeRecognitionRef = useRef<any>(null);
  const learningRecognitionRef = useRef<any>(null);

  // --- UI Refs ---
  // For auto-scrolling to the newest message
  const chatEndRef = useRef<HTMLDivElement>(null);
  // For auto-resizing the input textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Helper to update messages state and sync with the session cache.
   * Ensures that if the modal is closed and reopened, the conversation is preserved.
   */
  const updateMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prevMessages) => {
      const newMessages = updater(prevMessages);
      setCache((prevCache) => ({ ...prevCache, [phrase.id]: newMessages }));
      return newMessages;
    });
  };

  /**
   * Effect: Initialization
   * - Loads cached messages if available.
   * - If no cache, triggers the initial AI "guide" message to start the conversation.
   * - Sets quick reply options from the last message.
   */
  useEffect(() => {
    if (isOpen && phrase) {
      const cachedMessages = cache[phrase.id];
      setIsSuccess(false);
      setWordOptions([]);
      setCheatSheetOptions([]);

      if (cachedMessages) {
        // Restore from cache
        setMessages(cachedMessages);
        const lastMessage = cachedMessages[cachedMessages.length - 1];
        if (lastMessage?.role === 'model') {
          setWordOptions(lastMessage.wordOptions || []);
          setCheatSheetOptions(lastMessage.cheatSheetOptions || []);
          if (lastMessage.isCorrect) {
            setIsSuccess(true);
          }
        }
        setIsLoading(false);
      } else {
        // Start new session
        setIsLoading(true);
        setMessages([]);
        onGuide(phrase, [], '')
          .then((initialMessage) => {
            updateMessages(() => [initialMessage]);
            setWordOptions(initialMessage.wordOptions || []);
            setCheatSheetOptions(initialMessage.cheatSheetOptions || []);
          })
          .catch((err) => {
            const errorMsg: ChatMessage = {
              role: 'model',
              contentParts: [
                {
                  type: 'text',
                  text: t('modals.learningAssistant.errors.generic', { message: (err as Error).message }),
                },
              ],
            };
            updateMessages(() => [errorMsg]);
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    }
  }, []);

  /**
   * Effect: Speech Recognition Setup
   * Initializes two recognizers: one for Native language and one for Learning language.
   * This allows the user to switch languages instantly.
   */
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const setupRecognizer = (langCode: LanguageCode) => {
        const recognition = new SpeechRecognition();
        recognition.lang = getSpeechLocale(profile.native);
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
          if (event.error !== 'aborted' && event.error !== 'no-speech') {
            console.error(`Speech recognition error (${langCode}):`, event.error);
          }
          setIsListening(false);
        };
        recognition.onresult = (event: any) => {
          const transcript = event.results[0]?.[0]?.transcript;
          if (transcript && transcript.trim()) {
            setInput((prev) => (prev ? prev + ' ' : '') + transcript);
          }
        };
        return recognition;
      };
      nativeRecognitionRef.current = setupRecognizer(profile.native);
      learningRecognitionRef.current = setupRecognizer(profile.learning);
    }
  }, [profile.native, profile.learning]);

  // Handles switching the active speech recognition language
  const handleLangChange = (lang: LanguageCode) => {
    if (isListening) return;
    setRecognitionLang(lang);
  };

  // Toggles speech recognition on/off
  const handleMicClick = () => {
    const recognizer =
      recognitionLang === profile.native ? nativeRecognitionRef.current : learningRecognitionRef.current;
    if (!recognizer) return;

    if (isListening) {
      recognizer.stop();
    } else {
      try {
        (recognitionLang === profile.native ? learningRecognitionRef.current : nativeRecognitionRef.current)?.stop();
        recognizer.start();
      } catch (e) {
        console.error('Could not start recognition:', e);
        setIsListening(false);
      }
    }
  };

  // Auto-resizes the input textarea as content grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  /**
   * Handles sending a user message to the AI.
   * - Stops listening if active.
   * - Updates local chat history immediately.
   * - Calls the AI API (`onGuide`).
   * - Handles success state if the AI marks the interaction as correct.
   */
  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading || isSuccess) return;

    if (isListening) {
      (recognitionLang === profile.native ? nativeRecognitionRef.current : learningRecognitionRef.current)?.stop();
    }

    setWordOptions([]);
    setCheatSheetOptions([]);

    const userMessage: ChatMessage = { role: 'user', text: messageText };
    updateMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const modelResponse = await onGuide(phrase, [...messages, userMessage], messageText);
      updateMessages((prev) => [...prev, modelResponse]);
      setWordOptions(modelResponse.wordOptions || []);
      setCheatSheetOptions(modelResponse.cheatSheetOptions || []);
      if (modelResponse.isCorrect) {
        setIsSuccess(true);
        onSuccess(phrase);
        // Auto-close after success animation
        setTimeout(() => onClose(true), 2500);
      }
    } catch (error) {
      const errorMsg: ChatMessage = {
        role: 'model',
        contentParts: [
          { type: 'text', text: t('modals.learningAssistant.errors.generic', { message: (error as Error).message }) },
        ],
      };
      updateMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  /**
   * Handles clicks on "Cheat Sheet" chips (e.g. "Show conjugation").
   * Opens the appropriate modal based on the option type.
   */
  const handleCheatSheetClick = (option: CheatSheetOption) => {
    switch (option.type) {
      case 'verbConjugation':
        // Ensure data is a string before passing to onOpenVerbConjugation
        if (typeof option.data === 'string') {
          onOpenVerbConjugation(option.data);
        } else {
          console.error('Invalid data type for verb conjugation:', typeof option.data);
        }
        break;
      case 'nounDeclension':
        try {
          // Check if data exists and is a string before parsing
          if (typeof option.data === 'string' && option.data) {
            const nounData = JSON.parse(option.data);
            if (nounData.noun && nounData.article) {
              onOpenNounDeclension(nounData.noun, nounData.article);
            } else {
              console.error('Missing noun or article in noun data:', nounData);
            }
          } else {
            console.error('Invalid data for noun declension:', option.data);
          }
        } catch (e) {
          console.error('Failed to parse noun data for cheat sheet', e);
        }
        break;
      case 'pronouns':
        onOpenPronounsModal();
        break;
      case 'wFragen':
        onOpenWFragenModal();
        break;
      default:
        console.warn('Unknown cheat sheet type:', option.type);
    }
  };

  const handleWordOptionClick = (word: string) => {
    // For quick replies, send the message directly instead of inserting into input
    handleSendMessage(word);
  };

  // Replace hardcoded "Не знаю" with localized version for consistency
  const getLocalizedWordOptions = (options: string[]) => {
    if (options.length > 0 && options[0] === 'Не знаю') {
      const localizedDontKnow = t('modals.learningAssistant.dontKnow');
      return [localizedDontKnow, ...options.slice(1)];
    }
    return options;
  };

  const localizedWordOptions = getLocalizedWordOptions(wordOptions);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex justify-center items-end" onClick={() => onClose()}>
      <div
        className={`bg-slate-800 w-full max-w-2xl h-[90%] max-h-[90vh] rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <BookOpenIcon className="w-6 h-6 text-purple-400" />
            <h2 className="text-lg font-bold text-slate-100">{phrase.text.native}</h2>
          </div>
          <button onClick={() => onClose()} className="p-2 rounded-full hover:bg-slate-700">
            <CloseIcon className="w-6 h-6 text-slate-400" />
          </button>
        </header>

        <div className="flex-grow p-4 overflow-y-auto hide-scrollbar">
          <div className="space-y-6">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl break-words ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-lg' : 'bg-slate-700 text-slate-200 rounded-bl-lg'}`}
                >
                  <ChatMessageContent
                    message={msg}
                    onSpeak={speak}
                    basePhrase={phrase}
                    onOpenWordAnalysis={onOpenWordAnalysis}
                  />
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
          {isSuccess ? (
            <div className="flex items-center justify-center h-28 bg-green-900/50 rounded-lg animate-fade-in">
              <CheckIcon className="w-8 h-8 text-green-400 mr-3" />
              <span className="text-xl font-bold text-green-300">{t('modals.learningAssistant.success')}</span>
            </div>
          ) : (
            <>
              {localizedWordOptions.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mb-3">
                  {localizedWordOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleWordOptionClick(opt)}
                      className="px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-full transition-colors"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              {cheatSheetOptions.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mb-3">
                  {cheatSheetOptions.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleCheatSheetClick(opt)}
                      className="px-3 py-1.5 bg-slate-600/50 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-full transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              {/* Wrap the input and buttons in a form for proper submission handling */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(input);
                }}
                className="flex items-end space-x-2"
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(input);
                    }
                  }}
                  placeholder={
                    isListening ? t('modals.chat.placeholders.listening') : t('modals.learningAssistant.placeholder')
                  }
                  className="flex-grow bg-slate-700 rounded-lg p-3 text-slate-200 resize-none max-h-32 min-h-12 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={1}
                  disabled={isLoading}
                />
                <div className="flex items-center self-stretch bg-slate-600 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleLangChange(profile.learning)}
                    className={`h-full px-2 rounded-l-lg transition-colors ${recognitionLang === profile.learning ? 'bg-purple-600/50' : 'hover:bg-slate-500'}`}
                  >
                    <span className="text-xs font-bold text-white">{getLanguageLabel(profile.learning)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLangChange(profile.native)}
                    className={`h-full px-2 transition-colors ${recognitionLang === profile.native ? 'bg-purple-600/50' : 'hover:bg-slate-500'}`}
                  >
                    <span className="text-xs font-bold text-white">{getLanguageLabel(profile.native)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleMicClick}
                    disabled={isLoading}
                    className={`h-full px-2 rounded-r-lg transition-colors ${isListening ? 'bg-red-600' : 'hover:bg-slate-500'}`}
                  >
                    <MicrophoneIcon className="w-6 h-6 text-white" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="self-stretch p-3 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-slate-600 flex-shrink-0"
                >
                  <SendIcon className="w-6 h-6 text-white" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// FIX: Change to default export to resolve "no default export" error in App.tsx.
export default LearningAssistantModal;
