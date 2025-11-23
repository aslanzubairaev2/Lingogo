import type { Phrase, ChatMessage, DeepDiveAnalysis, ContentPart, MovieExample, WordAnalysis, VerbConjugation, NounDeclension, AdjectiveDeclension, SentenceContinuation, TranslationChatRequest, TranslationChatResponse, PhraseBuilderOptions, PhraseEvaluation, CategoryAssistantRequest, CategoryAssistantResponse } from '../types';
import { AiService } from './aiService';
import { getDeepseekApiKey } from './env';

const API_URL = "https://api.deepseek.com/chat/completions";
const model = "deepseek-chat";

const callDeepSeekApi = async (messages: any[], schema: object) => {
    const apiKey = getDeepseekApiKey();
    if (!apiKey) {
        throw new Error("DEEPSEEK_API_KEY environment variable not set for DeepSeek");
    }

    let lastUserMessageIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
            lastUserMessageIndex = i;
            break;
        }
    }

    if (lastUserMessageIndex !== -1) {
        messages[lastUserMessageIndex].content += `\n\nALWAYS respond with a valid JSON object matching this schema:\n${JSON.stringify(schema, null, 2)}`;
    } else {
        messages.push({ role: 'user', content: `Respond in JSON matching this schema:\n${JSON.stringify(schema, null, 2)}` })
    }

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            response_format: { type: 'json_object' },
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("DeepSeek API Error:", errorBody);
        throw new Error(`DeepSeek API request failed with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
};

// Placeholder implementations
const notImplemented = () => Promise.reject(new Error("Not implemented for DeepSeek provider"));

const generatePhrases: AiService['generatePhrases'] = notImplemented;
const generateSinglePhrase: AiService['generateSinglePhrase'] = notImplemented;
const translatePhrase: AiService['translatePhrase'] = notImplemented;
const translateLearningToNative: AiService['translateLearningToNative'] = notImplemented;
const getWordTranslation: AiService['getWordTranslation'] = notImplemented;
const improvePhrase: AiService['improvePhrase'] = notImplemented;
const generateInitialExamples: AiService['generateInitialExamples'] = notImplemented;
const continueChat: AiService['continueChat'] = notImplemented;
const practiceConversation: AiService['practiceConversation'] = notImplemented;
const guideToTranslation: AiService['guideToTranslation'] = notImplemented;
const discussTranslation: AiService['discussTranslation'] = notImplemented;
const generateDeepDiveAnalysis: AiService['generateDeepDiveAnalysis'] = notImplemented;
const generateMovieExamples: AiService['generateMovieExamples'] = notImplemented;
const analyzeWordInPhrase: AiService['analyzeWordInPhrase'] = notImplemented;
const conjugateVerb: AiService['conjugateVerb'] = notImplemented;
const conjugateVerbSimple: AiService['conjugateVerbSimple'] = notImplemented;
const declineNoun: AiService['declineNoun'] = notImplemented;
const declineAdjective: AiService['declineAdjective'] = notImplemented;
const generateSentenceContinuations: AiService['generateSentenceContinuations'] = notImplemented;
const findDuplicatePhrases: AiService['findDuplicatePhrases'] = notImplemented;
const generatePhraseBuilderOptions: AiService['generatePhraseBuilderOptions'] = notImplemented;
const evaluatePhraseAttempt: AiService['evaluatePhraseAttempt'] = notImplemented;
const evaluateSpokenPhraseAttempt: AiService['evaluateSpokenPhraseAttempt'] = notImplemented;
const generateCardsFromTranscript: AiService['generateCardsFromTranscript'] = notImplemented;
const generateCardsFromImage: AiService['generateCardsFromImage'] = notImplemented;
const generateTopicCards: AiService['generateTopicCards'] = notImplemented;
const classifyTopic: AiService['classifyTopic'] = notImplemented;
const getCategoryAssistantResponse: AiService['getCategoryAssistantResponse'] = notImplemented;

const healthCheck: AiService['healthCheck'] = async () => {
    const apiKey = getDeepseekApiKey();
    if (!apiKey) return false;
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 2,
            }),
        });
        return response.ok;
    } catch (error) {
        console.error("DeepSeek health check failed:", error);
        return false;
    }
};

export const deepseekService: AiService = {
    generatePhrases,
    generateSinglePhrase,
    translatePhrase,
    translateLearningToNative,
    getWordTranslation,
    improvePhrase,
    generateInitialExamples,
    continueChat,
    practiceConversation,
    guideToTranslation,
    discussTranslation,
    generateDeepDiveAnalysis,
    generateMovieExamples,
    analyzeWordInPhrase,
    conjugateVerb,
    conjugateVerbSimple,
    declineNoun,
    declineAdjective,
    generateSentenceContinuations,
    findDuplicatePhrases,
    generatePhraseBuilderOptions,
    evaluatePhraseAttempt,
    evaluateSpokenPhraseAttempt,
    healthCheck,
    getProviderName: () => "DeepSeek",
    generateCardsFromTranscript,
    generateCardsFromImage,
    generateTopicCards,
    classifyTopic,
    getCategoryAssistantResponse,
};