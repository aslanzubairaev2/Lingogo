
import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import type { Phrase } from '../types';
import ChatIcon from './icons/ChatIcon';
import AnalysisIcon from './icons/AnalysisIcon';
import FilmIcon from './icons/FilmIcon';
import LinkIcon from './icons/LinkIcon';
import SettingsIcon from './icons/SettingsIcon';
import BlocksIcon from './icons/BlocksIcon';
import BookOpenIcon from './icons/BookOpenIcon';
import Spinner from './Spinner';
import { getPhraseCategory } from '../services/srsService';
import MoreHorizontalIcon from './icons/MoreHorizontalIcon';
import CloseIcon from './icons/CloseIcon';
import MoreActionsMenu from './MoreActionsMenu';
import ProgressBar from './ProgressBar';
import { MAX_MASTERY_LEVEL } from '../services/srsService';
import SoundIcon from './icons/SoundIcon';
import { useTranslation } from '../src/hooks/useTranslation.ts';


interface PhraseCardProps {
  phrase: Phrase;
  onSpeak: (text: string, lang: 'de-DE' | 'ru-RU') => void;
  isFlipped: boolean;
  onFlip: () => void;
  onOpenChat: (phrase: Phrase) => void;
  onOpenDeepDive: (phrase: Phrase) => void;
  onOpenMovieExamples: (phrase: Phrase) => void;
  onWordClick: (phrase: Phrase, word: string) => void;
  onGetWordTranslation: (nativePhrase: string, learningPhrase: string, nativeWord: string) => Promise<{ learningTranslation: string }>;
  onOpenSentenceChain: (phrase: Phrase) => void;
  onOpenImprovePhrase: (phrase: Phrase) => void;
  onOpenContextMenu: (target: { phrase: Phrase, word?: string }) => void;
  onOpenVoicePractice: (phrase: Phrase) => void;
  onOpenLearningAssistant: (phrase: Phrase) => void;
  isWordAnalysisLoading: boolean;
  cardActionUsage: { [key: string]: number };
  onLogCardActionUsage: (button: string) => void;
  flash: 'green' | null;
  onFlashEnd: () => void;
}

interface NativePhraseDisplayProps {
  text: string;
  as: 'h2' | 'div';
  onWordClick: (event: React.MouseEvent<HTMLSpanElement>, word: string) => void;
}

const NativePhraseDisplay: React.FC<NativePhraseDisplayProps> = ({ text, as: Component, onWordClick }) => {
  const match = text.match(/(.*?)\s*\(([^)]+)\)/);

  const mainText = match && match[1] ? match[1].trim() : text;
  const noteText = match && match[2] ? match[2].trim() : null;

  return (
    <>
      <Component className="text-2xl font-semibold text-slate-100 flex flex-wrap justify-center items-center gap-x-1">
        {mainText.split(/(\s+)/).map((part, index) => (
          part.trim() ? (
            <span key={index} onClick={(e) => onWordClick(e, part.replace(/[.,!?]/g, ''))} className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded-md transition-colors">
              {part}
            </span>
          ) : (
            <span key={index}>{part}</span>
          )
        ))}
      </Component>
      {noteText && <p className="text-sm text-slate-300 mt-1 font-normal">({noteText})</p>}
    </>
  );
};

const PhraseCard: React.FC<PhraseCardProps> = ({
  phrase, onSpeak, isFlipped, onFlip, onOpenChat,
  onOpenDeepDive, onOpenMovieExamples, onWordClick, onGetWordTranslation, onOpenSentenceChain,
  onOpenImprovePhrase, onOpenContextMenu, onOpenVoicePractice,
  onOpenLearningAssistant, isWordAnalysisLoading,
  cardActionUsage, onLogCardActionUsage,
  flash, onFlashEnd,
}) => {
  const { t } = useTranslation();
  const [wordHint, setWordHint] = useState<{
    word: string;
    translation: string | null;
    position: { top: number; left: number } | null;
    isLoading: boolean;
  } | null>(null);

  const longPressTimer = useRef<number | null>(null);
  const wordLongPressTimer = useRef<number | null>(null);

  const [isMoreMenuOpenFront, setIsMoreMenuOpenFront] = useState(false);
  const [isMoreMenuOpenBack, setIsMoreMenuOpenBack] = useState(false);
  const buttonContainerRefFront = useRef<HTMLDivElement>(null);
  const buttonContainerRefBack = useRef<HTMLDivElement>(null);

  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const flashElement = flashRef.current;
    if (flash && flashElement) {
      const animationClass = flash === 'green' ? 'flash-green-animation' : 'flash-red-animation';

      const handleAnimationEnd = () => {
        if (flashElement.classList.contains(animationClass)) {
          flashElement.classList.remove(animationClass);
        }
        onFlashEnd();
      };

      flashElement.classList.add(animationClass);
      flashElement.addEventListener('animationend', handleAnimationEnd, { once: true });

      return () => {
        flashElement.removeEventListener('animationend', handleAnimationEnd);
      }
    }
  }, [flash, onFlashEnd]);

  const handleCardClick = useCallback(() => {
    setWordHint(null); // Close hint on any card interaction
    if (isFlipped) {
      onSpeak(phrase.text.learning, 'de-DE');
    } else {
      onFlip();
    }
  }, [isFlipped, phrase.text.learning, onSpeak, onFlip]);

  const handleNativeWordClick = async (e: React.MouseEvent<HTMLSpanElement>, word: string) => {
    e.stopPropagation();

    if (wordHint?.word === word) {
      setWordHint(null);
      return;
    }

    const target = e.target as HTMLElement;
    const cardFace = target.closest('.card-face');
    if (!cardFace) return;

    const rect = target.getBoundingClientRect();
    const cardRect = cardFace.getBoundingClientRect();

    const position = {
      top: rect.top - cardRect.top,
      left: rect.left - cardRect.left + rect.width / 2,
    };

    setWordHint({ word, translation: null, position, isLoading: true });

    try {
      const { learningTranslation } = await onGetWordTranslation(phrase.text.native, phrase.text.learning, word);
      setWordHint(prev => (prev?.word === word ? { ...prev, translation: learningTranslation, isLoading: false } : prev));
    } catch (error) {
      console.error("Failed to get word translation:", error);
      setWordHint(prev => (prev?.word === word ? { ...prev, translation: '???', isLoading: false } : prev));
    }
  };

  const createLoggedAction = useCallback((key: string, action: (p: Phrase) => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onLogCardActionUsage(key);
    action(phrase);
  }, [phrase, onLogCardActionUsage]);

  const allButtons = useMemo(() => [
    { key: 'learningAssistant', label: t('phraseCard.actions.learningAssistant'), icon: <BookOpenIcon className="w-5 h-5" />, action: createLoggedAction('learningAssistant', onOpenLearningAssistant) },
    { key: 'sentenceChain', label: t('phraseCard.actions.sentenceChain'), icon: <LinkIcon className="w-5 h-5" />, action: createLoggedAction('sentenceChain', onOpenSentenceChain) },
    { key: 'phraseBuilder', label: t('phraseCard.actions.phraseBuilder'), icon: <BlocksIcon className="w-5 h-5" />, action: createLoggedAction('phraseBuilder', onOpenVoicePractice) },
    { key: 'chat', label: t('phraseCard.actions.chat'), icon: <ChatIcon className="w-5 h-5" />, action: createLoggedAction('chat', onOpenChat) },
    { key: 'deepDive', label: t('phraseCard.actions.deepDive'), icon: <AnalysisIcon className="w-5 h-5" />, action: createLoggedAction('deepDive', onOpenDeepDive) },
    { key: 'movieExamples', label: t('phraseCard.actions.movieExamples'), icon: <FilmIcon className="w-5 h-5" />, action: createLoggedAction('movieExamples', onOpenMovieExamples) },
  ], [t, createLoggedAction, onOpenLearningAssistant, onOpenSentenceChain, onOpenVoicePractice, onOpenChat, onOpenDeepDive, onOpenMovieExamples]);

  const actionButtons = useMemo(() => {
    // Create a copy to avoid mutating the original allButtons array
    const sortedButtons = [...allButtons];

    // Sort the buttons based on usage count in descending order.
    // The `keyof typeof` ensures type safety between the button key and the usage stats object.
    sortedButtons.sort((a, b) => {
      const usageA = cardActionUsage[a.key as keyof typeof cardActionUsage] || 0;
      const usageB = cardActionUsage[b.key as keyof typeof cardActionUsage] || 0;
      return usageB - usageA;
    });

    return sortedButtons;
  }, [allButtons, cardActionUsage]);

  const visibleButtons = actionButtons.slice(0, 3);
  const hiddenButtons = actionButtons.slice(3);

  useEffect(() => {
    if (!isMoreMenuOpenFront) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonContainerRefFront.current && !buttonContainerRefFront.current.contains(event.target as Node)) {
        setIsMoreMenuOpenFront(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreMenuOpenFront]);

  useEffect(() => {
    if (!isMoreMenuOpenBack) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonContainerRefBack.current && !buttonContainerRefBack.current.contains(event.target as Node)) {
        setIsMoreMenuOpenBack(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreMenuOpenBack]);

  const handleOpenImprovePhrase = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenImprovePhrase(phrase);
  }

  const handleLearningWordClick = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    if (isWordAnalysisLoading) return;
    const cleanedWord = word.replace(/[.,!?]/g, '');
    if (cleanedWord) {
      onWordClick(phrase, cleanedWord);
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    longPressTimer.current = window.setTimeout(() => {
      onOpenContextMenu({ phrase });
      longPressTimer.current = null;
    }, 500); // 500ms for long press
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleWordPointerDown = (e: React.PointerEvent<HTMLSpanElement>, word: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation(); // prevent card's context menu
    if (isWordAnalysisLoading) return;
    const cleanedWord = word.replace(/[.,!?]/g, '');
    if (!cleanedWord) return;

    wordLongPressTimer.current = window.setTimeout(() => {
      onOpenContextMenu({ phrase, word: cleanedWord });
      wordLongPressTimer.current = null;
    }, 500);
  };

  const clearWordLongPress = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    if (wordLongPressTimer.current) {
      clearTimeout(wordLongPressTimer.current);
    }
  };

  const renderActionButtons = (theme: 'front' | 'back') => {
    const isMenuOpen = theme === 'front' ? isMoreMenuOpenFront : isMoreMenuOpenBack;
    const setIsMenuOpen = theme === 'front' ? setIsMoreMenuOpenFront : setIsMoreMenuOpenBack;
    const ref = theme === 'front' ? buttonContainerRefFront : buttonContainerRefBack;

    const themeClasses = theme === 'front'
      ? 'bg-black/5 hover:bg-black/10 text-slate-200'
      : 'bg-black/10 hover:bg-black/10 text-white';

    return (
      <div ref={ref} className="relative w-full flex justify-center items-center flex-wrap gap-2 z-10">
        {visibleButtons.map(button => (
          <button
            key={button.key}
            onClick={button.action}
            className={`p-3 rounded-full transition-colors ${themeClasses}`}
            aria-label={button.label}
          >
            {button.icon}
          </button>
        ))}
        {hiddenButtons.length > 0 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(prev => !prev); }}
              className={`p-3 rounded-full transition-colors ${themeClasses}`}
              aria-label={t('phraseCard.aria.moreActions')}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <CloseIcon className="w-5 h-5" /> : <MoreHorizontalIcon className="w-5 h-5" />}
            </button>
            {isMenuOpen && (
              <MoreActionsMenu
                buttons={hiddenButtons}
                onClose={() => setIsMenuOpen(false)}
                theme={theme}
              />
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div
      className="group [perspective:1000px] w-full max-w-md h-full"
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenContextMenu({ phrase });
      }}
    >
      <div
        className={`relative w-full h-full rounded-xl transition-transform duration-700 ease-in-out [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
        onClick={handleCardClick}
      >
        {/* Front Side (Native) */}
        <div
          className={`card-face bg-slate-400/10 backdrop-blur-xl transition-colors duration-500`}
        >
          <button
            onClick={handleOpenImprovePhrase}
            className="absolute top-3 right-3 p-0 rounded-full text-slate-500 hover:bg-white/20 hover:text-white transition-colors z-10"
            aria-label={t('phraseCard.aria.openSettings')}
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <div className="flex-grow flex flex-col items-center justify-center w-full">
            <NativePhraseDisplay text={phrase.text.native} as="h2" onWordClick={handleNativeWordClick} />
            {phrase.context?.native && (
              <p className="text-slate-300 mt-3 text-sm text-center font-normal italic max-w-xs">{phrase.context.native}</p>
            )}
          </div>
          {wordHint?.position && (
            <div
              className="word-hint-tooltip"
              style={{ top: wordHint.position.top, left: wordHint.position.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {wordHint.isLoading ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <div className="flex items-center gap-x-2">
                  <span>{wordHint.translation}</span>
                  {wordHint.translation && wordHint.translation !== '???' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSpeak(wordHint.translation!, 'de-DE');
                      }}
                      className="p-1 -my-1 -mr-1.5 rounded-full hover:bg-white/20 transition-colors"
                      aria-label={t('phraseCard.aria.playTranslation')}
                    >
                      <SoundIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="relative w-full">
            {renderActionButtons('front')}
          </div>

          <div className="absolute bottom-0 left-0 right-0 pb-1.5 px-2.5">
            <ProgressBar current={phrase.masteryLevel} max={MAX_MASTERY_LEVEL} />
          </div>
          <div ref={flashRef} className="flash-container"></div>
        </div>

        {/* Back Side (Learning) */}
        <div className="card-face [transform:rotateY(180deg)] bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-xl transition-colors duration-500">
          <div className="flex-grow flex flex-col items-center justify-center w-full">
            <button
              onClick={handleOpenImprovePhrase}
              className="absolute top-3 right-3 p-2 rounded-full text-white/70 hover:bg-black/20 hover:text-white transition-colors z-10"
              aria-label={t('phraseCard.aria.openSettings')}
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <div className="text-2xl font-bold text-white flex flex-wrap justify-center items-center gap-x-1">
              {phrase.text.learning.split(' ').map((word, index) => (
                <span
                  key={index}
                  className={`cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded-md transition-colors ${isWordAnalysisLoading ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={(e) => handleLearningWordClick(e, word)}
                  onPointerDown={(e) => handleWordPointerDown(e, word)}
                  onPointerUp={clearWordLongPress}
                  onPointerLeave={clearWordLongPress}
                >
                  {word}
                </span>
              ))}
            </div>
            {phrase.romanization?.learning && (
              <p className="text-slate-200 mt-3 text-lg font-mono">{phrase.romanization.learning}</p>
            )}
          </div>

          <div className="relative w-full">
            {renderActionButtons('back')}
          </div>
          <div className="absolute bottom-0 left-0 right-0 pb-1.5 px-2.5">
            <ProgressBar current={phrase.masteryLevel} max={MAX_MASTERY_LEVEL} variant="inverted" />
          </div>
          <div className="flash-container"></div>
        </div>
      </div>
    </div>
  );
};

export default PhraseCard;
