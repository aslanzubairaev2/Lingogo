import React, { useEffect } from 'react';
import type { Phrase, PhraseEvaluation } from '../types';
import CheckIcon from './icons/CheckIcon';
import XCircleIcon from './icons/XCircleIcon';
import AudioPlayer from './AudioPlayer';
import { useTranslation } from '../src/hooks/useTranslation';

interface PracticeResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCorrect: boolean;
  phrase: Phrase | null;
  evaluation: PhraseEvaluation | null;
  onOpenWordAnalysis?: (phrase: Phrase, word: string) => void;
}

const PracticeResultModal: React.FC<PracticeResultModalProps> = ({ isOpen, onClose, isCorrect, phrase, evaluation, onOpenWordAnalysis }) => {
  const { t } = useTranslation();

  const handleWordClick = (e: React.MouseEvent, word: string) => {
    if (!onOpenWordAnalysis || !phrase) return;
    e.stopPropagation();
    const cleanedWord = word.replace(/[.,!?()""":;]/g, '');
    if (cleanedWord) {
      onOpenWordAnalysis(phrase, cleanedWord);
    }
  };

  const renderClickableLearning = (text: string) => {
    if (!onOpenWordAnalysis || !text) return text;
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
    if (isOpen && isCorrect) {
      const timer = setTimeout(onClose, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isCorrect, onClose]);

  if (!isOpen || !phrase) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center backdrop-blur-sm p-4" onClick={isCorrect ? undefined : onClose}>
      <div
        className={`bg-slate-800 rounded-lg shadow-2xl w-full max-w-sm m-4 p-6 text-center animate-fade-in border-t-4 ${isCorrect ? 'border-green-500' : 'border-red-500'}`}
        onClick={e => e.stopPropagation()}
      >
        {isCorrect ? (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-900/50 flex items-center justify-center">
                <CheckIcon className="w-10 h-10 text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-100">{t('modals.practiceResult.correct')}</h2>
            <p className="text-xl text-slate-200 mt-4">{renderClickableLearning(phrase.text.learning)}</p>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-900/50 flex items-center justify-center">
                <XCircleIcon className="w-10 h-10 text-red-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-100">{t('modals.practiceResult.incorrect')}</h2>
            {evaluation?.feedback && (
              <p className="text-slate-400 mt-2 mb-4">{evaluation.feedback}</p>
            )}
            <div className="bg-slate-700/50 p-3 rounded-md text-center mb-6">
              <p className="text-xs text-slate-400 text-left">{t('modals.practiceResult.correctAnswer')}</p>
              <div className="flex items-center justify-center gap-x-2 mt-1">
                <AudioPlayer textToSpeak={evaluation?.correctedPhrase || phrase.text.learning} />
                <p className="text-slate-100 font-medium text-lg">{renderClickableLearning(evaluation?.correctedPhrase || phrase.text.learning)}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-full px-6 py-3 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors">
              {t('modals.practiceResult.actions.continue')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
export default PracticeResultModal;