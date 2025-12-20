
import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import type { Phrase, WordAnalysis, PhraseCategory, Category } from '../types';
import PhraseCard from '../components/PhraseCard';
import PhraseCardSkeleton from '../components/PhraseCardSkeleton';
import PracticePageContextMenu from '../components/PracticePageContextMenu';
import CheckIcon from '../components/icons/CheckIcon';
import * as srsService from '../services/srsService';
import * as cacheService from '../services/cacheService';
import { playCorrectSound } from '../services/soundService';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';
import ArrowRightIcon from '../components/icons/ArrowRightIcon';
import ChevronDownIcon from '../components/icons/ChevronDownIcon';
import PlusIcon from '../components/icons/PlusIcon';
import SettingsIcon from '../components/icons/SettingsIcon';
import { useTranslation } from '../src/hooks/useTranslation.ts';
import { useLanguage } from '../src/contexts/languageContext';
import { getSpeechLocale } from '../src/i18n/languageMeta';

const SWIPE_THRESHOLD = 50; // pixels

type AnimationDirection = 'left' | 'right';
interface AnimationState {
    key: string;
    direction: AnimationDirection;
}

interface PracticePageProps {
    currentPhrase: Phrase | null;
    isAnswerRevealed: boolean;
    onSetIsAnswerRevealed: React.Dispatch<React.SetStateAction<boolean>>;
    isCardEvaluated: boolean;
    animationState: AnimationState;
    isExiting: boolean;
    unmasteredCount: number;
    currentPoolCount: number;
    fetchNewPhrases: (count?: number) => Promise<void>;
    isLoading: boolean;
    error: string | null;
    isGenerating: boolean;
    apiProviderAvailable: boolean;
    onUpdateMastery: (action: 'know' | 'forgot' | 'dont_know') => Promise<boolean>;
    onUpdateMasteryWithoutUI: (phrase: Phrase, action: 'know' | 'forgot' | 'dont_know') => void;
    onContinue: () => void;
    onSwipeRight: () => void;
    onOpenChat: (phrase: Phrase) => void;
    onOpenDeepDive: (phrase: Phrase) => void;
    onOpenMovieExamples: (phrase: Phrase) => void;
    onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
    onGetWordTranslation: (nativePhrase: string, learningPhrase: string, nativeWord: string) => Promise<{ learningTranslation: string }>;
    onOpenVerbConjugation: (infinitive: string) => void;
    onOpenNounDeclension: (noun: string, article: string) => void;
    onOpenAdjectiveDeclension: (adjective: string) => void;
    onOpenSentenceChain: (phrase: Phrase) => void;
    onOpenImprovePhrase: (phrase: Phrase) => void;
    onOpenLearningAssistant: (phrase: Phrase) => void;
    onOpenVoiceWorkspace: (phrase: Phrase) => void;
    onDeletePhrase: (phraseId: string) => void;
    onGoToList: (phrase: Phrase) => void;
    onOpenDiscussTranslation: (phrase: Phrase) => void;
    settings: {
        soundEffects: boolean;
        autoSpeak: boolean;
        enabledCategories: Record<PhraseCategory, boolean>;
    };
    masteryButtonUsage: { know: number; forgot: number; dont_know: number };
    allPhrases: Phrase[];
    onCreateCard: (phraseData: { learning: string; native: string; }) => void;
    onAnalyzeWord: (phrase: Phrase, word: string) => Promise<WordAnalysis | null>;
    isWordAnalysisLoading: boolean;
    cardActionUsage: { [key: string]: number };
    onLogCardActionUsage: (button: string) => void;
    cardHistoryLength: number;
    practiceCategoryFilter: 'all' | PhraseCategory;
    setPracticeCategoryFilter: (filter: 'all' | PhraseCategory) => void;
    onMarkPhraseAsSeen: (phraseId: string) => void;
    categories: Category[];
    onAddCategory: () => void;
    onOpenCategoryManager: () => void;
    unmasteredCountsByCategory: Record<string, number>;
    onOpenSmartImport: () => void;
}

const CategoryFilter: React.FC<{
    currentFilter: 'all' | PhraseCategory;
    onFilterChange: (filter: 'all' | PhraseCategory) => void;
    enabledCategories: Record<PhraseCategory, boolean>;
    currentPhraseCategory: PhraseCategory | null;
    categories: Category[];
    onAddCategory: () => void;
    onManageCategories: () => void;
    counts: Record<string, number>;
    totalUnmastered: number;
}> = ({ currentFilter, onFilterChange, enabledCategories, currentPhraseCategory, categories, onAddCategory, onManageCategories, counts, totalUnmastered }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const getCategoryNameById = (id: string) => categories.find(c => c.id === id)?.name || id;

    const categoryName = currentFilter === 'all'
        ? t('practice.states.allCategories')
        : getCategoryNameById(currentFilter);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (filter: 'all' | PhraseCategory) => {
        onFilterChange(filter);
        setIsOpen(false);
    };

    const handleAddCategory = () => {
        onAddCategory();
        setIsOpen(false);
    };

    const handleManageCategories = () => {
        onManageCategories();
        setIsOpen(false);
    };

    const visibleCategories = categories.filter(cat => enabledCategories[cat.id]);

    return (
        <div ref={dropdownRef} className="relative w-full max-w-sm mx-auto mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-center px-4 py-2 bg-transparent hover:bg-slate-700/80 rounded-lg text-slate-300 transition-colors"
            >
                <span className="font-semibold mr-2">
                    {currentFilter === 'all' && currentPhraseCategory ? getCategoryNameById(currentPhraseCategory) : categoryName}
                </span>
                <ChevronDownIcon className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 w-full bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-20 animate-fade-in flex flex-col">
                    <ul className="p-1 max-h-60 overflow-y-auto hide-scrollbar">
                        <li>
                            <button onClick={() => handleSelect('all')} className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-600 rounded-md transition-colors flex justify-between items-center">
                                <span>{t('practice.states.allCategories')}</span>
                                <span className="text-xs font-semibold text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded-full">{totalUnmastered}</span>
                            </button>
                        </li>
                        {visibleCategories.map(cat => (
                            <li key={cat.id}>
                                <button onClick={() => handleSelect(cat.id)} className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-600 rounded-md transition-colors flex justify-between items-center">
                                    <span className="truncate pr-2">{cat.name}</span>
                                    <span className="text-xs font-semibold text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded-full flex-shrink-0">{counts[cat.id] || 0}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="p-1 border-t border-slate-600 flex-shrink-0 grid grid-cols-2 gap-1">
                        <button onClick={handleAddCategory} className="flex items-center justify-center gap-2 px-2 py-2 text-slate-300 hover:bg-slate-600 rounded-md transition-colors text-sm font-semibold">
                            <PlusIcon className="w-4 h-4" />
                            <span>{t('practice.states.add')}</span>
                        </button>
                        <button onClick={handleManageCategories} className="flex items-center justify-center gap-2 px-2 py-2 text-slate-300 hover:bg-slate-600 rounded-md transition-colors text-sm font-semibold">
                            <SettingsIcon className="w-4 h-4" />
                            <span>{t('practice.states.manage')}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


const PracticePage: React.FC<PracticePageProps> = (props) => {
    const {
        currentPhrase, isAnswerRevealed, onSetIsAnswerRevealed, isCardEvaluated, animationState, isExiting, unmasteredCount, currentPoolCount,
        fetchNewPhrases, isLoading, error, isGenerating, apiProviderAvailable,
        onUpdateMastery, onUpdateMasteryWithoutUI, onContinue, onSwipeRight,
        onOpenChat, onOpenDeepDive, onOpenMovieExamples, onOpenWordAnalysis, onGetWordTranslation,
        onOpenVerbConjugation, onOpenNounDeclension, onOpenAdjectiveDeclension,
        onOpenSentenceChain, onOpenImprovePhrase, onOpenLearningAssistant,
        onOpenVoiceWorkspace, onDeletePhrase, onGoToList, onOpenDiscussTranslation,
        settings, masteryButtonUsage, allPhrases, onCreateCard, onAnalyzeWord,
        isWordAnalysisLoading, cardActionUsage, onLogCardActionUsage,
        cardHistoryLength, practiceCategoryFilter, setPracticeCategoryFilter, onMarkPhraseAsSeen,
        categories, onAddCategory, onOpenCategoryManager, unmasteredCountsByCategory, onOpenSmartImport
    } = props;
    const { t } = useTranslation();
    const { profile } = useLanguage();


    const [contextMenuTarget, setContextMenuTarget] = useState<{ phrase: Phrase; word?: string } | null>(null);
    const [flashState, setFlashState] = useState<'green' | null>(null);
    const touchStartRef = useRef<number | null>(null);
    const touchMoveRef = useRef<number | null>(null);

    useEffect(() => {
        if (currentPhrase && currentPhrase.isNew) {
            onMarkPhraseAsSeen(currentPhrase.id);
        }
    }, [currentPhrase, onMarkPhraseAsSeen]);

    const speak = useCallback((text: string, lang: 'de-DE' | 'ru-RU') => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            // Использовать реальный язык из профиля вместо переданного параметра
            utterance.lang = getSpeechLocale(profile.learning);
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }, [profile.learning]);

    const handleTouchStart = (e: React.TouchEvent) => { touchMoveRef.current = null; touchStartRef.current = e.targetTouches[0].clientX; };
    const handleTouchMove = (e: React.TouchEvent) => { touchMoveRef.current = e.targetTouches[0].clientX; };
    const handleTouchEnd = () => {
        if (touchStartRef.current !== null && touchMoveRef.current !== null) {
            const deltaX = touchMoveRef.current - touchStartRef.current;
            if (deltaX < -SWIPE_THRESHOLD) onContinue();
            else if (deltaX > SWIPE_THRESHOLD) onSwipeRight();
        }
        touchStartRef.current = null; touchMoveRef.current = null;
    };

    const handleKnowClick = useCallback(async () => {
        if (isExiting || !currentPhrase) return;

        setFlashState('green');
        const leechModalShown = await onUpdateMastery('know');

        // Если было показано модальное окно "пиявки", оно само управляет переходом.
        // В противном случае, переходим к следующей карточке через задержку.
        if (!leechModalShown) {
            setTimeout(() => {
                onContinue();
            }, 600);
        }
    }, [isExiting, currentPhrase, onUpdateMastery, onContinue]);

    const renderContent = () => {
        if (isLoading) return <PhraseCardSkeleton />;
        if (error) return <div className="text-center bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg max-w-md mx-auto"><p className="font-semibold">{t('practice.states.errorOccurred')}</p><p className="text-sm">{error}</p></div>;

        if (!currentPhrase) {
            if (unmasteredCount === 0 && practiceCategoryFilter === 'all') {
                return (
                    <div className="text-center text-slate-400 p-4">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('practice.states.congratulations')}</h2>
                        <p>{t('practice.states.learnedAllSelected')}</p>
                        <button onClick={onOpenSmartImport} disabled={!apiProviderAvailable} className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-md text-white font-bold transition-colors disabled:opacity-50">{t('fab.smartImport')}</button>
                    </div>
                );
            }
            if (currentPoolCount === 0) {
                const category = categories.find(c => c.id === practiceCategoryFilter);
                const categoryName = category?.name || 'этой';

                if (category?.isFoundational) {
                    return (
                        <div className="text-center text-slate-400 p-4">
                            <h2 className="text-2xl font-bold text-white mb-4">{t('practice.states.excellent')}</h2>
                            <p>{t('practice.states.foundationCompleted', { categoryName })}</p>
                            <p className="mt-2 text-sm">{t('practice.states.noMoreCards')}</p>
                            <button onClick={() => setPracticeCategoryFilter('all')} className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-md text-white font-bold transition-colors">
                                {t('practice.states.practiceOtherCategories')}
                            </button>
                        </div>
                    );
                }

                return (
                    <div className="text-center text-slate-400 p-4">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('practice.states.empty')}</h2>
                        <p>{t('practice.states.noUnlearnedInCategory', { categoryName })}</p>
                        <button onClick={() => setPracticeCategoryFilter('all')} className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-md text-white font-bold transition-colors">
                            {t('practice.states.practiceAllCategories')}
                        </button>
                    </div>
                );
            } else {
                // This case means there are cards in the pool, but none are due for review right now.
                return (
                    <div className="text-center text-slate-400 p-4">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('practice.states.allForToday')}</h2>
                        <p>{t('practice.states.completedAllAvailable')}</p>
                        <p className="mt-2 text-sm">{t('practice.states.comeBackLater')}</p>
                        <button onClick={() => setPracticeCategoryFilter('all')} className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-md text-white font-bold transition-colors">
                            {t('practice.states.practiceOtherCategories')}
                        </button>
                    </div>
                );
            }
        }

        const animationClass = isExiting
            ? (animationState.direction === 'right' ? 'card-exit-left' : 'card-exit-right')
            : (animationState.direction === 'right' ? 'card-enter-right' : 'card-enter-left');

        return (
            <div className="relative w-full max-w-2xl flex items-center justify-center">
                {currentPhrase && (
                    <>
                        <button
                            onClick={onSwipeRight}
                            disabled={cardHistoryLength === 0}
                            className="hidden md:flex absolute top-1/2- left-0 -translate-y-1/2 w-12 h-12 bg-slate-800/50 hover:bg-slate-700/80 rounded-full items-center justify-center transition-colors text-slate-300 hover:text-white z-10 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Предыдущая карта"
                        >
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                        <button
                            onClick={onContinue}
                            disabled={unmasteredCount <= 1}
                            className="hidden md:flex absolute top-1/2- right-0 -translate-y-1/2 w-12 h-12 bg-slate-800/50 hover:bg-slate-700/80 rounded-full items-center justify-center transition-colors text-slate-300 hover:text-white z-10 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Следующая карта"
                        >
                            <ArrowRightIcon className="w-6 h-6" />
                        </button>
                    </>
                )}
                <div className="flex flex-col items-center w-full px-2">
                    <div
                        id="practice-card-container"
                        className="w-full max-w-md h-64 relative"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div key={animationState.key} className={`absolute inset-0 ${animationClass}`}>
                            <PhraseCard
                                phrase={currentPhrase}
                                onSpeak={speak}
                                isFlipped={isAnswerRevealed}
                                onFlip={() => onSetIsAnswerRevealed(true)}
                                onOpenChat={onOpenChat}
                                onOpenDeepDive={onOpenDeepDive}
                                onOpenMovieExamples={onOpenMovieExamples}
                                onWordClick={onOpenWordAnalysis}
                                onGetWordTranslation={onGetWordTranslation}
                                onOpenSentenceChain={onOpenSentenceChain}
                                onOpenImprovePhrase={onOpenImprovePhrase}
                                onOpenContextMenu={setContextMenuTarget}
                                onOpenVoicePractice={onOpenVoiceWorkspace}
                                onOpenLearningAssistant={onOpenLearningAssistant}
                                isWordAnalysisLoading={isWordAnalysisLoading}
                                cardActionUsage={cardActionUsage}
                                onLogCardActionUsage={onLogCardActionUsage}
                                flash={flashState}
                                onFlashEnd={() => setFlashState(null)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-center items-center mt-3 h-12 max-w-md w-full">
                        {!isAnswerRevealed && currentPhrase && (
                            <div className="flex items-center justify-center space-x-4 animate-fade-in w-full">
                                <button
                                    onClick={onContinue}
                                    disabled={isExiting}
                                    className="flex-grow p-2 rounded-3xl font-light text-sm text-slate-300 shadow-md transition-colors bg-slate-800 hover:bg-slate-500"
                                >
                                    {t('practice.actions.skip')}
                                </button>
                                <button
                                    onClick={handleKnowClick}
                                    disabled={isExiting}
                                    className="flex-grow p-2 rounded-3xl font-light text-sm text-white shadow-md transition-colors bg-green-600 hover:bg-green-700"
                                >
                                    {t('practice.actions.know')}
                                </button>
                            </div>
                        )}
                        {/* This button appears ONLY when the card is manually flipped to check the answer */}
                        {isAnswerRevealed && !isCardEvaluated && (
                            <button
                                onClick={onContinue}
                                disabled={isExiting}
                                className="p-2 rounded-lg font-semibold text-white shadow-md transition-all duration-300 bg-purple-600 hover:bg-purple-700 animate-fade-in"
                            >
                                {t('practice.states.continue')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <CategoryFilter
                currentFilter={practiceCategoryFilter}
                onFilterChange={setPracticeCategoryFilter}
                enabledCategories={settings.enabledCategories}
                currentPhraseCategory={currentPhrase?.category || null}
                categories={categories}
                onAddCategory={onAddCategory}
                onManageCategories={onOpenCategoryManager}
                counts={unmasteredCountsByCategory}
                totalUnmastered={unmasteredCount}
            />
            {renderContent()}
            {contextMenuTarget && (
                <PracticePageContextMenu
                    target={contextMenuTarget}
                    onClose={() => setContextMenuTarget(null)}
                    onDelete={onDeletePhrase}
                    onGoToList={onGoToList}
                    onDiscuss={onOpenDiscussTranslation}
                    onCreateCard={onCreateCard}
                    onAnalyzeWord={onAnalyzeWord}
                    onOpenWordAnalysis={onOpenWordAnalysis}
                    onOpenVerbConjugation={onOpenVerbConjugation}
                    onOpenNounDeclension={onOpenNounDeclension}
                    onOpenAdjectiveDeclension={onOpenAdjectiveDeclension}
                />
            )}
        </>
    );
};

export default PracticePage;