
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Phrase, ChatMessage, ContentPart, TranslationChatResponse, SpeechRecognition, SpeechRecognitionErrorEvent } from '../types';
import CloseIcon from './icons/CloseIcon';
import SendIcon from './icons/SendIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import GeminiLogo from './icons/GeminiLogo';
import SoundIcon from './icons/SoundIcon';
import CheckIcon from './icons/CheckIcon';
import { useTranslation } from '../src/hooks/useTranslation';
import { useLanguage } from '../src/contexts/languageContext';
import { SPEECH_LOCALE_MAP } from '../constants/speechLocales';
import { getNativeSpeechLocale } from '../services/speechService';

interface DiscussTranslationModalProps {
    isOpen: boolean;
    onClose: () => void;
    originalNative: string;
    currentLearning: string;
    onDiscuss: (request: any) => Promise<TranslationChatResponse>;
    onAccept: (suggestion: { native: string; learning: string }) => void;
    onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
    initialMessage?: string;
}

const ChatMessageContent: React.FC<{
    message: ChatMessage;
    onSpeak: (text: string) => void;
    basePhrase: Omit<Phrase, 'id'>;
    onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
}> = ({ message, onSpeak, basePhrase, onOpenWordAnalysis }) => {
    const { text, contentParts } = message;

    const handleWordClick = (contextText: string, word: string) => {
        const proxyPhrase = { ...basePhrase, id: `proxy_discuss_${contextText.slice(0, 5)}`, text: { ...basePhrase.text, learning: contextText } };
        onOpenWordAnalysis(proxyPhrase as Phrase, word);
    };

    const renderClickableLearning = (text: string) => {
        if (!text) return null;
        return text.split(' ').map((word, i, arr) => (
            <span
                key={i}
                onClick={(e) => {
                    e.stopPropagation();
                    const cleanedWord = word.replace(/[.,!?()"“”:;]/g, '');
                    if (cleanedWord) handleWordClick(text, cleanedWord);
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
                    part.type === 'learning' || part.type === 'learning' ? (
                        <span key={index} className="inline-flex items-center align-middle bg-slate-600/50 px-1.5 py-0.5 rounded-md mx-0.5">
                            <span className="font-medium text-purple-300">{renderClickableLearning(part.text)}</span>
                            <button onClick={() => onSpeak(part.text)} className="p-0.5 rounded-full hover:bg-white/20 ml-1.5">
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
    return text ? <p>{text}</p> : null;
};

const DiscussTranslationModal: React.FC<DiscussTranslationModalProps> = ({ isOpen, onClose, originalNative, currentLearning, onDiscuss, onAccept, onOpenWordAnalysis, initialMessage }) => {
    const { t } = useTranslation();
    const { profile } = useLanguage();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');
    const [latestSuggestion, setLatestSuggestion] = useState<{ native: string; learning: string } | null>(null);
    const [isListening, setIsListening] = useState(false);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const isInitialMessageSent = useRef(false);

    const basePhrase = {
        text: { native: originalNative, learning: currentLearning },
        category: 'general' as const,
        masteryLevel: 0, lastReviewedAt: null, nextReviewAt: Date.now(),
        knowCount: 0, knowStreak: 0, isMastered: false,
        lapses: 0,
    };

    const handleSendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: messageText };
        setInput('');
        setIsLoading(true);
        setLatestSuggestion(null);

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);

        try {
            const response = await onDiscuss({
                originalNative: originalNative,
                currentLearning: currentLearning,
                history: newMessages,
                userRequest: messageText,
            });
            setMessages(prev => [...prev, response]);
            if (response.suggestion) {
                setLatestSuggestion({ native: response.suggestion.native, learning: response.suggestion.learning });
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', contentParts: [{ type: 'text', text: t('modals.discussTranslation.errors.generic', { message: (error as Error).message }) }] }]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, messages, originalNative, currentLearning, onDiscuss]);

    useEffect(() => {
        if (isOpen) {
            if (initialMessage && !isInitialMessageSent.current) {
                isInitialMessageSent.current = true;

                const userMessage: ChatMessage = { role: 'user', text: initialMessage };
                setIsLoading(true);
                setMessages([userMessage]);

                onDiscuss({
                    originalNative: originalNative,
                    currentLearning: currentLearning,
                    history: [userMessage],
                    userRequest: initialMessage,
                }).then(response => {
                    setMessages(prev => [...prev, response]);
                    if (response.suggestion) {
                        setLatestSuggestion({ native: response.suggestion.native, learning: response.suggestion.learning });
                    }
                }).catch(error => {
                    setMessages(prev => [...prev, { role: 'model', contentParts: [{ type: 'text', text: t('modals.discussTranslation.errors.generic', { message: (error as Error).message }) }] }]);
                }).finally(() => {
                    setIsLoading(false);
                });
            }
        } else {
            // Reset state when modal closes
            setMessages([]);
            setLatestSuggestion(null);
            setInput('');
            isInitialMessageSent.current = false;
        }
    }, [isOpen, initialMessage, originalNative, currentLearning, onDiscuss]);

    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognitionAPI) {
            const recognition = new SpeechRecognitionAPI();
            recognition.lang = getNativeSpeechLocale(profile);
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
                console.error('Speech recognition error:', e.error);
                setIsListening(false);
            };
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (transcript.trim()) {
                    handleSendMessage(transcript.trim());
                }
            };
            recognitionRef.current = recognition;
        }
    }, [handleSendMessage]);

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

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleAccept = () => {
        if (latestSuggestion) {
            onAccept(latestSuggestion);
        }
    };

    const handleMicClick = () => {
        if (isListening) recognitionRef.current?.stop();
        else recognitionRef.current?.start();
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[90] flex justify-center items-end" onClick={onClose}>
            <div
                className={`bg-slate-800 w-full max-w-2xl h-[80%] max-h-[80vh] rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between px-2 p-1 border-b border-slate-700 flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <GeminiLogo className="w-7 h-7" />
                        <h2 className="text-lg font-bold text-slate-100">{t('modals.discussTranslation.title')}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700">
                        <CloseIcon className="w-6 h-6 text-slate-400" />
                    </button>
                </header>

                <div className="flex-grow p-4 overflow-y-auto hide-scrollbar space-y-6">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-4 py-3 rounded-2xl break-words ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-lg' : 'bg-slate-700 text-slate-200 rounded-bl-lg'}`}>
                                <ChatMessageContent message={msg} onSpeak={onSpeak} basePhrase={basePhrase} onOpenWordAnalysis={onOpenWordAnalysis} />
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
                    <div ref={chatEndRef} />
                </div>

                <div className="p-1 border-t border-slate-700 flex-shrink-0 bg-slate-800/80 backdrop-blur-sm">
                    {latestSuggestion && (
                        <div className="bg-slate-700/50 p-3 rounded-lg mb-3">
                            <p className="text-sm text-slate-400">{t('modals.discussTranslation.suggestion')}:</p>
                            <p className="font-semibold text-slate-200">{latestSuggestion.native} → {latestSuggestion.learning}</p>
                            <button onClick={handleAccept} className="w-full mt-2 text-sm flex items-center justify-center py-2 bg-green-600 hover:bg-green-700 rounded-md font-bold text-white">
                                <CheckIcon className="w-4 h-4 mr-2" />
                                {t('modals.discussTranslation.accept')}
                            </button>
                        </div>
                    )}
                    <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }} className="flex items-center space-x-1 pb-1">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder={isListening ? t('modals.chat.placeholders.listening') : t('modals.discussTranslation.placeholder')}
                            className="flex-grow bg-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            disabled={isLoading}
                        />
                        <button type="button" onClick={handleMicClick} className={`p-3 rounded-lg flex-shrink-0 ${isListening ? 'bg-red-600 animate-pulse' : 'bg-slate-600'} hover:bg-slate-500`} disabled={isLoading}>
                            <MicrophoneIcon className="w-4 h-4 text-white" />
                        </button>
                        <button type="submit" disabled={!input.trim() || isLoading} className="p-3 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-slate-600">
                            <SendIcon className="w-4 h-4 text-white" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default DiscussTranslationModal;
