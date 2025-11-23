import React, { useState, useEffect, useCallback } from 'react';
import type { Phrase } from '../types';
import CloseIcon from './icons/CloseIcon';
import RefreshIcon from './icons/RefreshIcon';
import CheckIcon from './icons/CheckIcon';
import MessageQuestionIcon from './icons/MessageQuestionIcon';
import { useTranslation } from '../src/hooks/useTranslation';

interface Suggestion {
  suggestedLearning: string;
  explanation: string;
}

interface ImprovePhraseModalProps {
  isOpen: boolean;
  onClose: () => void;
  phrase: Phrase;
  onGenerateImprovement: (originalNative: string, currentLearning: string) => Promise<Suggestion>;
  onPhraseImproved: (phraseId: string, newLearning: string) => void;
  onOpenDiscussion: (phrase: Phrase) => void;
}

const ImprovePhraseSkeleton: React.FC = () => (
  <div className="w-full flex flex-col items-center justify-center space-y-5 animate-pulse">
    <div className="w-full text-center space-y-2">
      <div className="h-4 bg-slate-600 rounded w-1/2 mx-auto"></div>
      <div className="h-8 bg-slate-600 rounded w-3/4 mx-auto"></div>
    </div>
    <div className="w-full flex flex-col space-y-3">
      <div className="h-12 bg-purple-600/50 rounded-lg"></div>
      <div className="h-10 bg-slate-600/50 rounded-lg"></div>
    </div>
  </div>
);


const ImprovePhraseModal: React.FC<ImprovePhraseModalProps> = ({ isOpen, onClose, phrase, onGenerateImprovement, onPhraseImproved, onOpenDiscussion }) => {
  const { t } = useTranslation();
  const [currentSuggestion, setCurrentSuggestion] = useState<Suggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLearning, setCurrentLearning] = useState(phrase.text.learning);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setCurrentSuggestion(null);
      setIsLoading(false);
      setError(null);
      setCurrentLearning(phrase.text.learning);
    }
  }, [isOpen, phrase]);

  const handleGenerate = useCallback(async (learningToImprove: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await onGenerateImprovement(phrase.text.native, learningToImprove);
      setCurrentSuggestion(result);
      setCurrentLearning(result.suggestedLearning); // Update current Learning for iterative improvement
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось получить улучшение.');
    } finally {
      setIsLoading(false);
    }
  }, [onGenerateImprovement, phrase.text.native]);

  const handleUse = () => {
    if (currentSuggestion) {
      onPhraseImproved(phrase.id, currentSuggestion.suggestedLearning);
      onClose();
    }
  };

  const handleImprove = () => {
    if (currentSuggestion) {
      handleGenerate(currentSuggestion.suggestedLearning);
    }
  };

  const renderInitialState = () => (
    <>
      <div className="w-full text-center">
        <p className="text-sm text-slate-400 mb-1">{phrase.text.native}</p>
        <p className="text-2xl font-bold text-slate-100">{currentLearning}</p>
      </div>
      <div className="w-full flex flex-col space-y-3">
        <button
          onClick={() => handleGenerate(currentLearning)}
          className="flex items-center justify-center w-full px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors font-semibold text-white shadow-md"
        >
          {t('modals.improvePhrase.actions.suggest')}
        </button>
        <button
          onClick={() => onOpenDiscussion(phrase)}
          className="flex items-center justify-center w-full px-6 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 transition-colors font-semibold text-white text-sm"
        >
          <MessageQuestionIcon className="w-4 h-4 mr-2" />
          {t('modals.improvePhrase.actions.discuss')}
        </button>
      </div>
    </>
  );

  const renderSuggestionState = () => (
    <>
      <div className="w-full text-center bg-slate-700 p-4 rounded-lg">
        <p className="text-2xl font-bold text-white">{currentSuggestion?.suggestedLearning}</p>
      </div>
      <div className="w-full text-left text-sm text-slate-300 p-4 rounded-lg bg-slate-900/50 border-l-2 border-purple-400">
        <p className="font-semibold mb-1 text-white">{t('modals.improvePhrase.reasoning')}</p>
        <p>{currentSuggestion?.explanation}</p>
      </div>
      {error && <div className="text-center bg-red-900/50 border border-red-700 text-red-300 p-2 rounded-lg text-sm"><p>{t('modals.improvePhrase.errors.generic')}</p></div>}
      <div className="grid grid-cols-5 gap-3 w-full">
        <button
          onClick={onClose}
          className="flex items-center justify-center px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 transition-colors font-semibold text-white shadow-md text-sm"
          aria-label="Отмена"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
        <button
          onClick={handleImprove}
          className="col-span-3 flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors font-semibold text-white shadow-md text-sm"
        >
          <RefreshIcon className="w-4 h-4 mr-1.5" />
          {t('modals.improvePhrase.improve')}
        </button>
        <button
          onClick={handleUse}
          className="flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 transition-colors font-semibold text-white shadow-md text-sm"
          aria-label="Использовать предложенный вариант"
        >
          <CheckIcon className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex justify-center items-center backdrop-blur-sm p-4" onClick={isLoading ? undefined : onClose}>
      <div
        className="relative w-full max-w-md bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col items-center justify-center p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full hover:bg-slate-700/80 disabled:opacity-50" disabled={isLoading}>
          <CloseIcon className="w-5 h-5 text-slate-400" />
        </button>

        {isLoading ? (
          <ImprovePhraseSkeleton />
        ) : currentSuggestion ? (
          renderSuggestionState()
        ) : (
          renderInitialState()
        )}
      </div>
    </div>
  );
};

export default ImprovePhraseModal;