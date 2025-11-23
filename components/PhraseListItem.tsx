import React, { useState, useRef, useEffect } from 'react';
import type { Phrase, PhraseCategory, Category } from '../types';
import ProgressBar from './ProgressBar';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import * as srsService from '../services/srsService';
import GraduationCapIcon from './icons/GraduationCapIcon';
import { useTranslation } from '../src/hooks/useTranslation';

interface PhraseListItemProps {
    phrase: Phrase;
    onEdit: (phrase: Phrase) => void;
    onDelete: (phraseId: string) => void;
    isDuplicate: boolean;
    isHighlighted: boolean;
    onPreview: (phrase: Phrase) => void;
    onStartPractice: (phrase: Phrase) => void;
    onCategoryClick: (category: PhraseCategory) => void;
    categoryInfo?: Category;
    allCategories: Category[];
    onUpdatePhraseCategory: (phraseId: string, newCategoryId: string) => void;
    onOpenWordAnalysis?: (phrase: Phrase, word: string) => void;
}

const PhraseListItem: React.FC<PhraseListItemProps> = React.memo(({ phrase, onEdit, onDelete, isDuplicate, isHighlighted, onPreview, onStartPractice, onCategoryClick, categoryInfo, allCategories, onUpdatePhraseCategory, onOpenWordAnalysis }) => {
    const { t } = useTranslation();
    const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit(phrase);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(phrase.id);
    };

    const handlePracticeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onStartPractice(phrase);
    };

    const handleCategoryChange = (e: React.MouseEvent, newCategoryId: string) => {
        e.stopPropagation();
        onUpdatePhraseCategory(phrase.id, newCategoryId);
        setIsCategoryPopoverOpen(false);
    };

    const handleWordClick = (e: React.MouseEvent, word: string) => {
        if (!onOpenWordAnalysis) return;
        e.stopPropagation();
        const cleanedWord = word.replace(/[.,!?()""":;]/g, '');
        if (cleanedWord) {
            onOpenWordAnalysis(phrase, cleanedWord);
        }
    };

    const renderClickableLearning = (text: string) => {
        if (!onOpenWordAnalysis || !text) return <span>{text}</span>;
        return text.split(' ').map((word, i, arr) => (
            <span
                key={i}
                onClick={(e) => handleWordClick(e, word)}
                className="cursor-pointer hover:bg-white/20 px-0.5 rounded transition-colors"
            >
                {word}{i < arr.length - 1 ? ' ' : ''}
            </span>
        ));
    };

    useEffect(() => {
        if (!isCategoryPopoverOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsCategoryPopoverOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCategoryPopoverOpen]);


    const getRingClass = () => {
        if (isHighlighted) return 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900';
        if (isDuplicate) return 'ring-2 ring-amber-500';
        return '';
    }

    const info = categoryInfo || { id: 'general', name: t('categories.names.general'), color: 'bg-slate-500', isFoundational: false };

    return (
        <li
            id={`phrase-item-${phrase.id}`}
            className={`relative bg-slate-400/10 backdrop-blur-xl border border-white/20 px-2 pt-0 rounded-lg flex items-start space-x-4 cursor-pointer hover:bg-slate-400/20 transition-all duration-300 ${getRingClass()} ${isCategoryPopoverOpen ? 'z-30' : 'z-10'}`}
            onClick={() => onPreview(phrase)}
        >
            {phrase.isNew && (
                <div className="absolute -top-2 -left-2 px-2 py-0.5 text-xs font-bold text-slate-800 bg-yellow-300 rounded-full shadow-lg transform -rotate-6">
                    {t('phraseList.item.badges.new')}
                </div>
            )}
            <div className="flex-grow">
                <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-slate-100">{phrase.text.native}</p>
                </div>
                <p className="text-sm text-slate-400">{renderClickableLearning(phrase.text.learning)}</p>
                <div className="mt-2 mb-1">
                    <ProgressBar current={phrase.masteryLevel} max={srsService.MAX_MASTERY_LEVEL} />
                </div>

            </div>

            <div className="flex flex-col self-stretch justify-between">

                <div className="flex-shrink-0 flex items-center space-x-1">
                    <div className="relative group">
                        <button
                            onClick={handlePracticeClick}
                            className="p-2 text-slate-400 hover:text-green-400 transition-colors"
                            aria-label={t('phraseList.item.actions.practice')}
                        >
                            <GraduationCapIcon className="w-5 h-5" />
                        </button>
                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900/90 backdrop-blur-sm text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 truncate max-w-40">
                            {t('phraseList.item.actions.practice')}
                        </div>
                    </div>
                    <div className="relative group">
                        <button
                            onClick={handleEditClick}
                            className="p-2 text-slate-400 hover:text-blue-400 transition-colors"
                            aria-label={t('phraseList.item.actions.edit')}
                        >
                            <PencilIcon className="w-5 h-5" />
                        </button>
                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900/90 backdrop-blur-sm text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 truncate max-w-40">
                            {t('phraseList.item.actions.edit')}
                        </div>
                    </div>
                    <div className="relative group">
                        <button
                            onClick={handleDeleteClick}
                            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                            aria-label={t('phraseList.item.actions.delete')}
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900/90 backdrop-blur-sm text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 truncate max-w-40">
                            {t('phraseList.item.actions.delete')}
                        </div>
                    </div>
                </div>


                <div className="relative flex justify-end flex-grow items-center " ref={popoverRef}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCategoryPopoverOpen(prev => !prev);
                        }}
                        className={`px-2 py-0.5 text-xs font-light text-white rounded-full ${info.color} transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-white max-w-32 truncate whitespace-nowrap`}
                        aria-label={t('phraseList.item.categoryButton', { name: info.name })}
                    >
                        {info.name}
                    </button>
                    {isCategoryPopoverOpen && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-slate-700 border border-slate-600 rounded-md shadow-lg z-20 animate-fade-in p-1">
                            <ul>
                                {allCategories.map(cat => (
                                    <li key={cat.id}>
                                        <button
                                            onClick={(e) => handleCategoryChange(e, cat.id)}
                                            className="w-full text-left px-3 py-1.5 text-slate-200 text-sm hover:bg-slate-600 rounded-md transition-colors truncate whitespace-nowrap"
                                        >
                                            {cat.name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

            </div>

        </li>
    );
});

export default PhraseListItem;
