import React from 'react';
import type { Phrase } from '../types';
import GraduationCapIcon from './icons/GraduationCapIcon';
import { useTranslation } from '../src/hooks/useTranslation';

interface PhrasePreviewModalProps {
  phrase: Phrase | null;
  onClose: () => void;
  onStartPractice: (phrase: Phrase) => void;
}

const PhrasePreviewModal: React.FC<PhrasePreviewModalProps> = ({ phrase, onClose, onStartPractice }) => {
  const { t } = useTranslation();

  if (!phrase) return null;

  const handlePractice = () => {
    onStartPractice(phrase);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[80] flex flex-col justify-center items-center backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="[perspective:1000px] w-full max-w-md h-64" onClick={e => e.stopPropagation()}>
        <div className="relative w-full h-full [transform-style:preserve-3d] slow-rotate-animation">
          {/* Front Side (Native) */}
          <div className="card-face bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600">
            <h2 className="text-3xl font-semibold text-slate-100">{phrase.text.native}</h2>
            {phrase.context?.native && <p className="text-slate-300 mt-3 text-base font-normal italic px-4">{phrase.context.native}</p>}
          </div>

          {/* Back Side (Learning) */}
          <div className="card-face [transform:rotateY(180deg)] bg-gradient-to-br from-purple-600 to-blue-600 border border-purple-500">
            <h2 className="text-3xl font-bold text-white">{phrase.text.learning}</h2>
            {phrase.romanization?.learning && <p className="text-slate-200 mt-3 text-xl font-mono">{phrase.romanization.learning}</p>}
          </div>
        </div>
      </div>
      <button
        onClick={handlePractice}
        className="mt-8 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-md text-white font-bold transition-colors shadow-lg flex items-center space-x-2"
      >
        <GraduationCapIcon className="w-5 h-5" />
        <span>{t('modals.phrasePreview.actions.learn')}</span>
      </button>
    </div>
  );
};

export default PhrasePreviewModal;