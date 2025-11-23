import { Phrase, ChatMessage, DeepDiveAnalysis, MovieExample, WordAnalysis, VerbConjugation, NounDeclension, AdjectiveDeclension, SentenceContinuation, TranslationChatRequest, TranslationChatResponse, PhraseBuilderOptions, PhraseEvaluation, CategoryAssistantRequest, CategoryAssistantResponse, ProposedCard, Pronoun } from '../types';

export interface AiService {
  // FIX: Updated the return type to accurately reflect the shape of the data returned by the API call.
  generatePhrases(prompt: string): Promise<{ learning: string, native: string }[]>;
  generateSinglePhrase(nativePhrase: string): Promise<{ learning: string; native: string; }>;
  translatePhrase(nativePhrase: string): Promise<{ learning: string }>;
  translateLearningToNative(learningPhrase: string): Promise<{ native: string }>;
  getWordTranslation(nativePhrase: string, learningPhrase: string, nativeWord: string): Promise<{ learningTranslation: string }>;
  improvePhrase(originalNative: string, currentLearning: string): Promise<{ suggestedLearning: string; explanation: string }>;
  generateInitialExamples(phrase: Phrase): Promise<ChatMessage>;
  continueChat(phrase: Phrase, history: ChatMessage[], newMessage: string): Promise<ChatMessage>;
  practiceConversation(history: ChatMessage[], newMessage: string, allPhrases: Phrase[]): Promise<ChatMessage>;
  guideToTranslation(phrase: Phrase, history: ChatMessage[], userAnswer: string): Promise<ChatMessage>;
  discussTranslation(request: TranslationChatRequest): Promise<TranslationChatResponse>;
  generateDeepDiveAnalysis(phrase: Phrase): Promise<DeepDiveAnalysis>;
  generateMovieExamples(phrase: Phrase): Promise<MovieExample[]>;
  analyzeWordInPhrase(phrase: Phrase, word: string): Promise<WordAnalysis>;
  conjugateVerb(infinitive: string): Promise<VerbConjugation>;
  conjugateVerbSimple(infinitive: string): Promise<{ pronoun: string; form: string; pronounNative?: string; }[]>;
  generatePronouns(): Promise<Pronoun[]>;
  declineNoun(noun: string, article: string): Promise<NounDeclension>;
  declineAdjective(adjective: string): Promise<AdjectiveDeclension>;
  generateSentenceContinuations(nativePhrase: string): Promise<SentenceContinuation>;
  findDuplicatePhrases(phrases: Phrase[]): Promise<{ duplicateGroups: string[][] }>;
  generatePhraseBuilderOptions(phrase: Phrase): Promise<PhraseBuilderOptions>;
  evaluatePhraseAttempt(phrase: Phrase, userAttempt: string): Promise<PhraseEvaluation>;
  evaluateSpokenPhraseAttempt(phrase: Phrase, userAttempt: string): Promise<PhraseEvaluation>;
  healthCheck(): Promise<boolean>;
  getProviderName(): string;
  // FIX: Update function signatures to return ProposedCard[] to match application types.
  generateCardsFromTranscript(transcript: string, sourceLang: 'ru' | 'de'): Promise<ProposedCard[]>;
  generateCardsFromImage(imageData: { mimeType: string; data: string }, refinement?: string): Promise<{ cards: ProposedCard[], categoryName: string }>;
  generateTopicCards(topic: string, refinement?: string, existingPhrases?: string[]): Promise<ProposedCard[]>;
  classifyTopic(topic: string): Promise<{ isCategory: boolean; categoryName: string; }>;
  getCategoryAssistantResponse(categoryName: string, existingPhrases: Phrase[], request: CategoryAssistantRequest): Promise<CategoryAssistantResponse>;
}
