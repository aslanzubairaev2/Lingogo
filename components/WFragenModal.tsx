import React, { useMemo } from 'react';
import { Phrase } from '../types';
import CloseIcon from './icons/CloseIcon';
import QuestionMarkCircleIcon from './icons/QuestionMarkCircleIcon';
import AudioPlayer from './AudioPlayer';
import { useTranslation } from '../src/hooks/useTranslation';

interface WFragenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
}

type WFrageItem = {
  learning: string;
  translation: string;
};

const FALLBACK_ITEMS: WFrageItem[] = [
  { learning: 'Was?', translation: 'What?' },
  { learning: 'Wer?', translation: 'Who?' },
  { learning: 'Wo?', translation: 'Where?' },
  { learning: 'Wann?', translation: 'When?' },
  { learning: 'Wie?', translation: 'How?' },
  { learning: 'Warum?', translation: 'Why?' },
  { learning: 'Woher?', translation: 'Where from?' },
  { learning: 'Wohin?', translation: 'Where to?' },
];

const WFragenModal: React.FC<WFragenModalProps> = ({ isOpen, onClose, onOpenWordAnalysis }) => {
  const { t } = useTranslation();

  const wFragenItems = useMemo(() => {
    const raw = t('modals.wFragen.items', { returnObjects: true }) as unknown;
    if (Array.isArray(raw)) {
      const parsed = raw.filter((item): item is WFrageItem =>
        item && typeof item.learning === 'string' && typeof item.translation === 'string'
      );
      return parsed.length ? parsed : FALLBACK_ITEMS;
    }
    return FALLBACK_ITEMS;
  }, [t]);

  if (!isOpen) return null;

  const handleWordClick = (contextText: string, word: string, nativeText: string) => {
    const proxyPhrase: Omit<Phrase, 'id'> & { id?: string } = {
      id: `proxy_wfrage_${word}`,
      text: { learning: contextText, native: nativeText },
      category: 'w-fragen',
      masteryLevel: 0,
      lastReviewedAt: null,
      nextReviewAt: Date.now(),
      knowCount: 0,
      knowStreak: 0,
      isMastered: false,
      lapses: 0,
    };
    onOpenWordAnalysis(proxyPhrase as Phrase, word);
  };

  const renderClickableLearning = (text: string, native: string) => {
    if (!text) return null;
    return text.split(' ').map((word, i, arr) => (
      <span
        key={`${word}-${i}`}
        onClick={(e) => {
          e.stopPropagation();
          const cleanedWord = word.replace(/[.,!?()"“”:;]/g, '');
          if (cleanedWord) handleWordClick(text, cleanedWord, native);
        }}
        className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded-md transition-colors"
      >
        {word}
        {i < arr.length - 1 ? ' ' : ''}
      </span>
    ));
  };

  const heading = t('modals.wFragen.title');
  const playLabel = t('modals.wFragen.columns.play');
  const learningHeading = t('modals.wFragen.columns.learning');
  const translationHeading = t('modals.wFragen.columns.translation');

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex justify-center items-center" onClick={onClose}>
      <div
        className="bg-slate-800 w-full max-w-sm m-4 rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <QuestionMarkCircleIcon className="w-6 h-6 text-purple-400" />
            <h2 className="text-lg font-bold text-slate-100">{heading || 'W-Fragen'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700">
            <CloseIcon className="w-6 h-6 text-slate-400" />
          </button>
        </header>
        <div className="p-2 overflow-y-auto">
          <div className="bg-slate-700/50 p-4 rounded-lg">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="p-3 w-1/6">
                    <span className="sr-only">{playLabel || 'Play'}</span>
                  </th>
                  <th className="p-3 text-sm font-semibold text-slate-400">{learningHeading || 'Learning'}</th>
                  <th className="p-3 text-sm font-semibold text-slate-400">{translationHeading || 'Translation'}</th>
                </tr>
              </thead>
              <tbody>
                {wFragenItems.map((item) => (
                  <tr key={item.learning} className="border-b border-slate-700 last:border-b-0">
                    <td className="p-3">
                      <AudioPlayer textToSpeak={item.learning} />
                    </td>
                    <td className="p-3 text-slate-100 font-semibold text-lg">
                      {renderClickableLearning(item.learning, item.translation)}
                    </td>
                    <td className="p-3 text-slate-300 text-lg">{item.translation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WFragenModal;

