import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * App.tsx
 *
 * The main entry point and root component of the Lingogo application.
 * This component orchestrates:
 * - Global state management (user, language, preferences).
 * - Routing and view switching (Practice, Library, Phrase List, Reader).
 * - Modal management for various features (Add Phrase, Settings, Deep Dive, etc.).
 * - Integration with the centralized `useDataOperations` hook for data persistence and synchronization.
 * - Error handling and Toast notifications.
 */
import AccountDrawer from './components/AccountDrawer';
import AddPhraseModal from './components/AddPhraseModal';
import AdjectiveDeclensionModal from './components/AdjectiveDeclensionModal';
import AiErrorBoundary from './components/AiErrorBoundary';
import AutoFillLoadingModal from './components/AutoFillLoadingModal';
import AutoFillPreviewModal from './components/AutoFillPreviewModal';
import CategoryAssistantModal from './components/CategoryAssistantModal';
import CategoryDetailModal from './components/CategoryDetailModal';
import CategoryFormModal from './components/CategoryFormModal';
import CategoryManagerModal from './components/CategoryManagerModal';
import ChatModal from './components/ChatModal';
import ConfirmCategoryFillModal from './components/ConfirmCategoryFillModal';
import ConfirmDeleteCategoryModal from './components/ConfirmDeleteCategoryModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import ConfirmDeletePhrasesModal from './components/ConfirmDeletePhrasesModal';
import DeepDiveModal from './components/DeepDiveModal';
import DiscussTranslationModal from './components/DiscussTranslationModal';
import EditPhraseModal from './components/EditPhraseModal';
import ExpandingFab from './components/ExpandingFab';
import Header from './components/Header';
// Improve Phrase Modal
import ImprovePhraseModal from './components/ImprovePhraseModal';
import LanguageOnboardingModal from './components/LanguageOnboardingModal';
import LearningAssistantModal from './components/LearningAssistantModal';
// Leech Modal
import { LeechModal } from './components/LeechModal.tsx';
import MoveOrSkipModal from './components/MoveOrSkipModal';
import MovieExamplesModal from './components/MovieExamplesModal';
import NounDeclensionModal from './components/NounDeclensionModal';
import PracticeChatFab from './components/PracticeChatFab';
import PracticeChatModal_v2 from './components/PracticeChatModal_v2';
import PronounsModal from './components/PronounsModal';
import SentenceChainModal from './components/SentenceChainModal';
import SettingsModal from './components/SettingsModal';
import SmartImportModal from './components/SmartImportModal';
import { Toast, ToastState, ToastType } from './components/Toast';
import VerbConjugationModal from './components/VerbConjugationModal';
import VoiceWorkspaceModal from './components/VoiceWorkspaceModal';
import WFragenModal from './components/WFragenModal';
import WordAnalysisModal from './components/WordAnalysisModal';
import { useAuth } from './contexts/authContext.tsx';
import { useLanguage } from './contexts/languageContext.tsx';
import { useAutoFixPhrases } from './hooks/useAutoFixPhrases.ts';
// Data Operations
import useDataOperations from './hooks/useDataOperations.ts';
import useImprovePhraseModal from './hooks/useImprovePhraseModal';
import { useLanguageOnboarding } from './hooks/useLanguageOnboarding.ts';
import useLearningAssistantModal from './hooks/useLearningAssistantModal.ts';
import useLeechModal from './hooks/useLeechModal.ts';
import { useTranslation } from './hooks/useTranslation.ts';
import LibraryPage from './pages/LibraryPage.tsx';
import PhraseListPage from './pages/PhraseListPage.tsx';
import PracticePage from './pages/PracticePage.tsx';
import { ReaderPage } from './pages/ReaderPage.tsx';
import * as backendService from './services/backendService';
import * as cacheService from './services/cacheService';
import { buildPracticeAnalyticsSummary } from './services/practiceAnalyticsService';
import { playCorrectSound, playIncorrectSound } from './services/soundService';
import * as srsService from './services/srsService';
import {
  AdjectiveDeclension,
  AnimationDirection,
  AnimationState,
  Category,
  CategoryAssistantRequest,
  ChatMessage,
  DeepDiveAnalysis,
  LanguageCode,
  MovieExample,
  NounDeclension,
  Phrase,
  PhraseCategory,
  PhraseEvaluation,
  PracticeReviewAction,
  ProposedCard,
  VerbConjugation,
  View,
  WordAnalysis,
} from './types.ts';

// Helper function for retrying API calls with a delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const App: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;
  const { profile: languageProfile } = useLanguage();
  // Onboarding Hook: Manages the initial user setup and language detection.
  const {
    needsOnboarding,
    isLoading: isOnboardingLoading,
    isGeneratingData,
    detectedLanguage,
    completeOnboarding,
  } = useLanguageOnboarding(userId || null);

  // --- View State ---
  // Controls the currently active main view of the application.
  const [view, setView] = useState<View>('practice');
  const [highlightedPhraseId, setHighlightedPhraseId] = useState<string | null>(null);
  const [activeBookId, setActiveBookId] = useState<number | null>(null);

  // --- Practice Session State ---
  // (Lifted from PracticePage to maintain state across view switches)
  const [isPracticeAnswerRevealed, setIsPracticeAnswerRevealed] = useState(false);
  const [practiceCardEvaluated, setPracticeCardEvaluated] = useState(false);
  const [practiceAnimationState, setPracticeAnimationState] = useState<AnimationState>({ key: '', direction: 'right' });
  const [cardHistory, setCardHistory] = useState<string[]>([]);
  const [practiceCategoryFilter, setPracticeCategoryFilter] = useState<'all' | PhraseCategory>('all');
  const practiceIsExitingRef = useRef(false);
  const specificPhraseRequestedRef = useRef(false);
  // --- End Practice Session State ---

  // Leech Modal
  const { leechPhrase, handleOpenLeechModal, isLeechModalOpen, handleCloseLeechModal } = useLeechModal();

  // Improve Phrase Modal
  const {
    phraseToImprove,
    handleOpenImproveModal,
    isImproveModalOpen,
    setIsImproveModalOpen,
    handleCloseImproveModal,
  } = useImprovePhraseModal();

  // Learning Assistant Modal
  const {
    isLearningAssistantModalOpen,
    learningAssistantPhrase,
    learningAssistantCache,
    setLearningAssistantCache,
    handleOpenLearningAssistant,
    handleCloseLearningAssistant,
  } = useLearningAssistantModal();

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback((config: { message: string; type?: ToastType }) => {
    setToast({
      message: config.message,
      type: config.type || 'default',
      id: Date.now(),
    });
  }, []);

  // --- Data & API Operations ---
  // Centralized hook for managing phrases, categories, SRS, stats, and API interactions.
  const {
    updateAndSavePhrases,
    updateAndSaveCategories,
    fetchNewPhrases,
    allPhrases,
    categories,
    isLoading,
    error,
    callApiWithFallback,
    updateSettings,
    updatePracticeChatHistory,
    updatePracticeChatSessionComplete,
    updateHabitTrackerChange,
    updateButtonUsage,
    updateMasteryButtonUsage,
    updateCardActionUsage,
    currentPracticePhrase,
    setCurrentPracticePhrase,
    settings,
    apiProvider,
    apiProviderType,
    buttonUsage,
    habitTracker,
    practiceChatSessions,
    isGenerating,
    cardActionUsage,
    masteryButtonUsage,
    updatePhraseMasteryAndCache,
    practiceReviewLog,
  } = useDataOperations(view, userId, needsOnboarding, isOnboardingLoading, languageProfile, showToast);

  // --- Modal Visibility States ---
  // Each modal has a corresponding boolean state to control its open/closed status.
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatContextPhrase, setChatContextPhrase] = useState<Phrase | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [isDeepDiveModalOpen, setIsDeepDiveModalOpen] = useState(false);
  const [deepDivePhrase, setDeepDivePhrase] = useState<Phrase | null>(null);
  const [deepDiveAnalysis, setDeepDiveAnalysis] = useState<DeepDiveAnalysis | null>(null);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState<boolean>(false);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);

  const [isMovieExamplesModalOpen, setIsMovieExamplesModalOpen] = useState(false);
  const [movieExamplesPhrase, setMovieExamplesPhrase] = useState<Phrase | null>(null);
  const [movieExamples, setMovieExamples] = useState<MovieExample[]>([]);
  const [isMovieExamplesLoading, setIsMovieExamplesLoading] = useState<boolean>(false);
  const [movieExamplesError, setMovieExamplesError] = useState<string | null>(null);

  const [isWordAnalysisModalOpen, setIsWordAnalysisModalOpen] = useState(false);
  const [wordAnalysisPhrase, setWordAnalysisPhrase] = useState<Phrase | null>(null);
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [wordAnalysis, setWordAnalysis] = useState<WordAnalysis | null>(null);
  const [isWordAnalysisLoading, setIsWordAnalysisLoading] = useState<boolean>(false);
  const [wordAnalysisError, setWordAnalysisError] = useState<string | null>(null);

  const [isVerbConjugationModalOpen, setIsVerbConjugationModalOpen] = useState(false);
  const [conjugationVerb, setConjugationVerb] = useState<string>('');

  const [isNounDeclensionModalOpen, setIsNounDeclensionModalOpen] = useState(false);
  const [nounDeclensionData, setNounDeclensionData] = useState<NounDeclension | null>(null);
  const [isNounDeclensionLoading, setIsNounDeclensionLoading] = useState<boolean>(false);
  const [nounDeclensionError, setNounDeclensionError] = useState<string | null>(null);
  const [declensionNoun, setDeclensionNoun] = useState<{
    noun: string;
    article: string;
  } | null>(null);

  const [isAdjectiveDeclensionModalOpen, setIsAdjectiveDeclensionModalOpen] = useState(false);
  const [adjectiveDeclensionData, setAdjectiveDeclensionData] = useState<AdjectiveDeclension | null>(null);
  const [isAdjectiveDeclensionLoading, setIsAdjectiveDeclensionLoading] = useState<boolean>(false);
  const [adjectiveDeclensionError, setAdjectiveDeclensionError] = useState<string | null>(null);
  const [declensionAdjective, setDeclensionAdjective] = useState<string>('');

  const [isSentenceChainModalOpen, setIsSentenceChainModalOpen] = useState(false);
  const [sentenceChainPhrase, setSentenceChainPhrase] = useState<Phrase | null>(null);

  const [isAddPhraseModalOpen, setIsAddPhraseModalOpen] = useState(false);
  const [addPhraseConfig, setAddPhraseConfig] = useState({
    language: 'ru' as LanguageCode,
    autoSubmit: true,
  });

  const [isSmartImportModalOpen, setIsSmartImportModalOpen] = useState(false);
  const [smartImportInitialTopic, setSmartImportInitialTopic] = useState<string | undefined>();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [phraseToEdit, setPhraseToEdit] = useState<Phrase | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [phraseToDelete, setPhraseToDelete] = useState<Phrase | null>(null);

  const [isVoiceWorkspaceModalOpen, setIsVoiceWorkspaceModalOpen] = useState(false);
  const [voiceWorkspacePhrase, setVoiceWorkspacePhrase] = useState<Phrase | null>(null);

  const [isDiscussModalOpen, setIsDiscussModalOpen] = useState(false);
  const [phraseToDiscuss, setPhraseToDiscuss] = useState<Phrase | null>(null);
  const [discussInitialMessage, setDiscussInitialMessage] = useState<string | undefined>();

  const [isPronounsModalOpen, setIsPronounsModalOpen] = useState(false);
  const [isWFragenModalOpen, setIsWFragenModalOpen] = useState(false);

  const [isCategoryManagerModalOpen, setIsCategoryManagerModalOpen] = useState(false);
  const [categoryToView, setCategoryToView] = useState<Category | null>(null);
  const [isCategoryFormModalOpen, setIsCategoryFormModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isAddingCategoryFromPractice, setIsAddingCategoryFromPractice] = useState(false);

  // New state for auto-fill flow
  const [categoryToAutoFill, setCategoryToAutoFill] = useState<Category | null>(null);
  const [autoFillingCategory, setAutoFillingCategory] = useState<Category | null>(null);
  const [isAutoFillPreviewOpen, setIsAutoFillPreviewOpen] = useState(false);
  const [proposedCardsForFill, setProposedCardsForFill] = useState<ProposedCard[]>([]);
  const [isRefining, setIsRefining] = useState(false);

  // New state for duplicate review flow
  const [isMoveOrSkipModalOpen, setIsMoveOrSkipModalOpen] = useState(false);
  const [duplicatesReviewData, setDuplicatesReviewData] = useState<{
    duplicates: { existingPhrase: Phrase; proposedCard: ProposedCard }[];
    newCards: ProposedCard[];
    targetCategory: Category;
  } | null>(null);

  // New state for Category Assistant
  const [assistantCache, setAssistantCache] = useState<{
    [categoryId: string]: ChatMessage[];
  }>({});
  const [isCategoryAssistantModalOpen, setIsCategoryAssistantModalOpen] = useState(false);
  const [assistantCategory, setAssistantCategory] = useState<Category | null>(null);

  // New state for multi-delete confirmation
  const [isConfirmDeletePhrasesModalOpen, setIsConfirmDeletePhrasesModalOpen] = useState(false);
  const [phrasesForDeletion, setPhrasesForDeletion] = useState<{
    phrases: Phrase[];
    sourceCategory: Category;
  } | null>(null);

  // New state for practice chat
  const [isPracticeChatModalOpen, setIsPracticeChatModalOpen] = useState(false);

  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);

  // --- Event Handlers ---

  const openChatForPhrase = (phrase: Phrase) => {
    setChatContextPhrase(phrase);
    setIsChatModalOpen(true);
  };

  /**
   * Generates a "Deep Dive" analysis for a phrase using AI.
   * Checks local cache first before making an API call.
   */
  const handleOpenDeepDive = useCallback(
    async (phrase: Phrase) => {
      setDeepDivePhrase(phrase);
      setIsDeepDiveModalOpen(true);
      setIsDeepDiveLoading(true);
      setDeepDiveAnalysis(null);
      setDeepDiveError(null);
      const cacheKey = `deep_dive_${phrase.id}`;
      const cachedAnalysis = cacheService.getCache<DeepDiveAnalysis>(cacheKey);
      if (cachedAnalysis) {
        setDeepDiveAnalysis(cachedAnalysis);
        setIsDeepDiveLoading(false);
        return;
      }
      try {
        const analysis = await callApiWithFallback((provider) => provider.generateDeepDiveAnalysis(phrase));
        setDeepDiveAnalysis(analysis);
        cacheService.setCache(cacheKey, analysis);
      } catch (err) {
        setDeepDiveError(err instanceof Error ? err.message : 'Unknown error during analysis generation.');
      } finally {
        setIsDeepDiveLoading(false);
      }
    },
    [callApiWithFallback]
  );

  /**
   * Generates movie examples for a phrase using AI.
   * Checks local cache first.
   */
  const handleOpenMovieExamples = useCallback(
    async (phrase: Phrase) => {
      setMovieExamplesPhrase(phrase);
      setIsMovieExamplesModalOpen(true);
      setIsMovieExamplesLoading(true);
      setMovieExamples([]);
      setMovieExamplesError(null);
      const cacheKey = `movie_examples_${phrase.id}`;
      const cachedExamples = cacheService.getCache<MovieExample[]>(cacheKey);
      if (cachedExamples) {
        setMovieExamples(cachedExamples);
        setIsMovieExamplesLoading(false);
        return;
      }
      try {
        const examples = await callApiWithFallback((provider) => provider.generateMovieExamples(phrase));
        setMovieExamples(examples);
        cacheService.setCache(cacheKey, examples);
      } catch (err) {
        setMovieExamplesError(err instanceof Error ? err.message : 'Unknown error during example generation.');
      } finally {
        setIsMovieExamplesLoading(false);
      }
    },
    [callApiWithFallback]
  );

  /**
   * Analyzes a specific word within a phrase to provide context-aware meaning.
   */
  const analyzeWord = useCallback(
    async (phrase: Phrase, word: string): Promise<WordAnalysis | null> => {
      const cacheKey = `word_analysis_${phrase.id}_${word.toLowerCase()}`;
      const cachedAnalysis = cacheService.getCache<WordAnalysis>(cacheKey);
      if (cachedAnalysis) return cachedAnalysis;

      try {
        const analysis = await callApiWithFallback((provider) => provider.analyzeWordInPhrase(phrase, word));
        cacheService.setCache(cacheKey, analysis);
        return analysis;
      } catch (err) {
        console.error('Error analyzing word:', err);
        return null;
      }
    },
    [callApiWithFallback]
  );

  const handleOpenWordAnalysis = useCallback(
    async (phrase: Phrase, word: string) => {
      if (isWordAnalysisLoading) return;
      setWordAnalysisPhrase(phrase);
      setSelectedWord(word);
      setIsWordAnalysisModalOpen(true);
      setIsWordAnalysisLoading(true);
      setWordAnalysis(null);
      setWordAnalysisError(null);

      const analysisResult = await analyzeWord(phrase, word);
      if (analysisResult) {
        setWordAnalysis(analysisResult);
      } else {
        setWordAnalysisError('Unknown error during word analysis.');
      }
      setIsWordAnalysisLoading(false);
    },
    [analyzeWord, isWordAnalysisLoading]
  );

  const handleOpenVerbConjugation = useCallback((infinitive: string) => {
    setConjugationVerb(infinitive);
    setIsVerbConjugationModalOpen(true);
  }, []);

  /**
   * Fetches noun declension tables (cases) for a given noun.
   */
  const handleOpenNounDeclension = useCallback(
    async (noun: string, article: string) => {
      setDeclensionNoun({ noun, article });
      setIsNounDeclensionModalOpen(true);
      setIsNounDeclensionLoading(true);
      setNounDeclensionData(null);
      setNounDeclensionError(null);
      const cacheKey = `noun_declension_${article}_${noun}`;
      const cachedData = cacheService.getCache<NounDeclension>(cacheKey);
      if (cachedData) {
        setNounDeclensionData(cachedData);
        setIsNounDeclensionLoading(false);
        return;
      }
      try {
        const data = await callApiWithFallback((provider) => provider.declineNoun(noun, article));
        setNounDeclensionData(data);
        cacheService.setCache(cacheKey, data);
      } catch (err) {
        setNounDeclensionError(err instanceof Error ? err.message : 'Unknown error during declension generation.');
      } finally {
        setIsNounDeclensionLoading(false);
      }
    },
    [callApiWithFallback]
  );

  /**
   * Fetches adjective declension tables (endings) for a given adjective.
   */
  const handleOpenAdjectiveDeclension = useCallback(
    async (adjective: string) => {
      setDeclensionAdjective(adjective);
      setIsAdjectiveDeclensionModalOpen(true);
      setIsAdjectiveDeclensionLoading(true);
      setAdjectiveDeclensionData(null);
      setAdjectiveDeclensionError(null);
      const cacheKey = `adj_declension_${adjective}`;
      const cachedData = cacheService.getCache<AdjectiveDeclension>(cacheKey);
      if (cachedData) {
        setAdjectiveDeclensionData(cachedData);
        setIsAdjectiveDeclensionLoading(false);
        return;
      }
      try {
        const data = await callApiWithFallback((provider) => provider.declineAdjective(adjective));
        setAdjectiveDeclensionData(data);
        cacheService.setCache(cacheKey, data);
      } catch (err) {
        setAdjectiveDeclensionError(
          err instanceof Error ? err.message : 'Unknown error during adjective declension generation.'
        );
      } finally {
        setIsAdjectiveDeclensionLoading(false);
      }
    },
    [callApiWithFallback]
  );

  const handleOpenSentenceChain = (phrase: Phrase) => {
    setSentenceChainPhrase(phrase);
    setIsSentenceChainModalOpen(true);
  };

  const handleOpenVoiceWorkspace = (phrase: Phrase) => {
    setVoiceWorkspacePhrase(phrase);
    setIsVoiceWorkspaceModalOpen(true);
  };

  // --- AI Interaction Wrappers ---
  // These functions wrap the AI provider calls, enabling easy component integration.

  const handleEvaluatePhraseAttempt = useCallback(
    (phrase: Phrase, userAttempt: string): Promise<PhraseEvaluation> => {
      return callApiWithFallback((provider) => provider.evaluatePhraseAttempt(phrase, userAttempt));
    },
    [callApiWithFallback]
  );

  const handleEvaluateSpokenPhraseAttempt = useCallback(
    (phrase: Phrase, userAttempt: string): Promise<PhraseEvaluation> => {
      return callApiWithFallback((provider) => provider.evaluateSpokenPhraseAttempt(phrase, userAttempt));
    },
    [callApiWithFallback]
  );

  const handleGenerateContinuations = useCallback(
    (nativePhrase: string) => callApiWithFallback((provider) => provider.generateSentenceContinuations(nativePhrase)),
    [callApiWithFallback]
  );
  const handleGenerateInitialExamples = useCallback(
    (phrase: Phrase) => callApiWithFallback((provider) => provider.generateInitialExamples(phrase)),
    [callApiWithFallback]
  );
  const handleContinueChat = useCallback(
    (phrase: Phrase, history: any[], newMessage: string) =>
      callApiWithFallback((provider) => provider.continueChat(phrase, history, newMessage)),
    [callApiWithFallback]
  );
  const handlePracticeConversation = useCallback(
    (history: ChatMessage[], newMessage: string) =>
      callApiWithFallback((provider) => provider.practiceConversation(history, newMessage, allPhrases)),
    [callApiWithFallback, allPhrases]
  );
  const handleGuideToTranslation = useCallback(
    (phrase: Phrase, history: ChatMessage[], userAnswer: string) =>
      callApiWithFallback((provider) => provider.guideToTranslation(phrase, history, userAnswer)),
    [callApiWithFallback]
  );
  const handleGenerateSinglePhrase = useCallback(
    (nativePhrase: string) => callApiWithFallback((provider) => provider.generateSinglePhrase(nativePhrase)),
    [callApiWithFallback]
  );
  const handleTranslateLearningToNative = useCallback(
    (learningPhrase: string) => callApiWithFallback((provider) => provider.translateLearningToNative(learningPhrase)),
    [callApiWithFallback]
  );
  const handleGetWordTranslation = useCallback(
    async (
      nativePhrase: string,
      learningPhrase: string,
      nativeWord: string
    ): Promise<{ learningTranslation: string }> => {
      const cacheKey = `word_translation_${nativePhrase}_${nativeWord}`;
      const cached = cacheService.getCache<{ learningTranslation: string }>(cacheKey);
      if (cached) return cached;

      const result = await callApiWithFallback((provider) =>
        provider.getWordTranslation(nativePhrase, learningPhrase, nativeWord)
      );
      cacheService.setCache(cacheKey, result);
      return result;
    },
    [callApiWithFallback]
  );
  const handleGenerateCardsFromTranscript = useCallback(
    (transcript: string, sourceLang: 'ru' | 'de') =>
      callApiWithFallback((provider) => provider.generateCardsFromTranscript(transcript, sourceLang)),
    [callApiWithFallback]
  );
  const handleGenerateCardsFromImage = useCallback(
    (imageData: { mimeType: string; data: string }) =>
      callApiWithFallback((provider) => provider.generateCardsFromImage(imageData)),
    [callApiWithFallback]
  );
  const handleGenerateTopicCards = useCallback(
    (topic: string, refinement?: string, existingPhrases?: string[]) =>
      callApiWithFallback((provider) => provider.generateTopicCards(topic, refinement, existingPhrases)),
    [callApiWithFallback]
  );
  const handleClassifyTopic = useCallback(
    (topic: string) => callApiWithFallback((provider) => provider.classifyTopic(topic)),
    [callApiWithFallback]
  );
  const handleGetCategoryAssistantResponse = useCallback(
    (categoryName: string, existingPhrases: Phrase[], request: CategoryAssistantRequest, history?: ChatMessage[]) =>
      callApiWithFallback((provider) =>
        provider.getCategoryAssistantResponse(categoryName, existingPhrases, request, history)
      ),
    [callApiWithFallback]
  );
  const handleConjugateVerbSimple = useCallback(
    async (infinitive: string) => {
      const cacheKey = cacheService.createLanguageAwareKey(`verb_conjugation_simple_${infinitive}`);
      const cached = cacheService.getCache<any[]>(cacheKey);
      if (cached) return cached;
      const result = await callApiWithFallback((provider) => provider.conjugateVerbSimple(infinitive));
      cacheService.setCache(cacheKey, result);
      return result;
    },
    [callApiWithFallback]
  );
  const handleConjugateVerbDetailed = useCallback(
    async (infinitive: string) => {
      const cacheKey = cacheService.createLanguageAwareKey(`verb_conjugation_detailed_${infinitive}`);
      const cached = cacheService.getCache<VerbConjugation>(cacheKey);
      if (cached) return cached;
      const result = await callApiWithFallback((provider) => provider.conjugateVerb(infinitive));
      cacheService.setCache(cacheKey, result);
      return result;
    },
    [callApiWithFallback]
  );

  // --- Phrase Creation & Modification Handlers ---

  const handleOpenAddPhraseModal = (options: { language: LanguageCode; autoSubmit: boolean }) => {
    setAddPhraseConfig(options);
    setIsAddPhraseModalOpen(true);
  };

  /**
   * Handles the creation of a new phrase from the Add Phrase modal.
   * Performs deduplication checks before saving.
   */
  const handlePhraseCreated = async (newPhraseData: { learning: string; native: string }) => {
    const normalizedLearning = newPhraseData.learning.trim().toLowerCase();
    const isDuplicate = allPhrases.some((p) => p.text.learning.trim().toLowerCase() === normalizedLearning);
    const isDuplicateInCategory = categoryToView
      ? allPhrases.some(
          (p) => p.category === categoryToView.id && p.text.learning.trim().toLowerCase() === normalizedLearning
        )
      : false;

    if (isDuplicateInCategory) {
      const message = t('notifications.phrases.existsInCategory', {
        phrase: newPhraseData.learning,
      });
      showToast({ message });
      throw new Error(message);
    } else if (isDuplicate) {
      const message = t('notifications.phrases.existsInOtherCategory', {
        phrase: newPhraseData.learning,
      });
      showToast({ message });
      throw new Error(message);
    }

    try {
      const generalCategory = categories.find((c) => c.name.toLowerCase() === 'общие');
      const defaultCategoryId = categories.length > 0 ? categories[0].id : '1';
      const categoryId = categoryToView?.id || generalCategory?.id || defaultCategoryId;

      // FIX: The Phrase type requires a nested `text` object.
      const phraseToCreate = {
        text: { learning: newPhraseData.learning, native: newPhraseData.native },
        category: categoryId,
      };
      const newPhrase = await backendService.createPhrase(phraseToCreate);

      updateAndSavePhrases((prev) => [{ ...newPhrase, isNew: true }, ...prev]);
      setIsAddPhraseModalOpen(false);

      if (!categoryToView) {
        setCurrentPracticePhrase(newPhrase);
        setIsPracticeAnswerRevealed(false);
        setView('practice');
      }
    } catch (err) {
      showToast({
        message: t('notifications.phrases.createError', {
          message: (err as Error).message,
        }),
      });
    }
  };

  /**
   * Processes proposed cards (from auto-fill or smart import) and adds them to a category.
   * Handles duplicate detection and moves duplicates to review if necessary.
   */
  const handleCreateProposedCards = useCallback(
    async (proposedCards: ProposedCard[], options?: { categoryId?: string; createCategoryName?: string }) => {
      let finalCategoryId = options?.categoryId;
      let newCategory: Category | null = null;

      if (options?.createCategoryName && !finalCategoryId) {
        const trimmedName = options.createCategoryName.trim();
        const existingCategory = categories.find((c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase());

        if (existingCategory) {
          finalCategoryId = existingCategory.id;
        } else {
          const colors = [
            'bg-red-500',
            'bg-orange-500',
            'bg-amber-500',
            'bg-yellow-500',
            'bg-lime-500',
            'bg-green-500',
            'bg-emerald-500',
            'bg-teal-500',
            'bg-cyan-500',
            'bg-sky-500',
            'bg-blue-500',
            'bg-indigo-500',
            'bg-violet-500',
            'bg-fuchsia-500',
            'bg-pink-500',
            'bg-rose-500',
          ];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          const capitalizedName = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);

          const newCategoryData = {
            name: capitalizedName,
            color: randomColor,
            isFoundational: false,
          };

          try {
            newCategory = await backendService.createCategory(newCategoryData);
            updateAndSaveCategories((prev) => [...prev, newCategory!]);
            updateSettings({
              enabledCategories: {
                ...settings.enabledCategories,
                [newCategory.id]: true,
              },
            });
            finalCategoryId = newCategory.id;
          } catch (err) {
            showToast({
              message: t('notifications.categories.createError', {
                message: (err as Error).message,
              }),
            });
            return;
          }
        }
      }

      const generalCategory = categories.find((c) => c.name.toLowerCase() === 'общие');
      const defaultCategoryId = categories.length > 0 ? categories[0].id : '1';
      const targetCategoryId =
        finalCategoryId || assistantCategory?.id || categoryToView?.id || generalCategory?.id || defaultCategoryId;

      const targetCategory = newCategory || categories.find((c) => c.id === targetCategoryId);

      if (!targetCategory) {
        console.error('Target category could not be determined.');
        return;
      }

      const duplicatesFound: {
        existingPhrase: Phrase;
        proposedCard: ProposedCard;
      }[] = [];
      const newCards: ProposedCard[] = [];
      const normalizedExistingPhrases = new Map<string, Phrase>();
      allPhrases.forEach((p) => {
        normalizedExistingPhrases.set(p.text.learning.trim().toLowerCase(), p);
      });

      proposedCards.forEach((proposed) => {
        // FIX: Use `proposed.learning` instead of `proposed.learning`
        // Use `proposed.learning` instead of `proposed.learning`
        const normalizedProposed = proposed.learning.trim().toLowerCase();
        const existingPhrase = normalizedExistingPhrases.get(normalizedProposed);

        if (existingPhrase && existingPhrase.category !== targetCategory.id) {
          duplicatesFound.push({ existingPhrase, proposedCard: proposed });
        } else if (!existingPhrase) {
          newCards.push(proposed);
        }
      });

      if (duplicatesFound.length > 0) {
        setDuplicatesReviewData({
          duplicates: duplicatesFound,
          newCards: newCards,
          targetCategory: targetCategory,
        });
        setIsMoveOrSkipModalOpen(true);
        setIsSmartImportModalOpen(false);
        setSmartImportInitialTopic(undefined);
        return;
      }

      const addedCount = await addCardsToCategory(newCards, targetCategory);

      const skippedCount = proposedCards.length - addedCount;
      const baseToastMessage = t('notifications.cards.bulkAdded', {
        count: addedCount,
      });
      const toastMessage =
        skippedCount > 0
          ? `${baseToastMessage} ${t('notifications.cards.bulkSkipped', {
              count: skippedCount,
            })}`
          : baseToastMessage;
      showToast({ message: toastMessage });

      if (categoryToView || assistantCategory) {
        /* stay in view */
      } else {
        setView('list');
        setHighlightedPhraseId(null);
      }
    },
    [
      allPhrases,
      categories,
      categoryToView,
      assistantCategory,
      settings.enabledCategories,
      updateSettings,
      showToast,
      updateAndSaveCategories,
      updateAndSavePhrases,
    ]
  );

  const handleCreateCardFromWord = useCallback(
    async (phraseData: { learning: string; native: string }) => {
      const alreadyExists = allPhrases.some(
        (p) => p.text.learning.trim().toLowerCase() === phraseData.learning.trim().toLowerCase()
      );
      if (alreadyExists) {
        showToast({
          message: t('notifications.phrases.exists', {
            phrase: phraseData.learning,
          }),
        });
        return;
      }

      try {
        const generalCategory = categories.find((c) => c.name.toLowerCase() === 'общие');
        const defaultCategoryId = categories.length > 0 ? categories[0].id : '1';
        const categoryId = generalCategory?.id || defaultCategoryId;

        // FIX: The Phrase type requires a nested `text` object.
        const phraseToCreate = {
          text: { learning: phraseData.learning, native: phraseData.native },
          category: categoryId,
        };
        const newPhrase = await backendService.createPhrase(phraseToCreate);

        updateAndSavePhrases((prev) => [{ ...newPhrase, isNew: true }, ...prev]);
        showToast({
          message: t('notifications.phrases.created', {
            phrase: phraseData.learning,
          }),
        });
      } catch (err) {
        showToast({
          message: t('notifications.phrases.createCardError', {
            message: (err as Error).message,
          }),
        });
      }
    },
    [allPhrases, categories, updateAndSavePhrases, showToast]
  );

  const handleCreateCardFromSelection = useCallback(
    async (learningText: string): Promise<boolean> => {
      const alreadyExists = allPhrases.some(
        (p) => p.text.learning.trim().toLowerCase() === learningText.trim().toLowerCase()
      );
      if (alreadyExists) {
        showToast({
          message: t('notifications.phrases.exists', { phrase: learningText }),
        });
        return false;
      }

      try {
        const { native } = await callApiWithFallback((provider) => provider.translateLearningToNative(learningText));
        const generalCategory = categories.find((c) => c.name.toLowerCase() === 'общие');
        const defaultCategoryId = categories.length > 0 ? categories[0].id : '1';
        const categoryId = generalCategory?.id || defaultCategoryId;

        // FIX: The Phrase type requires a nested `text` object.
        const phraseToCreate = {
          text: { learning: learningText, native: native },
          category: categoryId,
        };
        const newPhrase = await backendService.createPhrase(phraseToCreate);

        updateAndSavePhrases((prev) => [{ ...newPhrase, isNew: true }, ...prev]);
        showToast({
          message: t('notifications.phrases.created', { phrase: learningText }),
        });
        return true;
      } catch (error) {
        console.error('Failed to create card from selection:', error);
        showToast({
          message: t('notifications.phrases.createCardGenericError'),
        });
        return false;
      }
    },
    [allPhrases, categories, updateAndSavePhrases, showToast, callApiWithFallback, apiProvider]
  );

  const handleOpenDiscussion = (phraseForDiscussion: Phrase) => {
    setPhraseToDiscuss(phraseForDiscussion);
    setDiscussInitialMessage(
      'Давай обсудим, можно ли эту фразу улучшить и правильно, если она звучит с точки зрения носителя языка'
    );
    setIsDiscussModalOpen(true);
  };

  const handleTranslatePhrase = useCallback(
    (native: string) => callApiWithFallback((provider) => provider.translatePhrase(native)),
    [callApiWithFallback]
  );

  const handleDiscussTranslation = useCallback(
    (request: any) => callApiWithFallback((provider) => provider.discussTranslation(request)),
    [callApiWithFallback]
  );

  const handleFindDuplicates = useCallback(
    () => callApiWithFallback((provider) => provider.findDuplicatePhrases(allPhrases)),
    [callApiWithFallback, allPhrases]
  );

  const handlePhraseImproved = async (phraseId: string, newLearning: string, newNative?: string) => {
    const originalPhrase = allPhrases.find((p) => p.id === phraseId);
    if (!originalPhrase) return;
    // FIX: Use nested text object to match Phrase type
    const updatedPhrase = {
      ...originalPhrase,
      text: {
        learning: newLearning,
        native: newNative ?? originalPhrase.text.native,
      },
    };
    try {
      await backendService.updatePhrase(updatedPhrase);
      updateAndSavePhrases((prev) => prev.map((p) => (p.id === phraseId ? updatedPhrase : p)));
    } catch (err) {
      showToast({
        message: t('notifications.updateError', {
          message: (err as Error).message,
        }),
      });
    }
  };

  const handleSavePhraseEdits = async (phraseId: string, updates: Partial<Omit<Phrase, 'id'>>) => {
    const originalPhrase = allPhrases.find((p) => p.id === phraseId);
    if (!originalPhrase) return;
    const updatedPhrase = { ...originalPhrase, ...updates };
    try {
      await backendService.updatePhrase(updatedPhrase);
      updateAndSavePhrases((prev) => prev.map((p) => (p.id === phraseId ? updatedPhrase : p)));
    } catch (err) {
      showToast({
        message: t('notifications.saveError', {
          message: (err as Error).message,
        }),
      });
    }
  };

  const handleOpenEditModal = (phrase: Phrase) => {
    setPhraseToEdit(phrase);
    setIsEditModalOpen(true);
  };

  const handleDeletePhrase = useCallback(
    (phraseId: string) => {
      const phrase = allPhrases.find((p) => p.id === phraseId);
      if (phrase) {
        setPhraseToDelete(phrase);
        setIsDeleteModalOpen(true);
      }
    },
    [allPhrases]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (phraseToDelete) {
      try {
        await backendService.deletePhrase(phraseToDelete.id);
        updateAndSavePhrases((prev) => prev.filter((p) => p.id !== phraseToDelete.id));
        if (currentPracticePhrase?.id === phraseToDelete.id) {
          setCurrentPracticePhrase(null); // Clear from practice view if it was active
        }
      } catch (err) {
        showToast({
          message: t('notifications.deleteError', {
            message: (err as Error).message,
          }),
        });
      } finally {
        setIsDeleteModalOpen(false);
        setPhraseToDelete(null);
      }
    }
  }, [phraseToDelete, updateAndSavePhrases, currentPracticePhrase, showToast]);

  const handleStartPracticeWithPhrase = (phraseToPractice: Phrase) => {
    specificPhraseRequestedRef.current = true;
    setCurrentPracticePhrase(phraseToPractice);
    setIsPracticeAnswerRevealed(false);
    setCardHistory([]);
    setView('practice');
  };

  const handleStartPracticeWithCategory = (categoryId: PhraseCategory) => {
    setPracticeCategoryFilter(categoryId);
    setView('practice');
  };

  const handleGoToListFromPractice = (phrase: Phrase) => {
    setView('list');
    setHighlightedPhraseId(phrase.id);
  };

  const handleOpenDiscussModal = (phrase: Phrase) => {
    setPhraseToDiscuss(phrase);
    setDiscussInitialMessage(
      'Проанализируй, пожалуйста, текущий перевод. Насколько он точен и естественен? Есть ли более удачные альтернативы?'
    );
    setIsDiscussModalOpen(true);
  };

  const handleDiscussionAccept = (suggestion: { native: string; learning: string }) => {
    if (phraseToDiscuss) {
      handlePhraseImproved(phraseToDiscuss.id, suggestion.learning, suggestion.native);
    }
    setIsDiscussModalOpen(false);
    setDiscussInitialMessage(undefined);
  };

  const handleMarkPhraseAsSeen = useCallback(
    (phraseId: string) => {
      updateAndSavePhrases((prev) => {
        const phraseExists = prev.some((p) => p.id === phraseId && p.isNew);
        if (!phraseExists) return prev; // Avoid unnecessary updates

        return prev.map((p) => {
          if (p.id === phraseId && p.isNew) {
            const { isNew, ...rest } = p;
            return rest;
          }
          return p;
        });
      });
    },
    [updateAndSavePhrases]
  );

  const handleUpdatePhraseCategory = useCallback(
    async (phraseId: string, newCategoryId: string) => {
      const originalPhrase = allPhrases.find((p) => p.id === phraseId);
      if (!originalPhrase) return;
      const updatedPhrase = { ...originalPhrase, category: newCategoryId };
      try {
        await backendService.updatePhrase(updatedPhrase);
        updateAndSavePhrases((prev) => prev.map((p) => (p.id === phraseId ? updatedPhrase : p)));
      } catch (err) {
        showToast({
          message: t('notifications.moveError', {
            message: (err as Error).message,
          }),
        });
      }
    },
    [allPhrases, updateAndSavePhrases, showToast]
  );

  // --- Category Management Handlers ---
  // Functions for creating, updating, and deleting phrase categories.
  const handleOpenCategoryFormForAdd = () => {
    setIsCategoryManagerModalOpen(false);
    setCategoryToEdit(null);
    setIsCategoryFormModalOpen(true);
  };

  const handleAddCategoryFromPractice = () => {
    setIsAddingCategoryFromPractice(true);
    setCategoryToEdit(null);
    setIsCategoryFormModalOpen(true);
  };

  const handleOpenCategoryFormForEdit = (category: Category) => {
    setIsCategoryManagerModalOpen(false);
    setCategoryToEdit(category);
    setIsCategoryFormModalOpen(true);
  };

  const handleSaveCategory = async (categoryData: { name: string; color: string }): Promise<boolean> => {
    const trimmedName = categoryData.name;
    const lowercasedName = trimmedName.toLowerCase();
    const capitalizedName = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);
    const finalCategoryData = { ...categoryData, name: capitalizedName };

    try {
      if (categoryToEdit) {
        // Editing existing category
        const isDuplicate = categories.some(
          (c) => c.id !== categoryToEdit.id && c.name.trim().toLowerCase() === lowercasedName
        );
        if (isDuplicate) {
          return false;
        }

        const updatedCategory = await backendService.updateCategory({
          ...categoryToEdit,
          ...finalCategoryData,
        });
        updateAndSaveCategories((prev) => prev.map((c) => (c.id === updatedCategory.id ? updatedCategory : c)));
        setIsCategoryFormModalOpen(false);
        setCategoryToEdit(null);
        setIsCategoryManagerModalOpen(true);
      } else {
        // Adding new category
        const isDuplicate = categories.some((c) => c.name.trim().toLowerCase() === lowercasedName);
        if (isDuplicate) {
          return false;
        }

        const newCategoryData: Omit<Category, 'id'> = {
          ...finalCategoryData,
          isFoundational: false,
        };
        const newCategory = await backendService.createCategory(newCategoryData);

        updateAndSaveCategories((prev) => [...prev, newCategory]);
        updateSettings({
          enabledCategories: {
            ...settings.enabledCategories,
            [newCategory.id]: true,
          },
        });
        setIsCategoryFormModalOpen(false);
        setCategoryToEdit(null);
        setCategoryToAutoFill(newCategory);
        if (isAddingCategoryFromPractice) setIsAddingCategoryFromPractice(false);
      }
      return true; // Signal success
    } catch (err) {
      showToast({
        message: t('notifications.categories.saveError', {
          message: (err as Error).message,
        }),
      });
      return false;
    }
  };

  /**
   * Handles the deletion of a category.
   * Can either delete all phrases within it or migrate them to another category.
   */
  const handleConfirmDeleteCategory = async ({ migrationTargetId }: { migrationTargetId: string | null }) => {
    if (!categoryToDelete) return;

    const phrasesToProcess = allPhrases.filter((p) => p.category === categoryToDelete.id);
    const delay = 250; // ms between API calls to avoid rate limiting

    // Immediately close the confirmation modal and show progress in toasts
    const categoryName = categoryToDelete.name;
    const categoryIdToDelete = categoryToDelete.id;
    setCategoryToDelete(null);

    try {
      if (phrasesToProcess.length > 0) {
        if (migrationTargetId) {
          // --- Move phrases ---
          showToast({
            message: t('notifications.cards.moving', {
              count: phrasesToProcess.length,
            }),
          });
          for (let i = 0; i < phrasesToProcess.length; i++) {
            const phrase = phrasesToProcess[i];
            await backendService.updatePhrase({
              ...phrase,
              category: migrationTargetId,
            });
            if (i < phrasesToProcess.length - 1) await sleep(delay);
          }
          updateAndSavePhrases((prev) =>
            prev.map((p) => (p.category === categoryIdToDelete ? { ...p, category: migrationTargetId } : p))
          );
          showToast({ message: t('notifications.cards.moveSuccess') });
        } else {
          // --- Delete phrases ---
          showToast({
            message: t('notifications.cards.deleting', {
              count: phrasesToProcess.length,
            }),
          });
          for (let i = 0; i < phrasesToProcess.length; i++) {
            const phrase = phrasesToProcess[i];
            await backendService.deletePhrase(phrase.id);
            if (i < phrasesToProcess.length - 1) await sleep(delay);
          }
          updateAndSavePhrases((prev) => prev.filter((p) => p.category !== categoryIdToDelete));
          showToast({ message: t('notifications.cards.deleteSuccess') });
        }
      }

      // After processing all phrases, delete the now-empty category.
      await backendService.deleteCategory(categoryIdToDelete, null);

      // Update local state for categories and settings
      updateAndSaveCategories((prev) => prev.filter((c) => c.id !== categoryIdToDelete));
      const newEnabled = { ...settings.enabledCategories };
      delete newEnabled[categoryIdToDelete];
      updateSettings({ enabledCategories: newEnabled });

      showToast({
        message: t('notifications.categories.deleteSuccess', {
          name: categoryName,
        }),
      });
    } catch (err) {
      showToast({
        message: t('notifications.deleteError', {
          message: (err as Error).message,
        }),
      });
    }
  };

  const handleAddPhraseFromCategoryDetail = () => {
    handleOpenAddPhraseModal({ language: 'ru', autoSubmit: true });
  };

  const handleOpenCategoryAssistant = (category: Category) => {
    setCategoryToView(null); // Close detail view
    setAssistantCategory(category);
    setIsCategoryAssistantModalOpen(true);
  };

  /**
   * Initiates the "Auto-Fill" process for a category.
   * Generates proposed phrases based on the category name.
   */
  const handleStartAutoFill = async (category: Category) => {
    setCategoryToAutoFill(null);
    setAutoFillingCategory(category);

    try {
      const proposedCards = await handleGenerateTopicCards(category.name.replace(/^!/, '').trim());
      setProposedCardsForFill(proposedCards);
      setIsAutoFillPreviewOpen(true);
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : t('notifications.cards.generateError'),
      });
      setAutoFillingCategory(null);
    }
  };

  const handleRefineAutoFill = async (refinement: string) => {
    if (!autoFillingCategory) return;
    setIsRefining(true);
    try {
      const proposedCards = await handleGenerateTopicCards(
        autoFillingCategory.name.replace(/^!/, '').trim(),
        refinement
      );
      setProposedCardsForFill(proposedCards);
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : t('notifications.cards.generateError'),
      });
    } finally {
      setIsRefining(false);
    }
  };

  /**
   * Adds a batch of proposed cards to a category.
   * Handles API rate limiting with a delay between requests.
   */
  const addCardsToCategory = useCallback(
    async (cards: ProposedCard[], targetCategory: Category): Promise<number> => {
      let addedCount = 0;
      // FIX: Map ProposedCard to the correct Phrase structure before creating
      const phrasesToAdd = cards.map((p) => ({
        text: { native: p.native, learning: p.learning },
        category: targetCategory.id,
        ...(p.romanization ? { romanization: { learning: p.romanization } } : {}),
      }));
      const createdPhrases: Phrase[] = [];

      for (const phrase of phrasesToAdd) {
        try {
          // Add a small delay to avoid hitting API rate limits.
          await sleep(300);
          const newPhrase = await backendService.createPhrase(phrase);
          createdPhrases.push({ ...newPhrase, isNew: true });
          addedCount++;
        } catch (err) {
          const errorMessage = (err as Error).message;
          console.error('Failed to create a card during bulk add:', errorMessage);
          // FIX: Use `phrase.text.learning` to display the correct property in the toast message
          // Use `phrase.text.learning` to display the correct property in the toast message
          showToast({
            message: t('notifications.cards.addFailed', {
              phrase: phrase.text.learning,
              error: errorMessage,
            }),
          });

          // If rate-limited, stop trying to add more cards.
          if (errorMessage.toLowerCase().includes('too many requests')) {
            showToast({ message: t('notifications.cards.rateLimit') });
            break;
          }
        }
      }

      if (createdPhrases.length > 0) {
        updateAndSavePhrases((prev) => [...createdPhrases, ...prev]);
      }
      return addedCount;
    },
    [updateAndSavePhrases, showToast]
  );

  const handleConfirmAutoFill = useCallback(
    async (selectedCards: ProposedCard[]) => {
      if (!autoFillingCategory) return;

      const duplicatesFound: {
        existingPhrase: Phrase;
        proposedCard: ProposedCard;
      }[] = [];
      const newCards: ProposedCard[] = [];

      const normalizedExistingPhrases = new Map<string, Phrase>();
      allPhrases.forEach((p) => {
        normalizedExistingPhrases.set(p.text.learning.trim().toLowerCase(), p);
      });

      selectedCards.forEach((proposed) => {
        // FIX: Use `proposed.learning` instead of `proposed.learning`
        const normalizedProposed = proposed.learning.trim().toLowerCase();
        const existingPhrase = normalizedExistingPhrases.get(normalizedProposed);

        if (existingPhrase && existingPhrase.category !== autoFillingCategory.id) {
          duplicatesFound.push({ existingPhrase, proposedCard: proposed });
        } else if (!existingPhrase) {
          newCards.push(proposed);
        }
      });

      if (duplicatesFound.length > 0) {
        setDuplicatesReviewData({
          duplicates: duplicatesFound,
          newCards: newCards,
          targetCategory: autoFillingCategory,
        });
        setIsMoveOrSkipModalOpen(true);
        setIsAutoFillPreviewOpen(false);
        setAutoFillingCategory(null);
      } else {
        const addedCount = await addCardsToCategory(newCards, autoFillingCategory);
        showToast({
          message: t('notifications.cards.addedToCategory', {
            count: addedCount,
            category: autoFillingCategory.name,
          }),
        });
        setIsAutoFillPreviewOpen(false);
        setCategoryToView(autoFillingCategory);
        setAutoFillingCategory(null);
      }
    },
    [autoFillingCategory, allPhrases, addCardsToCategory, showToast]
  );

  /**
   * Moves existing phrases (duplicates) to a new category and adds new cards.
   */
  const handleMoveReviewedDuplicates = async (
    phraseIdsToMove: string[],
    newCards: ProposedCard[],
    targetCategory: Category
  ) => {
    try {
      for (const phraseId of phraseIdsToMove) {
        await handleUpdatePhraseCategory(phraseId, targetCategory.id);
      }
      const addedCount = await addCardsToCategory(newCards, targetCategory);
      showToast({
        message: t('notifications.cards.movedAndAdded', {
          moved: phraseIdsToMove.length,
          added: addedCount,
          category: targetCategory.name,
        }),
      });
    } catch (err) {
      showToast({
        message: t('notifications.genericError', {
          message: (err as Error).message,
        }),
      });
    } finally {
      setIsMoveOrSkipModalOpen(false);
      setDuplicatesReviewData(null);
      setCategoryToView(targetCategory);
    }
  };

  const handleAddOnlyNewFromReview = async (newCards: ProposedCard[], targetCategory: Category) => {
    const addedCount = await addCardsToCategory(newCards, targetCategory);
    showToast({
      message: t('notifications.cards.addedWithDuplicatesSkipped', {
        count: addedCount,
        category: targetCategory.name,
      }),
    });

    setIsMoveOrSkipModalOpen(false);
    setDuplicatesReviewData(null);
    setCategoryToView(targetCategory);
  };

  // New handler for opening the modal
  const handleOpenConfirmDeletePhrases = (phrases: Phrase[], sourceCategory: Category) => {
    setPhrasesForDeletion({ phrases, sourceCategory });
    setIsConfirmDeletePhrasesModalOpen(true);
    setIsCategoryAssistantModalOpen(false); // Close assistant modal
  };

  // New handler for deleting multiple phrases
  const handleConfirmDeleteMultiplePhrases = async (phraseIds: string[]) => {
    let deletedCount = 0;
    const phraseIdsSet = new Set(phraseIds);

    for (const phraseId of phraseIds) {
      try {
        await backendService.deletePhrase(phraseId);
        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete phrase ${phraseId}:`, err);
      }
    }

    if (deletedCount > 0) {
      updateAndSavePhrases((prev) => prev.filter((p) => !phraseIdsSet.has(p.id)));
      if (currentPracticePhrase && phraseIdsSet.has(currentPracticePhrase.id)) {
        setCurrentPracticePhrase(null);
      }
      showToast({
        message: t('notifications.cards.deletedCount', { count: deletedCount }),
      });
    }

    setIsConfirmDeletePhrasesModalOpen(false);
    setPhrasesForDeletion(null);
  };

  // New handler for moving multiple phrases
  const handleConfirmMoveMultiplePhrases = async (phraseIds: string[], targetCategoryId: string) => {
    let movedCount = 0;
    for (const phraseId of phraseIds) {
      try {
        // Re-using the existing handler is efficient
        await handleUpdatePhraseCategory(phraseId, targetCategoryId);
        movedCount++;
      } catch (err) {
        console.error(`Failed to move phrase ${phraseId}:`, err);
      }
    }

    if (movedCount > 0) {
      const targetCategory = categories.find((c) => c.id === targetCategoryId);
      showToast({
        message: t('notifications.cards.movedToCategory', {
          count: movedCount,
          category: targetCategory?.name ?? t('notifications.cards.otherCategory'),
        }),
      });
    }

    setIsConfirmDeletePhrasesModalOpen(false);
    setPhrasesForDeletion(null);
  };

  // --- Practice Page Logic ---
  // Core logic for the practice session: selecting phrases, updating SRS, and handling user inputs.

  const unmasteredPhrases = useMemo(
    () => allPhrases.filter((p) => p && !p.isMastered && settings.enabledCategories[p.category]),
    [allPhrases, settings.enabledCategories]
  );

  const unmasteredCountsByCategory = useMemo(() => {
    return unmasteredPhrases.reduce(
      (acc, phrase) => {
        acc[phrase.category] = (acc[phrase.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [unmasteredPhrases]);

  const practicePool = useMemo(() => {
    if (practiceCategoryFilter === 'all') {
      return unmasteredPhrases;
    }
    return unmasteredPhrases.filter((p) => p.category === practiceCategoryFilter);
  }, [unmasteredPhrases, practiceCategoryFilter]);

  const practiceAnalyticsSummary = useMemo(() => {
    return buildPracticeAnalyticsSummary(allPhrases, categories, practiceReviewLog);
  }, [allPhrases, categories, practiceReviewLog]);

  const changePracticePhrase = useCallback((nextPhrase: Phrase | null, direction: AnimationDirection) => {
    setIsPracticeAnswerRevealed(false);
    setPracticeCardEvaluated(false);
    if (!nextPhrase) {
      setCurrentPracticePhrase(null);
      return;
    }
    setPracticeAnimationState({ key: nextPhrase.id, direction });
    setCurrentPracticePhrase(nextPhrase);
  }, []);

  const isInitialFilterChange = useRef(true);
  useEffect(() => {
    if (specificPhraseRequestedRef.current) {
      return;
    }

    if (view !== 'practice' || isInitialFilterChange.current) {
      isInitialFilterChange.current = false;
      return;
    }

    // A change in the filter should immediately present a new card from that category.
    const newPool =
      practiceCategoryFilter === 'all'
        ? unmasteredPhrases
        : unmasteredPhrases.filter((p) => p.category === practiceCategoryFilter);

    const nextPhrase = srsService.selectNextPhrase(newPool, null); // Get a fresh card from the new pool
    changePracticePhrase(nextPhrase, 'right');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceCategoryFilter, view]);

  /**
   * Selects the next phrase to practice using the SRS algorithm.
   * Ensures the new phrase is different from the current one if possible.
   */
  const selectNextPracticePhrase = useCallback(() => {
    if (currentPracticePhrase) {
      setCardHistory((prev) => [...prev, currentPracticePhrase.id]);
      setLearningAssistantCache((prev) => {
        const newCache = { ...prev };
        delete newCache[currentPracticePhrase.id];
        return newCache;
      });
    }

    const nextPhrase = srsService.selectNextPhrase(practicePool, currentPracticePhrase?.id ?? null);

    if (nextPhrase) {
      changePracticePhrase(nextPhrase, 'right');
    } else {
      // No due or new cards. Clear view to show loading/empty state.
      // Automatic phrase generation was removed as per user request.
      changePracticePhrase(null, 'right');
    }
  }, [practicePool, currentPracticePhrase, changePracticePhrase]);

  useEffect(() => {
    if (specificPhraseRequestedRef.current) {
      specificPhraseRequestedRef.current = false;
      return;
    }
    if (!isLoading && allPhrases.length > 0 && !currentPracticePhrase && view === 'practice') {
      selectNextPracticePhrase();
    }
  }, [isLoading, allPhrases, currentPracticePhrase, selectNextPracticePhrase, view]);

  useEffect(() => {
    if (currentPracticePhrase && !allPhrases.some((p) => p && p.id === currentPracticePhrase.id)) {
      selectNextPracticePhrase();
    }
  }, [allPhrases, currentPracticePhrase, selectNextPracticePhrase]);

  useEffect(() => {
    if (isVoiceWorkspaceModalOpen && currentPracticePhrase) {
      setVoiceWorkspacePhrase(currentPracticePhrase);
    }
  }, [currentPracticePhrase, isVoiceWorkspaceModalOpen]);

  const transitionToNext = useCallback(
    (direction: AnimationDirection = 'right') => {
      if (practiceIsExitingRef.current) return;

      practiceIsExitingRef.current = true;
      setTimeout(() => {
        if (direction === 'right') {
          selectNextPracticePhrase();
        }
        practiceIsExitingRef.current = false;
      }, 250);
    },
    [selectNextPracticePhrase]
  );

  /**
   * Updates the mastery status of the current practice phrase (Know/Forgot).
   * Handles "Leech" detection (checking if a phrase has become difficult).
   */
  const handlePracticeUpdateMastery = useCallback(
    async (action: PracticeReviewAction): Promise<boolean> => {
      if (!currentPracticePhrase || practiceIsExitingRef.current) return false;

      updateMasteryButtonUsage(action);
      const originalPhrase = currentPracticePhrase;
      const srsUpdatedPhrase = srsService.updatePhraseMastery(originalPhrase, action, categories);

      if (action === 'forgot' || action === 'dont_know') {
        const wasLeech = srsService.isLeech(originalPhrase);
        const isNowLeech = srsService.isLeech(srsUpdatedPhrase);

        if (!wasLeech && isNowLeech) {
          const backendUpdatedPhrase = await updatePhraseMasteryAndCache(originalPhrase, action);
          if (settings.soundEffects) playIncorrectSound();
          handleOpenLeechModal(backendUpdatedPhrase);
          return true; // Leech modal shown
        }
      }

      const finalPhraseState = await updatePhraseMasteryAndCache(originalPhrase, action);

      // При "Знаю" не переворачиваем карточку - пользователь и так знает ответ
      if (action !== 'know') {
        setIsPracticeAnswerRevealed(true);
      }
      setPracticeCardEvaluated(action === 'know');
      setCurrentPracticePhrase(finalPhraseState);

      return false; // Leech modal not shown
    },
    [
      currentPracticePhrase,
      practiceIsExitingRef,
      updateMasteryButtonUsage,
      categories,
      updatePhraseMasteryAndCache,
      settings.soundEffects,
    ]
  );

  const handlePracticeSwipeRight = useCallback(() => {
    if (practiceIsExitingRef.current || cardHistory.length === 0) return;
    practiceIsExitingRef.current = true;
    setTimeout(() => {
      const lastPhraseId = cardHistory[cardHistory.length - 1];
      const prevPhrase = allPhrases.find((p) => p.id === lastPhraseId);
      if (prevPhrase) {
        setCardHistory((prev) => prev.slice(0, -1));
        changePracticePhrase(prevPhrase, 'left');
      }
      practiceIsExitingRef.current = false;
    }, 250);
  }, [allPhrases, cardHistory, changePracticePhrase]);
  // --- End Practice Page Logic ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Check if any modal is open by looking for a modal backdrop
      const isModalOpen = !!document.querySelector('.fixed.inset-0.bg-black\\/60, .fixed.inset-0.bg-black\\/70');
      if (isModalOpen) return;

      if (view === 'practice' && currentPracticePhrase && !practiceIsExitingRef.current) {
        if (e.key === 'ArrowRight') {
          transitionToNext('right');
        } else if (e.key === 'ArrowLeft') {
          handlePracticeSwipeRight();
        } else if (e.key === ' ') {
          // Space bar to flip
          e.preventDefault();
          if (!isPracticeAnswerRevealed) {
            setIsPracticeAnswerRevealed(true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [view, currentPracticePhrase, isPracticeAnswerRevealed, transitionToNext, handlePracticeSwipeRight]);

  const getProviderDisplayName = () => {
    const name = apiProvider.getProviderName();
    if (name.toLowerCase().includes('gemini')) return 'Google Gemini';
    if (name.toLowerCase().includes('deepseek')) return 'DeepSeek';
    return name;
  };

  const handleOpenLibrary = () => setView('library');
  const handleOpenBook = (bookId: number) => {
    setActiveBookId(bookId);
    setView('reader');
  };

  const handleOpenAccountDrawer = () => setIsAccountDrawerOpen(true);

  const phrasesForCategory = useMemo(() => {
    if (!categoryToView) return [];
    return allPhrases.filter((p) => p.category === categoryToView.id);
  }, [categoryToView, allPhrases]);

  const phraseCountForDeletion = useMemo(() => {
    if (!categoryToDelete) return 0;
    return allPhrases.filter((p) => p.category === categoryToDelete.id).length;
  }, [categoryToDelete, allPhrases]);

  // Auto-fix phrases with romanization issues
  const autoFixState = useAutoFixPhrases(
    allPhrases,
    languageProfile.learning,
    t(`languages.${languageProfile.learning}`, languageProfile.learning),
    t(`languages.${languageProfile.native}`, languageProfile.native),
    apiProvider,
    async (fixedPhrases) => {
      // Batch update all fixed phrases
      for (const phrase of fixedPhrases) {
        try {
          await backendService.updatePhrase(phrase);
        } catch (error) {
          console.error('[AutoFix] Failed to update phrase:', phrase.id, error);
        }
      }
      // Update local state
      updateAndSavePhrases((prev) => {
        const fixedMap = new Map(fixedPhrases.map((p) => [p.id, p]));
        return prev.map((p) => fixedMap.get(p.id) || p);
      });
    },
    {
      enabled: !isLoading && !needsOnboarding,
      runOnce: true,
    }
  );

  const renderCurrentView = () => {
    switch (view) {
      case 'practice':
        return (
          <PracticePage
            currentPhrase={currentPracticePhrase}
            isAnswerRevealed={isPracticeAnswerRevealed}
            onSetIsAnswerRevealed={setIsPracticeAnswerRevealed}
            isCardEvaluated={practiceCardEvaluated}
            animationState={practiceAnimationState}
            isExiting={practiceIsExitingRef.current}
            unmasteredCount={unmasteredPhrases.length}
            currentPoolCount={practicePool.length}
            fetchNewPhrases={fetchNewPhrases}
            isLoading={isLoading}
            error={error}
            isGenerating={isGenerating}
            apiProviderAvailable={true}
            onUpdateMastery={handlePracticeUpdateMastery}
            onUpdateMasteryWithoutUI={(phrase: Phrase, action: PracticeReviewAction) =>
              updatePhraseMasteryAndCache(phrase, action)
            }
            onContinue={() => transitionToNext('right')}
            onSwipeRight={handlePracticeSwipeRight}
            onOpenChat={openChatForPhrase}
            onOpenDeepDive={handleOpenDeepDive}
            onOpenMovieExamples={handleOpenMovieExamples}
            onOpenWordAnalysis={handleOpenWordAnalysis}
            onGetWordTranslation={handleGetWordTranslation}
            onOpenVerbConjugation={handleOpenVerbConjugation}
            onOpenNounDeclension={handleOpenNounDeclension}
            onOpenAdjectiveDeclension={handleOpenAdjectiveDeclension}
            onOpenSentenceChain={handleOpenSentenceChain}
            onOpenImprovePhrase={handleOpenImproveModal}
            onOpenLearningAssistant={handleOpenLearningAssistant}
            onOpenVoiceWorkspace={handleOpenVoiceWorkspace}
            onDeletePhrase={handleDeletePhrase}
            onGoToList={handleGoToListFromPractice}
            onOpenDiscussTranslation={handleOpenDiscussModal}
            settings={settings}
            masteryButtonUsage={masteryButtonUsage}
            allPhrases={allPhrases}
            onCreateCard={handleCreateCardFromWord}
            onAnalyzeWord={analyzeWord}
            isWordAnalysisLoading={isWordAnalysisLoading}
            cardActionUsage={cardActionUsage}
            onLogCardActionUsage={updateCardActionUsage}
            cardHistoryLength={cardHistory.length}
            practiceCategoryFilter={practiceCategoryFilter}
            setPracticeCategoryFilter={setPracticeCategoryFilter}
            onMarkPhraseAsSeen={handleMarkPhraseAsSeen}
            categories={categories}
            onAddCategory={handleAddCategoryFromPractice}
            onOpenCategoryManager={() => setIsCategoryManagerModalOpen(true)}
            unmasteredCountsByCategory={unmasteredCountsByCategory}
            onOpenSmartImport={() => setIsSmartImportModalOpen(true)}
          />
        );
      case 'list':
        return (
          <PhraseListPage
            phrases={allPhrases}
            onEditPhrase={handleOpenEditModal}
            onDeletePhrase={handleDeletePhrase}
            onFindDuplicates={handleFindDuplicates}
            updateAndSavePhrases={updateAndSavePhrases}
            onStartPractice={handleStartPracticeWithPhrase}
            highlightedPhraseId={highlightedPhraseId}
            onClearHighlight={() => setHighlightedPhraseId(null)}
            onOpenSmartImport={() => setIsSmartImportModalOpen(true)}
            categories={categories}
            onUpdatePhraseCategory={handleUpdatePhraseCategory}
            onStartPracticeWithCategory={handleStartPracticeWithCategory}
            onEditCategory={handleOpenCategoryFormForEdit}
            onOpenAssistant={handleOpenCategoryAssistant}
            backendService={backendService}
            onOpenWordAnalysis={handleOpenWordAnalysis}
          />
        );
      case 'library':
        return <LibraryPage onOpenBook={handleOpenBook} />;
      case 'reader':
        return activeBookId ? <ReaderPage bookId={activeBookId} onClose={() => setView('library')} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white font-sans p-0 flex flex-col items-center overflow-x-hidden">
      <Header
        view={view}
        onSetView={setView}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenAccountDrawer={handleOpenAccountDrawer}
      />
      <main
        className={`overflow-hidden w-full flex-grow flex flex-col items-center  ${
          view === 'practice' ? 'justify-center' : ''
        }`}
      >
        {renderCurrentView()}
      </main>
      {view === 'practice' && !isLoading && (
        <>
          <PracticeChatFab onClick={() => setIsPracticeChatModalOpen(true)} disabled={false} />
          <ExpandingFab
            onAddPhrase={handleOpenAddPhraseModal}
            onSmartImport={() => setIsSmartImportModalOpen(true)}
            onOpenLibrary={handleOpenLibrary}
            disabled={false}
          />
        </>
      )}
      {view === 'practice' ? (
        <footer className="text-center text-slate-500 py-4 text-sm h-6">
          {isGenerating ? 'Идет генерация новых фраз...' : apiProvider ? `` : ''}
        </footer>
      ) : (
        ''
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {chatContextPhrase && apiProviderType && (
        <AiErrorBoundary componentName="Chat Assistant">
          <ChatModal
            isOpen={isChatModalOpen}
            onClose={() => setIsChatModalOpen(false)}
            phrase={chatContextPhrase}
            onGenerateInitialExamples={handleGenerateInitialExamples}
            onContinueChat={handleContinueChat}
            apiProviderType={apiProviderType}
            onOpenWordAnalysis={handleOpenWordAnalysis}
            allPhrases={allPhrases}
            onCreateCard={handleCreateCardFromWord}
            onAnalyzeWord={analyzeWord}
            onOpenVerbConjugation={handleOpenVerbConjugation}
            onOpenNounDeclension={handleOpenNounDeclension}
            onOpenAdjectiveDeclension={handleOpenAdjectiveDeclension}
            onTranslateLearningToNative={handleTranslateLearningToNative}
            onSessionComplete={updatePracticeChatSessionComplete}
          />
        </AiErrorBoundary>
      )}
      {apiProvider && (
        <AiErrorBoundary componentName="Practice Chat">
          <PracticeChatModal_v2
            isOpen={isPracticeChatModalOpen}
            onClose={() => setIsPracticeChatModalOpen(false)}
            allPhrases={allPhrases}
            settings={settings}
            onOpenWordAnalysis={handleOpenWordAnalysis}
            onAnalyzeWord={analyzeWord}
            onCreateCard={handleCreateCardFromWord}
            onOpenVerbConjugation={handleOpenVerbConjugation}
            onOpenNounDeclension={handleOpenNounDeclension}
            onOpenAdjectiveDeclension={handleOpenAdjectiveDeclension}
            onTranslateLearningToNative={handleTranslateLearningToNative}
          />
        </AiErrorBoundary>
      )}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSettingsChange={updateSettings}
        categories={categories}
        practiceChatSessions={practiceChatSessions}
        practiceAnalyticsSummary={practiceAnalyticsSummary}
        onOpenCategoryManager={() => setIsCategoryManagerModalOpen(true)}
      />
      {deepDivePhrase && (
        <AiErrorBoundary componentName="Deep Dive">
          <DeepDiveModal
            isOpen={isDeepDiveModalOpen}
            onClose={() => setIsDeepDiveModalOpen(false)}
            phrase={deepDivePhrase}
            analysis={deepDiveAnalysis}
            isLoading={isDeepDiveLoading}
            error={deepDiveError}
            onOpenWordAnalysis={handleOpenWordAnalysis}
          />
        </AiErrorBoundary>
      )}
      {movieExamplesPhrase && (
        <MovieExamplesModal
          isOpen={isMovieExamplesModalOpen}
          onClose={() => setIsMovieExamplesModalOpen(false)}
          phrase={movieExamplesPhrase}
          examples={movieExamples}
          isLoading={isMovieExamplesLoading}
          error={movieExamplesError}
          onOpenWordAnalysis={handleOpenWordAnalysis}
        />
      )}
      {sentenceChainPhrase && (
        <SentenceChainModal
          isOpen={isSentenceChainModalOpen}
          onClose={() => setIsSentenceChainModalOpen(false)}
          phrase={sentenceChainPhrase}
          onGenerateContinuations={handleGenerateContinuations}
          onWordClick={handleOpenWordAnalysis}
        />
      )}
      {wordAnalysisPhrase && (
        <WordAnalysisModal
          isOpen={isWordAnalysisModalOpen}
          onClose={() => setIsWordAnalysisModalOpen(false)}
          word={selectedWord}
          phrase={wordAnalysisPhrase}
          analysis={wordAnalysis}
          isLoading={isWordAnalysisLoading}
          error={wordAnalysisError}
          onOpenVerbConjugation={handleOpenVerbConjugation}
          onOpenNounDeclension={handleOpenNounDeclension}
          onOpenAdjectiveDeclension={handleOpenAdjectiveDeclension}
          onOpenWordAnalysis={handleOpenWordAnalysis}
          allPhrases={allPhrases}
          onCreateCard={handleCreateCardFromWord}
        />
      )}
      {conjugationVerb && (
        <VerbConjugationModal
          isOpen={isVerbConjugationModalOpen}
          onClose={() => setIsVerbConjugationModalOpen(false)}
          infinitive={conjugationVerb}
          onConjugateSimple={handleConjugateVerbSimple}
          onConjugateDetailed={handleConjugateVerbDetailed}
          onOpenWordAnalysis={handleOpenWordAnalysis}
        />
      )}
      {declensionNoun && (
        <NounDeclensionModal
          isOpen={isNounDeclensionModalOpen}
          onClose={() => setIsNounDeclensionModalOpen(false)}
          noun={declensionNoun.noun}
          data={nounDeclensionData}
          isLoading={isNounDeclensionLoading}
          error={nounDeclensionError}
          onOpenWordAnalysis={handleOpenWordAnalysis}
        />
      )}
      {declensionAdjective && (
        <AdjectiveDeclensionModal
          isOpen={isAdjectiveDeclensionModalOpen}
          onClose={() => setIsAdjectiveDeclensionModalOpen(false)}
          adjective={declensionAdjective}
          data={adjectiveDeclensionData}
          isLoading={isAdjectiveDeclensionLoading}
          error={adjectiveDeclensionError}
          onOpenWordAnalysis={handleOpenWordAnalysis}
        />
      )}
      {apiProvider && (
        <AddPhraseModal
          isOpen={isAddPhraseModalOpen}
          onClose={() => setIsAddPhraseModalOpen(false)}
          onGenerate={handleGenerateSinglePhrase}
          onTranslateLearning={handleTranslateLearningToNative}
          onPhraseCreated={handlePhraseCreated}
          language={addPhraseConfig.language}
          autoSubmit={addPhraseConfig.autoSubmit}
        />
      )}
      {apiProvider && (
        <SmartImportModal
          isOpen={isSmartImportModalOpen}
          onClose={() => {
            setIsSmartImportModalOpen(false);
            setSmartImportInitialTopic(undefined);
          }}
          onGenerateCards={handleGenerateCardsFromTranscript}
          onGenerateCardsFromImage={handleGenerateCardsFromImage}
          onGenerateTopicCards={handleGenerateTopicCards}
          onCardsCreated={handleCreateProposedCards}
          onClassifyTopic={handleClassifyTopic}
          initialTopic={smartImportInitialTopic}
          allPhrases={allPhrases}
          categories={categories}
        />
      )}
      {phraseToImprove && (
        <ImprovePhraseModal
          phraseToImprove={phraseToImprove}
          isImproveModalOpen={isImproveModalOpen}
          handleCloseImproveModal={handleCloseImproveModal}
          handlePhraseImproved={handlePhraseImproved}
          handleOpenDiscussion={handleOpenDiscussion}
          callApiWithFallback={callApiWithFallback}
        />
      )}
      {phraseToEdit && apiProvider && (
        <EditPhraseModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          phrase={phraseToEdit}
          onSave={handleSavePhraseEdits}
          onTranslate={handleTranslatePhrase}
          onDiscuss={handleDiscussTranslation}
          onOpenWordAnalysis={handleOpenWordAnalysis}
          categories={categories}
        />
      )}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        phrase={phraseToDelete}
      />
      {leechPhrase && (
        <LeechModal
          leechPhrase={leechPhrase}
          isLeechModalOpen={isLeechModalOpen}
          handleCloseLeechModal={handleCloseLeechModal}
          handleOpenImproveModal={handleOpenImproveModal}
          handleOpenDiscussModal={handleOpenDiscussModal}
          updateAndSavePhrases={updateAndSavePhrases}
          showToast={showToast}
          transitionToNext={transitionToNext}
        />
      )}
      <VoiceWorkspaceModal
        isOpen={isVoiceWorkspaceModalOpen}
        onClose={() => setIsVoiceWorkspaceModalOpen(false)}
        phrase={voiceWorkspacePhrase}
        onEvaluate={handleEvaluateSpokenPhraseAttempt}
        onSuccess={(phrase: Phrase) => updatePhraseMasteryAndCache(phrase, 'know')}
        onFailure={(phrase: Phrase) => updatePhraseMasteryAndCache(phrase, 'forgot')}
        onNextPhrase={() => {
          setIsVoiceWorkspaceModalOpen(false);
          transitionToNext();
        }}
        onGeneratePhraseBuilderOptions={useCallback(
          (phrase: Phrase) => callApiWithFallback((p) => p.generatePhraseBuilderOptions(phrase)),
          [callApiWithFallback]
        )}
        onPracticeNext={() => selectNextPracticePhrase()}
        settings={settings}
        buttonUsage={buttonUsage}
        onLogButtonUsage={updateButtonUsage}
        habitTracker={habitTracker}
        onHabitTrackerChange={updateHabitTrackerChange}
        showToast={showToast}
        onOpenLearningAssistant={handleOpenLearningAssistant}
      />
      {learningAssistantPhrase && (
        <AiErrorBoundary componentName="Learning Assistant">
          <LearningAssistantModal
            isOpen={isLearningAssistantModalOpen}
            onClose={(didSucceed?: boolean) => {
              handleCloseLearningAssistant();
              const shouldReturnToWorkspace = isVoiceWorkspaceModalOpen;

              if (didSucceed && learningAssistantPhrase) {
                const finalPhraseState =
                  allPhrases.find((p) => p.id === learningAssistantPhrase.id) || learningAssistantPhrase;
                handleOpenVoiceWorkspace(finalPhraseState);
              } else if (shouldReturnToWorkspace && learningAssistantPhrase) {
                handleOpenVoiceWorkspace(learningAssistantPhrase);
              }
            }}
            phrase={learningAssistantPhrase}
            onGuide={handleGuideToTranslation}
            onSuccess={(phrase: Phrase) => updatePhraseMasteryAndCache(phrase, 'know')}
            onOpenVerbConjugation={handleOpenVerbConjugation}
            onOpenNounDeclension={handleOpenNounDeclension}
            onOpenPronounsModal={() => setIsPronounsModalOpen(true)}
            onOpenWFragenModal={() => setIsWFragenModalOpen(true)}
            cache={learningAssistantCache}
            setCache={setLearningAssistantCache}
            onOpenWordAnalysis={handleOpenWordAnalysis}
            onOpenAdjectiveDeclension={handleOpenAdjectiveDeclension}
          />
        </AiErrorBoundary>
      )}
      {phraseToDiscuss && apiProvider && (
        <AiErrorBoundary componentName="Discuss Translation">
          <DiscussTranslationModal
            isOpen={isDiscussModalOpen}
            onClose={() => {
              setIsDiscussModalOpen(false);
              setDiscussInitialMessage(undefined);
            }}
            originalNative={phraseToDiscuss.text.native}
            currentLearning={phraseToDiscuss.text.learning}
            onDiscuss={handleDiscussTranslation}
            onAccept={handleDiscussionAccept}
            onOpenWordAnalysis={handleOpenWordAnalysis}
            initialMessage={discussInitialMessage}
          />
        </AiErrorBoundary>
      )}
      {apiProvider && (
        <PronounsModal
          isOpen={isPronounsModalOpen}
          onClose={() => setIsPronounsModalOpen(false)}
          onOpenWordAnalysis={handleOpenWordAnalysis}
          languageProfile={languageProfile}
          aiService={apiProvider}
        />
      )}
      <WFragenModal
        isOpen={isWFragenModalOpen}
        onClose={() => setIsWFragenModalOpen(false)}
        onOpenWordAnalysis={handleOpenWordAnalysis}
      />
      {/* Category Management Modals */}
      <CategoryManagerModal
        isOpen={isCategoryManagerModalOpen}
        onClose={() => setIsCategoryManagerModalOpen(false)}
        categories={categories}
        onAddCategory={handleOpenCategoryFormForAdd}
        onEditCategory={handleOpenCategoryFormForEdit}
        onDeleteCategory={setCategoryToDelete}
        onViewCategory={(category) => {
          setCategoryToView(category);
          setIsCategoryManagerModalOpen(false);
        }}
      />
      <CategoryDetailModal
        isOpen={!!categoryToView}
        onClose={() => setCategoryToView(null)}
        category={categoryToView}
        phrases={phrasesForCategory}
        allCategories={categories}
        onUpdatePhraseCategory={handleUpdatePhraseCategory}
        onEditPhrase={handleOpenEditModal}
        onDeletePhrase={handleDeletePhrase}
        onPreviewPhrase={handleStartPracticeWithPhrase}
        onStartPractice={handleStartPracticeWithPhrase}
        onAddPhrase={handleAddPhraseFromCategoryDetail}
        onAIAssist={handleOpenCategoryAssistant}
      />
      <CategoryFormModal
        isOpen={isCategoryFormModalOpen}
        onClose={() => {
          setIsCategoryFormModalOpen(false);
          if (!isAddingCategoryFromPractice) {
            setIsCategoryManagerModalOpen(true);
          }
          setIsAddingCategoryFromPractice(false);
        }}
        onSubmit={handleSaveCategory}
        initialData={categoryToEdit}
      />
      <ConfirmDeleteCategoryModal
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleConfirmDeleteCategory}
        category={categoryToDelete}
        phraseCount={phraseCountForDeletion}
        allCategories={categories}
      />
      <ConfirmCategoryFillModal
        isOpen={!!categoryToAutoFill}
        onClose={() => {
          setCategoryToAutoFill(null);
          if (!isAddingCategoryFromPractice) {
            setIsCategoryManagerModalOpen(true);
          }
        }}
        onConfirm={handleStartAutoFill}
        category={categoryToAutoFill}
      />
      <AutoFillLoadingModal isOpen={!!autoFillingCategory && !isAutoFillPreviewOpen} category={autoFillingCategory} />
      <AutoFillPreviewModal
        isOpen={isAutoFillPreviewOpen}
        onClose={() => {
          setIsAutoFillPreviewOpen(false);
          setAutoFillingCategory(null);
        }}
        categoryName={autoFillingCategory?.name || ''}
        proposedCards={proposedCardsForFill}
        onConfirm={handleConfirmAutoFill}
        onRefine={handleRefineAutoFill}
        isLoading={isRefining}
      />
      <MoveOrSkipModal
        isOpen={isMoveOrSkipModalOpen}
        onClose={() => setIsMoveOrSkipModalOpen(false)}
        reviewData={duplicatesReviewData}
        categories={categories}
        onMove={handleMoveReviewedDuplicates}
        onAddOnlyNew={handleAddOnlyNewFromReview}
      />
      {assistantCategory && (
        <AiErrorBoundary componentName="Category Assistant">
          <CategoryAssistantModal
            isOpen={isCategoryAssistantModalOpen}
            onClose={(view?: View) => {
              setIsCategoryAssistantModalOpen(false);
              if (view) {
                setView(view);
              }
            }}
            category={assistantCategory}
            phrases={allPhrases.filter((p) => p.category === assistantCategory.id)}
            onGetAssistantResponse={handleGetCategoryAssistantResponse}
            onAddCards={handleCreateProposedCards}
            cache={assistantCache}
            setCache={setAssistantCache}
            onOpenWordAnalysis={handleOpenWordAnalysis}
            allPhrases={allPhrases}
            onCreateCard={handleCreateCardFromWord}
            onAnalyzeWord={analyzeWord}
            onOpenVerbConjugation={handleOpenVerbConjugation}
            onOpenNounDeclension={handleOpenNounDeclension}
            onOpenAdjectiveDeclension={handleOpenAdjectiveDeclension}
            onTranslateLearningToNative={handleTranslateLearningToNative}
            onGoToList={() => setView('list')}
            onOpenConfirmDeletePhrases={handleOpenConfirmDeletePhrases}
          />
        </AiErrorBoundary>
      )}
      {isConfirmDeletePhrasesModalOpen && phrasesForDeletion && (
        <ConfirmDeletePhrasesModal
          isOpen={isConfirmDeletePhrasesModalOpen}
          onClose={() => {
            setIsConfirmDeletePhrasesModalOpen(false);
            setPhrasesForDeletion(null);
          }}
          phrases={phrasesForDeletion.phrases}
          categories={categories}
          sourceCategory={phrasesForDeletion.sourceCategory}
          onConfirmDelete={handleConfirmDeleteMultiplePhrases}
          onConfirmMove={handleConfirmMoveMultiplePhrases}
        />
      )}
      <AccountDrawer isOpen={isAccountDrawerOpen} onClose={() => setIsAccountDrawerOpen(false)} />
      {(() => {
        const shouldShowModal = needsOnboarding && !isOnboardingLoading;
        console.log('🎭 [App] LanguageOnboardingModal render:', {
          needsOnboarding,
          isOnboardingLoading,
          shouldShowModal,
          isGeneratingData,
          detectedLanguage,
        });
        return (
          <LanguageOnboardingModal
            isOpen={shouldShowModal}
            detectedBrowserLanguage={detectedLanguage}
            isGeneratingData={isGeneratingData}
            onComplete={completeOnboarding}
          />
        );
      })()}
      {/* <AutoFixModal state={autoFixState.state} onDismiss={autoFixState.reset} /> */}
    </div>
  );
};

export default App;
