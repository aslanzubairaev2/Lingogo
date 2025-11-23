
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Phrase, TranslationChatResponse, Category } from '../types';
import CloseIcon from './icons/CloseIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import XCircleIcon from './icons/XCircleIcon';
import DiscussTranslationModal from './DiscussTranslationModal';
import AudioPlayer from './AudioPlayer';
import { useTranslation } from '../src/hooks/useTranslation';
import { useLanguage } from '../src/contexts/languageContext';
import { getNativeSpeechLocale } from '../services/speechService';
import { getLanguageNameInEnglish } from '../services/languageLabels';

interface EditPhraseModalProps {
    isOpen: boolean;
    onClose: () => void;
    phrase: Phrase;
    onSave: (phraseId: string, updates: Partial<Omit<Phrase, 'id'>>) => void;
    onTranslate: (nativePhrase: string) => Promise<{ learning: string }>;
    onDiscuss: (request: any) => Promise<TranslationChatResponse>;
    onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
    categories: Category[];
}

const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

const EditPhraseModal: React.FC<EditPhraseModalProps> = ({ isOpen, onClose, phrase, onSave, onTranslate, onDiscuss, onOpenWordAnalysis, categories }) => {
    const { t } = useTranslation();
    const { profile } = useLanguage();
    const [native, setNative] = useState(phrase.text.native);
    const [learning, setLearning] = useState(phrase.text.learning);
    const [selectedCategory, setSelectedCategory] = useState(phrase.category);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [isDiscussModalOpen, setIsDiscussModalOpen] = useState(false);

    const recognitionRef = useRef<any>(null);
    const debouncedNative = useDebounce(native, 1000);
    const initialNativeRef = useRef(phrase.text.native);

    useEffect(() => {
        if (isOpen) {
            setNative(phrase.text.native);
            setLearning(phrase.text.learning);
            setSelectedCategory(phrase.category);
            setError(null);
            initialNativeRef.current = phrase.text.native;
        }
    }, [isOpen, phrase]);

    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognitionAPI) {
            const recognition = new SpeechRecognitionAPI();
            recognition.lang = getNativeSpeechLocale(profile);
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
                console.error('Speech recognition error:', e.error);
                setIsListening(false);
            };
            recognition.onresult = (event) => {
                const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
                setNative(transcript);
            };
            recognitionRef.current = recognition;
        }
    }, []);

    useEffect(() => {
        if (debouncedNative && debouncedNative.trim() && debouncedNative !== initialNativeRef.current) {
            const getTranslation = async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const { learning } = await onTranslate(debouncedNative);
                    setLearning(learning);
                    initialNativeRef.current = debouncedNative;
                } catch (err) {
                    setError('Не удалось получить перевод.');
                } finally {
                    setIsLoading(false);
                }
            };
            getTranslation();
        }
    }, [debouncedNative, onTranslate]);

    const handleSave = () => {
        onSave(phrase.id, { text: { native: native, learning: learning }, category: selectedCategory });
        onClose();
    };

    const handleMicClick = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
        }
    };

    const handleDiscussionAccept = (suggestion: { native: string; learning: string }) => {
        setNative(suggestion.native);
        setLearning(suggestion.learning);
        initialNativeRef.current = suggestion.native; // Prevent re-translation
        setIsDiscussModalOpen(false);
    };

    if (!isOpen) return null;

    // Определяем динамические метки языков на основе текущего профиля
    const nativeNameRaw = t(`languages.names.${profile.native}`);
    const learningNameRaw = t(`languages.names.${profile.learning}`);
    const nativeLabel = nativeNameRaw && nativeNameRaw !== `languages.names.${profile.native}`
        ? nativeNameRaw
        : getLanguageNameInEnglish(profile.native as any);
    const learningLabel = learningNameRaw && learningNameRaw !== `languages.names.${profile.learning}`
        ? learningNameRaw
        : getLanguageNameInEnglish(profile.learning as any);

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-[80] flex justify-center items-center p-4" onClick={onClose}>
                <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                    <header className="flex items-center justify-between px-2 border-b border-slate-700">
                        <h2 className="text-lg font-bold text-slate-100">{t('modals.editPhrase.title')}</h2>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700">
                            <CloseIcon className="w-6 h-6 text-slate-400" />
                        </button>
                    </header>
                    <div className="p-2 space-y-2">
                        {error && <div className="text-center bg-red-900/50 text-red-300 p-2 rounded-md text-sm">{t('modals.editPhrase.errors.translation')}</div>}

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">{nativeLabel}</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={native}
                                    onChange={(e) => setNative(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 pr-20 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                                    {native && (
                                        <button onClick={() => setNative('')} className="p-1 text-slate-400 hover:text-white">
                                            <XCircleIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button onClick={handleMicClick} className={`p-1 ${isListening ? 'text-purple-400' : 'text-slate-400 hover:text-white'}`}>
                                        <MicrophoneIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">{learningLabel}</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={learning}
                                    readOnly
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 pr-20 text-slate-300 cursor-not-allowed"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                                    {isLoading ? (
                                        <div className="flex space-x-1 items-center justify-center p-2 text-purple-400">
                                            <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                                            <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                                            <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                        </div>
                                    ) : learning ? <AudioPlayer textToSpeak={learning} /> : null}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="category-select" className="block text-sm font-medium text-slate-400 mb-1">{t('modals.editPhrase.fields.category')}</label>
                            <select
                                id="category-select"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2  text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className=" flex justify-between items-center w-full h-full gap-2 pt-4">
                            <button
                                onClick={() => setIsDiscussModalOpen(true)}
                                className="w-full px-1 py-1 text-sm rounded-md  hover: transition-colors font-light text-white"
                            >
                                {t('modals.editPhrase.actions.discuss')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!native.trim() || !learning.trim()}
                                className="w-full px-1 py-1 rounded-md bg-purple-600 hover:bg-purple-700 transition-colors font-light text-white shadow-md disabled:opacity-50"
                            >
                                {t('modals.editPhrase.actions.save')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {phrase && <DiscussTranslationModal
                isOpen={isDiscussModalOpen}
                onClose={() => setIsDiscussModalOpen(false)}
                originalNative={phrase.text.native}
                currentLearning={learning}
                onDiscuss={onDiscuss}
                onAccept={handleDiscussionAccept}
                onOpenWordAnalysis={onOpenWordAnalysis}
            />}
        </>
    );
};

export default EditPhraseModal;
