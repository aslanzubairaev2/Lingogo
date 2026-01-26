import React, { useState } from 'react';

import { Category, Phrase, ProposedCard } from '../types.ts';
import FolderMoveIcon from './icons/FolderMoveIcon';
import Spinner from './Spinner';
import { t } from 'i18next';

interface MoveOrSkipModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewData: {
    duplicates: { existingPhrase: Phrase; proposedCard: ProposedCard }[];
    newCards: ProposedCard[];
    targetCategory: Category;
  } | null;
  categories: Category[];
  onMove: (phraseIdsToMove: string[], newCards: ProposedCard[], targetCategory: Category) => Promise<void>;
  onAddOnlyNew: (newCards: ProposedCard[], targetCategory: Category) => Promise<void>;
}

const MoveOrSkipModal: React.FC<MoveOrSkipModalProps> = ({
  isOpen,
  onClose,
  reviewData,
  categories,
  onMove,
  onAddOnlyNew,
}) => {
  const [isLoading, setIsLoading] = useState<'move' | 'add' | false>(false);

  if (!isOpen || !reviewData) return null;

  const { duplicates, newCards, targetCategory } = reviewData;
  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name || id;

  const handleMove = async () => {
    setIsLoading('move');
    const idsToMove = duplicates.map((d) => d.existingPhrase.id);
    await onMove(idsToMove, newCards, targetCategory);
    setIsLoading(false);
  };

  const handleAddOnlyNew = async () => {
    setIsLoading('add');
    await onAddOnlyNew(newCards, targetCategory);
    setIsLoading(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[80] flex justify-center items-center backdrop-blur-sm p-4 animate-fade-in"
      onClick={isLoading ? undefined : onClose}
    >
      <div
        className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg m-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-start p-4 border-b border-slate-700 space-x-3">
          <div className="w-10 h-10 rounded-full bg-amber-900/50 flex items-center justify-center flex-shrink-0">
            <FolderMoveIcon className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">{t('modals.moveOrSkip.title')}</h2>
        </header>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto hide-scrollbar">
          <p className="text-slate-300">
            {t('modals.moveOrSkip.body', {
              count: duplicates.length,
              cards: t(
                `modals.moveOrSkip.cards.${duplicates.length === 1 ? 'one' : duplicates.length > 1 && duplicates.length < 5 ? 'few' : 'many'}`
              ),
            })}
            {newCards.length > 0 && t('modals.moveOrSkip.newCards', { count: newCards.length })}
          </p>
          <div className="bg-slate-900/50 p-3 rounded-lg max-h-48 overflow-y-auto hide-scrollbar">
            <ul className="space-y-2">
              {duplicates.map(({ existingPhrase }, index) => (
                <li key={index} className="text-sm text-slate-400">
                  {t('modals.moveOrSkip.listItem', {
                    phrase: existingPhrase.text.learning,
                    category: getCategoryName(existingPhrase.category),
                  })}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-slate-300">{t('modals.moveOrSkip.question')}</p>
        </div>

        <footer className="p-4 border-t border-slate-700 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleMove}
            disabled={!!isLoading}
            className="w-full px-4 py-3 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading === 'move' ? (
              <Spinner className="w-5 h-5" />
            ) : (
              t('modals.moveOrSkip.actions.move', { count: duplicates.length, category: targetCategory.name })
            )}
          </button>
          {newCards.length > 0 && (
            <button
              onClick={handleAddOnlyNew}
              disabled={!!isLoading}
              className="w-full px-4 py-3 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {isLoading === 'add' ? (
                <Spinner className="w-5 h-5" />
              ) : (
                t('modals.moveOrSkip.actions.addOnlyNew', { count: newCards.length })
              )}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={!!isLoading}
            className="w-full sm:w-auto px-4 py-3 rounded-md bg-transparent hover:bg-slate-700/50 text-slate-300 font-medium transition-colors disabled:opacity-50"
          >
            {t('modals.moveOrSkip.actions.cancel')}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default MoveOrSkipModal;
