import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
// FIX: Import View type from shared types.ts
import {
  Phrase,
  DeepDiveAnalysis,
  MovieExample,
  WordAnalysis,
  VerbConjugation,
  NounDeclension,
  AdjectiveDeclension,
  SentenceContinuation,
  PhraseBuilderOptions,
  PhraseEvaluation,
  ChatMessage,
  PhraseCategory,
  ProposedCard,
  BookRecord,
  Category,
  CategoryAssistantRequest,
  CategoryAssistantResponse,
  View,
  LanguageCode,
  PracticeChatSessionRecord,
  PracticeReviewLogEntry,
  PracticeReviewAction,
} from "./types";
import * as srsService from "./services/srsService";
import * as cacheService from "./services/cacheService";
import * as backendService from "./services/backendService";
import {
  getProviderPriorityList,
  getFallbackProvider,
  ApiProviderType,
} from "./services/apiProvider";
import { AiService } from "./services/aiService";
import { buildPracticeAnalyticsSummary } from "./services/practiceAnalyticsService";
import { playCorrectSound, playIncorrectSound } from "./services/soundService";
import { getSpeechLocale } from "./src/i18n/languageMeta";

import Header from "./components/Header";
import PracticePage from "./pages/PracticePage";
// FIX: Changed to a named import to resolve "no default export" error.
import { PhraseListPage } from "./pages/PhraseListPage";
import LibraryPage from "./pages/LibraryPage";
import { ReaderPage } from "./pages/ReaderPage";
import ChatModal from "./components/ChatModal";
import SettingsModal from "./components/SettingsModal";
import DeepDiveModal from "./components/DeepDiveModal";
import MovieExamplesModal from "./components/MovieExamplesModal";
import WordAnalysisModal from "./components/WordAnalysisModal";
import VerbConjugationModal from "./components/VerbConjugationModal";
import NounDeclensionModal from "./components/NounDeclensionModal";
import AdjectiveDeclensionModal from "./components/AdjectiveDeclensionModal";
import SentenceChainModal from "./components/SentenceChainModal";
import AddPhraseModal from "./components/AddPhraseModal";
import SmartImportModal from "./components/SmartImportModal";
import ImprovePhraseModal from "./components/ImprovePhraseModal";
import EditPhraseModal from "./components/EditPhraseModal";
import ConfirmDeleteModal from "./components/ConfirmDeleteModal";
// FIX: Changed to a named import to resolve "no default export" error.
import { VoiceWorkspaceModal } from "./components/VoiceWorkspaceModal";
import ExpandingFab from "./components/ExpandingFab";
import DiscussTranslationModal from "./components/DiscussTranslationModal";
import LearningAssistantModal from "./components/LearningAssistantModal";
import PronounsModal from "./components/PronounsModal";
import WFragenModal from "./components/WFragenModal";
import Toast from "./components/Toast";
import AccountDrawer from "./components/AccountDrawer";
import BugIcon from "./components/icons/BugIcon";
import WandIcon from "./components/icons/WandIcon";
import MessageQuestionIcon from "./components/icons/MessageQuestionIcon";
import CategoryManagerModal from "./components/CategoryManagerModal";
import CategoryDetailModal from "./components/CategoryDetailModal";
import CategoryFormModal from "./components/CategoryFormModal";
import ConfirmDeleteCategoryModal from "./components/ConfirmDeleteCategoryModal";
import ConfirmCategoryFillModal from "./components/ConfirmCategoryFillModal";
import AutoFillLoadingModal from "./components/AutoFillLoadingModal";
import AutoFillPreviewModal from "./components/AutoFillPreviewModal";
import MoveOrSkipModal from "./components/MoveOrSkipModal";
import CategoryAssistantModal from "./components/CategoryAssistantModal";
import ConfirmDeletePhrasesModal from "./components/ConfirmDeletePhrasesModal";
import PracticeChatFab from "./components/PracticeChatFab";
import PracticeChatModal_v2 from "./components/PracticeChatModal_v2";
import AiErrorBoundary from "./components/AiErrorBoundary";
import { useTranslation } from "./src/hooks/useTranslation.ts";
import { useAuth } from "./src/contexts/authContext.tsx";
import { useLanguage } from "./src/contexts/languageContext.tsx";
import { setCurrentLanguageProfile } from "./services/languageAwareAiService";
import { useLanguageOnboarding } from "./src/hooks/useLanguageOnboarding";
import LanguageOnboardingModal from "./components/LanguageOnboardingModal";
import { useAutoFixPhrases } from "./hooks/useAutoFixPhrases";
import AutoFixModal from "./components/AutoFixModal";

// Legacy keys (for migration)
const LEGACY_PHRASES_KEY = "learningPhrases";
const LEGACY_CATEGORIES_KEY = "learningAppCategories";

// Helper function to create user-aware and language-aware storage keys
const getStorageKey = (
  baseKey: string,
  userId?: string,
  languageProfile?: { native: string; learning: string }
): string => {
  if (!userId) return baseKey; // Fallback to base key if no user
  if (!languageProfile) return `${baseKey}_${userId}`; // User-aware only
  return `${baseKey}_${userId}_${languageProfile.native}_${languageProfile.learning}`; // Full isolation
};

// Storage key generators
const PHRASES_KEY = (
  userId?: string,
  langProfile?: { native: string; learning: string }
) => getStorageKey("userPhrases", userId, langProfile);
const CATEGORIES_KEY = (
  userId?: string,
  langProfile?: { native: string; learning: string }
) => getStorageKey("userCategories", userId, langProfile);
const SETTINGS_KEY = (userId?: string) => getStorageKey("userSettings", userId);
const BUTTON_USAGE_KEY = (userId?: string) =>
  getStorageKey("userButtonUsage", userId);
const MASTERY_BUTTON_USAGE_KEY = (userId?: string) =>
  getStorageKey("userMasteryButtonUsage", userId);
const HABIT_TRACKER_KEY = (userId?: string) =>
  getStorageKey("userHabitTracker", userId);
const CARD_ACTION_USAGE_KEY = (userId?: string) =>
  getStorageKey("userCardActionUsage", userId);
const PRACTICE_CHAT_HISTORY_KEY = (
  userId?: string,
  langProfile?: { native: string; learning: string }
) => getStorageKey("userPracticeChatHistory", userId, langProfile);
const PRACTICE_CHAT_SESSIONS_KEY = (
  userId?: string,
  langProfile?: { native: string; learning: string }
) => getStorageKey("userPracticeChatSessions", userId, langProfile);
const PRACTICE_REVIEW_LOG_KEY = (
  userId?: string,
  langProfile?: { native: string; learning: string }
) => getStorageKey("userPracticeReviewLog", userId, langProfile);
const DISCUSS_CHAT_CACHE_KEY = (
  userId?: string,
  langProfile?: { native: string; learning: string }
) => getStorageKey("userDiscussChatCache", userId, langProfile);

const PRACTICE_REVIEW_LOG_LIMIT = 5000;

// FIX: Removed local View type definition. It's now imported from types.ts
type AnimationDirection = "left" | "right";
interface AnimationState {
  key: string;
  direction: AnimationDirection;
}
type ToastType = "default" | "automationSuccess";
interface ToastState {
  message: string;
  id: number;
  type: ToastType;
}

// FIX: Added Settings interface to fix 'Cannot find name' error
interface Settings {
  autoSpeak: boolean;
  soundEffects: boolean;
  automation: {
    autoCheckShortPhrases: boolean;
    learnNextPhraseHabit: boolean;
  };
  enabledCategories: Record<PhraseCategory, boolean>;
}

const defaultSettings = {
  autoSpeak: true,
  soundEffects: true,
  automation: {
    autoCheckShortPhrases: true,
    learnNextPhraseHabit: true,
  },
  // enabledCategories is now loaded dynamically from fetched categories
};

const defaultHabitTracker = {
  quickNextCount: 0,
  quickBuilderNextCount: 0,
};

const defaultCardActionUsage = {
  learningAssistant: 0,
  sentenceChain: 0,
  phraseBuilder: 0,
  chat: 0,
  deepDive: 0,
  movieExamples: 0,
};

// Helper function for retrying API calls with a delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface LeechModalProps {
  isOpen: boolean;
  phrase: Phrase;
  onImprove: (phrase: Phrase) => void;
  onDiscuss: (phrase: Phrase) => void;
  onContinue: (phrase: Phrase) => void;
  onReset: (phrase: Phrase) => void;
  onPostpone: (phrase: Phrase) => void;
}

const LeechModal: React.FC<LeechModalProps> = ({
  isOpen,
  phrase,
  onImprove,
  onDiscuss,
  onContinue,
  onReset,
  onPostpone,
}) => {
  if (!isOpen) return null;

  const handleImprove = () => onImprove(phrase);
  const handleDiscuss = () => onDiscuss(phrase);
  const handleContinue = () => onContinue(phrase);
  const handleReset = () => onReset(phrase);
  const handlePostpone = () => onPostpone(phrase);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center backdrop-blur-sm p-4 animate-fade-in"
      onClick={handlePostpone} // Default action on backdrop click is to postpone
    >
      <div
        className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-sm m-4 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-900/50 flex items-center justify-center">
            <BugIcon className="w-6 h-6 text-amber-500" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-100">Сложная фраза</h2>
        <p className="text-slate-400 mt-2 mb-4">
          Эта фраза дается вам с трудом. Что с ней сделать?
        </p>

        <div className="bg-slate-700/50 p-4 rounded-md text-center mb-6">
          {/* FIX: Use phrase.text.native and phrase.text.learning to match the updated Phrase type */}
          <p className="text-slate-200 font-medium text-lg">
            "{phrase.text.native}"
          </p>
          <p className="text-slate-400 mt-1">"{phrase.text.learning}"</p>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            onClick={handleImprove}
            className="w-full px-6 py-3 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors flex items-center justify-center"
          >
            <WandIcon className="w-5 h-5 mr-2" />
            <span>Улучшить фразу</span>
          </button>
          <button
            onClick={handleDiscuss}
            className="w-full px-6 py-3 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold transition-colors flex items-center justify-center"
          >
            <MessageQuestionIcon className="w-5 h-5 mr-2" />
            <span>Обсудить с AI</span>
          </button>
          <div className="pt-3 mt-3 border-t border-slate-700 space-y-3">
            <button
              onClick={handleContinue}
              className="w-full px-6 py-2 rounded-md bg-transparent hover:bg-slate-700/50 text-slate-300 font-medium transition-colors"
            >
              Повторить через 10 мин
            </button>
            <button
              onClick={handleReset}
              className="w-full px-6 py-2 rounded-md bg-transparent hover:bg-slate-700/50 text-slate-300 font-medium transition-colors"
            >
              Сбросить прогресс
            </button>
            <button
              onClick={handlePostpone}
              className="w-full px-6 py-2 rounded-md bg-transparent hover:bg-slate-700/50 text-slate-300 font-medium transition-colors"
            >
              Отложить на завтра
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Migrate legacy localStorage data to new user+language aware keys
 */
const migrateLegacyStorage = (
  userId: string,
  languageProfile: { native: string; learning: string }
) => {
  console.log("[Migration] Checking for legacy data...");

  // Migrate phrases
  const legacyPhrases = localStorage.getItem(LEGACY_PHRASES_KEY);
  if (
    legacyPhrases &&
    !localStorage.getItem(PHRASES_KEY(userId, languageProfile))
  ) {
    console.log("[Migration] Migrating legacy phrases...");
    localStorage.setItem(PHRASES_KEY(userId, languageProfile), legacyPhrases);
    localStorage.removeItem(LEGACY_PHRASES_KEY);
    console.log("[Migration] Phrases migrated successfully");
  }

  // Migrate categories
  const legacyCategories = localStorage.getItem(LEGACY_CATEGORIES_KEY);
  if (
    legacyCategories &&
    !localStorage.getItem(CATEGORIES_KEY(userId, languageProfile))
  ) {
    console.log("[Migration] Migrating legacy categories...");
    localStorage.setItem(
      CATEGORIES_KEY(userId, languageProfile),
      legacyCategories
    );
    localStorage.removeItem(LEGACY_CATEGORIES_KEY);
    console.log("[Migration] Categories migrated successfully");
  }
};

const App: React.FC = () => {
  const { t } = useTranslation();
  const { userChanged, resetUserChanged, user } = useAuth();
  const userId = user?.id;
  const { profile: languageProfile } = useLanguage();
  const {
    needsOnboarding,
    isLoading: isOnboardingLoading,
    isGeneratingData,
    detectedLanguage,
    completeOnboarding,
  } = useLanguageOnboarding(userId || null);
  const [allPhrases, setAllPhrases] = useState<Phrase[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("practice");
  const [highlightedPhraseId, setHighlightedPhraseId] = useState<string | null>(
    null
  );
  const [activeBookId, setActiveBookId] = useState<number | null>(null);

  // --- State Lifted from PracticePage ---
  const [currentPracticePhrase, setCurrentPracticePhrase] =
    useState<Phrase | null>(null);
  const [isPracticeAnswerRevealed, setIsPracticeAnswerRevealed] =
    useState(false);
  const [practiceCardEvaluated, setPracticeCardEvaluated] = useState(false);
  const [practiceAnimationState, setPracticeAnimationState] =
    useState<AnimationState>({ key: "", direction: "right" });
  const [cardHistory, setCardHistory] = useState<string[]>([]);
  const [practiceCategoryFilter, setPracticeCategoryFilter] = useState<
    "all" | PhraseCategory
  >("all");
  const practiceIsExitingRef = useRef(false);
  const specificPhraseRequestedRef = useRef(false);
  // --- End State Lift ---

  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatContextPhrase, setChatContextPhrase] = useState<Phrase | null>(
    null
  );

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  // FIX: Initialize settings state to be type-safe.
  const [settings, setSettings] = useState<Settings>({
    ...defaultSettings,
    enabledCategories: {},
  });
  const [buttonUsage, setButtonUsage] = useState({
    close: 0,
    continue: 0,
    next: 0,
  });
  const [masteryButtonUsage, setMasteryButtonUsage] = useState({
    know: 0,
    forgot: 0,
    dont_know: 0,
  });
  const [habitTracker, setHabitTracker] = useState(defaultHabitTracker);
  const [cardActionUsage, setCardActionUsage] = useState(
    defaultCardActionUsage
  );

  const [toast, setToast] = useState<ToastState | null>(null);

  const [isDeepDiveModalOpen, setIsDeepDiveModalOpen] = useState(false);
  const [deepDivePhrase, setDeepDivePhrase] = useState<Phrase | null>(null);
  const [deepDiveAnalysis, setDeepDiveAnalysis] =
    useState<DeepDiveAnalysis | null>(null);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState<boolean>(false);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);

  const [isMovieExamplesModalOpen, setIsMovieExamplesModalOpen] =
    useState(false);
  const [movieExamplesPhrase, setMovieExamplesPhrase] = useState<Phrase | null>(
    null
  );
  const [movieExamples, setMovieExamples] = useState<MovieExample[]>([]);
  const [isMovieExamplesLoading, setIsMovieExamplesLoading] =
    useState<boolean>(false);
  const [movieExamplesError, setMovieExamplesError] = useState<string | null>(
    null
  );

  const [isWordAnalysisModalOpen, setIsWordAnalysisModalOpen] = useState(false);
  const [wordAnalysisPhrase, setWordAnalysisPhrase] = useState<Phrase | null>(
    null
  );
  const [selectedWord, setSelectedWord] = useState<string>("");
  const [wordAnalysis, setWordAnalysis] = useState<WordAnalysis | null>(null);
  const [isWordAnalysisLoading, setIsWordAnalysisLoading] =
    useState<boolean>(false);
  const [wordAnalysisError, setWordAnalysisError] = useState<string | null>(
    null
  );

  const [isVerbConjugationModalOpen, setIsVerbConjugationModalOpen] =
    useState(false);
  const [conjugationVerb, setConjugationVerb] = useState<string>("");

  const [isNounDeclensionModalOpen, setIsNounDeclensionModalOpen] =
    useState(false);
  const [nounDeclensionData, setNounDeclensionData] =
    useState<NounDeclension | null>(null);
  const [isNounDeclensionLoading, setIsNounDeclensionLoading] =
    useState<boolean>(false);
  const [nounDeclensionError, setNounDeclensionError] = useState<string | null>(
    null
  );
  const [declensionNoun, setDeclensionNoun] = useState<{
    noun: string;
    article: string;
  } | null>(null);

  const [isAdjectiveDeclensionModalOpen, setIsAdjectiveDeclensionModalOpen] =
    useState(false);
  const [adjectiveDeclensionData, setAdjectiveDeclensionData] =
    useState<AdjectiveDeclension | null>(null);
  const [isAdjectiveDeclensionLoading, setIsAdjectiveDeclensionLoading] =
    useState<boolean>(false);
  const [adjectiveDeclensionError, setAdjectiveDeclensionError] = useState<
    string | null
  >(null);
  const [declensionAdjective, setDeclensionAdjective] = useState<string>("");

  const [isSentenceChainModalOpen, setIsSentenceChainModalOpen] =
    useState(false);
  const [sentenceChainPhrase, setSentenceChainPhrase] = useState<Phrase | null>(
    null
  );

  const [isAddPhraseModalOpen, setIsAddPhraseModalOpen] = useState(false);
  const [addPhraseConfig, setAddPhraseConfig] = useState({
    language: "ru" as LanguageCode,
    autoSubmit: true,
  });

  const [isSmartImportModalOpen, setIsSmartImportModalOpen] = useState(false);
  const [smartImportInitialTopic, setSmartImportInitialTopic] = useState<
    string | undefined
  >();

  const [isImproveModalOpen, setIsImproveModalOpen] = useState(false);
  const [phraseToImprove, setPhraseToImprove] = useState<Phrase | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [phraseToEdit, setPhraseToEdit] = useState<Phrase | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [phraseToDelete, setPhraseToDelete] = useState<Phrase | null>(null);

  const [isVoiceWorkspaceModalOpen, setIsVoiceWorkspaceModalOpen] =
    useState(false);
  const [voiceWorkspacePhrase, setVoiceWorkspacePhrase] =
    useState<Phrase | null>(null);

  const [isLearningAssistantModalOpen, setIsLearningAssistantModalOpen] =
    useState(false);
  const [learningAssistantPhrase, setLearningAssistantPhrase] =
    useState<Phrase | null>(null);
  const [learningAssistantCache, setLearningAssistantCache] = useState<{
    [phraseId: string]: ChatMessage[];
  }>({});

  const [apiProvider, setApiProvider] = useState<AiService | null>(null);
  const [apiProviderType, setApiProviderType] =
    useState<ApiProviderType | null>(null);

  const [isDiscussModalOpen, setIsDiscussModalOpen] = useState(false);
  const [phraseToDiscuss, setPhraseToDiscuss] = useState<Phrase | null>(null);
  const [discussInitialMessage, setDiscussInitialMessage] = useState<
    string | undefined
  >();

  const [isPronounsModalOpen, setIsPronounsModalOpen] = useState(false);
  const [isWFragenModalOpen, setIsWFragenModalOpen] = useState(false);

  const [isLeechModalOpen, setIsLeechModalOpen] = useState(false);
  const [leechPhrase, setLeechPhrase] = useState<Phrase | null>(null);

  const [isCategoryManagerModalOpen, setIsCategoryManagerModalOpen] =
    useState(false);
  const [categoryToView, setCategoryToView] = useState<Category | null>(null);
  const [isCategoryFormModalOpen, setIsCategoryFormModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null
  );
  const [isAddingCategoryFromPractice, setIsAddingCategoryFromPractice] =
    useState(false);

  // New state for auto-fill flow
  const [categoryToAutoFill, setCategoryToAutoFill] = useState<Category | null>(
    null
  );
  const [autoFillingCategory, setAutoFillingCategory] =
    useState<Category | null>(null);
  const [isAutoFillPreviewOpen, setIsAutoFillPreviewOpen] = useState(false);
  const [proposedCardsForFill, setProposedCardsForFill] = useState<
    ProposedCard[]
  >([]);
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
  const [isCategoryAssistantModalOpen, setIsCategoryAssistantModalOpen] =
    useState(false);
  const [assistantCategory, setAssistantCategory] = useState<Category | null>(
    null
  );

  // New state for multi-delete confirmation
  const [isConfirmDeletePhrasesModalOpen, setIsConfirmDeletePhrasesModalOpen] =
    useState(false);
  const [phrasesForDeletion, setPhrasesForDeletion] = useState<{
    phrases: Phrase[];
    sourceCategory: Category;
  } | null>(null);

  // New state for practice chat
  const [isPracticeChatModalOpen, setIsPracticeChatModalOpen] = useState(false);
  const [practiceChatHistory, setPracticeChatHistory] = useState<ChatMessage[]>(
    []
  );
  const [practiceChatSessions, setPracticeChatSessions] = useState<
    PracticeChatSessionRecord[]
  >([]);
  const [practiceReviewLog, setPracticeReviewLog] = useState<
    PracticeReviewLogEntry[]
  >([]);

  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);

  const isPrefetchingRef = useRef(false);

  // Migrate legacy data on mount
  useEffect(() => {
    if (userId && languageProfile) {
      migrateLegacyStorage(userId, languageProfile);
    }
  }, [userId, languageProfile]);

  const showToast = useCallback(
    (config: { message: string; type?: ToastType }) => {
      setToast({
        message: config.message,
        type: config.type || "default",
        id: Date.now(),
      });
    },
    []
  );

  const updateAndSavePhrases = useCallback(
    (updater: React.SetStateAction<Phrase[]>) => {
      setAllPhrases((prevPhrases) => {
        const newPhrases =
          typeof updater === "function" ? updater(prevPhrases) : updater;
        try {
          localStorage.setItem(
            PHRASES_KEY(userId, languageProfile),
            JSON.stringify(newPhrases)
          );
        } catch (e) {
          console.error("Failed to save phrases to storage", e);
        }
        return newPhrases;
      });
    },
    [userId, languageProfile]
  );

  const loadUserData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // --- AI Provider Setup ---
    const providerList = getProviderPriorityList();
    let activeProvider: AiService | null = null;
    let activeProviderType: ApiProviderType | null = null;
    if (providerList.length > 0) {
      for (const providerInfo of providerList) {
        if (await providerInfo.provider.healthCheck()) {
          activeProvider = providerInfo.provider;
          activeProviderType = providerInfo.type;
          break;
        }
      }
    }
    if (activeProvider) {
      setApiProvider(activeProvider);
      setApiProviderType(activeProviderType);
    } else {
      setError(
        providerList.length === 0
          ? "No AI provider configured."
          : "AI features are temporarily unavailable."
      );
    }

    // --- Data Loading (Categories & Phrases) ---
    const storedCategories = localStorage.getItem(
      CATEGORIES_KEY(userId, languageProfile)
    );
    const storedPhrases = localStorage.getItem(
      PHRASES_KEY(userId, languageProfile)
    );
    let dataLoaded = false;

    if (storedCategories && storedPhrases) {
      console.log("Loading data from localStorage cache...");
      const loadedCategories = JSON.parse(storedCategories);
      let loadedPhrases: Phrase[] = JSON.parse(storedPhrases);
      loadedPhrases = loadedPhrases.map((p) => ({
        ...p,
        isMastered: srsService.isPhraseMastered(p, loadedCategories),
      }));
      setCategories(loadedCategories);
      setAllPhrases(loadedPhrases);
      dataLoaded = true;

      // Background sync with server
      backendService
        .fetchInitialData()
        .then((serverData) => {
          console.log("Syncing with server in background...");
          const {
            loadedCategories: serverCategories,
            loadedPhrases: serverPhrases,
          } = processInitialServerData(serverData);
          localStorage.setItem(
            CATEGORIES_KEY(userId, languageProfile),
            JSON.stringify(serverCategories)
          );
          updateAndSavePhrases(serverPhrases);
          setCategories(serverCategories);
          showToast({ message: t("notifications.sync.synced") });
        })
        .catch((syncError) => {
          console.warn("Background sync failed:", (syncError as Error).message);
        });
    } else {
      console.log("No local data, fetching from server...");
      try {
        const serverData = await backendService.fetchInitialData();
        const { loadedCategories, loadedPhrases } =
          processInitialServerData(serverData);

        localStorage.setItem(
          CATEGORIES_KEY(userId, languageProfile),
          JSON.stringify(loadedCategories)
        );
        localStorage.setItem(
          PHRASES_KEY(userId, languageProfile),
          JSON.stringify(loadedPhrases)
        );
        setCategories(loadedCategories);
        setAllPhrases(loadedPhrases);
        dataLoaded = true;
        showToast({ message: t("notifications.sync.loaded") });
      } catch (fetchError) {
        console.error(
          "Server not available, initializing with empty data:",
          (fetchError as Error).message
        );
        // Initialize with empty data if server is not available
        const defaultCategories = [
          {
            id: "1",
            name: "Общие",
            color: "bg-slate-500",
            isFoundational: true,
          },
        ];
        const defaultPhrases: Phrase[] = [];

        localStorage.setItem(
          CATEGORIES_KEY(userId, languageProfile),
          JSON.stringify(defaultCategories)
        );
        localStorage.setItem(
          PHRASES_KEY(userId, languageProfile),
          JSON.stringify(defaultPhrases)
        );
        setCategories(defaultCategories);
        setAllPhrases(defaultPhrases);
        dataLoaded = true;
        showToast({ message: "Инициализация с пустыми данными" });
      }
    }

    if (dataLoaded) {
      try {
        const loadedCategories = JSON.parse(
          localStorage.getItem(CATEGORIES_KEY(userId, languageProfile)) || "[]"
        );
        const storedSettings = localStorage.getItem(SETTINGS_KEY(userId));
        const defaultEnabledCategories = loadedCategories.reduce(
          (acc: any, cat: Category) => ({ ...acc, [cat.id]: true }),
          {} as Record<PhraseCategory, boolean>
        );

        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          const enabledCategories = {
            ...defaultEnabledCategories,
            ...parsedSettings.enabledCategories,
          };
          loadedCategories.forEach((cat: Category) => {
            if (!(cat.id in enabledCategories))
              enabledCategories[cat.id] = true;
          });
          setSettings({
            ...defaultSettings,
            ...parsedSettings,
            enabledCategories,
          });
        } else {
          setSettings({
            ...defaultSettings,
            enabledCategories: defaultEnabledCategories,
          });
        }

        const storedUsage = localStorage.getItem(BUTTON_USAGE_KEY(userId));
        if (storedUsage) setButtonUsage(JSON.parse(storedUsage));
        const storedMasteryUsage = localStorage.getItem(
          MASTERY_BUTTON_USAGE_KEY(userId)
        );
        if (storedMasteryUsage)
          setMasteryButtonUsage(JSON.parse(storedMasteryUsage));
        const storedCardActionUsage = localStorage.getItem(
          CARD_ACTION_USAGE_KEY(userId)
        );
        if (storedCardActionUsage)
          setCardActionUsage(JSON.parse(storedCardActionUsage));
        const storedHabitTracker = localStorage.getItem(
          HABIT_TRACKER_KEY(userId)
        );
        if (storedHabitTracker) setHabitTracker(JSON.parse(storedHabitTracker));

        const storedPracticeChat = localStorage.getItem(
          PRACTICE_CHAT_HISTORY_KEY(userId, languageProfile)
        );
        if (storedPracticeChat)
          setPracticeChatHistory(JSON.parse(storedPracticeChat));
        const storedPracticeChatSessions = localStorage.getItem(
          PRACTICE_CHAT_SESSIONS_KEY(userId, languageProfile)
        );
        if (storedPracticeChatSessions)
          setPracticeChatSessions(JSON.parse(storedPracticeChatSessions));
        const storedPracticeReviewLog = localStorage.getItem(
          PRACTICE_REVIEW_LOG_KEY(userId, languageProfile)
        );
        if (storedPracticeReviewLog)
          setPracticeReviewLog(JSON.parse(storedPracticeReviewLog));
        const storedDiscussCache = localStorage.getItem(
          DISCUSS_CHAT_CACHE_KEY(userId, languageProfile)
        );
        if (storedDiscussCache) {
          setDiscussCache(JSON.parse(storedDiscussCache));
        }
      } catch (e) {
        console.error("Failed to load settings or trackers", e);
      }
    }

    setIsLoading(false);
  }, [showToast, updateAndSavePhrases, userId, languageProfile, t]);

  const processInitialServerData = (serverData: {
    categories: Category[];
    phrases: Phrase[];
  }) => {
    let loadedPhrases = serverData.phrases.map((p) => ({
      ...p,
      isMastered: srsService.isPhraseMastered(p, serverData.categories),
    }));
    return { loadedCategories: serverData.categories, loadedPhrases };
  };

  // Sync language profile with AI service
  useEffect(() => {
    setCurrentLanguageProfile(languageProfile);
    console.log(
      "[App] Language profile updated for AI services:",
      languageProfile
    );
  }, [languageProfile]);

  useEffect(() => {
    console.log("🔍 [App] loadUserData useEffect triggered:", {
      needsOnboarding,
      isOnboardingLoading,
      willLoadData: !needsOnboarding && !isOnboardingLoading,
    });

    // Don't load data if user needs onboarding or onboarding is still checking
    if (!needsOnboarding && !isOnboardingLoading) {
      console.log("✅ [App] Conditions met, calling loadUserData()");
      loadUserData();
    } else {
      console.log("⏸️ [App] Skipping loadUserData because:", {
        needsOnboarding,
        isOnboardingLoading,
      });
    }
  }, [loadUserData, needsOnboarding, isOnboardingLoading]);

  // Handle user change - reload data for new user
  useEffect(() => {
    if (userChanged) {
      console.log("User changed, reloading data...");
      // Clear current state
      setAllPhrases([]);
      setCategories([]);
      setCurrentPracticePhrase(null);
      setIsLoading(true);
      setError(null);
      setPracticeChatHistory([]);
      setPracticeChatSessions([]);
      setPracticeReviewLog([]);

      // Clear localStorage for user data
      localStorage.removeItem(PHRASES_KEY(userId, languageProfile));
      localStorage.removeItem(CATEGORIES_KEY(userId, languageProfile));
      localStorage.removeItem(
        PRACTICE_CHAT_HISTORY_KEY(userId, languageProfile)
      );
      localStorage.removeItem(
        PRACTICE_CHAT_SESSIONS_KEY(userId, languageProfile)
      );
      localStorage.removeItem(PRACTICE_REVIEW_LOG_KEY(userId, languageProfile));

      // Reload data from server
      loadUserData();
      resetUserChanged();
    }
  }, [userChanged, resetUserChanged, loadUserData]);

  const callApiWithFallback = useCallback(
    async <T,>(apiCall: (provider: AiService) => Promise<T>): Promise<T> => {
      if (!apiProvider || !apiProviderType)
        throw new Error("AI provider not initialized.");

      const maxRetries = 3;

      const executeWithRetries = async (
        provider: AiService,
        type: ApiProviderType
      ): Promise<T> => {
        let attempt = 0;
        let delay = 1000; // 1s initial delay
        while (attempt < maxRetries) {
          try {
            return await apiCall(provider);
          } catch (error: any) {
            attempt++;
            let isRetryableError = false;
            let errorType = "generic";

            if (type === "gemini") {
              try {
                const message = error.message || "";
                const jsonMatch = message.match(/{.*}/s);
                if (jsonMatch) {
                  const errorJson = JSON.parse(jsonMatch[0]);
                  const errorCode = errorJson?.error?.code;
                  const errorStatus = errorJson?.error?.status;

                  if (
                    errorCode === 429 ||
                    errorStatus === "RESOURCE_EXHAUSTED"
                  ) {
                    isRetryableError = true;
                    errorType = "rate limit";
                  } else if (
                    errorCode === 503 ||
                    errorStatus === "UNAVAILABLE"
                  ) {
                    isRetryableError = true;
                    errorType = "server overloaded";
                  }
                } else {
                  if (
                    message.includes("429") ||
                    message.includes("RESOURCE_EXHAUSTED")
                  ) {
                    isRetryableError = true;
                    errorType = "rate limit";
                  } else if (
                    message.includes("503") ||
                    message.includes("UNAVAILABLE")
                  ) {
                    isRetryableError = true;
                    errorType = "server overloaded";
                  }
                }
              } catch (e) {
                const message = error.message || "";
                if (
                  message.includes("429") ||
                  message.includes("RESOURCE_EXHAUSTED")
                ) {
                  isRetryableError = true;
                  errorType = "rate limit";
                } else if (
                  message.includes("503") ||
                  message.includes("UNAVAILABLE")
                ) {
                  isRetryableError = true;
                  errorType = "server overloaded";
                }
              }
            }

            if (isRetryableError && attempt < maxRetries) {
              const jitter = Math.random() * 500;
              console.warn(
                `API call failed (${errorType}) on attempt ${attempt} with ${type}. Retrying in ${(delay + jitter) / 1000
                }s...`
              );
              await sleep(delay + jitter);
              delay *= 2; // Exponential backoff
            } else {
              throw error;
            }
          }
        }
        throw new Error(
          `API call failed with ${type} after ${maxRetries} attempts.`
        );
      };

      try {
        return await executeWithRetries(apiProvider, apiProviderType);
      } catch (primaryError) {
        console.warn(`API call with ${apiProviderType} failed:`, primaryError);
        const fallback = getFallbackProvider(apiProviderType);
        if (fallback) {
          console.log(`Attempting fallback to ${fallback.type}...`);
          setApiProvider(fallback.provider);
          setApiProviderType(fallback.type);
          try {
            return await executeWithRetries(fallback.provider, fallback.type);
          } catch (fallbackError) {
            console.error(
              `Fallback API call with ${fallback.type} also failed:`,
              fallbackError
            );
            throw new Error(
              `Primary API failed: ${(primaryError as Error).message
              }. Fallback API also failed: ${(fallbackError as Error).message}`
            );
          }
        }
        throw primaryError;
      }
    },
    [apiProvider, apiProviderType]
  );

  const updateAndSaveCategories = useCallback(
    (updater: React.SetStateAction<Category[]>) => {
      setCategories((prev) => {
        const newCategories =
          typeof updater === "function" ? updater(prev) : updater;
        localStorage.setItem(
          CATEGORIES_KEY(userId, languageProfile),
          JSON.stringify(newCategories)
        );
        return newCategories;
      });
    },
    [userId, languageProfile]
  );

  const handleSettingsChange = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(SETTINGS_KEY(userId), JSON.stringify(updated));
      return updated;
    });
  };

  const handlePracticeChatHistoryChange = useCallback(
    (updater: React.SetStateAction<ChatMessage[]>) => {
      setPracticeChatHistory((prev) => {
        const newHistory =
          typeof updater === "function" ? updater(prev) : updater;
        localStorage.setItem(
          PRACTICE_CHAT_HISTORY_KEY(userId, languageProfile),
          JSON.stringify(newHistory)
        );
        return newHistory;
      });
    },
    [userId, languageProfile]
  );

  const handlePracticeChatSessionComplete = useCallback(
    (session: PracticeChatSessionRecord) => {
      setPracticeChatSessions((prev) => {
        const updatedSessions = [...prev, session];
        const trimmed = updatedSessions.slice(-50);
        localStorage.setItem(
          PRACTICE_CHAT_SESSIONS_KEY(userId, languageProfile),
          JSON.stringify(trimmed)
        );
        return trimmed;
      });
    },
    [userId, languageProfile]
  );

  const appendPracticeReviewLog = useCallback(
    (entry: PracticeReviewLogEntry) => {
      if (!userId) return;
      const storageKey = PRACTICE_REVIEW_LOG_KEY(userId, languageProfile);
      setPracticeReviewLog((prev) => {
        const next = [...prev, entry];
        const trimmed =
          next.length > PRACTICE_REVIEW_LOG_LIMIT
            ? next.slice(next.length - PRACTICE_REVIEW_LOG_LIMIT)
            : next;
        try {
          localStorage.setItem(storageKey, JSON.stringify(trimmed));
        } catch (error) {
          console.error("[PracticeReviewLog] Failed to persist log", error);
        }
        return trimmed;
      });
    },
    [userId, languageProfile]
  );

  const handleHabitTrackerChange = useCallback(
    (updater: React.SetStateAction<typeof habitTracker>) => {
      setHabitTracker((prev) => {
        const newTracker =
          typeof updater === "function" ? updater(prev) : updater;
        localStorage.setItem(
          HABIT_TRACKER_KEY(userId),
          JSON.stringify(newTracker)
        );
        return newTracker;
      });
    },
    [userId]
  );

  const handleLogButtonUsage = useCallback(
    (button: "close" | "continue" | "next") => {
      const DECAY_FACTOR = 0.95;
      const INCREMENT = 1;
      setButtonUsage((prev) => {
        const newUsage = {
          close: prev.close * DECAY_FACTOR,
          continue: prev.continue * DECAY_FACTOR,
          next: prev.next * DECAY_FACTOR,
        };
        newUsage[button] += INCREMENT;
        localStorage.setItem(
          BUTTON_USAGE_KEY(userId),
          JSON.stringify(newUsage)
        );
        return newUsage;
      });
    },
    [userId]
  );

  const handleLogMasteryButtonUsage = useCallback(
    (button: "know" | "forgot" | "dont_know") => {
      const DECAY_FACTOR = 0.95;
      const INCREMENT = 1;
      setMasteryButtonUsage((prev) => {
        const newUsage = {
          know: prev.know * DECAY_FACTOR,
          forgot: prev.forgot * DECAY_FACTOR,
          dont_know: prev.dont_know * DECAY_FACTOR,
        };
        newUsage[button] += INCREMENT;
        localStorage.setItem(
          MASTERY_BUTTON_USAGE_KEY(userId),
          JSON.stringify(newUsage)
        );
        return newUsage;
      });
    },
    [userId]
  );

  const handleLogCardActionUsage = useCallback(
    (button: keyof typeof cardActionUsage) => {
      const DECAY_FACTOR = 0.95;
      const INCREMENT = 1;
      setCardActionUsage((prev) => {
        const newUsage = { ...prev };
        for (const key in newUsage) {
          (newUsage as any)[key] *= DECAY_FACTOR;
        }
        newUsage[button] += INCREMENT;
        localStorage.setItem(
          CARD_ACTION_USAGE_KEY(userId),
          JSON.stringify(newUsage)
        );
        return newUsage;
      });
    },
    [userId]
  );

  const fetchNewPhrases = useCallback(
    async (count: number = 5) => {
      if (isGenerating || !apiProvider) {
        if (!apiProvider)
          setError("AI provider is not available for generating new phrases.");
        return;
      }
      setIsGenerating(true);
      if (!error?.includes("AI features are temporarily unavailable"))
        setError(null);
      try {
        // FIX: Use phrase.text.learning to match the updated Phrase type
        const existingLearningPhrases = allPhrases
          .map((p) => p.text.learning)
          .join("; ");
        const prompt = `Сгенерируй ${count} новых, полезных в быту немецких фраз уровня A1. Не повторяй: "${existingLearningPhrases}". Верни JSON-массив объектов с ключами 'learning' и 'native'.`;
        const newPhrasesData = await callApiWithFallback((provider) =>
          provider.generatePhrases(prompt)
        );

        const generalCategory = categories.find(
          (c) => c.name.toLowerCase() === "общие"
        );
        const defaultCategoryId =
          generalCategory?.id ||
          (categories.length > 0 ? categories[0].id : "1");

        const phrasesToCreate = newPhrasesData.map((p) => ({
          // FIX: Map flat structure to nested `text` object
          text: { learning: p.learning, native: p.native },
          category: defaultCategoryId,
        }));

        const createdPhrases: Phrase[] = [];
        for (const p of phrasesToCreate) {
          try {
            const newPhrase = await backendService.createPhrase(p);
            createdPhrases.push(newPhrase);
          } catch (err) {
            console.error("Failed to save new phrase to backend:", err);
          }
        }

        if (createdPhrases.length > 0) {
          updateAndSavePhrases((prev) => [...prev, ...createdPhrases]);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error during phrase generation."
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [
      allPhrases,
      categories,
      isGenerating,
      updateAndSavePhrases,
      callApiWithFallback,
      apiProvider,
      error,
    ]
  );

  const openChatForPhrase = (phrase: Phrase) => {
    if (!apiProvider) return;
    setChatContextPhrase(phrase);
    setIsChatModalOpen(true);
  };

  const handleOpenDeepDive = useCallback(
    async (phrase: Phrase) => {
      if (!apiProvider) return;
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
        const analysis = await callApiWithFallback((provider) =>
          provider.generateDeepDiveAnalysis(phrase)
        );
        setDeepDiveAnalysis(analysis);
        cacheService.setCache(cacheKey, analysis);
      } catch (err) {
        setDeepDiveError(
          err instanceof Error
            ? err.message
            : "Unknown error during analysis generation."
        );
      } finally {
        setIsDeepDiveLoading(false);
      }
    },
    [callApiWithFallback, apiProvider]
  );

  const handleOpenMovieExamples = useCallback(
    async (phrase: Phrase) => {
      if (!apiProvider) return;
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
        const examples = await callApiWithFallback((provider) =>
          provider.generateMovieExamples(phrase)
        );
        setMovieExamples(examples);
        cacheService.setCache(cacheKey, examples);
      } catch (err) {
        setMovieExamplesError(
          err instanceof Error
            ? err.message
            : "Unknown error during example generation."
        );
      } finally {
        setIsMovieExamplesLoading(false);
      }
    },
    [callApiWithFallback, apiProvider]
  );

  const analyzeWord = useCallback(
    async (phrase: Phrase, word: string): Promise<WordAnalysis | null> => {
      if (!apiProvider) return null;
      const cacheKey = `word_analysis_${phrase.id}_${word.toLowerCase()}`;
      const cachedAnalysis = cacheService.getCache<WordAnalysis>(cacheKey);
      if (cachedAnalysis) return cachedAnalysis;

      try {
        const analysis = await callApiWithFallback((provider) =>
          provider.analyzeWordInPhrase(phrase, word)
        );
        cacheService.setCache(cacheKey, analysis);
        return analysis;
      } catch (err) {
        console.error("Error analyzing word:", err);
        return null;
      }
    },
    [callApiWithFallback, apiProvider]
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
        setWordAnalysisError("Unknown error during word analysis.");
      }
      setIsWordAnalysisLoading(false);
    },
    [analyzeWord, isWordAnalysisLoading]
  );

  const handleOpenVerbConjugation = useCallback(
    (infinitive: string) => {
      if (!apiProvider) return;
      setConjugationVerb(infinitive);
      setIsVerbConjugationModalOpen(true);
    },
    [apiProvider]
  );

  const handleOpenNounDeclension = useCallback(
    async (noun: string, article: string) => {
      if (!apiProvider) return;
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
        const data = await callApiWithFallback((provider) =>
          provider.declineNoun(noun, article)
        );
        setNounDeclensionData(data);
        cacheService.setCache(cacheKey, data);
      } catch (err) {
        setNounDeclensionError(
          err instanceof Error
            ? err.message
            : "Unknown error during declension generation."
        );
      } finally {
        setIsNounDeclensionLoading(false);
      }
    },
    [apiProvider, callApiWithFallback]
  );

  const handleOpenAdjectiveDeclension = useCallback(
    async (adjective: string) => {
      if (!apiProvider) return;
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
        const data = await callApiWithFallback((provider) =>
          provider.declineAdjective(adjective)
        );
        setAdjectiveDeclensionData(data);
        cacheService.setCache(cacheKey, data);
      } catch (err) {
        setAdjectiveDeclensionError(
          err instanceof Error
            ? err.message
            : "Unknown error during adjective declension generation."
        );
      } finally {
        setIsAdjectiveDeclensionLoading(false);
      }
    },
    [apiProvider, callApiWithFallback]
  );

  const handleOpenSentenceChain = (phrase: Phrase) => {
    if (!apiProvider) return;
    setSentenceChainPhrase(phrase);
    setIsSentenceChainModalOpen(true);
  };

  const prefetchPhraseBuilderOptions = useCallback(
    async (startingPhraseId: string | null) => {
      if (isPrefetchingRef.current || !apiProvider) return;
      isPrefetchingRef.current = true;

      try {
        const PREFETCH_COUNT = 2;
        let nextPhraseId = startingPhraseId;
        const phrasesToFetch: Phrase[] = [];
        const unmastered = allPhrases.filter((p) => p && !p.isMastered);

        for (let i = 0; i < PREFETCH_COUNT; i++) {
          const nextPhrase = srsService.selectNextPhrase(
            unmastered,
            nextPhraseId
          );
          if (nextPhrase) {
            if (phrasesToFetch.some((p) => p.id === nextPhrase.id)) break;
            phrasesToFetch.push(nextPhrase);
            nextPhraseId = nextPhrase.id;
          } else {
            break;
          }
        }

        await Promise.all(
          phrasesToFetch.map(async (phrase) => {
            const cacheKey = `phrase_builder_${phrase.id}`;
            if (!cacheService.getCache<PhraseBuilderOptions>(cacheKey)) {
              try {
                const options = await callApiWithFallback((provider) =>
                  provider.generatePhraseBuilderOptions(phrase)
                );
                cacheService.setCache(cacheKey, options);
              } catch (err) {
                console.warn(
                  `Background prefetch failed for phrase ${phrase.id}:`,
                  err
                );
              }
            }
          })
        );
      } finally {
        isPrefetchingRef.current = false;
      }
    },
    [allPhrases, callApiWithFallback, apiProvider]
  );

  // New proactive pre-fetching effect for both phrase builder and quick replies
  useEffect(() => {
    if (view === "practice" && currentPracticePhrase) {
      prefetchPhraseBuilderOptions(currentPracticePhrase.id);
    }
  }, [view, currentPracticePhrase, prefetchPhraseBuilderOptions]);

  const handleOpenVoiceWorkspace = (phrase: Phrase) => {
    if (!apiProvider) return;
    setVoiceWorkspacePhrase(phrase);
    setIsVoiceWorkspaceModalOpen(true);
  };

  const handleEvaluatePhraseAttempt = useCallback(
    (phrase: Phrase, userAttempt: string): Promise<PhraseEvaluation> => {
      return callApiWithFallback((provider) =>
        provider.evaluatePhraseAttempt(phrase, userAttempt)
      );
    },
    [callApiWithFallback]
  );

  const handleEvaluateSpokenPhraseAttempt = useCallback(
    (phrase: Phrase, userAttempt: string): Promise<PhraseEvaluation> => {
      return callApiWithFallback((provider) =>
        provider.evaluateSpokenPhraseAttempt(phrase, userAttempt)
      );
    },
    [callApiWithFallback]
  );

  const updatePhraseMasteryAndCache = useCallback(
    async (phrase: Phrase, action: PracticeReviewAction) => {
      const updatedPhrase = srsService.updatePhraseMastery(
        phrase,
        action,
        categories
      );

      // Optimistic UI update
      updateAndSavePhrases((prev) =>
        prev.map((p) => (p.id === phrase.id ? updatedPhrase : p))
      );
      if (updatedPhrase.isMastered && !phrase.isMastered) {
        cacheService.clearCacheForPhrase(phrase.id);
      }

      try {
        // Background sync
        await backendService.updatePhrase(updatedPhrase);
      } catch (err) {
        // On failure, just show a toast. Do NOT revert the UI state.
        showToast({
          message: t("notifications.sync.error", {
            message: (err as Error).message,
          }),
        });
        console.error("Background sync failed for phrase " + phrase.id, err);
      }

      const logTimestamp = Date.now();
      const randomSource =
        typeof globalThis !== "undefined"
          ? (globalThis as typeof globalThis & { crypto?: Crypto }).crypto
          : undefined;
      const logEntry: PracticeReviewLogEntry = {
        id:
          randomSource && typeof randomSource.randomUUID === "function"
            ? randomSource.randomUUID()
            : `review_${phrase.id}_${logTimestamp}`,
        timestamp: logTimestamp,
        phraseId: phrase.id,
        categoryId: phrase.category,
        action,
        wasCorrect: action === "know",
        wasNew: phrase.lastReviewedAt === null,
        previousMasteryLevel: phrase.masteryLevel,
        newMasteryLevel: updatedPhrase.masteryLevel,
        previousKnowStreak: phrase.knowStreak,
        newKnowStreak: updatedPhrase.knowStreak,
        previousLapses: phrase.lapses ?? 0,
        newLapses: updatedPhrase.lapses ?? 0,
        previousNextReviewAt: phrase.nextReviewAt,
        nextReviewAt: updatedPhrase.nextReviewAt,
        previousIsMastered: phrase.isMastered,
        newIsMastered: updatedPhrase.isMastered,
        previousKnowCount: phrase.knowCount,
        newKnowCount: updatedPhrase.knowCount,
        intervalMs: Math.max(updatedPhrase.nextReviewAt - logTimestamp, 0),
        languageLearning: languageProfile?.learning ?? "",
        languageNative: languageProfile?.native ?? "",
        isLeechAfter: srsService.isLeech(updatedPhrase),
      };

      appendPracticeReviewLog(logEntry);

      return updatedPhrase; // Return the optimistically updated phrase.
    },
    [
      updateAndSavePhrases,
      categories,
      showToast,
      appendPracticeReviewLog,
      languageProfile,
    ]
  );

  const handlePhraseActionSuccess = useCallback(
    async (phrase: Phrase) => {
      if (settings.soundEffects) playCorrectSound();
      return updatePhraseMasteryAndCache(phrase, "know");
    },
    [settings.soundEffects, updatePhraseMasteryAndCache]
  );

  const handlePhraseActionFailure = useCallback(
    async (phrase: Phrase) => {
      if (settings.soundEffects) playIncorrectSound();
      return updatePhraseMasteryAndCache(phrase, "forgot");
    },
    [settings.soundEffects, updatePhraseMasteryAndCache]
  );

  const handleUpdateMasteryWithoutUI = useCallback(
    async (phrase: Phrase, action: "know" | "forgot" | "dont_know") => {
      if (action === "know") {
        await handlePhraseActionSuccess(phrase);
      } else {
        await handlePhraseActionFailure(phrase);
      }
    },
    [handlePhraseActionSuccess, handlePhraseActionFailure]
  );

  const handleGenerateContinuations = useCallback(
    (nativePhrase: string) =>
      callApiWithFallback((provider) =>
        provider.generateSentenceContinuations(nativePhrase)
      ),
    [callApiWithFallback]
  );
  const handleGenerateInitialExamples = useCallback(
    (phrase: Phrase) =>
      callApiWithFallback((provider) =>
        provider.generateInitialExamples(phrase)
      ),
    [callApiWithFallback]
  );
  const handleContinueChat = useCallback(
    (phrase: Phrase, history: any[], newMessage: string) =>
      callApiWithFallback((provider) =>
        provider.continueChat(phrase, history, newMessage)
      ),
    [callApiWithFallback]
  );
  const handlePracticeConversation = useCallback(
    (history: ChatMessage[], newMessage: string) =>
      callApiWithFallback((provider) =>
        provider.practiceConversation(history, newMessage, allPhrases)
      ),
    [callApiWithFallback, allPhrases]
  );
  const handleGuideToTranslation = useCallback(
    (phrase: Phrase, history: ChatMessage[], userAnswer: string) =>
      callApiWithFallback((provider) =>
        provider.guideToTranslation(phrase, history, userAnswer)
      ),
    [callApiWithFallback]
  );
  const handleGenerateSinglePhrase = useCallback(
    (nativePhrase: string) =>
      callApiWithFallback((provider) =>
        provider.generateSinglePhrase(nativePhrase)
      ),
    [callApiWithFallback]
  );
  const handleTranslateLearningToNative = useCallback(
    (learningPhrase: string) =>
      callApiWithFallback((provider) =>
        provider.translateLearningToNative(learningPhrase)
      ),
    [callApiWithFallback]
  );
  const handleGetWordTranslation = useCallback(
    async (
      nativePhrase: string,
      learningPhrase: string,
      nativeWord: string
    ): Promise<{ learningTranslation: string }> => {
      const cacheKey = `word_translation_${nativePhrase}_${nativeWord}`;
      const cached = cacheService.getCache<{ learningTranslation: string }>(
        cacheKey
      );
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
    (transcript: string, sourceLang: "ru" | "de") =>
      callApiWithFallback((provider) =>
        provider.generateCardsFromTranscript(transcript, sourceLang)
      ),
    [callApiWithFallback]
  );
  const handleGenerateCardsFromImage = useCallback(
    (imageData: { mimeType: string; data: string }) =>
      callApiWithFallback((provider) =>
        provider.generateCardsFromImage(imageData)
      ),
    [callApiWithFallback]
  );
  const handleGenerateTopicCards = useCallback(
    (topic: string, refinement?: string, existingPhrases?: string[]) =>
      callApiWithFallback((provider) =>
        provider.generateTopicCards(topic, refinement, existingPhrases)
      ),
    [callApiWithFallback]
  );
  const handleClassifyTopic = useCallback(
    (topic: string) =>
      callApiWithFallback((provider) => provider.classifyTopic(topic)),
    [callApiWithFallback]
  );
  const handleGetCategoryAssistantResponse = useCallback(
    (
      categoryName: string,
      existingPhrases: Phrase[],
      request: CategoryAssistantRequest,
      history?: ChatMessage[]
    ) =>
      callApiWithFallback((provider) =>
        provider.getCategoryAssistantResponse(
          categoryName,
          existingPhrases,
          request,
          history
        )
      ),
    [callApiWithFallback]
  );
  const handleConjugateVerbSimple = useCallback(
    async (infinitive: string) => {
      const cacheKey = cacheService.createLanguageAwareKey(
        `verb_conjugation_simple_${infinitive}`
      );
      const cached = cacheService.getCache<any[]>(cacheKey);
      if (cached) return cached;
      const result = await callApiWithFallback((provider) =>
        provider.conjugateVerbSimple(infinitive)
      );
      cacheService.setCache(cacheKey, result);
      return result;
    },
    [callApiWithFallback]
  );
  const handleConjugateVerbDetailed = useCallback(
    async (infinitive: string) => {
      const cacheKey = cacheService.createLanguageAwareKey(
        `verb_conjugation_detailed_${infinitive}`
      );
      const cached = cacheService.getCache<VerbConjugation>(cacheKey);
      if (cached) return cached;
      const result = await callApiWithFallback((provider) =>
        provider.conjugateVerb(infinitive)
      );
      cacheService.setCache(cacheKey, result);
      return result;
    },
    [callApiWithFallback]
  );

  const handleOpenAddPhraseModal = (options: {
    language: LanguageCode;
    autoSubmit: boolean;
  }) => {
    if (!apiProvider) return;
    setAddPhraseConfig(options);
    setIsAddPhraseModalOpen(true);
  };

  const handlePhraseCreated = async (newPhraseData: {
    learning: string;
    native: string;
  }) => {
    const normalizedLearning = newPhraseData.learning.trim().toLowerCase();
    const isDuplicate = allPhrases.some(
      (p) => p.text.learning.trim().toLowerCase() === normalizedLearning
    );
    const isDuplicateInCategory = categoryToView
      ? allPhrases.some(
        (p) =>
          p.category === categoryToView.id &&
          p.text.learning.trim().toLowerCase() === normalizedLearning
      )
      : false;

    if (isDuplicateInCategory) {
      const message = t("notifications.phrases.existsInCategory", {
        phrase: newPhraseData.learning,
      });
      showToast({ message });
      throw new Error(message);
    } else if (isDuplicate) {
      const message = t("notifications.phrases.existsInOtherCategory", {
        phrase: newPhraseData.learning,
      });
      showToast({ message });
      throw new Error(message);
    }

    try {
      const generalCategory = categories.find(
        (c) => c.name.toLowerCase() === "общие"
      );
      const defaultCategoryId = categories.length > 0 ? categories[0].id : "1";
      const categoryId =
        categoryToView?.id || generalCategory?.id || defaultCategoryId;

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
        setView("practice");
      }
    } catch (err) {
      showToast({
        message: t("notifications.phrases.createError", {
          message: (err as Error).message,
        }),
      });
    }
  };

  const handleCreateProposedCards = useCallback(
    async (
      proposedCards: ProposedCard[],
      options?: { categoryId?: string; createCategoryName?: string }
    ) => {
      let finalCategoryId = options?.categoryId;
      let newCategory: Category | null = null;

      if (options?.createCategoryName && !finalCategoryId) {
        const trimmedName = options.createCategoryName.trim();
        const existingCategory = categories.find(
          (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );

        if (existingCategory) {
          finalCategoryId = existingCategory.id;
        } else {
          const colors = [
            "bg-red-500",
            "bg-orange-500",
            "bg-amber-500",
            "bg-yellow-500",
            "bg-lime-500",
            "bg-green-500",
            "bg-emerald-500",
            "bg-teal-500",
            "bg-cyan-500",
            "bg-sky-500",
            "bg-blue-500",
            "bg-indigo-500",
            "bg-violet-500",
            "bg-fuchsia-500",
            "bg-pink-500",
            "bg-rose-500",
          ];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          const capitalizedName =
            trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);

          const newCategoryData = {
            name: capitalizedName,
            color: randomColor,
            isFoundational: false,
          };

          try {
            newCategory = await backendService.createCategory(newCategoryData);
            updateAndSaveCategories((prev) => [...prev, newCategory!]);
            handleSettingsChange({
              enabledCategories: {
                ...settings.enabledCategories,
                [newCategory.id]: true,
              },
            });
            finalCategoryId = newCategory.id;
          } catch (err) {
            showToast({
              message: t("notifications.categories.createError", {
                message: (err as Error).message,
              }),
            });
            return;
          }
        }
      }

      const generalCategory = categories.find(
        (c) => c.name.toLowerCase() === "общие"
      );
      const defaultCategoryId = categories.length > 0 ? categories[0].id : "1";
      const targetCategoryId =
        finalCategoryId ||
        assistantCategory?.id ||
        categoryToView?.id ||
        generalCategory?.id ||
        defaultCategoryId;

      const targetCategory =
        newCategory || categories.find((c) => c.id === targetCategoryId);

      if (!targetCategory) {
        console.error("Target category could not be determined.");
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
        const existingPhrase =
          normalizedExistingPhrases.get(normalizedProposed);

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
      const baseToastMessage = t("notifications.cards.bulkAdded", {
        count: addedCount,
      });
      const toastMessage =
        skippedCount > 0
          ? `${baseToastMessage} ${t("notifications.cards.bulkSkipped", {
            count: skippedCount,
          })}`
          : baseToastMessage;
      showToast({ message: toastMessage });

      if (categoryToView || assistantCategory) {
        /* stay in view */
      } else {
        setView("list");
        setHighlightedPhraseId(null);
      }
    },
    [
      allPhrases,
      categories,
      categoryToView,
      assistantCategory,
      settings.enabledCategories,
      handleSettingsChange,
      showToast,
      updateAndSaveCategories,
      updateAndSavePhrases,
    ]
  );

  const handleCreateCardFromWord = useCallback(
    async (phraseData: { learning: string; native: string }) => {
      const alreadyExists = allPhrases.some(
        (p) =>
          p.text.learning.trim().toLowerCase() ===
          phraseData.learning.trim().toLowerCase()
      );
      if (alreadyExists) {
        showToast({
          message: t("notifications.phrases.exists", {
            phrase: phraseData.learning,
          }),
        });
        return;
      }

      try {
        const generalCategory = categories.find(
          (c) => c.name.toLowerCase() === "общие"
        );
        const defaultCategoryId =
          categories.length > 0 ? categories[0].id : "1";
        const categoryId = generalCategory?.id || defaultCategoryId;

        // FIX: The Phrase type requires a nested `text` object.
        const phraseToCreate = {
          text: { learning: phraseData.learning, native: phraseData.native },
          category: categoryId,
        };
        const newPhrase = await backendService.createPhrase(phraseToCreate);

        updateAndSavePhrases((prev) => [
          { ...newPhrase, isNew: true },
          ...prev,
        ]);
        showToast({
          message: t("notifications.phrases.created", {
            phrase: phraseData.learning,
          }),
        });
      } catch (err) {
        showToast({
          message: t("notifications.phrases.createCardError", {
            message: (err as Error).message,
          }),
        });
      }
    },
    [allPhrases, categories, updateAndSavePhrases, showToast]
  );

  const handleCreateCardFromSelection = useCallback(
    async (learningText: string): Promise<boolean> => {
      if (!apiProvider) {
        showToast({ message: t("notifications.ai.providerUnavailable") });
        return false;
      }
      const alreadyExists = allPhrases.some(
        (p) =>
          p.text.learning.trim().toLowerCase() ===
          learningText.trim().toLowerCase()
      );
      if (alreadyExists) {
        showToast({
          message: t("notifications.phrases.exists", { phrase: learningText }),
        });
        return false;
      }

      try {
        const { native } = await callApiWithFallback((provider) =>
          provider.translateLearningToNative(learningText)
        );
        const generalCategory = categories.find(
          (c) => c.name.toLowerCase() === "общие"
        );
        const defaultCategoryId =
          categories.length > 0 ? categories[0].id : "1";
        const categoryId = generalCategory?.id || defaultCategoryId;

        // FIX: The Phrase type requires a nested `text` object.
        const phraseToCreate = {
          text: { learning: learningText, native: native },
          category: categoryId,
        };
        const newPhrase = await backendService.createPhrase(phraseToCreate);

        updateAndSavePhrases((prev) => [
          { ...newPhrase, isNew: true },
          ...prev,
        ]);
        showToast({
          message: t("notifications.phrases.created", { phrase: learningText }),
        });
        return true;
      } catch (error) {
        console.error("Failed to create card from selection:", error);
        showToast({
          message: t("notifications.phrases.createCardGenericError"),
        });
        return false;
      }
    },
    [
      allPhrases,
      categories,
      updateAndSavePhrases,
      showToast,
      callApiWithFallback,
      apiProvider,
    ]
  );

  const handleOpenImproveModal = (phrase: Phrase) => {
    if (!apiProvider) return;
    setPhraseToImprove(phrase);
    setIsImproveModalOpen(true);
  };

  const handleOpenDiscussionFromImprove = (phraseForDiscussion: Phrase) => {
    setIsImproveModalOpen(false);
    setPhraseToDiscuss(phraseForDiscussion);
    setDiscussInitialMessage(
      "Давай обсудим, можно ли эту фразу улучшить и правильно, если она звучит с точки зрения носителя языка"
    );
    setIsDiscussModalOpen(true);
  };

  const handleGenerateImprovement = useCallback(
    (originalNative: string, currentLearning: string) =>
      callApiWithFallback((provider) =>
        provider.improvePhrase(originalNative, currentLearning)
      ),
    [callApiWithFallback]
  );

  const handleTranslatePhrase = useCallback(
    (native: string) =>
      callApiWithFallback((provider) => provider.translatePhrase(native)),
    [callApiWithFallback]
  );

  const handleDiscussTranslation = useCallback(
    (request: any) =>
      callApiWithFallback((provider) => provider.discussTranslation(request)),
    [callApiWithFallback]
  );
  const handleUpdateDiscussHistory = useCallback(
    (phraseId: string, messages: ChatMessage[]) => {
      setDiscussCache((prev) => {
        const newCache = { ...prev, [phraseId]: messages };
        try {
          localStorage.setItem(
            DISCUSS_CHAT_CACHE_KEY(userId, languageProfile),
            JSON.stringify(newCache)
          );
        } catch (error) {
          console.error("Failed to save discuss cache", error);
        }
        return newCache;
      });
    },
    [userId, languageProfile]
  );

  const handleFindDuplicates = useCallback(
    () =>
      callApiWithFallback((provider) =>
        provider.findDuplicatePhrases(allPhrases)
      ),
    [callApiWithFallback, allPhrases]
  );

  const handlePhraseImproved = async (
    phraseId: string,
    newLearning: string,
    newNative?: string
  ) => {
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
      updateAndSavePhrases((prev) =>
        prev.map((p) => (p.id === phraseId ? updatedPhrase : p))
      );
    } catch (err) {
      showToast({
        message: t("notifications.updateError", {
          message: (err as Error).message,
        }),
      });
    }
  };

  const handleSavePhraseEdits = async (
    phraseId: string,
    updates: Partial<Omit<Phrase, "id">>
  ) => {
    const originalPhrase = allPhrases.find((p) => p.id === phraseId);
    if (!originalPhrase) return;
    const updatedPhrase = { ...originalPhrase, ...updates };
    try {
      await backendService.updatePhrase(updatedPhrase);
      updateAndSavePhrases((prev) =>
        prev.map((p) => (p.id === phraseId ? updatedPhrase : p))
      );
    } catch (err) {
      showToast({
        message: t("notifications.saveError", {
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
        updateAndSavePhrases((prev) =>
          prev.filter((p) => p.id !== phraseToDelete.id)
        );
        if (currentPracticePhrase?.id === phraseToDelete.id) {
          setCurrentPracticePhrase(null); // Clear from practice view if it was active
        }
      } catch (err) {
        showToast({
          message: t("notifications.deleteError", {
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
    setView("practice");
  };

  const handleStartPracticeWithCategory = (categoryId: PhraseCategory) => {
    setPracticeCategoryFilter(categoryId);
    setView("practice");
  };

  const handleGoToListFromPractice = (phrase: Phrase) => {
    setView("list");
    setHighlightedPhraseId(phrase.id);
  };

  const handleOpenDiscussModal = (phrase: Phrase) => {
    setPhraseToDiscuss(phrase);
    setDiscussInitialMessage(
      "Проанализируй, пожалуйста, текущий перевод. Насколько он точен и естественен? Есть ли более удачные альтернативы?"
    );
    setIsDiscussModalOpen(true);
  };

  const handleDiscussionAccept = (suggestion: {
    native: string;
    learning: string;
  }) => {
    if (phraseToDiscuss) {
      handlePhraseImproved(
        phraseToDiscuss.id,
        suggestion.learning,
        suggestion.native
      );
    }
    setIsDiscussModalOpen(false);
    setDiscussInitialMessage(undefined);
  };

  const handleOpenLearningAssistant = (phrase: Phrase) => {
    if (!apiProvider) return;
    setLearningAssistantPhrase(phrase);
    setIsLearningAssistantModalOpen(true);
  };

  const handleLearningAssistantSuccess = useCallback(
    async (phrase: Phrase) => {
      if (settings.soundEffects) playCorrectSound();
      // FIX: Await the async function to get the updated phrase before setting state.
      const updatedPhrase = await updatePhraseMasteryAndCache(phrase, "know");
      if (currentPracticePhrase?.id === phrase.id) {
        setCurrentPracticePhrase(updatedPhrase);
      }
    },
    [updatePhraseMasteryAndCache, currentPracticePhrase, settings.soundEffects]
  );

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
        updateAndSavePhrases((prev) =>
          prev.map((p) => (p.id === phraseId ? updatedPhrase : p))
        );
      } catch (err) {
        showToast({
          message: t("notifications.moveError", {
            message: (err as Error).message,
          }),
        });
      }
    },
    [allPhrases, updateAndSavePhrases, showToast]
  );

  // --- Category Management Handlers ---
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

  const handleSaveCategory = async (categoryData: {
    name: string;
    color: string;
  }): Promise<boolean> => {
    const trimmedName = categoryData.name;
    const lowercasedName = trimmedName.toLowerCase();
    const capitalizedName =
      trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);
    const finalCategoryData = { ...categoryData, name: capitalizedName };

    try {
      if (categoryToEdit) {
        // Editing existing category
        const isDuplicate = categories.some(
          (c) =>
            c.id !== categoryToEdit.id &&
            c.name.trim().toLowerCase() === lowercasedName
        );
        if (isDuplicate) {
          return false;
        }

        const updatedCategory = await backendService.updateCategory({
          ...categoryToEdit,
          ...finalCategoryData,
        });
        updateAndSaveCategories((prev) =>
          prev.map((c) => (c.id === updatedCategory.id ? updatedCategory : c))
        );
        setIsCategoryFormModalOpen(false);
        setCategoryToEdit(null);
        setIsCategoryManagerModalOpen(true);
      } else {
        // Adding new category
        const isDuplicate = categories.some(
          (c) => c.name.trim().toLowerCase() === lowercasedName
        );
        if (isDuplicate) {
          return false;
        }

        const newCategoryData: Omit<Category, "id"> = {
          ...finalCategoryData,
          isFoundational: false,
        };
        const newCategory = await backendService.createCategory(
          newCategoryData
        );

        updateAndSaveCategories((prev) => [...prev, newCategory]);
        handleSettingsChange({
          enabledCategories: {
            ...settings.enabledCategories,
            [newCategory.id]: true,
          },
        });
        setIsCategoryFormModalOpen(false);
        setCategoryToEdit(null);
        setCategoryToAutoFill(newCategory);
        if (isAddingCategoryFromPractice)
          setIsAddingCategoryFromPractice(false);
      }
      return true; // Signal success
    } catch (err) {
      showToast({
        message: t("notifications.categories.saveError", {
          message: (err as Error).message,
        }),
      });
      return false;
    }
  };

  const handleConfirmDeleteCategory = async ({
    migrationTargetId,
  }: {
    migrationTargetId: string | null;
  }) => {
    if (!categoryToDelete) return;

    const phrasesToProcess = allPhrases.filter(
      (p) => p.category === categoryToDelete.id
    );
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
            message: t("notifications.cards.moving", {
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
            prev.map((p) =>
              p.category === categoryIdToDelete
                ? { ...p, category: migrationTargetId }
                : p
            )
          );
          showToast({ message: t("notifications.cards.moveSuccess") });
        } else {
          // --- Delete phrases ---
          showToast({
            message: t("notifications.cards.deleting", {
              count: phrasesToProcess.length,
            }),
          });
          for (let i = 0; i < phrasesToProcess.length; i++) {
            const phrase = phrasesToProcess[i];
            await backendService.deletePhrase(phrase.id);
            if (i < phrasesToProcess.length - 1) await sleep(delay);
          }
          updateAndSavePhrases((prev) =>
            prev.filter((p) => p.category !== categoryIdToDelete)
          );
          showToast({ message: t("notifications.cards.deleteSuccess") });
        }
      }

      // After processing all phrases, delete the now-empty category.
      await backendService.deleteCategory(categoryIdToDelete, null);

      // Update local state for categories and settings
      updateAndSaveCategories((prev) =>
        prev.filter((c) => c.id !== categoryIdToDelete)
      );
      const newEnabled = { ...settings.enabledCategories };
      delete newEnabled[categoryIdToDelete];
      handleSettingsChange({ enabledCategories: newEnabled });

      showToast({
        message: t("notifications.categories.deleteSuccess", {
          name: categoryName,
        }),
      });
    } catch (err) {
      showToast({
        message: t("notifications.deleteError", {
          message: (err as Error).message,
        }),
      });
    }
  };

  const handleAddPhraseFromCategoryDetail = () => {
    handleOpenAddPhraseModal({ language: "ru", autoSubmit: true });
  };

  const handleOpenCategoryAssistant = (category: Category) => {
    setCategoryToView(null); // Close detail view
    setAssistantCategory(category);
    setIsCategoryAssistantModalOpen(true);
  };

  const handleStartAutoFill = async (category: Category) => {
    if (!apiProvider) return;

    setCategoryToAutoFill(null);
    setAutoFillingCategory(category);

    try {
      const proposedCards = await handleGenerateTopicCards(
        category.name.replace(/^!/, "").trim()
      );
      setProposedCardsForFill(proposedCards);
      setIsAutoFillPreviewOpen(true);
    } catch (err) {
      showToast({
        message:
          err instanceof Error
            ? err.message
            : t("notifications.cards.generateError"),
      });
      setAutoFillingCategory(null);
    }
  };

  const handleRefineAutoFill = async (refinement: string) => {
    if (!autoFillingCategory) return;
    setIsRefining(true);
    try {
      const proposedCards = await handleGenerateTopicCards(
        autoFillingCategory.name.replace(/^!/, "").trim(),
        refinement
      );
      setProposedCardsForFill(proposedCards);
    } catch (err) {
      showToast({
        message:
          err instanceof Error
            ? err.message
            : t("notifications.cards.generateError"),
      });
    } finally {
      setIsRefining(false);
    }
  };

  const addCardsToCategory = useCallback(
    async (
      cards: ProposedCard[],
      targetCategory: Category
    ): Promise<number> => {
      let addedCount = 0;
      // FIX: Map ProposedCard to the correct Phrase structure before creating
      const phrasesToAdd = cards.map((p) => ({
        text: { native: p.native, learning: p.learning },
        category: targetCategory.id,
        ...(p.romanization
          ? { romanization: { learning: p.romanization } }
          : {}),
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
          console.error(
            "Failed to create a card during bulk add:",
            errorMessage
          );
          // FIX: Use `phrase.text.learning` to display the correct property in the toast message
          // Use `phrase.text.learning` to display the correct property in the toast message
          showToast({
            message: t("notifications.cards.addFailed", {
              phrase: phrase.text.learning,
              error: errorMessage,
            }),
          });

          // If rate-limited, stop trying to add more cards.
          if (errorMessage.toLowerCase().includes("too many requests")) {
            showToast({ message: t("notifications.cards.rateLimit") });
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
        const existingPhrase =
          normalizedExistingPhrases.get(normalizedProposed);

        if (
          existingPhrase &&
          existingPhrase.category !== autoFillingCategory.id
        ) {
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
        const addedCount = await addCardsToCategory(
          newCards,
          autoFillingCategory
        );
        showToast({
          message: t("notifications.cards.addedToCategory", {
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
        message: t("notifications.cards.movedAndAdded", {
          moved: phraseIdsToMove.length,
          added: addedCount,
          category: targetCategory.name,
        }),
      });
    } catch (err) {
      showToast({
        message: t("notifications.genericError", {
          message: (err as Error).message,
        }),
      });
    } finally {
      setIsMoveOrSkipModalOpen(false);
      setDuplicatesReviewData(null);
      setCategoryToView(targetCategory);
    }
  };

  const handleAddOnlyNewFromReview = async (
    newCards: ProposedCard[],
    targetCategory: Category
  ) => {
    const addedCount = await addCardsToCategory(newCards, targetCategory);
    showToast({
      message: t("notifications.cards.addedWithDuplicatesSkipped", {
        count: addedCount,
        category: targetCategory.name,
      }),
    });

    setIsMoveOrSkipModalOpen(false);
    setDuplicatesReviewData(null);
    setCategoryToView(targetCategory);
  };

  // New handler for opening the modal
  const handleOpenConfirmDeletePhrases = (
    phrases: Phrase[],
    sourceCategory: Category
  ) => {
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
      updateAndSavePhrases((prev) =>
        prev.filter((p) => !phraseIdsSet.has(p.id))
      );
      if (currentPracticePhrase && phraseIdsSet.has(currentPracticePhrase.id)) {
        setCurrentPracticePhrase(null);
      }
      showToast({
        message: t("notifications.cards.deletedCount", { count: deletedCount }),
      });
    }

    setIsConfirmDeletePhrasesModalOpen(false);
    setPhrasesForDeletion(null);
  };

  // New handler for moving multiple phrases
  const handleConfirmMoveMultiplePhrases = async (
    phraseIds: string[],
    targetCategoryId: string
  ) => {
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
        message: t("notifications.cards.movedToCategory", {
          count: movedCount,
          category:
            targetCategory?.name ?? t("notifications.cards.otherCategory"),
        }),
      });
    }

    setIsConfirmDeletePhrasesModalOpen(false);
    setPhrasesForDeletion(null);
  };

  // --- Practice Page Logic ---
  const unmasteredPhrases = useMemo(
    () =>
      allPhrases.filter(
        (p) => p && !p.isMastered && settings.enabledCategories[p.category]
      ),
    [allPhrases, settings.enabledCategories]
  );

  const unmasteredCountsByCategory = useMemo(() => {
    return unmasteredPhrases.reduce((acc, phrase) => {
      acc[phrase.category] = (acc[phrase.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [unmasteredPhrases]);

  const practicePool = useMemo(() => {
    if (practiceCategoryFilter === "all") {
      return unmasteredPhrases;
    }
    return unmasteredPhrases.filter(
      (p) => p.category === practiceCategoryFilter
    );
  }, [unmasteredPhrases, practiceCategoryFilter]);

  const practiceAnalyticsSummary = useMemo(() => {
    return buildPracticeAnalyticsSummary(
      allPhrases,
      categories,
      practiceReviewLog
    );
  }, [allPhrases, categories, practiceReviewLog]);

  const changePracticePhrase = useCallback(
    (nextPhrase: Phrase | null, direction: AnimationDirection) => {
      setIsPracticeAnswerRevealed(false);
      setPracticeCardEvaluated(false);
      if (!nextPhrase) {
        setCurrentPracticePhrase(null);
        return;
      }
      setPracticeAnimationState({ key: nextPhrase.id, direction });
      setCurrentPracticePhrase(nextPhrase);
    },
    []
  );

  const isInitialFilterChange = useRef(true);
  useEffect(() => {
    if (specificPhraseRequestedRef.current) {
      return;
    }

    if (view !== "practice" || isInitialFilterChange.current) {
      isInitialFilterChange.current = false;
      return;
    }

    // A change in the filter should immediately present a new card from that category.
    const newPool =
      practiceCategoryFilter === "all"
        ? unmasteredPhrases
        : unmasteredPhrases.filter(
          (p) => p.category === practiceCategoryFilter
        );

    const nextPhrase = srsService.selectNextPhrase(newPool, null); // Get a fresh card from the new pool
    changePracticePhrase(nextPhrase, "right");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceCategoryFilter, view]);

  const selectNextPracticePhrase = useCallback(() => {
    if (currentPracticePhrase) {
      setCardHistory((prev) => [...prev, currentPracticePhrase.id]);
      setLearningAssistantCache((prev) => {
        const newCache = { ...prev };
        delete newCache[currentPracticePhrase.id];
        return newCache;
      });
    }

    const nextPhrase = srsService.selectNextPhrase(
      practicePool,
      currentPracticePhrase?.id ?? null
    );

    if (nextPhrase) {
      changePracticePhrase(nextPhrase, "right");
    } else {
      // No due or new cards. Clear view to show loading/empty state.
      // Automatic phrase generation was removed as per user request.
      changePracticePhrase(null, "right");
    }
  }, [practicePool, currentPracticePhrase, changePracticePhrase]);

  useEffect(() => {
    if (specificPhraseRequestedRef.current) {
      specificPhraseRequestedRef.current = false;
      return;
    }
    if (
      !isLoading &&
      allPhrases.length > 0 &&
      !currentPracticePhrase &&
      view === "practice"
    ) {
      selectNextPracticePhrase();
    }
  }, [
    isLoading,
    allPhrases,
    currentPracticePhrase,
    selectNextPracticePhrase,
    view,
  ]);

  useEffect(() => {
    if (
      currentPracticePhrase &&
      !allPhrases.some((p) => p && p.id === currentPracticePhrase.id)
    ) {
      selectNextPracticePhrase();
    }
  }, [allPhrases, currentPracticePhrase, selectNextPracticePhrase]);

  useEffect(() => {
    if (isVoiceWorkspaceModalOpen && currentPracticePhrase) {
      setVoiceWorkspacePhrase(currentPracticePhrase);
    }
  }, [currentPracticePhrase, isVoiceWorkspaceModalOpen]);

  const transitionToNext = useCallback(
    (direction: AnimationDirection = "right") => {
      if (practiceIsExitingRef.current) return;

      practiceIsExitingRef.current = true;
      setTimeout(() => {
        if (direction === "right") {
          selectNextPracticePhrase();
        }
        practiceIsExitingRef.current = false;
      }, 250);
    },
    [selectNextPracticePhrase]
  );

  const handlePracticeUpdateMastery = useCallback(
    async (action: "know" | "forgot" | "dont_know"): Promise<boolean> => {
      if (!currentPracticePhrase || practiceIsExitingRef.current) return false;

      handleLogMasteryButtonUsage(action);
      const originalPhrase = currentPracticePhrase;
      const srsUpdatedPhrase = srsService.updatePhraseMastery(
        originalPhrase,
        action,
        categories
      );

      if (action === "forgot" || action === "dont_know") {
        const wasLeech = srsService.isLeech(originalPhrase);
        const isNowLeech = srsService.isLeech(srsUpdatedPhrase);

        if (!wasLeech && isNowLeech) {
          const backendUpdatedPhrase = await updatePhraseMasteryAndCache(
            originalPhrase,
            action
          );
          if (settings.soundEffects) playIncorrectSound();
          setLeechPhrase(backendUpdatedPhrase);
          setIsLeechModalOpen(true);
          return true; // Leech modal shown
        }
      }

      const finalPhraseState = await updatePhraseMasteryAndCache(
        originalPhrase,
        action
      );

      // При "Знаю" не переворачиваем карточку - пользователь и так знает ответ
      if (action !== "know") {
        setIsPracticeAnswerRevealed(true);
      }
      setPracticeCardEvaluated(action === "know");
      setCurrentPracticePhrase(finalPhraseState);

      if (action === "know") {
        if (settings.soundEffects) playCorrectSound();
        // Озвучиваем фразу при "Знаю" без переворота карточки
        if (settings.autoSpeak && "speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(originalPhrase.text.learning);
          const learningLang = languageProfile.learning || "de";
          utterance.lang = getSpeechLocale(learningLang);
          utterance.rate = 0.9;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        }
      } else {
        if (settings.soundEffects) playIncorrectSound();
      }
      return false; // Leech modal not shown
    },
    [
      currentPracticePhrase,
      practiceIsExitingRef,
      handleLogMasteryButtonUsage,
      categories,
      updatePhraseMasteryAndCache,
      settings.soundEffects,
    ]
  );

  const handleLeechAction = useCallback(
    async (phrase: Phrase, action: "continue" | "reset" | "postpone") => {
      let updatedPhrase = { ...phrase };
      const now = Date.now();

      if (action === "continue") {
        updatedPhrase.nextReviewAt = now + 10 * 60 * 1000; // 10 minutes
      } else if (action === "reset") {
        updatedPhrase = {
          ...phrase,
          masteryLevel: 0,
          lastReviewedAt: null,
          nextReviewAt: now,
          knowCount: 0,
          knowStreak: 0,
          lapses: 0,
          isMastered: false,
        };
      } else {
        // postpone
        updatedPhrase.nextReviewAt = now + 24 * 60 * 60 * 1000; // 24 hours
      }

      try {
        await backendService.updatePhrase(updatedPhrase);
        updateAndSavePhrases((prev) =>
          prev.map((p) => (p.id === updatedPhrase.id ? updatedPhrase : p))
        );
      } catch (err) {
        showToast({
          message: t("notifications.genericError", {
            message: (err as Error).message,
          }),
        });
      }

      setIsLeechModalOpen(false);
      setLeechPhrase(null);
      transitionToNext();
    },
    [updateAndSavePhrases, transitionToNext, showToast]
  );

  const handlePracticeSwipeRight = useCallback(() => {
    if (practiceIsExitingRef.current || cardHistory.length === 0) return;
    practiceIsExitingRef.current = true;
    setTimeout(() => {
      const lastPhraseId = cardHistory[cardHistory.length - 1];
      const prevPhrase = allPhrases.find((p) => p.id === lastPhraseId);
      if (prevPhrase) {
        setCardHistory((prev) => prev.slice(0, -1));
        changePracticePhrase(prevPhrase, "left");
      }
      practiceIsExitingRef.current = false;
    }, 250);
  }, [allPhrases, cardHistory, changePracticePhrase]);
  // --- End Practice Page Logic ---

  // Speak the phrase when the card is flipped to the answer side.
  useEffect(() => {
    if (
      isPracticeAnswerRevealed &&
      currentPracticePhrase &&
      settings.autoSpeak &&
      "speechSynthesis" in window
    ) {
      const utterance = new SpeechSynthesisUtterance(
        currentPracticePhrase.text.learning
      );
      // Use learning language from profile for correct pronunciation
      const learningLang = languageProfile.learning || "de";
      utterance.lang = getSpeechLocale(learningLang);
      utterance.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [
    isPracticeAnswerRevealed,
    currentPracticePhrase,
    settings.autoSpeak,
    languageProfile.learning,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      // Check if any modal is open by looking for a modal backdrop
      const isModalOpen = !!document.querySelector(
        ".fixed.inset-0.bg-black\\/60, .fixed.inset-0.bg-black\\/70"
      );
      if (isModalOpen) return;

      if (
        view === "practice" &&
        currentPracticePhrase &&
        !practiceIsExitingRef.current
      ) {
        if (e.key === "ArrowRight") {
          transitionToNext("right");
        } else if (e.key === "ArrowLeft") {
          handlePracticeSwipeRight();
        } else if (e.key === " ") {
          // Space bar to flip
          e.preventDefault();
          if (!isPracticeAnswerRevealed) {
            setIsPracticeAnswerRevealed(true);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    view,
    currentPracticePhrase,
    isPracticeAnswerRevealed,
    transitionToNext,
    handlePracticeSwipeRight,
  ]);

  const getProviderDisplayName = () => {
    if (!apiProvider) return "";
    const name = apiProvider.getProviderName();
    if (name.toLowerCase().includes("gemini")) return "Google Gemini";
    if (name.toLowerCase().includes("deepseek")) return "DeepSeek";
    return name;
  };

  const handleOpenLibrary = () => setView("library");
  const handleOpenBook = (bookId: number) => {
    setActiveBookId(bookId);
    setView("reader");
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
          console.error("[AutoFix] Failed to update phrase:", phrase.id, error);
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
      case "practice":
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
            apiProviderAvailable={!!apiProvider}
            onUpdateMastery={handlePracticeUpdateMastery}
            onUpdateMasteryWithoutUI={handleUpdateMasteryWithoutUI}
            onContinue={() => transitionToNext("right")}
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
            onLogCardActionUsage={handleLogCardActionUsage}
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
      case "list":
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
      case "library":
        return <LibraryPage onOpenBook={handleOpenBook} />;
      case "reader":
        return activeBookId ? (
          <ReaderPage
            bookId={activeBookId}
            onClose={() => setView("library")}
          />
        ) : null;
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
        className={`overflow-hidden w-full flex-grow flex flex-col items-center  ${view === "practice" ? "justify-center" : ""
          }`}
      >
        {renderCurrentView()}
      </main>
      {view === "practice" && !isLoading && (
        <>
          <PracticeChatFab
            onClick={() => setIsPracticeChatModalOpen(true)}
            disabled={!apiProvider}
          />
          <ExpandingFab
            onAddPhrase={handleOpenAddPhraseModal}
            onSmartImport={() => setIsSmartImportModalOpen(true)}
            onOpenLibrary={handleOpenLibrary}
            disabled={!apiProvider}
          />
        </>
      )}
      {view === "practice" ? (
        <footer className="text-center text-slate-500 py-4 text-sm h-6">
          {isGenerating
            ? "Идет генерация новых фраз..."
            : apiProvider
              ? ``
              : ""}
        </footer>
      ) : (
        ""
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
            onSessionComplete={handlePracticeChatSessionComplete}
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
        onSettingsChange={handleSettingsChange}
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
          isOpen={isImproveModalOpen}
          onClose={() => setIsImproveModalOpen(false)}
          phrase={phraseToImprove}
          onGenerateImprovement={handleGenerateImprovement}
          onPhraseImproved={handlePhraseImproved}
          onOpenDiscussion={handleOpenDiscussionFromImprove}
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
          isOpen={isLeechModalOpen}
          phrase={leechPhrase}
          onImprove={(phrase) => {
            handleLeechAction(phrase, "postpone");
            handleOpenImproveModal(phrase);
          }}
          onDiscuss={(phrase) => {
            handleLeechAction(phrase, "postpone");
            handleOpenDiscussModal(phrase);
          }}
          onContinue={(phrase) => handleLeechAction(phrase, "continue")}
          onReset={(phrase) => handleLeechAction(phrase, "reset")}
          onPostpone={(phrase) => handleLeechAction(phrase, "postpone")}
        />
      )}
      <VoiceWorkspaceModal
        isOpen={isVoiceWorkspaceModalOpen}
        onClose={() => setIsVoiceWorkspaceModalOpen(false)}
        phrase={voiceWorkspacePhrase}
        onEvaluate={handleEvaluateSpokenPhraseAttempt}
        onSuccess={handlePhraseActionSuccess}
        onFailure={handlePhraseActionFailure}
        onNextPhrase={() => {
          setIsVoiceWorkspaceModalOpen(false);
          transitionToNext();
        }}
        onGeneratePhraseBuilderOptions={useCallback(
          (phrase: Phrase) =>
            callApiWithFallback((p) => p.generatePhraseBuilderOptions(phrase)),
          [callApiWithFallback]
        )}
        onPracticeNext={() => selectNextPracticePhrase()}
        settings={settings}
        buttonUsage={buttonUsage}
        onLogButtonUsage={handleLogButtonUsage}
        habitTracker={habitTracker}
        onHabitTrackerChange={handleHabitTrackerChange}
        showToast={showToast}
        onOpenLearningAssistant={handleOpenLearningAssistant}
      />
      {learningAssistantPhrase && (
        <AiErrorBoundary componentName="Learning Assistant">
          <LearningAssistantModal
            isOpen={isLearningAssistantModalOpen}
            onClose={(didSucceed?: boolean) => {
              setIsLearningAssistantModalOpen(false);
              const shouldReturnToWorkspace = isVoiceWorkspaceModalOpen;

              if (didSucceed && learningAssistantPhrase) {
                const finalPhraseState =
                  allPhrases.find((p) => p.id === learningAssistantPhrase.id) ||
                  learningAssistantPhrase;
                handleOpenVoiceWorkspace(finalPhraseState);
              } else if (shouldReturnToWorkspace && learningAssistantPhrase) {
                handleOpenVoiceWorkspace(learningAssistantPhrase);
              }
            }}
            phrase={learningAssistantPhrase}
            onGuide={handleGuideToTranslation}
            onSuccess={handleLearningAssistantSuccess}
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
      <AutoFillLoadingModal
        isOpen={!!autoFillingCategory && !isAutoFillPreviewOpen}
        category={autoFillingCategory}
      />
      <AutoFillPreviewModal
        isOpen={isAutoFillPreviewOpen}
        onClose={() => {
          setIsAutoFillPreviewOpen(false);
          setAutoFillingCategory(null);
        }}
        categoryName={autoFillingCategory?.name || ""}
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
            phrases={allPhrases.filter(
              (p) => p.category === assistantCategory.id
            )}
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
            onGoToList={() => setView("list")}
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
      <AccountDrawer
        isOpen={isAccountDrawerOpen}
        onClose={() => setIsAccountDrawerOpen(false)}
      />
      {(() => {
        const shouldShowModal = needsOnboarding && !isOnboardingLoading;
        console.log("🎭 [App] LanguageOnboardingModal render:", {
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
