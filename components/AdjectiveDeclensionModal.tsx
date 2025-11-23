import React from 'react';
import type { Phrase, AdjectiveDeclension, AdjectiveDeclensionTable } from '../types';
import CloseIcon from './icons/CloseIcon';
import TableIcon from './icons/TableIcon';
import AudioPlayer from './AudioPlayer';
import { useTranslation } from '../src/hooks/useTranslation.ts';

interface AdjectiveDeclensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  adjective: string;
  data: AdjectiveDeclension | null;
  isLoading: boolean;
  error: string | null;
  onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
}

const CASE_ORDER: Array<keyof AdjectiveDeclensionTable['masculine']> = [
  'nominativ',
  'akkusativ',
  'dativ',
  'genitiv',
];

const AdjectiveDeclensionSkeleton: React.FC = () => (
  <div className="space-y-8 animate-pulse">
    <section>
      <div className="h-6 w-1/2 bg-slate-700 rounded mb-3" />
      <div className="bg-slate-700/50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-14 bg-slate-600 rounded" />
        <div className="h-14 bg-slate-600 rounded" />
        <div className="h-14 bg-slate-600 rounded" />
      </div>
    </section>
    <section>
      <div className="h-6 w-2/3 bg-slate-700 rounded mb-3" />
      <div className="bg-slate-700/50 p-4 rounded-lg">
        <div className="w-full min-w-[600px] space-y-1">
          <div className="flex items-center p-2">
            <div className="h-5 bg-slate-600 rounded w-1/5" />
            <div className="h-5 bg-slate-600 rounded w-1/5 ml-2" />
            <div className="h-5 bg-slate-600 rounded w-1/5 ml-2" />
            <div className="h-5 bg-slate-600 rounded w-1/5 ml-2" />
            <div className="h-5 bg-slate-600 rounded w-1/5 ml-2" />
          </div>
          {[...Array(4)].map((_, index) => (
            <div key={index} className="flex items-center p-2 border-t border-slate-700">
              <div className="h-6 bg-slate-600 rounded w-1/5" />
              <div className="h-6 bg-slate-600 rounded w-1/5 ml-2" />
              <div className="h-6 bg-slate-600 rounded w-1/5 ml-2" />
              <div className="h-6 bg-slate-600 rounded w-1/5 ml-2" />
              <div className="h-6 bg-slate-600 rounded w-1/5 ml-2" />
            </div>
          ))}
        </div>
      </div>
    </section>
  </div>
);

const AdjectiveDeclensionModal: React.FC<AdjectiveDeclensionModalProps> = ({
  isOpen,
  onClose,
  adjective,
  data,
  isLoading,
  error,
  onOpenWordAnalysis,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleWordClick = (contextText: string, word: string) => {
    const proxyPhrase: Omit<Phrase, 'id'> & { id?: string } = {
      id: `proxy_adj_${adjective}`,
      text: {
        learning: contextText,
        native: t('modals.adjectiveDeclension.phraseNative', { adjective }),
      },
      category: 'general',
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

  const renderEnding = (text: string) => {
    if (!text) return text;
    const parts = text.split('**');
    if (parts.length === 3) {
      return (
        <>
          {parts[0]}
          <strong className="text-yellow-300 font-bold">{parts[1]}</strong>
          {parts[2]}
        </>
      );
    }
    return text;
  };

  const renderClickableLearning = (text: string) => {
    if (!text) return null;
    return text.split(' ').map((word, index, array) => (
      <span
        key={`${word}-${index}`}
        onClick={(event) => {
          event.stopPropagation();
          const cleanedWord = word.replace(/[.,!?*"«»“”„:;]/g, '');
          if (cleanedWord) {
            handleWordClick(text, cleanedWord);
          }
        }}
        className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded-md transition-colors"
      >
        {renderEnding(word)}
        {index < array.length - 1 ? ' ' : ''}
      </span>
    ));
  };

  const renderDeclensionTable = (tableData: AdjectiveDeclensionTable, variant: 'weak' | 'mixed' | 'strong') => (
    <section>
      <h3 className="text-lg font-semibold text-purple-300 mb-3">
        {t(`modals.adjectiveDeclension.labels.${variant}`)}
      </h3>
      <div className="bg-slate-700/50 p-2 rounded-lg overflow-x-auto hide-scrollbar">
        <table className="w-full min-w-[600px] text-left">
          <thead>
            <tr className="border-b border-slate-600">
              <th className="p-2 text-sm font-semibold text-slate-400">
                {t('modals.adjectiveDeclension.labels.case')}
              </th>
              <th className="p-2 text-sm font-semibold text-slate-400">
                {t('modals.adjectiveDeclension.labels.masculine')}
              </th>
              <th className="p-2 text-sm font-semibold text-slate-400">
                {t('modals.adjectiveDeclension.labels.feminine')}
              </th>
              <th className="p-2 text-sm font-semibold text-slate-400">
                {t('modals.adjectiveDeclension.labels.neuter')}
              </th>
              <th className="p-2 text-sm font-semibold text-slate-400">
                {t('modals.adjectiveDeclension.labels.plural')}
              </th>
            </tr>
          </thead>
          <tbody>
            {CASE_ORDER.map((caseKey) => (
              <tr key={caseKey} className="border-b border-slate-700">
                <td className="p-2 align-top text-sm text-slate-300 whitespace-nowrap">
                  {t(`modals.adjectiveDeclension.cases.${caseKey}`)}
                </td>
                <td className="p-2 text-sm text-slate-100">
                  {renderClickableLearning(tableData.masculine[caseKey])}
                </td>
                <td className="p-2 text-sm text-slate-100">
                  {renderClickableLearning(tableData.feminine[caseKey])}
                </td>
                <td className="p-2 text-sm text-slate-100">
                  {renderClickableLearning(tableData.neuter[caseKey])}
                </td>
                <td className="p-2 text-sm text-slate-100">
                  {renderClickableLearning(tableData.plural[caseKey])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderContent = () => {
    if (isLoading) {
      return <AdjectiveDeclensionSkeleton />;
    }

    if (error) {
      return (
        <div className="flex justify-center items-center h-full">
          <div className="text-center bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">
            <p className="font-semibold">{t('modals.adjectiveDeclension.states.errorTitle')}</p>
            <p className="text-sm">{error || t('modals.adjectiveDeclension.states.errorMessage')}</p>
          </div>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="flex justify-center items-center h-full">
          <p className="text-slate-400">{t('modals.adjectiveDeclension.states.empty')}</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <section>
          <h3 className="text-lg font-semibold text-purple-300 mb-3">
            {t('modals.adjectiveDeclension.labels.degrees')}
          </h3>
          <div className="bg-slate-700/50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-slate-400">
                {t('modals.adjectiveDeclension.labels.positive')}
              </p>
              <div className="flex items-center justify-center gap-x-2">
                <AudioPlayer textToSpeak={data.comparison.positive} />
                <strong className="text-slate-100 text-lg">
                  {renderClickableLearning(data.comparison.positive)}
                </strong>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-400">
                {t('modals.adjectiveDeclension.labels.comparative')}
              </p>
              <div className="flex items-center justify-center gap-x-2">
                <AudioPlayer textToSpeak={data.comparison.comparative} />
                <strong className="text-slate-100 text-lg">
                  {renderClickableLearning(data.comparison.comparative)}
                </strong>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-400">
                {t('modals.adjectiveDeclension.labels.superlative')}
              </p>
              <div className="flex items-center justify-center gap-x-2">
                <AudioPlayer textToSpeak={data.comparison.superlative} />
                <strong className="text-slate-100 text-lg">
                  {renderClickableLearning(data.comparison.superlative)}
                </strong>
              </div>
            </div>
          </div>
        </section>
        {renderDeclensionTable(data.weak, 'weak')}
        {renderDeclensionTable(data.mixed, 'mixed')}
        {renderDeclensionTable(data.strong, 'strong')}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex justify-center items-end" onClick={onClose}>
      <div
        className={`bg-slate-800 w-full max-w-3xl h-[90%] max-h-[90vh] rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <TableIcon className="w-6 h-6 text-purple-400" />
            <h2 className="text-lg font-bold text-slate-100">
              {t('modals.adjectiveDeclension.title', { adjective })}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-700"
            aria-label={t('modals.addPhrase.aria.close')}
          >
            <CloseIcon className="w-6 h-6 text-slate-400" />
          </button>
        </header>
        <div className="p-2 overflow-y-auto hide-scrollbar">{renderContent()}</div>
      </div>
    </div>
  );
};

export default AdjectiveDeclensionModal;
