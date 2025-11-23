import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: Added 'ContentPart' to the import to resolve 'Cannot find name' error.
import { Phrase, ChatMessage, CheatSheetOption, ContentPart, LanguageCode } from '../types';
import CloseIcon from './icons/CloseIcon';
import SendIcon from './icons/SendIcon';
import SoundIcon from './icons/SoundIcon';
import BookOpenIcon from './icons/BookOpenIcon';
import CheckIcon from './icons/CheckIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import { useTranslation } from '../src/hooks/useTranslation';
import { useLanguage } from '../src/contexts/languageContext';
import { SPEECH_LOCALE_MAP } from '../constants/speechLocales';
import { getLanguageLabel } from '../services/languageLabels';

interface LearningAssistantModalProps {
  isOpen: boolean;
  onClose: (didSucceed?: boolean) => void;
  phrase: Phrase;
  onGuide: (phrase: Phrase, history: ChatMessage[], userAnswer: string) => Promise<ChatMessage>;
  onSuccess: (phrase: Phrase) => void;
  onOpenVerbConjugation: (infinitive: string) => void;
  onOpenNounDeclension: (noun: string, article: string) => void;
  onOpenPronounsModal: () => void;
  onOpenWFragenModal: () => void;
  cache: { [phraseId: string]: ChatMessage[] };
  setCache: React.Dispatch<React.SetStateAction<{ [phraseId: string]: ChatMessage[] }>>;
  onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
  onOpenAdjectiveDeclension: (adjective: string) => void;
}

const ChatMessageContent: React.FC<{
  message: ChatMessage;
  onSpeak: (text: string) => void;
  basePhrase?: Phrase;
  onOpenWordAnalysis?: (phrase: Phrase, word: string) => void;
}> = ({ message, onSpeak, basePhrase, onOpenWordAnalysis }) => {
  const { contentParts } = message;

  // FIX: Updated to accept nativeText and construct a valid proxy Phrase.
  const handleWordClick = (contextText: string, word: string, nativeText: string) => {
    if (!onOpenWordAnalysis || !basePhrase) return;
    const proxyPhrase: Phrase = { ...basePhrase, id: `${basePhrase.id}_proxy_${contextText.slice(0, 5)}`, text: { learning: contextText, native: nativeText } };
    onOpenWordAnalysis(proxyPhrase, word);
  };

  // FIX: Updated to pass the translation to handleWordClick.
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
        {word}{i < arr.length - 1 ? ' ' : ''}
      </span>
    ));
  };

  if (contentParts) {
    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {contentParts.map((part, index) =>
          part.type === 'learning' ? (
            <span key={index} className="inline-flex items-center align-middle bg-slate-600/50 px-1.5 py-0.5 rounded-md mx-0.5">
              <span className="font-medium text-purple-300">{renderClickableLearning(part)}</span>
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

  return message.text ? <p>{message.text}</p> : null;
};

const LearningAssistantModal: React.FC<LearningAssistantModalProps> = ({ isOpen, onClose, phrase, onGuide, onSuccess, onOpenVerbConjugation, onOpenNounDeclension, onOpenPronounsModal, onOpenWFragenModal, cache, setCache, onOpenWordAnalysis, onOpenAdjectiveDeclension }) => {
  const { t } = useTranslation();
  const { profile } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [input, setInput] = useState('');
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [cheatSheetOptions, setCheatSheetOptions] = useState<CheatSheetOption[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  const [recognitionLang, setRecognitionLang] = useState<LanguageCode>(profile.native);
  const [isListening, setIsListening] = useState(false);
  const nativeRecognitionRef = useRef<any>(null);
  const learningRecognitionRef = useRef<any>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages(prevMessages => {
      const newMessages = updater(prevMessages);
      setCache(prevCache => ({ ...prevCache, [phrase.id]: newMessages }));
      return newMessages;
    });
  }, [setCache, phrase.id]);

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
    if (isOpen && phrase) {
      const cachedMessages = cache[phrase.id];
      setIsSuccess(false);
      setWordOptions([]);
      setCheatSheetOptions([]);

      if (cachedMessages) {
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
        setIsLoading(true);
        setMessages([]);
        onGuide(phrase, [], '')
          .then(initialMessage => {
            updateMessages(() => [initialMessage]);
            setWordOptions(initialMessage.wordOptions || []);
            setCheatSheetOptions(initialMessage.cheatSheetOptions || []);
          })
          .catch(err => {
            const errorMsg: ChatMessage = { role: 'model', contentParts: [{ type: 'text', text: t('modals.learningAssistant.errors.generic', { message: (err as Error).message }) }] };
            updateMessages(() => [errorMsg]);
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    }
  }, [isOpen, phrase, onGuide, cache, updateMessages]);

  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const setupRecognizer = (langCode: LanguageCode) => {
        const recognition = new SpeechRecognitionAPI();
        recognition.lang = SPEECH_LOCALE_MAP[langCode] || 'en-US';
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
            setInput(prev => (prev ? prev + ' ' : '') + transcript);
          }
        };
        return recognition;
      }
      nativeRecognitionRef.current = setupRecognizer(profile.native);
      learningRecognitionRef.current = setupRecognizer(profile.learning);
    }
  }, [profile.native, profile.learning]);

  const handleLangChange = (lang: LanguageCode) => {
    if (isListening) return;
    setRecognitionLang(lang);
  };

  const handleMicClick = () => {
    const recognizer = recognitionLang === profile.native ? nativeRecognitionRef.current : learningRecognitionRef.current;
    if (!recognizer) return;

    if (isListening) {
      recognizer.stop();
    } else {
      try {
        (recognitionLang === profile.native ? learningRecognitionRef.current : nativeRecognitionRef.current)?.stop();
        recognizer.start();
      } catch (e) {
        console.error("Could not start recognition:", e);
        setIsListening(false);
      }
    }
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading || isSuccess) return;

    if (isListening) {
      (recognitionLang === profile.native ? nativeRecognitionRef.current : learningRecognitionRef.current)?.stop();
    }

    setWordOptions([]);
    setCheatSheetOptions([]);

    const userMessage: ChatMessage = { role: 'user', text: messageText };
    updateMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const modelResponse = await onGuide(phrase, [...messages, userMessage], messageText);
      updateMessages(prev => [...prev, modelResponse]);
      setWordOptions(modelResponse.wordOptions || []);
      setCheatSheetOptions(modelResponse.cheatSheetOptions || []);
      if (modelResponse.isCorrect) {
        setIsSuccess(true);
        onSuccess(phrase);
        setTimeout(() => onClose(true), 2500);
      }
    } catch (error) {
      const errorMsg: ChatMessage = { role: 'model', contentParts: [{ type: 'text', text: t('modals.learningAssistant.errors.generic', { message: (error as Error).message }) }] };
      updateMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isSuccess, messages, phrase, onGuide, onSuccess, onClose, updateMessages, recognitionLang, isListening]);

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleCheatSheetClick = (option: CheatSheetOption) => {
    switch (option.type) {
      case 'verbConjugation':
        // Ensure data is a string before passing to onOpenVerbConjugation
        if (typeof option.data === 'string') {
          onOpenVerbConjugation(option.data);
        } else {
          console.error("Invalid data type for verb conjugation:", typeof option.data);
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
              console.error("Missing noun or article in noun data:", nounData);
            }
          } else {
            console.error("Invalid data for noun declension:", option.data);
          }
        } catch (e) {
          console.error("Failed to parse noun data for cheat sheet", e);
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
  }

  // Replace hardcoded "Не знаю" with localized version
  const getLocalizedWordOptions = useCallback((options: string[]) => {
    if (options.length > 0 && options[0] === "Не знаю") {
      const localizedDontKnow = t('modals.learningAssistant.dontKnow');
      return [localizedDontKnow, ...options.slice(1)];
    }
    return options;
  }, [t]);

  const localizedWordOptions = getLocalizedWordOptions(wordOptions);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex justify-center items-end" onClick={() => onClose()}>
      <div
        className={`bg-slate-800 w-full max-w-2xl h-[90%] max-h-[90vh] rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
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
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl break-words ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-lg' : 'bg-slate-700 text-slate-200 rounded-bl-lg'}`}>
                  <ChatMessageContent message={msg} onSpeak={onSpeak} basePhrase={phrase} onOpenWordAnalysis={onOpenWordAnalysis} />
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
                  {localizedWordOptions.map(opt => (
                    <button key={opt} onClick={() => handleWordOptionClick(opt)} className="px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-full transition-colors">
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              {cheatSheetOptions.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mb-3">
                  {cheatSheetOptions.map(opt => (
                    <button key={opt.label} onClick={() => handleCheatSheetClick(opt)} className="px-3 py-1.5 bg-slate-600/50 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-full transition-colors">
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              {/* Wrap the input and buttons in a form for proper submission handling */}
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }} className="flex items-end space-x-2">
                <textarea
                  ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(input); } }}
                  placeholder={isListening ? t('modals.chat.placeholders.listening') : t('modals.learningAssistant.placeholder')}
                  className="flex-grow bg-slate-700 rounded-lg p-3 text-slate-200 resize-none max-h-32 min-h-12 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={1} disabled={isLoading}
                />
                <div className="flex items-center self-stretch bg-slate-600 rounded-lg">
                  <button type="button" onClick={() => handleLangChange(profile.learning)} className={`h-full px-2 rounded-l-lg transition-colors ${recognitionLang === profile.learning ? 'bg-purple-600/50' : 'hover:bg-slate-500'}`}><span className="text-xs font-bold text-white">{getLanguageLabel(profile.learning)}</span></button>
                  <button type="button" onClick={() => handleLangChange(profile.native)} className={`h-full px-2 transition-colors ${recognitionLang === profile.native ? 'bg-purple-600/50' : 'hover:bg-slate-500'}`}><span className="text-xs font-bold text-white">{getLanguageLabel(profile.native)}</span></button>
                  <button type="button" onClick={handleMicClick} disabled={isLoading} className={`h-full px-2 rounded-r-lg transition-colors ${isListening ? 'bg-red-600' : 'hover:bg-slate-500'}`}>
                    <MicrophoneIcon className="w-6 h-6 text-white" />
                  </button>
                </div>
                <button type="submit" disabled={!input.trim() || isLoading} className="self-stretch p-3 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-slate-600 flex-shrink-0">
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