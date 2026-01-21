import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { FiCopy, FiZap } from 'react-icons/fi';

import CategoryFilterContextMenu from '../components/CategoryFilterContextMenu';
import FindDuplicatesModal from '../components/FindDuplicatesModal';
import MicrophoneIcon from '../components/icons/MicrophoneIcon';
import XCircleIcon from '../components/icons/XCircleIcon';
import PhraseListItem from '../components/PhraseListItem';
import PhrasePreviewModal from '../components/PhrasePreviewModal';
import { useLanguage } from '../contexts/languageContext';
import { useTranslation } from '../hooks/useTranslation';
import { getLanguageLabel, getSpeechLocale } from '../i18n/languageMeta';
import * as backendService from '../services/backendService';
import type { Category, LanguageCode, Phrase, PhraseCategory } from '../types.ts';

/** Estimated height of a section header in pixels for virtual scrolling */
const HEADER_ESTIMATE = 48;
/** Estimated height of a phrase list item in pixels for virtual scrolling */
const PHRASE_ESTIMATE = 176;

/**
 * Props for the PhraseListPage component.
 */
interface PhraseListPageProps {
  /** List of phrases to display */
  phrases: Phrase[];
  /** Callback to edit a phrase */
  onEditPhrase: (phrase: Phrase) => void;
  /** Callback to delete a phrase */
  onDeletePhrase: (phraseId: string) => void;
  /** Function to find duplicates, returning a promise with groups of duplicate IDs */
  onFindDuplicates: () => Promise<{ duplicateGroups: string[][] }>;
  /** Function to update phrases state and persist to storage */
  updateAndSavePhrases: (updater: (prevPhrases: Phrase[]) => Phrase[]) => void;
  /** Callback to start practice for a single phrase */
  onStartPractice: (phrase: Phrase) => void;
  /** ID of a phrase to highlight (e.g. after adding) */
  highlightedPhraseId: string | null;
  /** Callback to clear the highlight */
  onClearHighlight: () => void;
  /** Callback to open the Smart Import modal */
  onOpenSmartImport: () => void;
  /** Available categories for filtering */
  categories: Category[];
  /** Callback to update a phrase's category */
  onUpdatePhraseCategory: (phraseId: string, newCategoryId: string) => void;
  /** Callback to start practice for a specific category */
  onStartPracticeWithCategory: (categoryId: PhraseCategory) => void;
  /** Callback to edit a category */
  onEditCategory: (category: Category) => void;
  /** Callback to open the Category Assistant */
  onOpenAssistant: (category: Category) => void;
  /** Reference to the backend service */
  backendService: typeof backendService;
  /** Optional callback to open word analysis */
  onOpenWordAnalysis?: (phrase: Phrase, word: string) => void;
}

type ListItem = { type: 'header'; title: string } | { type: 'phrase'; phrase: Phrase };

const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const WORD_BOUNDARY_REGEX = /[\s.,!?;:'"()[\]{}\-]/;

/**
 * Normalizes a string for search by removing diacritics and converting to NFD form.
 * @param value The string to normalize
 */
const normalizeForSearch = (value: string) => value.normalize('NFD').replace(DIACRITICS_REGEX, '');

/**
 * Computes a fuzzy match score for a search term against a text.
 * Higher score means better match.
 *
 * Scoring rules:
 * - Base match: 100
 * - Starts with term: +50
 * - Word boundary match (start/end): +20
 * - Penalty for extra characters: -0.05 per char
 *
 * @param text The text to search within
 * @param normalizedTerm The normalized search term
 * @returns A score > 0 if matched, 0 otherwise
 */
const computeMatchScore = (text: string | undefined | null, normalizedTerm: string): number => {
  if (!text) {
    return 0;
  }

  const normalizedText = normalizeForSearch(text.toLowerCase());
  if (!normalizedText) {
    return 0;
  }

  const termIndex = normalizedText.indexOf(normalizedTerm);
  if (termIndex === -1) {
    return 0;
  }

  let score = 100;

  if (termIndex === 0) {
    score += 50;
  }

  const endIndex = termIndex + normalizedTerm.length;
  const charBefore = normalizedText.charAt(termIndex - 1);
  const charAfter = normalizedText.charAt(endIndex);

  const isStartBoundary = termIndex === 0 || WORD_BOUNDARY_REGEX.test(charBefore);
  const isEndBoundary = endIndex >= normalizedText.length || WORD_BOUNDARY_REGEX.test(charAfter);

  if (isStartBoundary && isEndBoundary) {
    score += 20;
  }

  score -= Math.max(0, normalizedText.length - normalizedTerm.length) * 0.05;

  return score;
};

/**
 * PhraseListPage Component
 *
 * Displays a list of phrases with filtering, searching, and virtual scrolling capabilities.
 * Supports categorization, duplicate finding, and AI-powered features.
 */
export const PhraseListPage: React.FC<PhraseListPageProps> = ({
  phrases,
  onEditPhrase,
  onDeletePhrase,
  onFindDuplicates,
  updateAndSavePhrases,
  onStartPractice,
  highlightedPhraseId,
  onClearHighlight,
  onOpenSmartImport,
  categories,
  onUpdatePhraseCategory,
  onStartPracticeWithCategory,
  onEditCategory,
  onOpenAssistant,
  backendService,
  onOpenWordAnalysis,
}) => {
  const { t } = useTranslation();
  const { profile } = useLanguage();
  // State for search and filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [, startTransition] = useTransition();
  const [categoryFilter, setCategoryFilter] = useState<'all' | PhraseCategory>('all');

  // State for modals and UI
  const [previewPhrase, setPreviewPhrase] = useState<Phrase | null>(null);
  const [isFindDuplicatesModalOpen, setIsFindDuplicatesModalOpen] = useState(false);

  // State for speech recognition
  const [isListening, setIsListening] = useState(false);
  const [recognitionLang, setRecognitionLang] = useState<LanguageCode>(profile.native);
  const nativeRecognitionRef = useRef<SpeechRecognition | null>(null);
  const learningRecognitionRef = useRef<SpeechRecognition | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    category: Category;
    x: number;
    y: number;
  } | null>(null);
  // FIX: Changed `useRef<number>()` to the more explicit and safer `useRef<number | null>(null)`. The original syntax, while valid, can sometimes be misinterpreted by build tools, and this change resolves the potential ambiguity that might be causing the reported error.
  const longPressTimer = useRef<number | null>(null);
  const isLongPress = useRef(false);

  // References for virtual scrolling and DOM elements
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterButtonsContainerRef = useRef<HTMLDivElement>(null);
  const listWrapperRef = useRef<HTMLDivElement>(null);
  const heightsRef = useRef<number[]>([]);
  const offsetsRef = useRef<number[]>([]);
  const totalHeightRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const [, forceVirtualUpdate] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  /**
   * Updates the search term state.
   * Uses startTransition for non-immediate updates to keep UI responsive.
   *
   * @param value The new search value
   * @param options.immediate If true, updates are applied immediately without transition
   */
  const updateSearchValue = (value: string, options?: { immediate?: boolean }) => {
    const immediate = options?.immediate ?? (isListening || value.length <= 2);

    setSearchTerm(value);

    if (immediate) {
      setFilterTerm(value);
    } else {
      startTransition(() => {
        setFilterTerm(value);
      });
    }
  };

  // Initialize Speech Recognition on mount and when languages change
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const setupRecognizer = (langCode: LanguageCode): SpeechRecognition => {
        const recognition = new SpeechRecognition();
        recognition.lang = getSpeechLocale(langCode);
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error !== 'aborted' && event.error !== 'no-speech') {
            console.error(`Speech recognition error (${langCode}):`, event.error);
          }
          setIsListening(false);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0]?.transcript ?? '')
            .join('')
            .trim();

          if (transcript) {
            updateSearchValue(transcript, { immediate: true });
          }

          const lastResult = event.results[event.results.length - 1];
          if (lastResult?.isFinal) {
            setIsListening(false);
            try {
              recognition.stop();
            } catch (error) {
              console.warn('Speech recognition could not be stopped cleanly:', error);
            }
          }
        };

        return recognition;
      };

      nativeRecognitionRef.current = setupRecognizer(profile.native);
      learningRecognitionRef.current = setupRecognizer(profile.learning);
    }
  }, [profile.native, profile.learning]);

  /**
   * Handles switching the speech recognition language.
   * If listening, restarts recognition with the new language.
   */
  const handleLangChange = (lang: LanguageCode) => {
    if (lang === recognitionLang) return; // No change
    setRecognitionLang(lang);
    if (isListening) {
      // Stop current recognizer
      (recognitionLang === profile.native ? nativeRecognitionRef.current : learningRecognitionRef.current)?.stop();

      // Start new recognizer
      const newRecognizer = lang === profile.native ? nativeRecognitionRef.current : learningRecognitionRef.current;
      if (newRecognizer) {
        try {
          newRecognizer.start();
        } catch (e) {
          console.error('Could not switch recognition language:', e);
          setIsListening(false);
        }
      }
    }
  };

  /**
   * Toggles microphone recording state.
   */
  const handleMicClick = () => {
    const recognizer =
      recognitionLang === profile.native ? nativeRecognitionRef.current : learningRecognitionRef.current;
    if (!recognizer) return;

    if (isListening) {
      recognizer.stop();
    } else {
      updateSearchValue('', { immediate: true });
      setIsListening(true);
      try {
        // Ensure the other recognizer is stopped
        (recognitionLang === profile.native ? learningRecognitionRef.current : nativeRecognitionRef.current)?.stop();
        recognizer.start();
      } catch (e) {
        console.error('Could not start recognition:', e);
        setIsListening(false);
      }
    }
  };

  /**
   * Clears the current search term and stops listening.
   */
  const handleClearSearch = () => {
    updateSearchValue('', { immediate: true });
    if (isListening) {
      nativeRecognitionRef.current?.stop();
      learningRecognitionRef.current?.stop();
      setIsListening(false);
    }
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
    isLongPress.current = false;
  };

  const handleButtonPointerDown = (e: React.PointerEvent<HTMLButtonElement>, category: Category) => {
    if (categoryFilter === category.id) {
      // Only on active button
      isLongPress.current = false;
      longPressTimer.current = window.setTimeout(() => {
        isLongPress.current = true;
        setContextMenu({ category, x: e.clientX, y: e.clientY });
      }, 500);
    }
  };

  const handleButtonPointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleButtonClick = (category: Category) => {
    if (isLongPress.current) {
      return;
    }

    if (categoryFilter === category.id) {
      onStartPracticeWithCategory(category.id);
    } else {
      setCategoryFilter(category.id);
    }
  };

  /**
   * The actual search term to use for filtering.
   * If listening (speech recognition active), uses the raw search term (transcript).
   * Otherwise, uses the debounced filter term to avoid frequent re-renders/heavy computations.
   */
  const effectiveSearchTerm = useMemo(() => {
    return isListening ? searchTerm : filterTerm;
  }, [searchTerm, filterTerm, isListening]);

  /**
   * Filters and sorts the phrases based on the effective search term and selected category.
   * Implements fuzzy search scoring for better relevance.
   */
  const filteredPhrases = useMemo(() => {
    let baseList = phrases;

    if (categoryFilter !== 'all') {
      baseList = baseList.filter((p) => p.category === categoryFilter);
    }

    const normalizedTermInput = effectiveSearchTerm.trim().toLowerCase();
    if (!normalizedTermInput) return baseList;

    const normalizedTerm = normalizeForSearch(normalizedTermInput);
    if (!normalizedTerm) {
      return baseList;
    }

    const scoredPhrases = baseList
      .map((phrase) => {
        const searchTargets: Array<{
          text: string | undefined;
          weight: number;
        }> = [
          { text: phrase.text.learning, weight: 1 },
          { text: phrase.text.native, weight: 1 },
          { text: phrase.romanization?.learning, weight: 0.7 },
          { text: phrase.context?.native, weight: 0.5 },
        ];

        const bestScore = searchTargets.reduce((currentBest, target) => {
          const score = computeMatchScore(target.text, normalizedTerm);
          if (score <= 0) {
            return currentBest;
          }
          const weightedScore = score * target.weight;
          return weightedScore > currentBest ? weightedScore : currentBest;
        }, 0);

        return { phrase, score: bestScore };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scoredPhrases.map((item) => item.phrase);
  }, [phrases, categoryFilter, effectiveSearchTerm]);

  /**
   * Transforms the filtered phrases into a flat list of items (headers + phrases) for rendering.
   * Categorizes phrases into 'New', 'In Progress', and 'Mastered' sections.
   */
  const listItems = useMemo((): ListItem[] => {
    const sections = {
      new: [] as Phrase[],
      inProgress: [] as Phrase[],
      mastered: [] as Phrase[],
    };

    // Single pass through filteredPhrases to categorize all phrases
    filteredPhrases.forEach((p) => {
      if (p.isMastered) {
        sections.mastered.push(p);
      } else if (p.lastReviewedAt === null) {
        sections.new.push(p);
      } else {
        sections.inProgress.push(p);
      }
    });

    const items: ListItem[] = [];

    // Create sections in order: new, inProgress, mastered
    const sectionOrder: Array<{
      key: keyof typeof sections;
      titleKey: string;
    }> = [
      { key: 'new', titleKey: 'phraseList.sections.new' },
      { key: 'inProgress', titleKey: 'phraseList.sections.inProgress' },
      { key: 'mastered', titleKey: 'phraseList.sections.mastered' },
    ];

    sectionOrder.forEach(({ key, titleKey }) => {
      const phrases = sections[key];
      if (phrases.length > 0) {
        items.push({
          type: 'header',
          title: `${t(titleKey)} (${phrases.length})`,
        });
        phrases.forEach((p) => items.push({ type: 'phrase', phrase: p }));
      }
    });

    return items;
  }, [filteredPhrases, t]);

  /**
   * Map of categories for quick lookup.
   */
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  /**
   * Initializes the estimated heights and offsets for the virtual list.
   * This is called on component mount and potentially when the list items change significantly.
   */
  const initializeVirtualMetrics = () => {
    const estimates = listItems.map((item) => (item.type === 'header' ? HEADER_ESTIMATE : PHRASE_ESTIMATE));
    heightsRef.current = estimates;
    offsetsRef.current = new Array(estimates.length);
    let runningOffset = 0;
    for (let i = 0; i < estimates.length; i += 1) {
      offsetsRef.current[i] = runningOffset;
      runningOffset += estimates[i];
    }
    totalHeightRef.current = runningOffset;
    forceVirtualUpdate((v) => v + 1);
  };

  // Effect to reset scroll and metrics when mounting
  useEffect(() => {
    initializeVirtualMetrics();
    const container = listWrapperRef.current;
    if (container) {
      container.scrollTop = 0;
    }
    setScrollTop(0);
  }, []);

  // Layout effect to handle container resize and viewport height updates
  useLayoutEffect(() => {
    const container = listWrapperRef.current;
    if (!container) {
      return;
    }

    const updateHeight = () => {
      setViewportHeight(container.clientHeight);
    };

    updateHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateHeight());
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  // Cleanup scroll animation frame
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  /**
   * Updates the height of a specific item in the virtual list and adjusts offsets of subsequent items.
   */
  const updateItemSize = (index: number, measuredSize: number) => {
    const heights = heightsRef.current;
    if (index < 0 || index >= heights.length) {
      return;
    }
    if (!Number.isFinite(measuredSize) || measuredSize <= 0) {
      return;
    }
    const previous = heights[index];
    if (Math.abs(previous - measuredSize) < 1) {
      return;
    }
    const delta = measuredSize - previous;
    heights[index] = measuredSize;
    totalHeightRef.current += delta;
    const offsets = offsetsRef.current;
    for (let i = index + 1; i < offsets.length; i += 1) {
      offsets[i] += delta;
    }
    forceVirtualUpdate((v) => v + 1);
  };

  /**
   * Ref callback to measure the height of rendered items for dynamic sizing.
   */
  const handleItemMeasurement = (index: number, node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }
    updateItemSize(index, node.getBoundingClientRect().height);
  };

  /**
   * Binary search to find the index of the first item visible at the given offset.
   */
  const findStartIndex = (offset: number) => {
    const offsets = offsetsRef.current;
    const heights = heightsRef.current;
    if (offsets.length === 0) {
      return 0;
    }
    let low = 0;
    let high = offsets.length - 1;
    let answer = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const start = offsets[mid];
      const end = start + heights[mid];
      if (end >= offset) {
        answer = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return answer;
  };

  /**
   * Binary search to find the index of the last item visible at the given offset.
   */
  const findEndIndex = (offset: number) => {
    const offsets = offsetsRef.current;
    if (offsets.length === 0) {
      return -1;
    }
    let low = 0;
    let high = offsets.length - 1;
    let answer = offsets.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const start = offsets[mid];
      if (start <= offset) {
        answer = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return answer;
  };

  /**
   * Scroll event handler to update the scrollTop state using requestAnimationFrame for performance.
   */
  const handleScroll = () => {
    const container = listWrapperRef.current;
    if (!container) {
      return;
    }
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = window.requestAnimationFrame(() => {
      setScrollTop(container.scrollTop);
    });
  };

  /**
   * Smoothly scrolls the virtual list to the specified index.
   * Centers the item in the viewport if possible.
   */
  const scrollToIndex = (index: number) => {
    const container = listWrapperRef.current;
    if (!container) {
      return;
    }
    const offsets = offsetsRef.current;
    const heights = heightsRef.current;
    if (index < 0 || index >= offsets.length) {
      return;
    }
    const itemStart = offsets[index];
    const itemHeight = heights[index];
    const available = viewportHeight > 0 ? viewportHeight : container.clientHeight;
    const target = Math.max(itemStart - Math.max((available - itemHeight) / 2, 0), 0);
    container.scrollTo({ top: target, behavior: 'smooth' });
  };

  // Effect to handle scrolling to a highlighted phrase (e.g. after adding/editing)
  useEffect(() => {
    if (!highlightedPhraseId) {
      return;
    }
    const targetIndex = listItems.findIndex((item) => item.type === 'phrase' && item.phrase.id === highlightedPhraseId);
    if (targetIndex === -1) {
      return;
    }
    scrollToIndex(targetIndex);
    const timer = window.setTimeout(() => {
      onClearHighlight();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [highlightedPhraseId, listItems]);

  // ????????????? ???????? ?????? ???????
  // Effect to ensure the active filter button is visible in the scrollable container
  useEffect(() => {
    if (!filterButtonsContainerRef.current) return;

    const container = filterButtonsContainerRef.current;
    const activeButton = container.querySelector('button.bg-purple-600') as HTMLButtonElement;

    if (!activeButton) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    const isFullyVisible = buttonRect.left >= containerRect.left && buttonRect.right <= containerRect.right;

    if (!isFullyVisible) {
      activeButton.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [categoryFilter]);

  const overscanPx = 400;
  const totalHeight = totalHeightRef.current;
  const containerHeight = viewportHeight;
  const itemCount = listItems.length;
  const startOffset = Math.max(0, scrollTop - overscanPx);
  const endOffset = scrollTop + containerHeight + overscanPx;

  let startIndex = 0;
  let endIndex = -1;

  if (itemCount > 0) {
    startIndex = Math.min(itemCount - 1, findStartIndex(startOffset));
    endIndex = Math.min(itemCount - 1, Math.max(findEndIndex(Math.max(0, endOffset)), startIndex));
  }

  return (
    <div className="h-[calc(100dvh-50px)] w-full pt-[65px]">
      {/* 
        Search and Filter Section
        Sticky header containing search bar, language toggle, microphone, and category filters.
      */}
      <div className="flex-shrink-0 sticky top-15 z-20 pb-2">
        <div className="backdrop-blur-lg rounded-xlp-2">
          {/* ????? */}
          <div className="relative group px-2">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => updateSearchValue(e.target.value)}
              placeholder={isListening ? t('phraseList.search.listening') : t('phraseList.search.placeholder')}
              className="w-full bg-slate-400/10 backdrop-blur-lg border border-white/20 rounded-full py-2 pl-3 pr-40 text-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1 z-10">
              {searchTerm && !isListening && (
                <button onClick={handleClearSearch} className="p-1 text-slate-400 hover:text-white">
                  <XCircleIcon className="w-6 h-6" />
                </button>
              )}
              <div className="flex items-center bg-slate-700/50 rounded-full p-0.5">
                <button
                  onClick={() => handleLangChange(profile.native)}
                  className={`px-2 py-0.5 text-xs font-bold rounded-full transition-colors ${
                    recognitionLang === profile.native
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {getLanguageLabel(profile.native)}
                </button>
                <button
                  onClick={() => handleLangChange(profile.learning)}
                  className={`px-2 py-0.5 text-xs font-bold rounded-full transition-colors ${
                    recognitionLang === profile.learning
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {getLanguageLabel(profile.learning)}
                </button>
              </div>
              <button onClick={handleMicClick} className="p-2 transition-colors">
                <MicrophoneIcon
                  className={`w-6 h-6 ${
                    isListening ? 'mic-color-shift-animation' : 'text-slate-400 group-hover:text-white'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ?????? ??????? ????????? */}
          <div className="mt-4">
            <div ref={filterButtonsContainerRef} className="flex space-x-1 pb-2 hide-scrollbar overflow-x-auto px-2">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`flex-shrink-0 px-2 py-0.5 rounded-full text-sm font-medium transition-colors ${
                  categoryFilter === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {t('phraseList.filters.all')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onPointerDown={(e) => handleButtonPointerDown(e, cat)}
                  onPointerUp={handleButtonPointerUp}
                  onPointerLeave={handleButtonPointerUp}
                  onClick={() => handleButtonClick(cat)}
                  className={`flex-shrink-0 px-2 py-0.5 rounded-full text-sm font-medium transition-colors ${
                    categoryFilter === cat.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* ?????????? ????????
                            ?????? ? ???????????
                            ?????? ??????????
                        */}
          <div className="flex justify-between items-end mt-1 px-2">
            <span className="text-sm text-slate-400">
              {t('phraseList.summary.count', { count: filteredPhrases.length })}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsFindDuplicatesModalOpen(true)}
                className="flex-shrink-0 flex items-center justify-center space-x-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-semibold transition-colors disabled:opacity-50 h-[34px] w-12 sm:w-36"
              >
                <FiCopy className="w-5 h-5" />
                <span className="hidden sm:inline">{t('phraseList.actions.duplicates')}</span>
              </button>
              <button
                onClick={onOpenSmartImport}
                className="flex-shrink-0 flex items-center justify-center space-x-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-semibold transition-colors h-[34px] w-12 sm:w-36"
              >
                <FiZap className="w-5 h-5" />
                <span className="hidden sm:inline">{t('phraseList.actions.aiImport')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 
        Virtual List Section
        Renders the list of phrases and headers using absolute positioning for virtualization.
      */}
      <div className="w-full max-w-2xl mx-auto flex flex-col h-full">
        <div ref={listWrapperRef} className="flex-grow pt-2 min-h-0 overflow-y-auto" onScroll={handleScroll}>
          {itemCount === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400">{t('phraseList.summary.count', { count: 0 })}</div>
          ) : (
            <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
              {startIndex <= endIndex &&
                Array.from({ length: endIndex - startIndex + 1 }, (_, offsetIndex) => {
                  const listIndex = startIndex + offsetIndex;
                  const item = listItems[listIndex];
                  if (!item) {
                    return null;
                  }
                  const key = item.type === 'header' ? `header-${item.title}` : item.phrase.id;
                  const top = offsetsRef.current[listIndex];
                  return (
                    <div key={key} style={{ position: 'absolute', top, left: 0, right: 0 }}>
                      <div ref={(node) => handleItemMeasurement(listIndex, node)} className="px-2 pb-2">
                        {item.type === 'header' ? (
                          <div className="py-">
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{item.title}</h2>
                          </div>
                        ) : (
                          <PhraseListItem
                            phrase={item.phrase}
                            onEdit={onEditPhrase}
                            onDelete={onDeletePhrase}
                            isDuplicate={false}
                            isHighlighted={highlightedPhraseId === item.phrase.id}
                            onPreview={setPreviewPhrase}
                            onStartPractice={onStartPractice}
                            onCategoryClick={setCategoryFilter}
                            categoryInfo={categoryMap.get(item.phrase.category)}
                            allCategories={categories}
                            onUpdatePhraseCategory={onUpdatePhraseCategory}
                            onOpenWordAnalysis={onOpenWordAnalysis}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {previewPhrase && (
        <PhrasePreviewModal
          phrase={previewPhrase}
          onClose={() => setPreviewPhrase(null)}
          onStartPractice={onStartPractice}
        />
      )}
      {contextMenu && (
        <CategoryFilterContextMenu
          category={contextMenu.category}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={handleContextMenuClose}
          onEdit={() => {
            handleContextMenuClose();
            onEditCategory(contextMenu.category);
          }}
          onOpenAssistant={() => {
            handleContextMenuClose();
            onOpenAssistant(contextMenu.category);
          }}
        />
      )}
      {isFindDuplicatesModalOpen && (
        <FindDuplicatesModal
          onClose={() => setIsFindDuplicatesModalOpen(false)}
          onFindDuplicates={onFindDuplicates}
          updateAndSavePhrases={updateAndSavePhrases}
          phrases={phrases}
          backendService={backendService}
        />
      )}
    </div>
  );
};

export default PhraseListPage;
