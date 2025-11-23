// FIX: Moved View type from App.tsx and exported it to be shared across components.
export type View = 'practice' | 'list' | 'library' | 'reader';

export const SUPPORTED_LANGUAGE_CODES = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'ma', 'pt', 'pl', 'ru', 'zh'] as const;
export type LanguageCode = typeof SUPPORTED_LANGUAGE_CODES[number];

export interface LanguageProfile {
  ui: LanguageCode;
  native: LanguageCode;
  learning: LanguageCode;
}

export type PhraseCategory = string;

export interface Category {
  id: string;
  name: string;
  color: string;
  isFoundational: boolean;
  isNew?: boolean; // Used to trigger auto-generation
}

export interface Phrase {
  id: string;
  text: {
    native: string;
    learning: string;
  };
  category: PhraseCategory;
  romanization?: {
    learning?: string;
  };
  context?: {
    native?: string;
  };
  masteryLevel: number; // 0: new, higher is better
  lastReviewedAt: number | null; // timestamp
  nextReviewAt: number; // timestamp
  knowCount: number; // Total times 'know' was clicked
  knowStreak: number; // Consecutive times 'know' was clicked
  isMastered: boolean; // True if knowCount >= 3 or knowStreak >= 2
  lapses: number; // Number of times the user has forgotten this card after the first success.
  isNew?: boolean;
}

export type ProposedCard = {
  native: string;
  learning: string;
  romanization?: string;
};

export interface MovieExample {
  title: string;
  // FIX: Renamed 'titleNative' to be consistent with other types.
  titleNative: string;
  // FIX: Renamed 'dialogueLearning' to be consistent with other types.
  dialogueLearning: string;
  // FIX: Renamed 'dialogueNative' to be consistent with other types.
  dialogueNative: string;
}

export interface WordAnalysis {
  word: string;
  partOfSpeech: string;
  nativeTranslation: string;
  baseForm?: string; // Base form for adjectives
  nounDetails?: {
    article: string;
    plural: string;
  };
  verbDetails?: {
    infinitive: string;
    tense: string;
    person: string;
  };
  exampleSentence: string;
  exampleSentenceNative: string;
}

export interface PronounConjugation {
  pronoun: string;
  pronounNative?: string;
  learning: string;
  native: string;
}

export interface Pronoun {
  learning: string; // pronoun in learning language
  native: string; // translation in native language
}

export interface TenseForms {
  statement: PronounConjugation[];
  question: PronounConjugation[];
  negative: PronounConjugation[];
}

export interface VerbConjugation {
  infinitive: string;
  past: TenseForms;
  present: TenseForms;
  future: TenseForms;
}

export interface NounDeclension {
  noun: string;
  // NOTE: Keys use Learning case labels for compatibility with current AI schema.
  // UI texts are localized via i18n; data remains language-agnostic strings.
  singular: {
    nominativ: string;
    akkusativ: string;
    dativ: string;
    genitiv: string;
  };
  plural: {
    nominativ: string;
    akkusativ: string;
    dativ: string;
    genitiv: string;
  };
}

export interface AdjectiveDeclension {
  adjective: string;
  weak: DeclensionTable;
  mixed: DeclensionTable;
  strong: DeclensionTable;
}

export interface DeclensionTable {
  masculine: CaseDeclension;
  feminine: CaseDeclension;
  neuter: CaseDeclension;
  plural: CaseDeclension;
}

export interface CaseDeclension {
  nominative: string;
  accusative: string;
  dative: string;
  genitive: string;
}

export interface SentenceContinuation {
  learning: string;
  native: string;
}

export interface PhraseBuilderOptions {
  wordOptions: string[];
}

export interface CheatSheetOption {
  type: 'verbConjugation' | 'nounDeclension' | 'pronouns' | 'wFragen';
  label: string;
  data?: string | { noun: string; article: string };
}

export interface ContentPart {
  type: 'text' | 'learning';
  text: string;
  translation?: string; // For learning type
}

export interface ExamplePair {
  // FIX: Renamed 'learningExample' to 'learningExample' for consistency.
  learningExample: string;
  // FIX: Renamed 'nativeTranslation' to 'nativeTranslation' for consistency.
  nativeTranslation: string;
}

export interface ProactiveSuggestion {
  topic: string;
  icon: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text?: string;
  examples?: ExamplePair[];
  suggestions?: ProactiveSuggestion[];
  contentParts?: ContentPart[];
  promptSuggestions?: string[];
  isCorrect?: boolean;
  wordOptions?: string[];
  cheatSheetOptions?: CheatSheetOption[];
  // For Category Assistant
  assistantResponse?: CategoryAssistantResponse;
}

export interface TranslationChatRequest {
  originalNative: string;
  currentLearning: string;
  history: ChatMessage[];
  userRequest: string;
}

export interface TranslationChatResponse {
  role: 'user' | 'model';
  contentParts: ContentPart[];
  promptSuggestions: string[];
  suggestion?: {
    learning: string;
    native: string;
  };
}

export interface CategoryAssistantResponse {
  responseType: 'text' | 'proposed_cards' | 'phrases_to_review' | 'phrases_to_delete';
  responseParts: ContentPart[];
  promptSuggestions: string[];
  proposedCards?: ProposedCard[];
  phrasesToReview?: { learning: string; reason: string }[];
  phrasesForDeletion?: { learning: string; reason: string }[];
}

export type CategoryAssistantRequestType = 'initial' | 'add_similar' | 'check_homogeneity' | 'create_dialogue' | 'user_text';

export interface CategoryAssistantRequest {
  type: CategoryAssistantRequestType;
  text?: string;
}

// ============================================================================
// NEW PRACTICE CHAT TYPES (Redesign)
// ============================================================================

/**
 * Type of AI message in Practice Chat
 */
export type PracticeChatMessageType =
  | 'greeting'      // Welcome and session start
  | 'question'      // Question from AI to user
  | 'correction'    // Correction of user's mistake
  | 'explanation'   // Grammar/word explanation
  | 'encouragement' // Praise and motivation
  | 'suggestion';   // Suggestion to use a phrase

/**
 * Simplified Practice Chat Message structure
 */
export interface PracticeChatMessage {
  role: 'user' | 'assistant';
  messageType?: PracticeChatMessageType; // Only for assistant messages

  // Main content
  content: {
    // Primary text in learning language
    primary: {
      text: string;           // e.g., "Wie geht es dir?"
      translation?: string;   // e.g., "How are you?" (for assistant messages)
    };

    // Additional explanation in native language (optional)
    secondary?: {
      text: string;           // e.g., "Это вежливый способ спросить как дела"
    };
  };

  // Interactive elements (only for assistant)
  actions?: {
    suggestions?: string[];   // Quick reply buttons ["Gut, danke", "Sehr gut"]
    hints?: string[];         // Hints if user is stuck
    phraseUsed?: string;      // ID of phrase from vocabulary
  };

  // Metadata
  metadata?: {
    timestamp: number;
    correctness?: 'correct' | 'partial' | 'incorrect';  // For user messages
    vocabulary?: string[];    // New words introduced
  };
}

/**
 * Practice Chat Session Statistics
 */
export interface PracticeChatSessionStats {
  phrasesUsedIds: string[];       // IDs of phrases practiced
  correctCount: number;            // Number of correct responses
  incorrectCount: number;          // Number of mistakes
  partialCount: number;            // Number of partially correct responses
  hintsUsed: number;               // Number of hints requested
  duration: number;                // Session duration in ms
  messagesExchanged: number;       // Total message count
  sessionStartTime: number;        // Timestamp of session start
}

export interface PracticeChatSessionRecord extends PracticeChatSessionStats {
  sessionEndTime: number;          // Timestamp of session end
  sessionId: string;               // Unique session identifier
}

export type PracticeReviewAction = 'know' | 'forgot' | 'dont_know';

export interface PracticeReviewLogEntry {
  id: string;
  timestamp: number;
  phraseId: string;
  categoryId: string;
  action: PracticeReviewAction;
  wasCorrect: boolean;
  wasNew: boolean;
  previousMasteryLevel: number;
  newMasteryLevel: number;
  previousKnowStreak: number;
  newKnowStreak: number;
  previousLapses: number;
  newLapses: number;
  previousNextReviewAt: number;
  nextReviewAt: number;
  previousIsMastered: boolean;
  newIsMastered: boolean;
  previousKnowCount: number;
  newKnowCount: number;
  intervalMs: number;
  languageLearning: string;
  languageNative: string;
  isLeechAfter: boolean;
}

/**
 * Raw AI response from Gemini (simplified schema)
 */
export interface PracticeChatAIResponse {
  messageType: PracticeChatMessageType;
  primaryText: string;
  translation: string;
  secondaryText?: string;
  suggestions: string[];
  hints?: string[];
  vocabularyUsed?: string[];
}
