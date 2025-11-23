import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { Phrase, WordAnalysis } from "../types";
import CloseIcon from "./icons/CloseIcon";
import BookOpenIcon from "./icons/BookOpenIcon";
import AudioPlayer from "./AudioPlayer";
import PlusIcon from "./icons/PlusIcon";
import { useTranslation } from "../src/hooks/useTranslation";

interface WordAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  word: string;
  phrase: Phrase;
  analysis: WordAnalysis | null;
  isLoading: boolean;
  error: string | null;
  onOpenVerbConjugation: (infinitive: string) => void;
  onOpenNounDeclension: (noun: string, article: string) => void;
  onOpenAdjectiveDeclension: (adjective: string) => void;
  onOpenWordAnalysis: (phrase: Phrase, word: string) => void;
  allPhrases: Phrase[];
  onCreateCard: (phraseData: { learning: string; native: string }) => void;
}

const WordAnalysisSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="text-center space-y-2">
      <div className="h-8 w-1/2 bg-slate-700 rounded mx-auto"></div>
      <div className="h-5 w-1/3 bg-slate-700 rounded mx-auto"></div>
    </div>
    <div className="bg-slate-700/50 p-4 rounded-lg h-12"></div>
    <div className="bg-slate-700/50 p-4 rounded-lg space-y-3">
      <div className="h-5 w-1/4 bg-slate-600 rounded"></div>
      <div className="h-4 w-full bg-slate-600 rounded"></div>
      <div className="h-4 w-full bg-slate-600 rounded"></div>
    </div>
    <div className="bg-slate-700/50 p-4 rounded-lg space-y-2">
      <div className="h-5 w-1/3 bg-slate-600 rounded"></div>
      <div className="h-5 w-full bg-slate-600 rounded"></div>
      <div className="h-4 w-full bg-slate-600 rounded mt-1"></div>
    </div>
  </div>
);

const WordAnalysisModal: React.FC<WordAnalysisModalProps> = ({
  isOpen,
  onClose,
  word,
  phrase,
  analysis,
  isLoading,
  error,
  onOpenVerbConjugation,
  onOpenNounDeclension,
  onOpenAdjectiveDeclension,
  onOpenWordAnalysis,
  allPhrases,
  onCreateCard,
}) => {
  const { t } = useTranslation();
  const [isCardCreated, setIsCardCreated] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsCardCreated(false); // Reset on open
    }
  }, [isOpen]);

  const getCanonicalLearning = useCallback((): string | null => {
    if (!analysis) return null;
    if (analysis.verbDetails?.infinitive) {
      return analysis.verbDetails.infinitive;
    }
    if (analysis.nounDetails?.article) {
      return `${analysis.nounDetails.article} ${analysis.word}`;
    }
    return analysis.baseForm || analysis.word;
  }, [analysis]);

  const cardExists = useMemo(() => {
    const canonicalLearning = getCanonicalLearning();
    if (!canonicalLearning) return false;
    return allPhrases.some(
      (p) =>
        p.text.learning.trim().toLowerCase() ===
        canonicalLearning.trim().toLowerCase()
    );
  }, [allPhrases, getCanonicalLearning]);

  const handleCreateCard = () => {
    const canonicalLearning = getCanonicalLearning();
    if (!analysis || !canonicalLearning) return;

    onCreateCard({
      learning: canonicalLearning,
      native: analysis.nativeTranslation,
    });
    setIsCardCreated(true);
  };

  if (!isOpen) return null;

  const handleWordClick = (
    contextText: string,
    clickedWord: string,
    nativeText: string
  ) => {
    const proxyPhrase: Phrase = {
      ...phrase,
      id: `proxy_${phrase.id}_analysis`,
      text: { learning: contextText, native: nativeText },
    };
    onOpenWordAnalysis(proxyPhrase, clickedWord);
  };

  const renderClickableLearning = (text: string, native: string) => {
    if (!text) return null;
    return text.split(" ").map((word, i, arr) => (
      <span
        key={i}
        onClick={(e) => {
          e.stopPropagation();
          const cleanedWord = word.replace(/[.,!?()"“”:;]/g, "");
          if (cleanedWord) handleWordClick(text, cleanedWord, native);
        }}
        className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded-md transition-colors"
      >
        {word}
        {i < arr.length - 1 ? " " : ""}
      </span>
    ));
  };

  const renderContent = () => {
    if (isLoading) {
      return <WordAnalysisSkeleton />;
    }
    if (error) {
      return (
        <div className="flex justify-center items-center h-full">
          <div className="text-center bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">
            <p className="font-semibold">
              {t("modals.wordAnalysis.errors.generic")}
            </p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      );
    }
    if (!analysis) {
      return (
        <div className="flex justify-center items-center h-full">
          <p className="text-slate-400">
            {t("modals.wordAnalysis.errors.unknown")}
          </p>
        </div>
      );
    }

    const isAdjective = analysis.partOfSpeech === "Прилагательное";

    return (
      <>
        {/* Main Info */}
        <div className="text-center sticky top-0 bg-slate-800 pt-2 pb-2 z-10">
          <div className="flex justify-center items-center gap-x-3">
            <h4 className="text-xl font-bold text-slate-100">
              {analysis.word}
            </h4>
            <AudioPlayer textToSpeak={analysis.word} />
          </div>
          <p className="text-m text-purple-300 mt-1">
            {analysis.partOfSpeech}
          </p>
        </div>
        <div className="space-y-4 p-4 ">
          <div className="bg-slate-700/50 px-2 py-2 rounded-lg">
            <p className="text-xl text-center text-slate-200">
              {analysis.nativeTranslation}
            </p>
          </div>

          {/* Details */}
          {(analysis.nounDetails ||
            analysis.verbDetails ||
            analysis.baseForm) && (
              <div className="bg-slate-700/50 px-2 py-1 rounded-lg space-y-3">
                <h4 className="font-semibold text-slate-300 border-b border-slate-600 pb-2 mb-3">
                  {t("modals.wordAnalysis.labels.grammarReference")}
                </h4>
                {analysis.baseForm && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">
                      {t("modals.wordAnalysis.labels.baseForm")}:
                    </span>{" "}
                    <strong className="text-slate-100">
                      {analysis.baseForm}
                    </strong>
                  </div>
                )}
                {analysis.nounDetails && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">
                        {t("modals.wordAnalysis.labels.article")}:
                      </span>{" "}
                      <strong className="text-slate-100 font-mono bg-slate-600 px-2 py-0.5 rounded">
                        {analysis.nounDetails.article}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">
                        {t("modals.wordAnalysis.labels.plural")}:
                      </span>{" "}
                      <strong className="text-slate-100">
                        {analysis.nounDetails.plural}
                      </strong>
                    </div>
                  </>
                )}
                {analysis.verbDetails && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">
                        {t("modals.wordAnalysis.labels.infinitive")}:
                      </span>{" "}
                      <strong className="text-slate-100">
                        {analysis.verbDetails.infinitive}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">
                        {t("modals.wordAnalysis.labels.tense")}:
                      </span>{" "}
                      <strong className="text-slate-100">
                        {analysis.verbDetails.tense}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">
                        {t("modals.wordAnalysis.labels.person")}:
                      </span>{" "}
                      <strong className="text-slate-100">
                        {analysis.verbDetails.person}
                      </strong>
                    </div>
                  </>
                )}
              </div>
            )}

          {/* Example */}
          <div className="bg-slate-700/50 px-2 py-1 rounded-lg">
            <h4 className="font-semibold text-slate-300 mb-3">
              {t("modals.wordAnalysis.labels.example")}
            </h4>
            <div className="flex items-start space-x-3">
              <AudioPlayer textToSpeak={analysis.exampleSentence} />
              <div className="flex-1">
                <p className="text-slate-200 text-m leading-relaxed">
                  "
                  {renderClickableLearning(
                    analysis.exampleSentence,
                    analysis.exampleSentenceNative
                  )}
                  "
                </p>
                <p className="text-slate-400 italic mt-1">
                  {t("modals.wordAnalysis.labels.exampleTranslation")}{" "}
                  {analysis.exampleSentenceNative}
                </p>
              </div>
            </div>
          </div>

          {/* Grammar Actions & Create Card */}
          <div className="pt-2 space-y-3">
            {!cardExists && !isCardCreated && (
              <button
                onClick={handleCreateCard}
                className="w-full flex items-center justify-center text-center px-4 py-3 rounded-lg bg-green-600/80 hover:bg-green-600 transition-colors font-semibold text-white shadow-md"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                <span>{t("modals.wordAnalysis.actions.createCard")}</span>
              </button>
            )}
            {analysis.verbDetails && (
              <button
                onClick={() =>
                  onOpenVerbConjugation(analysis.verbDetails!.infinitive)
                }
                className="w-full text-center px-4 py-3 rounded-lg bg-purple-600/80 hover:bg-purple-600 transition-colors font-semibold text-white shadow-md"
              >
                {t("modals.wordAnalysis.actions.openVerb")}
              </button>
            )}
            {analysis.nounDetails && (
              <button
                onClick={() =>
                  onOpenNounDeclension(
                    analysis.word,
                    analysis.nounDetails!.article
                  )
                }
                className="w-full text-center px-4 py-3 rounded-lg bg-purple-600/80 hover:bg-purple-600 transition-colors font-semibold text-white shadow-md"
              >
                {t("modals.wordAnalysis.actions.openNoun")}
              </button>
            )}
            {isAdjective && (
              <button
                onClick={() =>
                  onOpenAdjectiveDeclension(analysis.baseForm || analysis.word)
                }
                className="w-full text-center px-4 py-3 rounded-lg bg-purple-600/80 hover:bg-purple-600 transition-colors font-semibold text-white shadow-md"
              >
                {t("modals.wordAnalysis.actions.openAdjective")}
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex justify-center items-end"
      onClick={onClose}
    >
      <div
        className={`bg-slate-800 w-full max-w-lg h-[90%] max-h-[90vh] rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? "translate-y-0" : "translate-y-full"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-3 py-1 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <BookOpenIcon className="w-6 h-6 text-purple-400" />
            <h3 className="text-sm font-bold text-slate-100">
              {t("modals.wordAnalysis.title", { word })}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-700"
          >
            <CloseIcon className="w-6 h-6 text-slate-400" />
          </button>
        </header>
        <div className="flex-grow p-0 overflow-y-auto hide-scrollbar">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default WordAnalysisModal;
