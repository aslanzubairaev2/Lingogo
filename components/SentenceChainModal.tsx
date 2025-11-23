
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Phrase, SentenceContinuation } from '../types';
import CloseIcon from './icons/CloseIcon';
import LinkIcon from './icons/LinkIcon';
import AudioPlayer from './AudioPlayer';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import * as cacheService from '../services/cacheService';
import AddContinuationModal from './AddContinuationModal';
import PlusIcon from './icons/PlusIcon';
import { useTranslation } from '../src/hooks/useTranslation';

interface SentenceChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  phrase: Phrase;
  onGenerateContinuations: (nativePhrase: string) => Promise<SentenceContinuation>;
  onWordClick: (phrase: Phrase, word: string) => void;
}

const SkeletonLoader: React.FC = () => {
  const widths = ['w-24', 'w-32', 'w-20', 'w-28', 'w-36', 'w-24', 'w-28', 'w-32', 'w-20'];
  return (
    <div className="flex flex-wrap justify-center gap-2 p-1 w-full max-w-lg animate-pulse">
      {widths.map((width, index) => (
        <div key={index} className={`h-8 bg-slate-700 rounded-lg ${width}`}></div>
      ))}
    </div>
  );
};


const SentenceChainModal: React.FC<SentenceChainModalProps> = ({ isOpen, onClose, phrase, onGenerateContinuations, onWordClick }) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState<string[]>([]);
  const [currentLearning, setCurrentLearning] = useState('');
  const [continuations, setContinuations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const cacheRef = useRef<Map<string, SentenceContinuation>>(new Map());
  const apiCacheKey = useMemo(() => `sentence_chain_api_cache_${phrase.id}`, [phrase.id]);
  const historyCacheKey = useMemo(() => `sentence_chain_history_${phrase.id}`, [phrase.id]);

  const getFullNativePhrase = useCallback((currentHistory: string[]): string => {
    let fullPhrase = phrase.text.native;
    for (const part of currentHistory) {
      if (part.match(/^[.,:;!?]/)) {
        fullPhrase += part;
      } else {
        fullPhrase += ' ' + part;
      }
    }
    return fullPhrase;
  }, [phrase.text.native]);

  const fetchContinuations = useCallback(async (nativePhrase: string) => {
    if (cacheRef.current.has(nativePhrase)) {
      const cachedData = cacheRef.current.get(nativePhrase)!;
      setCurrentLearning(cachedData.learning);
      setContinuations(cachedData.continuations);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setContinuations([]);
    try {
      const result = await onGenerateContinuations(nativePhrase);
      cacheRef.current.set(nativePhrase, result);
      // FIX: Use `result.learning` to match the `SentenceContinuation` type.
      setCurrentLearning(result.learning);
      setContinuations(result.continuations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [onGenerateContinuations]);

  // Effect to handle initialization on open and saving on close.
  useEffect(() => {
    if (isOpen) {
      const storedApiCache = cacheService.getCache<[string, SentenceContinuation][]>(apiCacheKey);
      cacheRef.current = storedApiCache ? new Map(storedApiCache) : new Map();

      const storedHistory = cacheService.getCache<string[]>(historyCacheKey) || [];
      setHistory(storedHistory);
      setIsInitialized(true);
    } else {
      // Cleanup on close
      setIsInitialized(false);
      if (cacheRef.current.size > 0) {
        cacheService.setCache(apiCacheKey, Array.from(cacheRef.current.entries()));
      }
      cacheService.setCache(historyCacheKey, history);
    }
  }, [isOpen, apiCacheKey, historyCacheKey]);

  // Effect to fetch data whenever history changes, but only after initialization
  useEffect(() => {
    if (isOpen && isInitialized) {
      const fullNativePhrase = getFullNativePhrase(history);
      fetchContinuations(fullNativePhrase);
    }
  }, [history, isOpen, isInitialized, getFullNativePhrase, fetchContinuations]);


  const handleSelectContinuation = (continuation: string) => {
    const newHistory = [...history, continuation];
    setHistory(newHistory);
    // The useEffect listening to `history` will trigger the fetch
    setCurrentLearning('...');
  };

  const handleAddContinuation = (text: string) => {
    handleSelectContinuation(text);
    setIsAddModalOpen(false);
  };

  const handleBlockClick = (blockIndex: number) => {
    if (isLoading) return;
    // Clicking any block reverts the history to the state *before* that block was added.
    // The new history should contain elements from index 0 up to (but not including) `blockIndex - 1`.
    const newHistory = history.slice(0, Math.max(0, blockIndex - 1));
    setHistory(newHistory);
    // The useEffect listening to `history` will trigger the fetch
    setCurrentLearning('...');
  };

  const handleGoBackOneStep = () => {
    if (history.length > 0) {
      handleBlockClick(history.length);
    }
  };

  const handleWordClick = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    const cleanedWord = word.replace(/[.,!?]/g, '');
    if (cleanedWord) {
      const proxyPhrase: Phrase = { ...phrase, text: { learning: currentLearning, native: getFullNativePhrase(history) } };
      onWordClick(proxyPhrase, cleanedWord);
    }
  };

  if (!isOpen) return null;

  const renderPhraseBlocks = () => {
    const allParts = [phrase.text.native, ...history];
    return (
      <div className="flex flex-wrap items-center justify-center gap-1 leading-relaxed">
        {allParts.map((part, index) => (
          <button
            key={index}
            onClick={() => handleBlockClick(index)}
            className={`${index === 0 ? 'bg-slate-600/50 hover:bg-slate-600' : 'bg-purple-600 hover:bg-purple-700'} px-2 py-1 rounded-md text-sm transition-colors group relative`}
            title={t('modals.sentenceChain.tooltips.clickToRevert')}
          >
            {part}
            <span className="absolute -top-1 -right-1.5 h-4 w-4 rounded-full bg-slate-700/80 group-hover:bg-red-500 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
              ×
            </span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end" onClick={onClose}>
        <div
          className={`bg-slate-800 w-full max-w-2xl h-[90%] max-h-[90vh] rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleGoBackOneStep}
                disabled={history.length === 0 || isLoading}
                className="p-2 rounded-full hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={t('modals.sentenceChain.aria.goBack')}
              >
                <ArrowLeftIcon className="w-6 h-6 text-slate-400" />
              </button>
              <div className="flex items-center space-x-2">
                <LinkIcon className="w-6 h-6 text-purple-400" />
                <h2 className="text-lg font-bold text-slate-100">{t('modals.sentenceChain.title')}</h2>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700">
              <CloseIcon className="w-6 h-6 text-slate-400" />
            </button>
          </header>

          <div className="flex-grow p-4 overflow-y-auto hide-scrollbar">
            {/* Phrase Display Area */}
            <div className="bg-slate-700/50 p-3 rounded-lg mb-4 text-center">
              <div className="mb-3 min-h-[36px]">
                {renderPhraseBlocks()}
              </div>
              <div className="flex items-center justify-center gap-x-2 border-t border-slate-600/50 pt-3">
                <AudioPlayer textToSpeak={currentLearning} />
                <div className="text-lg font-bold text-purple-300 text-left flex flex-wrap justify-center items-center gap-x-1">
                  {currentLearning.split(' ').map((word, index) => (
                    <span key={index} onClick={(e) => handleWordClick(e, word)} className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded-md transition-colors">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Continuations Area */}
            <div className="flex flex-col justify-center items-center min-h-[120px]">
              {isLoading && <SkeletonLoader />}
              {error && <div className="text-center bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg"><p className="font-semibold">{t('modals.sentenceChain.errors.generic')}</p><p className="text-sm">{error}</p></div>}
              {!isLoading && !error && (
                continuations.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-2 p-1">
                    {continuations.map((cont, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectContinuation(cont)}
                        className="px-3 py-1.5 bg-slate-600/70 hover:bg-slate-600 rounded-lg transition-colors text-slate-200 text-sm font-medium"
                      >
                        {cont}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-400 text-sm p-4">{t('modals.sentenceChain.messages.noContinuations')}</p>
                )
              )}
            </div>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="absolute bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-4 shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-800 z-10"
            aria-label={t('modals.sentenceChain.actions.addCustom')}
          >
            <PlusIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
      <AddContinuationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddContinuation}
      />
    </>
  );
};

export default SentenceChainModal;
