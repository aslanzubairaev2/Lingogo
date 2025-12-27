import React, { useEffect, useRef, useState } from 'react';

import { useLanguage } from '../contexts/languageContext';
import { useTranslation } from '../hooks/useTranslation.ts';
import { getNativeSpeechLocale } from '../services/speechService';
import { ProposedCard } from '../types.ts';
import CheckIcon from './icons/CheckIcon';
import CloseIcon from './icons/CloseIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import RefreshIcon from './icons/RefreshIcon';
import SmartToyIcon from './icons/SmartToyIcon';
import WandIcon from './icons/WandIcon';
import Spinner from './Spinner';

interface AutoFillPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedCards: ProposedCard[]) => Promise<void>;
  onRefine: (refinementText: string) => void;
  categoryName: string;
  proposedCards: ProposedCard[];
  isLoading: boolean;
}

const CardListSkeleton: React.FC = () => (
  <div className="space-y-2 w-full animate-pulse">
    {[...Array(5)].map((_, index) => (
      <div key={index} className="p-3 rounded-lg flex items-start space-x-3 bg-slate-700/80">
        <div className="mt-1 w-5 h-5 rounded-md flex-shrink-0 bg-slate-800" />
        <div className="flex-grow space-y-2">
          <div className="h-4 bg-slate-600 rounded w-3/4" />
          <div className="h-3 bg-slate-600 rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

const AutoFillPreviewModal: React.FC<AutoFillPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onRefine,
  categoryName,
  proposedCards,
  isLoading,
}) => {
  const { t } = useTranslation();
  const { profile } = useLanguage();
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndices(new Set(proposedCards.map((_, index) => index)));
      setShowRefineInput(false);
      setRefineText('');
      setIsConfirming(false);
    }
  }, [isOpen, proposedCards]);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.warn('Speech Recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getNativeSpeechLocale(profile);
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('');
      setRefineText(transcript);
    };

    recognitionRef.current = recognition;
  }, []);

  if (!isOpen) return null;

  const toggleSelection = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndices(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === proposedCards.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(proposedCards.map((_, index) => index)));
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    const selected = proposedCards.filter((_, index) => selectedIndices.has(index));
    await onConfirm(selected);
  };

  const handleRefine = () => {
    if (refineText.trim()) {
      onRefine(refineText);
      setShowRefineInput(false);
    }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const allSelected = selectedIndices.size === proposedCards.length && proposedCards.length > 0;
  const selectionLabel = allSelected
    ? t('modals.autoFillPreview.selection.clear')
    : t('modals.autoFillPreview.selection.select');

  const confirmCount = selectedIndices.size;
  const confirmShortLabel = `${t('modals.autoFillPreview.actions.confirmShort')} (${confirmCount})`;
  const confirmFullLabel = t('modals.autoFillPreview.actions.confirmWithCount', { count: confirmCount });

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[80] flex justify-center items-center backdrop-blur-sm p-4 animate-fade-in"
      onClick={isConfirming ? undefined : onClose}
    >
      <div
        className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg m-4 flex flex-col h-[90vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <SmartToyIcon className="w-6 h-6 text-purple-400 flex-shrink-0" />
            <h2
              className="text-lg font-bold text-slate-100 truncate"
              title={t('modals.autoFillPreview.tooltip', { category: categoryName })}
            >
              {t('modals.autoFillPreview.title', { category: categoryName })}
            </h2>
          </div>
          <button onClick={onClose} disabled={isConfirming} className="p-2 rounded-full hover:bg-slate-700 ml-2">
            <CloseIcon className="w-6 h-6 text-slate-400" />
          </button>
        </header>

        <div className="p-4 flex-grow overflow-y-auto hide-scrollbar relative">
          {isLoading && (
            <div className="absolute inset-0 bg-slate-800/80 flex flex-col items-center justify-center z-10">
              <CardListSkeleton />
            </div>
          )}
          {proposedCards.length > 0 ? (
            <ul className="space-y-2">
              {proposedCards.map((card, index) => (
                <li
                  key={index}
                  onClick={() => toggleSelection(index)}
                  className={`p-3 rounded-lg flex items-start space-x-3 cursor-pointer transition-colors ${
                    selectedIndices.has(index) ? 'bg-slate-700' : 'bg-slate-700/50 hover:bg-slate-700/80'
                  }`}
                >
                  <div
                    className={`mt-1 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 ${
                      selectedIndices.has(index) ? 'bg-purple-600 border-purple-500' : 'bg-slate-800 border-slate-600'
                    }`}
                  >
                    {selectedIndices.has(index) && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">{card.learning}</p>
                    <p className="text-sm text-slate-400">{card.native}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <p>{t('modals.autoFillPreview.empty')}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 flex-shrink-0 space-y-3">
          {showRefineInput && (
            <div className="flex items-center space-x-2">
              <div className="relative flex-grow">
                <input
                  type="text"
                  value={refineText}
                  onChange={(event) => setRefineText(event.target.value)}
                  placeholder={t('modals.autoFillPreview.refine.placeholder')}
                  className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleMicClick}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
                  aria-label={t('modals.autoFillPreview.status.listening')}
                >
                  <MicrophoneIcon className={`w-5 h-5 ${isListening ? 'text-purple-400' : ''}`} />
                </button>
              </div>
              <button
                onClick={handleRefine}
                disabled={!refineText.trim() || isLoading}
                className="p-2 w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-md bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors disabled:opacity-50"
                aria-label={t('modals.autoFillPreview.actions.refine')}
              >
                {isLoading ? (
                  <div className="flex space-x-1 items-center justify-center text-white">
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                    <div
                      className="w-1.5 h-1.5 bg-current rounded-full animate-pulse"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-current rounded-full animate-pulse"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                ) : (
                  <RefreshIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={toggleSelectAll}
              disabled={isConfirming}
              className="px-2 sm:px-4 py-2 text-sm rounded-md text-slate-300 hover:bg-slate-700 transition-colors"
            >
              {selectionLabel}
            </button>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowRefineInput((prev) => !prev)}
                disabled={isConfirming}
                className="px-3 sm:px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold transition-colors flex items-center"
              >
                <WandIcon className="w-5 h-5 sm:mr-2" />
                <span className="hidden sm:inline">{t('modals.autoFillPreview.refine.toggle')}</span>
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirmCount === 0 || isLoading || isConfirming}
                className="px-4 sm:px-6 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center min-w-[120px]"
              >
                {isConfirming ? (
                  <Spinner className="w-5 h-5" />
                ) : (
                  <>
                    <span className="sm:hidden">{confirmShortLabel}</span>
                    <span className="hidden sm:inline">{confirmFullLabel}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoFillPreviewModal;
