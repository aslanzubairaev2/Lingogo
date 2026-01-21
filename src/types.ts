/**
 * Supported view modes for the application.
 * - 'practice': The main practice/quiz interface.
 * - 'list': View for browsing and managing phrases.
 * - 'library': View for accessing book content.
 * - 'reader': The e-reader interface for reading books.
 */
export type View = 'practice' | 'list' | 'library' | 'reader';

import { type LanguageCode, SUPPORTED_LANGUAGE_CODES } from './i18n/languageMeta';
export { type LanguageCode, SUPPORTED_LANGUAGE_CODES };

/**
 * Represents the user's language configuration.
 */
export interface LanguageProfile {
  /** The language code for the application UI. */
  ui: LanguageCode;
  /** The user's native language code (known language). */
  native: LanguageCode;
  /** The language code the user is currently learning. */
  learning: LanguageCode;
}

/**
 * Identifies a category of phrases. Currently a string alias.
 */
export type PhraseCategory = string;

/**
 * Represents a category grouping for phrases.
 */
export interface Category {
  /** Unique identifier for the category. */
  id: string;
  /** Display name of the category. */
  name: string;
  /** Color code associated with the category (e.g., hex string). */
  color: string;
  /** Whether this is a foundational/default category. */
  isFoundational: boolean;
  /** Optional flag: if true, triggers auto-generation of content. */
  isNew?: boolean;
}

/**
 * Represents a learning phrase or vocabulary item.
 */
export interface Phrase {
  /** Unique identifier for the phrase. */
  id: string;
  /** The text content of the phrase. */
  text: {
    /** The phrase in the user's native (known) language. */
    native: string;
    /** The phrase in the target learning language. */
    learning: string;
  };
  /** The category ID this phrase belongs to. */
  category: PhraseCategory;
  /** Romanization details (optional). */
  romanization?: {
    /** Romanized version of the learning text (e.g., Pinyin for Chinese). */
    learning?: string;
  };
  /** Contextual information for the phrase. */
  context?: {
    /** Usage context or notes in the native language. */
    native?: string;
  };
  /** Mastery level (0-5+). 0 is new, higher indicates better retention. */
  masteryLevel: number;
  /** Timestamp of the last review session. Null if never reviewed. */
  lastReviewedAt: number | null;
  /** Timestamp when the next review is due (Spaced Repetition). */
  nextReviewAt: number;
  /** Total number of times the user successfully recalled this phrase. */
  knowCount: number;
  /** Consecutive successful recalls. */
  knowStreak: number;
  /** Whether the phrase is considered 'mastered' (e.g., knowCount >= 3). */
  isMastered: boolean;
  /** Number of times the phrase was forgotten after being known. */
  lapses: number;
  /** Optional flag marking the phrase as newly added. */
  isNew?: boolean;
}

/**
 * Structure for a suggested new flashcard (e.g., from AI generation).
 */
export type ProposedCard = {
  /** Text in the native language. */
  native: string;
  /** Text in the learning language. */
  learning: string;
  /** Optional romanization. */
  romanization?: string;
};

/**
 * Represents an example from a movie or media content.
 */
export interface MovieExample {
  /** The title of the movie or source. */
  title: string;
  /** Localized title in the user's native language. */
  titleNative: string;
  /** Dialogue text in the learning language. */
  dialogueLearning: string;
  /** Dialogue text in the native language (subtitles). */
  dialogueNative: string;
}

/**
 * Detailed grammatical analysis of a word.
 */
export interface WordAnalysis {
  /** The word being analyzed. */
  word: string;
  /** Part of speech tag (e.g., Noun, Verb). */
  partOfSpeech: string;
  /** Translation in the native language. */
  nativeTranslation: string;
  /** Base/dictionary form of the word (lemma). */
  baseForm?: string;
  /** Specific details if the word is a noun. */
  nounDetails?: {
    article: string;
    plural: string;
  };
  /** Specific details if the word is a verb. */
  verbDetails?: {
    infinitive: string;
    tense: string;
    person: string;
  };
  /** Example sentence containing the word. */
  exampleSentence: string;
  /** Native translation of the example sentence. */
  exampleSentenceNative: string;
}

/**
 * Represents a conjugated form associated with a pronoun.
 */
export interface PronounConjugation {
  /** The pronoun key or text. */
  pronoun: string;
  /** Localized pronoun text (optional). */
  pronounNative?: string;
  /** The conjugated verb form in the learning language. */
  learning: string;
  /** Translation of the conjugated form. */
  native: string;
}

/**
 * Simple pronoun mapping.
 */
export interface Pronoun {
  /** Pronoun in the learning language. */
  learning: string;
  /** Pronoun in the native language. */
  native: string;
}

/**
 * Groups conjugations by sentence type for a specific tense.
 */
export interface TenseForms {
  statement: PronounConjugation[];
  question: PronounConjugation[];
  negative: PronounConjugation[];
}

/**
 * Full conjugation table for a verb across major tenses.
 */
export interface VerbConjugation {
  /** The infinitive form of the verb. */
  infinitive: string;
  past: TenseForms;
  present: TenseForms;
  future: TenseForms;
}

/**
 * Represents the declension patterns for a noun.
 */
export interface NounDeclension {
  /** The noun being declined. */
  noun: string;
  // NOTE: Keys use Learning case labels for compatibility with current AI schema.
  // UI texts are localized via i18n; data remains language-agnostic strings.
  /** Singular forms. */
  singular: {
    nominativ: string;
    akkusativ: string;
    dativ: string;
    genitiv: string;
  };
  /** Plural forms. */
  plural: {
    nominativ: string;
    akkusativ: string;
    dativ: string;
    genitiv: string;
  };
}

/**
 * Represents the declension patterns for an adjective.
 */
export interface AdjectiveDeclension {
  /** The adjective being declined. */
  adjective: string;
  /** Comparison forms (positive, comparative, superlative). */
  comparison: {
    positive: string;
    comparative: string;
    superlative: string;
  };
  /** Weak declension table (with definite article). */
  weak: DeclensionTable;
  /** Mixed declension table (with indefinite article). */
  mixed: DeclensionTable;
  /** Strong declension table (no article). */
  strong: DeclensionTable;
}

/**
 * Helper interface for a full set of case declensions by gender/plurality.
 */
export interface DeclensionTable {
  masculine: CaseDeclension;
  feminine: CaseDeclension;
  neuter: CaseDeclension;
  plural: CaseDeclension;
}

/**
 * Helper interface defining forms for standard cases.
 */
export interface CaseDeclension {
  nominative: string;
  accusative: string;
  dative: string;
  genitive: string;
}

/**
 * Represents a sentence continuation exercise.
 */
export interface SentenceContinuation {
  /** The starting segment of the sentence in the learning language. */
  learning: string;
  /** List of valid continuations. */
  continuations: string[];
}

/**
 * Options for the phrase builder exercise.
 */
export interface PhraseBuilderOptions {
  /** Array of words to construct the phrase from. */
  words: string[];
}

/**
 * Option for a grammar cheat sheet or quick reference.
 */
export interface CheatSheetOption {
  /** The type of cheat sheet to display. */
  type: 'verbConjugation' | 'nounDeclension' | 'pronouns' | 'wFragen';
  /** Label text for the option (e.g., button text). */
  label: string;
  /** Context data required for the cheat sheet (e.g., specific noun or verb). */
  data?: string | { noun: string; article: string };
}

/**
 * A segment of content within a chat message, allowing mixed text types.
 */
export interface ContentPart {
  /** The type of content (plain text or learning language). */
  type: 'text' | 'learning';
  /** The actual text content. */
  text: string;
  /** Optional translation for learning segments. */
  translation?: string;
}

/**
 * A general example pair with learning and native text.
 */
export interface ExamplePair {
  /** Example text in the learning language. */
  learningExample: string;
  /** Translation in the native language. */
  nativeTranslation: string;
}

/**
 * Simplified example pair for chat interfaces.
 */
export interface ChatExamplePair {
  /** Example text in the learning language. */
  learning: string;
  /** Translation in the native language. */
  native: string;
}

/**
 * A suggestion for a proactive chat topic.
 */
export interface ProactiveSuggestion {
  /** The suggested topic or question. */
  topic: string;
  /** Icon representing the topic. */
  icon: string;
}

/**
 * A detailed suggestion for chat, including structured content.
 */
export interface ChatProactiveSuggestion {
  /** Title of the suggestion. */
  title: string;
  /** Rich content parts explaining the suggestion or providing context. */
  contentParts: ContentPart[];
}

/**
 * Represents a simplified chat message structure for various chat features.
 * Note: Newer features use `PracticeChatMessage`.
 */
export interface ChatMessage {
  /** The sender of the message. */
  role: 'user' | 'model';
  /** The raw text content of the message. */
  text?: string;
  /** Structured parts for grammar analysis. */
  grammarParts?: ContentPart[];
  /** List of examples included in the message. */
  examples?: ChatExamplePair[];
  /** List of proactive suggestions. */
  suggestions?: ChatProactiveSuggestion[];
  /** General content parts for rich text. */
  contentParts?: ContentPart[];
  /** Suggestions for what the user might say next. */
  promptSuggestions?: string[];
  /** Whether the user's input was evaluated as correct. */
  isCorrect?: boolean;
  /** Options for specific word selections (deprecated/legacy). */
  wordOptions?: string[];
  /** Available cheat sheet options relevant to the message. */
  cheatSheetOptions?: CheatSheetOption[];
  // For Category Assistant
  /** Specific response data for the Category Assistant feature. */
  assistantResponse?: CategoryAssistantResponse;
}

/**
 * Request payload for the Translation Chat feature.
 */
export interface TranslationChatRequest {
  /** The original text in the native language. */
  originalNative: string;
  /** The current translation attempt in the learning language. */
  currentLearning: string;
  /** Conversation history. */
  history: ChatMessage[];
  /** The specific user request or question. */
  userRequest: string;
}

/**
 * Response payload for the Translation Chat feature.
 */
export interface TranslationChatResponse {
  /** The sender of the response. */
  role: 'user' | 'model';
  /** Rich text content of the response. */
  contentParts: ContentPart[];
  /** Suggested follow-up prompts for the user. */
  promptSuggestions: string[];
  /** Optional specific translation suggestion. */
  suggestion?: {
    learning: string;
    native: string;
  };
}

/**
 * Response structure for the Category Assistant.
 */
export interface CategoryAssistantResponse {
  /** The type of action or response provided by the assistant. */
  responseType: 'text' | 'proposed_cards' | 'phrases_to_review' | 'phrases_to_delete';
  /** Rich text parts of the response. */
  responseParts: ContentPart[];
  /** Suggested follow-up prompts. */
  promptSuggestions: string[];
  /** List of proposed new cards (if responseType is 'proposed_cards'). */
  proposedCards?: ProposedCard[];
  /** List of phrases flagged for review (if action is review). */
  phrasesToReview?: { learning: string; reason: string }[];
  /** List of phrases recommended for deletion. */
  phrasesForDeletion?: { learning: string; reason: string }[];
}

/**
 * Types of requests handled by the Category Assistant.
 */
export type CategoryAssistantRequestType =
  | 'initial'
  | 'add_similar'
  | 'check_homogeneity'
  | 'create_dialogue'
  | 'user_text';

/**
 * Request payload for the Category Assistant.
 */
export interface CategoryAssistantRequest {
  /** The type of request action. */
  type: CategoryAssistantRequestType;
  /** Additional text input from the user (optional). */
  text?: string;
}

// ============================================================================
// NEW PRACTICE CHAT TYPES (Redesign)
// ============================================================================

/**
 * Type of AI message in Practice Chat
 */
export type PracticeChatMessageType =
  | 'greeting' // Welcome and session start
  | 'question' // Question from AI to user
  | 'correction' // Correction of user's mistake
  | 'explanation' // Grammar/word explanation
  | 'encouragement' // Praise and motivation
  | 'suggestion'; // Suggestion to use a phrase

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
      text: string; // e.g., "Wie geht es dir?"
      translation?: string; // e.g., "How are you?" (for assistant messages)
    };

    // Additional explanation in native language (optional)
    secondary?: {
      text: string; // e.g., "Это вежливый способ спросить как дела"
    };
  };

  // Interactive elements (only for assistant)
  actions?: {
    suggestions?: string[]; // Quick reply buttons ["Gut, danke", "Sehr gut"]
    hints?: string[]; // Hints if user is stuck
    phraseUsed?: string; // ID of phrase from vocabulary
  };

  // Metadata
  metadata?: {
    timestamp: number;
    correctness?: 'correct' | 'partial' | 'incorrect'; // For user messages
    vocabulary?: string[]; // New words introduced
  };
}

/**
 * Practice Chat Session Statistics
 */
export interface PracticeChatSessionStats {
  /** List of phrase IDs practiced in this session. */
  phrasesUsedIds: string[];
  /** Number of correct responses. */
  correctCount: number;
  /** Number of incorrect responses. */
  incorrectCount: number;
  /** Number of partially correct responses. */
  partialCount: number;
  /** Number of hints requested. */
  hintsUsed: number;
  /** Session duration in milliseconds. */
  duration: number;
  /** Total number of messages exchanged. */
  messagesExchanged: number;
  /** Timestamp when the session started. */
  sessionStartTime: number;
}

/**
 * Full record of a completed practice chat session.
 */
export interface PracticeChatSessionRecord extends PracticeChatSessionStats {
  /** Timestamp when the session ended. */
  sessionEndTime: number;
  /** Unique session identifier (UUID). */
  sessionId: string;
}

/**
 * Possible actions/results during a practice review.
 */
export type PracticeReviewAction = 'know' | 'forgot' | 'dont_know';

/**
 * Log entry for a single practice review event.
 */
export interface PracticeReviewLogEntry {
  /** Unique log entry ID. */
  id: string;
  /** Timestamp of the review. */
  timestamp: number;
  /** ID of the phrase reviewed. */
  phraseId: string;
  /** ID of the category the phrase belongs to. */
  categoryId: string;
  /** The result of the review (know/forgot etc.). */
  action: PracticeReviewAction;
  /** Whether the user's answer was considered correct. */
  wasCorrect: boolean;
  /** Whether the phrase was new at the time of review. */
  wasNew: boolean;
  /** Mastery level before this review. */
  previousMasteryLevel: number;
  /** Mastery level after this review. */
  newMasteryLevel: number;
  /** Know streak before this review. */
  previousKnowStreak: number;
  /** Know streak after this review. */
  newKnowStreak: number;
  /** Lapses count before this review. */
  previousLapses: number;
  /** Lapses count after this review. */
  newLapses: number;
  /** Next review timestamp before this update. */
  previousNextReviewAt: number;
  /** Updated next review timestamp. */
  nextReviewAt: number;
  /** Mastery status before. */
  previousIsMastered: boolean;
  /** Mastery status after. */
  newIsMastered: boolean;
  /** Know count before. */
  previousKnowCount: number;
  /** Know count after. */
  newKnowCount: number;
  /** Time interval until next review in milliseconds. */
  intervalMs: number;
  /** Text in learning language at time of review. */
  languageLearning: string;
  /** Text in native language at time of review. */
  languageNative: string;
  /** Whether the item is considered a 'leech' (hard to learn) after this review. */
  isLeechAfter: boolean;
}

/**
 * Cache structure for discussion/chat history.
 * Key: Discussion ID, Value: Array of chat messages.
 */
export type DiscussCacheEntry = Record<string, ChatMessage[]>;

/**
 * Raw AI response from Gemini (simplified schema)
 */
export interface PracticeChatAIResponse {
  /** The type of message to be displayed. */
  messageType: PracticeChatMessageType;
  /** Main text content. */
  primaryText: string;
  /** Translation of the main text. */
  translation: string;
  /** Secondary or explanatory text. */
  secondaryText?: string;
  /** Suggested user responses (quick replies). */
  suggestions: string[];
  /** Helpful hints if the user needs assistance. */
  hints?: string[];
  /** List of vocabulary/words emphasized in the message. */
  vocabularyUsed?: string[];
}

/**
 * Directional values for UI animations.
 */
export type AnimationDirection = 'left' | 'right';

/**
 * Tracks the state of animations for map keys/components.
 */
export interface AnimationState {
  /** Unique key identifying the animated component. */
  key: string;
  /** Direction of the animation. */
  direction: AnimationDirection;
}

/**
 * Result of evaluating a user's submitted phrase.
 */
export interface PhraseEvaluation {
  /** True if the phrase was correct. */
  isCorrect: boolean;
  /** Feedback message provided to the user. */
  feedback: string;
  /** The correct version of the phrase (if incorrect). */
  correctedPhrase?: string;
}

/**
 * Represents a segmented chunk of text for deep analysis.
 */
interface Chunk {
  /** The text segment. */
  text: string;
  /** Type or category of the chunk. */
  type: string;
  /** Explanation of the chunk's meaning or grammar. */
  explanation: string;
}

/**
 * Represents a key concept extracted from text.
 */
interface KeyConcept {
  /** The concept term or phrase. */
  concept: string;
  /** Explanation of the concept. */
  explanation: string;
}

/**
 * Description of an image to aid memory.
 */
interface MnemonicImage {
  /** Visual description of the image. */
  description: string;
  /** Key elements or tags for the image. */
  keywords: string[];
}

/**
 * Result of a deep dive analysis on a phrase or text.
 */
export interface DeepDiveAnalysis {
  /** Broken down chunks of the text. */
  chunks: Chunk[];
  /** Key concepts identified in the text. */
  keyConcepts: KeyConcept[];
  /** A question to help personalize the learning. */
  personalizationQuestion: string;
  /** Suggested mnemonic imagery. */
  mnemonicImage: MnemonicImage;
}

/**
 * Represents a book or ebook in the library.
 */
export interface BookRecord {
  /** Unique ID (auto-incremented by IndexedDB). */
  id?: number;
  /** Title of the book. */
  title: string;
  /** Author of the book. */
  author: string;
  /** Blob data for the book cover image. */
  coverBlob: Blob;
  /** URL created from the cover blob for display. */
  coverUrl?: string;
  /** Raw binary data of the EPUB file. */
  epubData: ArrayBuffer;
  /** CFI string representing the last read position. */
  lastLocation?: string;
}
