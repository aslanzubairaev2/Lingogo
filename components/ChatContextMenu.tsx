
import React, { useState, useEffect, useCallback } from 'react';
import type { Phrase, WordAnalysis } from '../types';
import InfoIcon from './icons/InfoIcon';
import CardPlusIcon from './icons/CardPlusIcon';
import PlusIcon from './icons/PlusIcon';
import WandIcon from './icons/WandIcon';
import SoundIcon from './icons/SoundIcon';
import TableIcon from './icons/TableIcon';
import LanguagesIcon from './icons/LanguagesIcon';
import { useTranslation } from '../src/hooks/useTranslation';

interface ChatContextMenuProps {
  target: { sentence: { learning: string; native: string }; word: string };
  onClose: () => void;
  onAnalyzeWord: (phrase: Phrase, word: string) => Promise<WordAnalysis | null>;
  onCreateCard: (data: { learning: string; native: string }) => void;
  onGenerateMore: (prompt: string) => void;
  onSpeak: (text: string) => void;
  onOpenVerbConjugation: (infinitive: string) => void;
  onOpenNounDeclension: (noun: string, article: string) => void;
  onOpenAdjectiveDeclension: (adjective: string) => void;
  onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
  allPhrases: Phrase[];
  onTranslateLearningToNative: (learningPhrase: string) => Promise<{ native: string }>;
}

const ChatContextMenu: React.FC<ChatContextMenuProps> = ({
  target,
  onClose,
  onAnalyzeWord,
  onCreateCard,
  onGenerateMore,
  onSpeak,
  onOpenVerbConjugation,
  onOpenNounDeclension,
  onOpenAdjectiveDeclension,
  onOpenWordAnalysis,
  allPhrases,
  onTranslateLearningToNative,
}) => {
  const { t } = useTranslation();
  const { sentence, word } = target;
  const [analysis, setAnalysis] = useState<WordAnalysis | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);
  const [translation, setTranslation] = useState<string | null>(sentence.native);
  const [isTranslating, setIsTranslating] = useState(false);

  const proxyPhrase: Phrase = {
    id: `proxy_context_${Date.now()}`,
    text: { learning: sentence.learning, native: sentence.native },
    category: 'general',
    masteryLevel: 0,
    lastReviewedAt: null,
    nextReviewAt: 0,
    knowCount: 0,
    knowStreak: 0,
    isMastered: false,
    lapses: 0,
  };

  useEffect(() => {
    let isMounted = true;
    const analyze = async () => {
      setIsAnalysisLoading(true);
      const result = await onAnalyzeWord(proxyPhrase, word);
      if (isMounted) {
        setAnalysis(result);
        setIsAnalysisLoading(false);
      }
    };
    analyze();
    return () => {
      isMounted = false;
    };
  }, [word, sentence.learning, onAnalyzeWord]);

  const handleTranslate = useCallback(async () => {
    if (isTranslating) return;
    setIsTranslating(true);
    try {
      const result = await onTranslateLearningToNative(sentence.learning);
      setTranslation(result.native);
    } catch (error) {
      console.error("Translation failed", error);
      setTranslation(t('assistant.common.translationError'));
    } finally {
      setIsTranslating(false);
    }
  }, [sentence.learning, onTranslateLearningToNative, isTranslating]);

  const getCanonicalWordLearning = useCallback(() => {
    if (!analysis) return word;
    if (analysis.verbDetails?.infinitive) return analysis.verbDetails.infinitive;
    if (analysis.nounDetails?.article) return `${analysis.nounDetails.article} ${analysis.word}`;
    return analysis.baseForm || analysis.word;
  }, [analysis, word]);

  const phraseCardExists =
    !!sentence.native &&
    allPhrases.some(
      (p) => p.text.learning.trim().toLowerCase() === sentence.learning.trim().toLowerCase()
    );

  const wordCardExists = allPhrases.some(
    (p) => p.text.learning.trim().toLowerCase() === getCanonicalWordLearning().trim().toLowerCase()
  );

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
    setTimeout(action, 50); // timeout to let modal close first
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const menuItems = [
    { label: t('assistant.contextMenu.wordDetails'), icon: <InfoIcon />, action: () => onOpenWordAnalysis(proxyPhrase, word), condition: !!analysis },
    { label: t('assistant.contextMenu.createWordCard'), icon: <PlusIcon />, action: () => { if (analysis) onCreateCard({ learning: getCanonicalWordLearning(), native: analysis.nativeTranslation }); }, condition: !wordCardExists && !!analysis },
    { label: t('modals.wordAnalysis.actions.openVerb'), icon: <TableIcon />, action: () => { if (analysis?.verbDetails?.infinitive) onOpenVerbConjugation(analysis.verbDetails.infinitive); }, condition: !!analysis?.verbDetails },
    { label: t('modals.wordAnalysis.actions.openNoun'), icon: <TableIcon />, action: () => { if (analysis?.nounDetails) onOpenNounDeclension(analysis.word, analysis.nounDetails.article); }, condition: !!analysis?.nounDetails },
    { label: t('modals.wordAnalysis.actions.openAdjective'), icon: <TableIcon />, action: () => { if (analysis) onOpenAdjectiveDeclension(analysis.baseForm || analysis.word); }, condition: analysis?.partOfSpeech === 'Прилагательное' },
  ];

  const phraseMenuItems = [
    { label: t('assistant.contextMenu.createPhraseCard'), icon: <CardPlusIcon />, action: () => onCreateCard({ learning: sentence.learning, native: translation || sentence.native }), condition: !!translation && !phraseCardExists },
    { label: t('assistant.contextMenu.generateSimilar'), icon: <WandIcon />, action: () => onGenerateMore(t('assistant.prompts.generateSimilar', { phrase: sentence.learning })), condition: true },
  ];


  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" onClick={handleBackdropClick} />
      <div
        className="fixed z-[90] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl animate-fade-in-center text-white w-80 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-base font-medium text-slate-200 break-words flex-grow">{sentence.learning}</p>
            <button onClick={(e) => { e.stopPropagation(); onSpeak(sentence.learning); }} className="p-1 rounded-full hover:bg-white/10 ml-2 flex-shrink-0">
              <SoundIcon className="w-4 h-4 text-slate-300" />
            </button>
          </div>
          {translation ? (
            <p className="text-sm text-slate-300 italic mt-1">«{translation}»</p>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); handleTranslate(); }} disabled={isTranslating} className="w-full mt-2 flex items-center justify-center px-3 py-1.5 text-left text-sm bg-slate-600/70 hover:bg-slate-600 transition-colors rounded-md disabled:opacity-50">
              {isTranslating ? (
                <div className="flex space-x-1 items-center justify-center mr-2">
                  <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse"></div>
                  <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                </div>
              ) : <LanguagesIcon className="w-4 h-4 mr-2" />}
              <span>{isTranslating ? t('assistant.common.translating') : t('assistant.common.translate')}</span>
            </button>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-purple-300 break-words flex-grow">{word}</p>
            <button onClick={(e) => { e.stopPropagation(); onSpeak(word); }} className="p-1 rounded-full hover:bg-white/10 ml-2 flex-shrink-0">
              <SoundIcon className="w-4 h-4 text-slate-300" />
            </button>
          </div>
          {isAnalysisLoading ? (
            <div className="h-4 w-2/3 bg-slate-700 rounded animate-pulse mt-1"></div>
          ) : analysis ? (
            <p className="text-sm text-slate-400 capitalize">{analysis.nativeTranslation}</p>
          ) : null}
        </div>

        <div className="p-2 border-t border-slate-700">
          {isAnalysisLoading ? (
            <div className="flex items-center px-4 py-3 text-[15px] text-slate-400">
              <div className="flex space-x-1 items-center justify-center mr-4">
                <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span>{t('common.status.analyzing')}</span>
            </div>
          ) : (
            menuItems
              .filter((item) => item.condition)
              .map((item) => (
                <button
                  key={item.label}
                  onClick={(e) => handleAction(e, item.action)}
                  className="w-full flex items-center px-4 py-3 text-left hover:bg-slate-700/60 transition-colors text-[15px] text-slate-200 rounded-lg"
                >
                  <div className="w-5 h-5 mr-4 text-slate-400 flex-shrink-0">{item.icon}</div>
                  <span className="truncate">{item.label}</span>
                </button>
              ))
          )}

          {(menuItems.filter(i => i.condition && !isAnalysisLoading).length > 0) && <hr className="border-slate-700 mx-2 my-1" />}

          {phraseMenuItems
            .filter((item) => item.condition)
            .map((item) => (
              <button
                key={item.label}
                onClick={(e) => handleAction(e, item.action)}
                className="w-full flex items-center px-4 py-3 text-left hover:bg-slate-700/60 transition-colors text-[15px] text-slate-200 rounded-lg"
              >
                <div className="w-5 h-5 mr-4 text-slate-400 flex-shrink-0">{item.icon}</div>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
        </div>
      </div>
    </>
  );
};

export default ChatContextMenu;
