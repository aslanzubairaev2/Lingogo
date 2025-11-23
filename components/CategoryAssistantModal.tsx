
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Category, Phrase, ProposedCard, CategoryAssistantRequest, ChatMessage, ContentPart, WordAnalysis, View } from '../types';
import CloseIcon from './icons/CloseIcon';
import SendIcon from './icons/SendIcon';
import SmartToyIcon from './icons/SmartToyIcon';
import CheckIcon from './icons/CheckIcon';
import WandIcon from './icons/WandIcon';
import SearchIcon from './icons/SearchIcon';
import ChatIcon from './icons/ChatIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import SoundIcon from './icons/SoundIcon';
import CategoryAssistantContextMenu from './CategoryAssistantContextMenu';
import ListIcon from './icons/ListIcon';
import Spinner from './Spinner';
import { useTranslation } from '../src/hooks/useTranslation';
import { useLanguage } from '../src/contexts/languageContext';
import { SPEECH_LOCALE_MAP, getNativeSpeechLocale } from '../services/speechService';

interface CategoryAssistantModalProps {
    isOpen: boolean;
    onClose: (view?: View) => void;
    category: Category;
    phrases: Phrase[];
    onGetAssistantResponse: (categoryName: string, existingPhrases: Phrase[], request: CategoryAssistantRequest) => Promise<ChatMessage['assistantResponse']>;
    onAddCards: (cards: ProposedCard[], options: { categoryId: string }) => Promise<void>;
    onOpenConfirmDeletePhrases: (phrases: Phrase[], sourceCategory: Category) => void;
    cache: { [categoryId: string]: ChatMessage[] };
    setCache: React.Dispatch<React.SetStateAction<{ [categoryId: string]: ChatMessage[] }>>;
    // Props for interactivity
    onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
    allPhrases: Phrase[];
    onCreateCard: (phraseData: { learning: string; native: string; }) => void;
    onAnalyzeWord: (phrase: Phrase, word: string) => Promise<WordAnalysis | null>;
    onOpenVerbConjugation: (infinitive: string) => void;
    onOpenNounDeclension: (noun: string, article: string) => void;
    onOpenAdjectiveDeclension: (adjective: string) => void;
    onTranslateLearningToNative: (learningPhrase: string) => Promise<{ native: string }>;
    onGoToList: () => void;
}

const AssistantChatMessageContent: React.FC<{
    msg: ChatMessage;
    category: Category;
    onAddCards: (cards: ProposedCard[], options: { categoryId: string }) => Promise<void>;
    onGoToList: () => void;
    onClose: () => void;
    // Interactivity props
    onSpeak: (text: string) => void;
    onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
    onOpenContextMenu: (target: { sentence: { learning: string, native: string }, word: string }) => void;
}> = ({ msg, category, onAddCards, onGoToList, onClose, onSpeak, onOpenWordAnalysis, onOpenContextMenu }) => {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [addedInfo, setAddedInfo] = useState<{ count: number } | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const wordLongPressTimer = useRef<number | null>(null);

    const response = msg.assistantResponse;

    useEffect(() => {
        if (response?.responseType === 'proposed_cards' && response.proposedCards && !addedInfo) {
            setSelectedIndices(new Set(response.proposedCards.map((_, i) => i)));
        }
    }, [response, addedInfo]);

    const handleAddSelected = async () => {
        if (!response?.proposedCards || isAdding) return;
        setIsAdding(true);
        const selected = response.proposedCards.filter((_, i) => selectedIndices.has(i));
        await onAddCards(selected, { categoryId: category.id });
        setAddedInfo({ count: selected.length });
        setIsAdding(false);
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

    const handleWordClick = (contextText: string, word: string, nativeText: string) => {
        const proxyPhrase: Phrase = {
            id: `proxy_assist_${contextText.slice(0, 5)}`,
            text: { learning: contextText, native: nativeText },
            category: category.id,
            masteryLevel: 0, lastReviewedAt: null, nextReviewAt: Date.now(),
            knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0,
        };
        onOpenWordAnalysis(proxyPhrase, word);
    };

    const renderClickableLearning = (part: ContentPart) => {
        if (!part.text) return null;
        return part.text.split(' ').map((word, i, arr) => (
            <span
                key={i}
                onClick={(e) => { e.stopPropagation(); const cleaned = word.replace(/[.,!?()"“”:;]/g, ''); if (cleaned) handleWordClick(part.text, cleaned, part.translation || ''); }}
                onPointerDown={(e) => handleWordPointerDown(e, { learning: part.text, native: part.translation || '' }, word)}
                onPointerUp={clearWordLongPress}
                onPointerLeave={clearWordLongPress}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); const cleaned = word.replace(/[.,!?()"“”:;]/g, ''); if (cleaned) onOpenContextMenu({ sentence: { learning: part.text, native: part.translation || '' }, word: cleaned }); }}
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded-md transition-colors"
            >
                {word}{i < arr.length - 1 ? ' ' : ''}
            </span>
        ));
    };

    if (response) {
        const { responseType, responseParts, proposedCards, phrasesToReview, phrasesForDeletion } = response;

        return (
            <div className="space-y-3">
                <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3">
                    {responseParts.map((part, index) =>
                        part.type === 'learning' || part.type === 'learning' ? (
                            <span key={index} className="inline-flex items-center align-middle bg-slate-600/50 px-1.5 py-0.5 rounded-md mx-0.5">
                                <span className="font-medium text-purple-300 not-prose">{renderClickableLearning(part)}</span>
                                <button
                                    onClick={() => onSpeak(part.text)}
                                    className="p-0.5 rounded-full hover:bg-white/20 flex-shrink-0 ml-1.5"
                                    aria-label={`Speak: ${part.text}`}
                                >
                                    <SoundIcon className="w-3.5 h-3.5 text-slate-300" />
                                </button>
                            </span>
                        ) : (
                            <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
                        )
                    )}
                </div>

                {responseType === 'proposed_cards' && proposedCards && (
                    <div className="space-y-2 pt-2 border-t border-slate-600">
                        {proposedCards.map((card, index) => (
                            <div key={index} onClick={() => { if (!addedInfo) { const newSelection = new Set(selectedIndices); if (newSelection.has(index)) newSelection.delete(index); else newSelection.add(index); setSelectedIndices(newSelection); } }} className={`p-2 rounded-md flex items-start space-x-3 transition-colors ${!addedInfo && 'cursor-pointer bg-slate-800/50 hover:bg-slate-800'}`}>
                                <div className={`mt-1 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 ${selectedIndices.has(index) ? 'bg-purple-600 border-purple-500' : 'bg-slate-900 border-slate-600'}`}>
                                    {selectedIndices.has(index) && <CheckIcon className="w-3 h-3 text-white" />}
                                </div>
                                <div>
                                    <p className="font-medium text-slate-200">{card.learning}</p>
                                    <p className="text-sm text-slate-400">{card.native}</p>
                                </div>
                            </div>
                        ))}
                        {addedInfo ? (
                            <div className="flex items-center justify-between gap-2 pt-2">
                                <p className="text-sm text-green-400">{t('assistant.modal.success.added', { count: addedInfo.count })}</p>
                                <button onClick={() => { onGoToList(); onClose(); }} className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-md flex items-center gap-2">
                                    <ListIcon className="w-4 h-4" />
                                    <span>{t('assistant.modal.actions.goToList')}</span>
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleAddSelected} disabled={selectedIndices.size === 0 || isAdding} className="w-full mt-2 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md disabled:opacity-50 flex items-center justify-center min-h-[36px]">
                                {isAdding ? <Spinner className="w-5 h-5" /> : t('assistant.modal.actions.addSelected', { count: selectedIndices.size })}
                            </button>
                        )}
                    </div>
                )}
                {(responseType === 'phrases_to_review' || responseType === 'phrases_to_delete') && (phrasesToReview || phrasesForDeletion) && (
                    <ul className="space-y-2 pt-2 border-t border-slate-600">
                        {(phrasesToReview || phrasesForDeletion)!.map((item, i) => (
                            <li key={i} className="p-2 bg-slate-800/50 rounded-md">
                                <p className="font-medium text-amber-300">"{item.learning}"</p>
                                <p className="text-sm text-slate-400 italic">{item.reason}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    }
    return <p>{msg.text}</p>;
};

const CategoryAssistantModal: React.FC<CategoryAssistantModalProps> = (props) => {
    const { t } = useTranslation();
    const { profile } = useLanguage();
    const { isOpen, onClose, category, phrases, onGetAssistantResponse, onAddCards, onOpenConfirmDeletePhrases, cache, setCache, onGoToList, ...interactiveProps } = props;

    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
    const [contextMenuTarget, setContextMenuTarget] = useState<{ sentence: { learning: string, native: string }, word: string } | null>(null);

    const recognitionRef = useRef<any>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const messages = cache[category.id] || [];

    const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
        const newMessages = updater(messages);
        setCache(prev => ({ ...prev, [category.id]: newMessages }));
    }, [messages, setCache, category.id]);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

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

    const handleRequest = useCallback(async (request: CategoryAssistantRequest) => {
        setIsLoading(true);
        if (request.type === 'user_text' && request.text) {
            updateMessages(prev => [...prev, { role: 'user', text: request.text }]);
            setInput('');
        }

        try {
            const response = await onGetAssistantResponse(category.name, phrases, request);
            updateMessages(prev => [...prev, { role: 'model', assistantResponse: response }]);
            if (response?.promptSuggestions) {
                setPromptSuggestions(response.promptSuggestions);
            }
            if (response?.responseType === 'phrases_to_delete' && response.phrasesForDeletion) {
                const learningTextsToDelete = new Set(response.phrasesForDeletion.map(p => p.learning.toLowerCase().trim()));
                const phrasesToDelete = phrases.filter(p => learningTextsToDelete.has(p.text.learning.toLowerCase().trim()));
                if (phrasesToDelete.length > 0) {
                    onOpenConfirmDeletePhrases(phrasesToDelete, category);
                }
            }
        } catch (err) {
            const errorMsg: ChatMessage = { role: 'model', text: t('assistant.modal.messages.error', { message: (err as Error).message }) };
            updateMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    }, [category, phrases, onGetAssistantResponse, updateMessages, onOpenConfirmDeletePhrases]);

    useEffect(() => {
        if (isOpen) {
            if (!cache[category.id] || cache[category.id].length === 0) {
                setIsLoading(true);
                handleRequest({ type: 'initial' });
            } else {
                const lastMessage = messages[messages.length - 1];
                setPromptSuggestions(lastMessage?.assistantResponse?.promptSuggestions || []);
                setIsLoading(false);
            }
        } else {
            recognitionRef.current?.abort();
        }
    }, [isOpen, category.id, cache]);

    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognitionAPI) {
            const recognition = new SpeechRecognitionAPI();
            recognition.lang = getNativeSpeechLocale(profile);
            recognition.interimResults = false;
            recognition.continuous = false;
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                if (event.error !== 'aborted' && event.error !== 'no-speech') console.error(`Speech recognition error:`, event.error);
                setIsListening(false);
            };
            recognition.onresult = (event) => {
                const transcript = event.results[0]?.[0]?.transcript;
                if (transcript?.trim()) {
                    setInput(prev => (prev ? prev + ' ' : '') + transcript);
                }
            };
            recognitionRef.current = recognition;
        }
    }, []);

    useEffect(scrollToBottom, [messages, isLoading]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    const handleMicClick = () => {
        if (!recognitionRef.current) return;
        if (isListening) recognitionRef.current.stop();
        else try { recognitionRef.current.start(); } catch (e) { console.error("Could not start recognition:", e); setIsListening(false); }
    };

    if (!isOpen) return null;

    const initialActions = [
        { label: t('assistant.modal.quickActions.addSimilar'), icon: <WandIcon className="w-4 h-4" />, action: () => handleRequest({ type: 'add_similar' }) },
        { label: t('assistant.modal.quickActions.checkConsistency'), icon: <SearchIcon className="w-4 h-4" />, action: () => handleRequest({ type: 'check_homogeneity' }) },
        { label: t('assistant.modal.quickActions.createDialogue'), icon: <ChatIcon className="w-4 h-4" />, action: () => handleRequest({ type: 'create_dialogue' }) },
    ];

    const currentSuggestions = promptSuggestions.length > 0 ? promptSuggestions : (messages.length <= 1 ? initialActions.map(a => a.label) : []);

    const handleSuggestionClick = (suggestion: string) => {
        const initialAction = initialActions.find(a => a.label === suggestion);
        if (initialAction) {
            initialAction.action();
        } else {
            handleRequest({ type: 'user_text', text: suggestion });
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end" onClick={() => onClose()}>
                <div className={`bg-slate-800 w-full max-w-2xl h-[90%] max-h-[90vh] rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`} onClick={e => e.stopPropagation()}>
                    <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                        <div className="flex items-center space-x-3">
                            <SmartToyIcon className="w-6 h-6 text-purple-400" />
                            <h2 className="text-lg font-bold text-slate-100">{t('assistant.modal.title', { name: category.name })}</h2>
                        </div>
                        <button onClick={() => onClose()} className="p-2 rounded-full hover:bg-slate-700">
                            <CloseIcon className="w-6 h-6 text-slate-400" />
                        </button>
                    </header>

                    <div className="flex-grow p-4 overflow-y-auto hide-scrollbar">
                        <div className="space-y-6">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[90%] px-4 py-3 rounded-2xl break-words ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-lg' : 'bg-slate-700 text-slate-200 rounded-bl-lg'}`}>
                                        <AssistantChatMessageContent
                                            msg={msg}
                                            category={category}
                                            onAddCards={onAddCards}
                                            onGoToList={onGoToList}
                                            onClose={() => onClose()}
                                            onSpeak={(text) => onSpeak(text)}
                                            onOpenWordAnalysis={interactiveProps.onOpenWordAnalysis}
                                            onOpenContextMenu={setContextMenuTarget}
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
                        {!isLoading && currentSuggestions.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-2 mb-3">
                                {currentSuggestions.map(suggestion => (
                                    <button key={suggestion} onClick={() => handleSuggestionClick(suggestion)} className="px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-full transition-colors flex items-center justify-center gap-1.5">
                                        {initialActions.find(a => a.label === suggestion)?.icon}
                                        <span>{suggestion}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <form onSubmit={e => { e.preventDefault(); handleRequest({ type: 'user_text', text: input }); }} className="flex items-end space-x-2">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRequest({ type: 'user_text', text: input }); } }}
                                placeholder={isListening ? t('assistant.modal.input.listening') : t('assistant.modal.input.placeholder')}
                                className="w-full bg-slate-700 rounded-lg p-3 text-slate-200 resize-none max-h-32 min-h-12 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                rows={1}
                                disabled={isLoading}
                            />
                            <button type="button" onClick={handleMicClick} disabled={isLoading} aria-label={isListening ? 'Stop' : 'Record'} className={`p-3 rounded-lg transition-colors flex-shrink-0 ${isListening ? 'bg-red-600 animate-pulse' : 'bg-slate-600 hover:bg-slate-500'} disabled:bg-slate-600`}>
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
                <CategoryAssistantContextMenu
                    target={contextMenuTarget}
                    onClose={() => setContextMenuTarget(null)}
                    onGenerateMore={(prompt) => handleRequest({ type: 'user_text', text: prompt })}
                    onSpeak={(text) => onSpeak(text)}
                    {...interactiveProps}
                />
            )}
        </>
    );
};

export default CategoryAssistantModal;
