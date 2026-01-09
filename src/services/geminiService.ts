import { GoogleGenAI, Type } from '@google/genai';

import i18n from '../i18n/config.ts';
import { getLanguageName, needsTranscription } from '../i18n/languageMeta';
import type { TranslationRecord } from '../services/languageService.ts';
import type {
  AdjectiveDeclension,
  CategoryAssistantRequest,
  CategoryAssistantRequestType,
  CategoryAssistantResponse,
  ChatExamplePair,
  ChatMessage,
  ChatProactiveSuggestion,
  ContentPart,
  DeepDiveAnalysis,
  LanguageCode,
  MovieExample,
  NounDeclension,
  Phrase,
  PhraseBuilderOptions,
  PhraseEvaluation,
  ProposedCard,
  SentenceContinuation,
  VerbConjugation,
  WordAnalysis,
} from '../types.ts';
import { AiService } from './aiService';
import { currentLanguageProfile } from './currentLanguageProfile';
import { getGeminiApiKey } from './env';

let ai: GoogleGenAI | null = null;

const initializeApi = () => {
  if (ai) return ai;
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
    return ai;
  }
  return null;
};

const model = 'gemini-3-flash-preview';
// const model = 'gemini-2.5-flash-lite-preview-09-2025';
// const model = "gemini-2.5-flash";

/**
 * Retry wrapper for AI API calls with exponential backoff
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelayMs - Initial delay in milliseconds (default: 1000)
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === maxRetries - 1;

      console.warn(
        `[retryWithExponentialBackoff] Attempt ${attempt + 1}/${maxRetries} failed:`,
        error instanceof Error ? error.message : error
      );

      if (isLastAttempt) {
        console.error('[retryWithExponentialBackoff] All retries exhausted');
        break;
      }

      // Calculate delay with exponential backoff: 1s, 2s, 4s, etc.
      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.log(`[retryWithExponentialBackoff] Waiting ${delayMs}ms before retry...`);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Helper functions for getting language names in prompts
 */
const getLang = () => {
  const profile = currentLanguageProfile.getProfile();
  return {
    native: getLanguageName(profile.native),
    learning: getLanguageName(profile.learning),
    nativeCode: profile.native,
    learningCode: profile.learning,
  };
};

const buildLocalePrompt = (languageLabel: string) => [
  {
    role: 'user',
    parts: [
      {
        text: `You translate UI text from English to ${languageLabel}. Return valid JSON matching the input structure. Translate string values only. Preserve placeholders like {{count}} or {{name}} exactly. Keep HTML tags and Markdown untouched. Use straight quotes and ASCII ellipsis (...). Do not add explanations.`,
      },
    ],
  },
];

const sanitizeJsonResponse = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    const withoutFence = trimmed.replace(/^```[a-z]*\s*/i, '').replace(/```$/, '');
    return withoutFence.trim();
  }
  return trimmed;
};

export const translateLocaleTemplate = async (
  template: TranslationRecord,
  targetLanguage: LanguageCode
): Promise<TranslationRecord> => {
  console.log(`[Gemini] Starting locale translation for ${targetLanguage}`);

  const api = initializeApi();
  if (!api) {
    console.error(`[Gemini] API key not configured for ${targetLanguage}`);
    throw new Error('Gemini API key not configured.');
  }

  const templateJson = JSON.stringify(template, null, 2);
  console.log(`[Gemini] Template size for ${targetLanguage}: ${templateJson.length} characters`);

  const prompt = buildLocalePrompt(targetLanguage);
  prompt[0].parts.push({ text: templateJson });

  try {
    console.log(`[Gemini] Sending request to Gemini API for ${targetLanguage}`);
    const response = await api.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    console.log(`[Gemini] Received response for ${targetLanguage}`);
    const raw = (response?.text ?? '').toString();
    console.log(`[Gemini] Raw response length for ${targetLanguage}: ${raw.length} characters`);

    if (!raw || raw.trim().length === 0) {
      console.error(`[Gemini] Empty response received for ${targetLanguage}`);
      throw new Error('Received empty translation response.');
    }

    const sanitized = sanitizeJsonResponse(raw);
    console.log(`[Gemini] Sanitized response length for ${targetLanguage}: ${sanitized.length} characters`);

    if (!sanitized) {
      console.error(`[Gemini] Sanitization resulted in empty string for ${targetLanguage}`);
      throw new Error('Received empty translation response.');
    }

    console.log(`[Gemini] Parsing JSON response for ${targetLanguage}`);
    const parsed = JSON.parse(sanitized);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.error(`[Gemini] Invalid JSON structure for ${targetLanguage}:`, typeof parsed, Array.isArray(parsed));
      throw new Error('Translated locale must be a JSON object.');
    }

    console.log(`[Gemini] Successfully parsed locale for ${targetLanguage}`);
    return parsed as TranslationRecord;
  } catch (error) {
    console.error(`[Gemini] Error translating locale for ${targetLanguage}:`, error);

    // Add more specific error information
    if (error instanceof Error) {
      if (error.message.includes('JSON')) {
        console.error(`[Gemini] JSON parsing error for ${targetLanguage}:`, error.message);
      } else if (error.message.includes('API')) {
        console.error(`[Gemini] API error for ${targetLanguage}:`, error.message);
      } else {
        console.error(`[Gemini] General error for ${targetLanguage}:`, error.message);
      }
    }

    throw error instanceof Error ? error : new Error('Failed to translate locale via Gemini.');
  }
};

const phraseSchema = () => {
  const lang = getLang();
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        [lang.learningCode]: {
          type: Type.STRING,
          description: `The phrase in ${lang.learning}. NEVER include romanization/transcription in parentheses here - use the separate romanization field.`,
        },
        [lang.nativeCode]: {
          type: Type.STRING,
          description: `The phrase in ${lang.native}.`,
        },
        ...(needsTranscription(lang.learningCode)
          ? {
            romanization: {
              type: Type.STRING,
              description: `Romanization/transcription of the ${lang.learning} phrase (e.g., Pinyin for Chinese, Romaji for Japanese, Devanagari transliteration for Hindi, Arabic transliteration for Arabic). This field is REQUIRED.`,
            },
          }
          : {}),
      },
      required: [
        lang.learningCode,
        lang.nativeCode,
        ...(needsTranscription(lang.learningCode) ? ['romanization'] : []),
      ],
    },
  };
};

const generatePhrases: AiService['generatePhrases'] = async (prompt) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: phraseSchema(),
        temperature: 0.7,
      },
    });

    const jsonText = response.text.trim();
    const parsedPhrases = JSON.parse(jsonText);

    if (!Array.isArray(parsedPhrases)) {
      throw new Error('API did not return an array of phrases.');
    }

    const isValid = parsedPhrases.every(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        lang.learningCode in p &&
        lang.nativeCode in p &&
        typeof p[lang.learningCode] === 'string' &&
        typeof p[lang.nativeCode] === 'string'
    );

    if (!isValid) {
      throw new Error('Received malformed phrase data from API.');
    }

    return parsedPhrases.map((p: any) => ({
      learning: p[lang.learningCode],
      native: p[lang.nativeCode],
    }));
  } catch (error) {
    console.error('Error generating phrases with Gemini:', error);
    if (error instanceof Error && error.message.includes('JSON')) {
      throw new Error('Failed to parse the response from the AI. The format was invalid.');
    }
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const singlePhraseSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      [lang.learningCode]: {
        type: Type.STRING,
        description: `The translated phrase in ${lang.learning}.`,
      },
    },
    required: [lang.learningCode],
  };
};

const generateSinglePhrase: AiService['generateSinglePhrase'] = async (nativePhrase) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');

  const lang = getLang();
  const prompt = `Translate the following ${lang.native} phrase into a common, natural-sounding ${lang.learning} phrase: "${nativePhrase}". Return a single JSON object with one key: "${lang.learningCode}" for the translation.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: singlePhraseSchema(),
        temperature: 0.5,
      },
    });

    const jsonText = response.text.trim();
    const parsedResult = JSON.parse(jsonText);

    if (
      typeof parsedResult !== 'object' ||
      parsedResult === null ||
      !(lang.learningCode in parsedResult) ||
      typeof parsedResult[lang.learningCode] !== 'string'
    ) {
      throw new Error('Received malformed translation data from API.');
    }

    const finalResponse = {
      learning: parsedResult[lang.learningCode],
      native: nativePhrase,
    };

    console.log('[practiceConversation] Final structured response:', finalResponse);
    return finalResponse;
  } catch (error) {
    console.error('Error generating single phrase with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const translatePhrase: AiService['translatePhrase'] = async (nativePhrase) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');

  const lang = getLang();

  const prompt = `Translate this ${lang.native} phrase to ${lang.learning}: "${nativePhrase}"`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: singlePhraseSchema(),
        temperature: 0.2,
      },
    });
    const jsonText = response.text.trim();
    const parsedResult = JSON.parse(jsonText);
    return { learning: parsedResult[lang.learningCode] };
  } catch (error) {
    console.error('Error translating phrase with Gemini:', error);
    throw new Error(`Failed to call the Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

const nativeSinglePhraseSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      [lang.nativeCode]: {
        type: Type.STRING,
        description: `The translated phrase in ${lang.native}.`,
      },
    },
    required: [lang.nativeCode],
  };
};

const translateLearningToNative: AiService['translateLearningToNative'] = async (learningPhrase) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const prompt = `Translate this ${lang.learning} phrase to ${lang.native}: "${learningPhrase}"`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: nativeSinglePhraseSchema(),
        temperature: 0.2,
      },
    });
    const jsonText = response.text.trim();
    const parsedResult = JSON.parse(jsonText);
    return { native: parsedResult[lang.nativeCode] };
  } catch (error) {
    console.error('Error translating Learning phrase with Gemini:', error);
    throw new Error(`Failed to call the Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

const wordTranslationSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      learningTranslation: {
        // This key remains for backward compatibility
        type: Type.STRING,
        description: `The ${lang.learning} word(s) that correspond to the given ${lang.native} word in the context of the full phrase.`,
      },
    },
    required: ['learningTranslation'],
  };
};

const getWordTranslation: AiService['getWordTranslation'] = async (nativePhrase, learningPhrase, nativeWord) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const prompt = `Given the ${lang.native} phrase: "${nativePhrase}".
Its ${lang.learning} translation: "${learningPhrase}".
What is the exact translation of the ${lang.native} word "${nativeWord}" in this specific context?
Return ONLY a JSON object with one key "learningTranslation".`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: wordTranslationSchema(),
        temperature: 0.1,
      },
    });
    const jsonText = response.text.trim();
    const parsedResult = JSON.parse(jsonText);
    // The key "learningTranslation" is kept for backward compatibility.
    // The value will be the learning language translation.
    return { learningTranslation: parsedResult.learningTranslation };
  } catch (error) {
    console.error('Error getting word translation with Gemini:', error);
    throw new Error(`Failed to call the Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

const cardsFromTranscriptSchema = () => {
  const lang = getLang();
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        [lang.learningCode]: {
          type: Type.STRING,
          description: `The phrase in ${lang.learning}. NEVER include romanization/transcription in parentheses here - use the separate romanization field.`,
        },
        [lang.nativeCode]: {
          type: Type.STRING,
          description: `The phrase in ${lang.native}.`,
        },
        ...(needsTranscription(lang.learningCode)
          ? {
            romanization: {
              type: Type.STRING,
              description: `Romanization/transcription of the ${lang.learning} phrase (e.g., Pinyin for Chinese, Romaji for Japanese, Devanagari transliteration for Hindi, Arabic transliteration for Arabic). This field is REQUIRED.`,
            },
          }
          : {}),
      },
      required: [
        lang.learningCode,
        lang.nativeCode,
        ...(needsTranscription(lang.learningCode) ? ['romanization'] : []),
      ],
    },
  };
};

const generateCardsFromTranscript: AiService['generateCardsFromTranscript'] = async (transcript, sourceLang) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const sourceLanguageName = sourceLang === lang.nativeCode ? lang.native : lang.learning;
  const targetLanguageName = sourceLang === lang.nativeCode ? lang.learning : lang.native;

  const prompt = `You are an expert linguist and a methodologist for creating language learning materials. Your task is to analyze a provided text transcript of spoken language and break it down into high-quality, logically complete flashcards for Spaced Repetition System (SRS) learning.

Analyze the following text, which is a transcript of ${sourceLanguageName} speech:
"""
${transcript}
"""

Instructions:
1.  **Analyze Context:** First, understand the context: is it a monologue, a dialogue, or chaotic speech from multiple participants? The text might contain broken phrases, filler words ('umm', 'well'), repetitions, or interruptions. Your job is to extract coherent and logical phrases suitable for learning.
2.  **Decomposition Rules:**
    *   Break down long, complex sentences into shorter, self-sufficient semantic blocks. Each block should be a useful phrase to learn.
    *   For example, if you see the sentence: "I'll go home because I have a very bad headache and I also need to make dinner", you should split it into cards like: "I'll go home", "because I have a very bad headache", "I need to make dinner".
    *   Clean up filler words and repetitions to make the phrases natural and useful.
3.  **Translation and Formatting:**
    *   For each extracted phrase, generate an accurate and natural translation into ${targetLanguageName}.
    *   Return the result ONLY as a JSON array of objects. Each object must have two keys: '${lang.nativeCode}' and '${lang.learningCode}'.

Example Output Format:
[
  { "${lang.nativeCode}": "I am going home", "${lang.learningCode}": "ich gehe nach Hause" },
  { "${lang.nativeCode}": "because I have a bad headache", "${lang.learningCode}": "weil ich starke Kopfschmerzen habe" }
]`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: cardsFromTranscriptSchema(),
        temperature: 0.6,
      },
    });

    const jsonText = response.text.trim();
    const parsed = JSON.parse(jsonText);
    return parsed.map((p: any) => ({
      learning: p[lang.learningCode],
      native: p[lang.nativeCode],
      ...(p.romanization ? { romanization: p.romanization } : {}),
    }));
  } catch (error) {
    console.error('Error generating cards from transcript with Gemini:', error);
    throw new Error(`Failed to call the Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

const imageCardsWithCategorySchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      cards: {
        type: Type.ARRAY,
        description: 'An array of generated flashcards.',
        items: {
          type: Type.OBJECT,
          properties: {
            [lang.learningCode]: {
              type: Type.STRING,
              description: `The phrase in ${lang.learning}. NEVER include romanization/transcription in parentheses here - use the separate romanization field.`,
            },
            [lang.nativeCode]: { type: Type.STRING, description: `The phrase in ${lang.native}.` },
            ...(needsTranscription(lang.learningCode)
              ? {
                romanization: {
                  type: Type.STRING,
                  description: `Romanization/transcription of the ${lang.learning} phrase (e.g., Pinyin for Chinese, Romaji for Japanese, Devanagari transliteration for Hindi, Arabic transliteration for Arabic). This field is REQUIRED.`,
                },
              }
              : {}),
          },
          required: [
            lang.learningCode,
            lang.nativeCode,
            ...(needsTranscription(lang.learningCode) ? ['romanization'] : []),
          ],
        },
      },
      categoryName: {
        type: Type.STRING,
        description: `A short, relevant category name in ${lang.native} for these cards based on the image content and user request.`,
      },
    },
    required: ['cards', 'categoryName'],
  };
};

const generateCardsFromImage: AiService['generateCardsFromImage'] = async (imageData, refinement) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const prompt = `You are an AI assistant for learning ${lang.learning}. Your task is to create flashcards from an image.

**1. HIGHEST PRIORITY: User's Refinement**
First, check if the user provided a specific instruction. If they did, YOU MUST FOLLOW IT EXACTLY. It overrides all other rules.
${refinement ? `User's instruction: "${refinement}"` : 'No specific instruction was given by the user.'}

**Examples of following instructions:**
- If the user says "get nouns from exercise 3a", find exercise 3a and extract ONLY the nouns with their articles.
- If the user photographs a room and says "phrases about the bed", create phrases like "das Bett ist weich" (the bed is soft), not just a list of objects.

**2. FALLBACK TASK (If no user instruction is given):**
If the user did not provide an instruction, analyze the image content:
- **If Text is present:** Use OCR to extract all ${lang.learning} text. Break it into logical, useful phrases for flashcards and provide ${lang.native} translations.
- **If No Text (Objects/Scene):** Identify the main objects. Generate a list of ${lang.learning} nouns (WITH articles, e.g., "das Bett"), verbs, and simple descriptive phrases. Provide ${lang.native} translations.

**3. OUTPUT REQUIREMENTS (Applies to ALL cases):**
You must return a single JSON object with two keys:
- **"cards"**: A JSON array of objects. Each object must have "${lang.learningCode}" and "${lang.nativeCode}" keys. If you cannot find any relevant content, return an empty array.
- **"categoryName"**: A short, suitable category name in ${lang.native} that accurately describes the content of the generated cards. Examples: "Exercise 3a: Nouns", "Objects in the room", "Street signs".

Return EXCLUSIVELY the JSON object matching the provided schema.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: {
        parts: [{ inlineData: { mimeType: imageData.mimeType, data: imageData.data } }, { text: prompt }],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: imageCardsWithCategorySchema(),
        temperature: 0.5,
      },
    });

    const jsonText = response.text.trim();
    const parsedResult = JSON.parse(jsonText);

    if (!parsedResult || !Array.isArray(parsedResult.cards) || typeof parsedResult.categoryName !== 'string') {
      throw new Error('API did not return the expected structure with cards and categoryName.');
    }

    return {
      cards: parsedResult.cards.map((c: any) => ({
        learning: c[lang.learningCode],
        native: c[lang.nativeCode],
        ...(c.romanization ? { romanization: c.romanization } : {}),
      })),
      categoryName: parsedResult.categoryName,
    };
  } catch (error) {
    console.error('Error generating cards from image with Gemini:', error);
    throw new Error(`Failed to call the Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

const generateTopicCards: AiService['generateTopicCards'] = async (topic, refinement, existingPhrases) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const refinementPrompt = refinement
    ? `\n\nThe user was not satisfied with previous results and provided the following refinement: "${refinement}". Please generate a new list, strictly following this refinement.`
    : '';

  const existingPhrasesPrompt =
    existingPhrases && existingPhrases.length > 0
      ? `\n\nImportant: The category already contains the following phrases: "${existingPhrases.join('; ')}". Do not repeat them. Create new, unique, and useful words/phrases on this topic.`
      : '';

  const prompt = `You are an AI assistant for learning ${lang.learning}. The user wants a set of flashcards on a specific topic.
Topic: "${topic}"${refinementPrompt}${existingPhrasesPrompt}

Your task:
1.  Analyze the user's request.
2.  Generate a list of 10-15 useful, diverse ${lang.learning} words and phrases with ${lang.native} translation on this topic. Phrases should be natural and commonly used.
3.  Return the result ONLY as a JSON array of objects. Each object must have two keys: '${lang.nativeCode}' and '${lang.learningCode}'.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: phraseSchema(),
        temperature: 0.6,
      },
    });

    const jsonText = response.text.trim();
    const parsedCards = JSON.parse(jsonText);

    if (!Array.isArray(parsedCards)) {
      throw new Error('API did not return an array of cards.');
    }

    return parsedCards.map((card: any) => ({
      learning: card[lang.learningCode],
      native: card[lang.nativeCode],
      ...(card.romanization ? { romanization: card.romanization } : {}),
    }));
  } catch (error) {
    console.error('Error generating topic cards with Gemini:', error);
    throw new Error(`Failed to call the Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

const topicClassificationSchema = {
  type: Type.OBJECT,
  properties: {
    isCategory: {
      type: Type.BOOLEAN,
      description:
        "True if the topic is a closed, well-defined set of concepts suitable for a dedicated category (e.g., 'Days of the week', 'Colors', 'Family members'). False otherwise (e.g., 'How to apologize').",
    },
    categoryName: {
      type: Type.STRING,
      description:
        "A short, suitable name for the category if isCategory is true. Should be in Native. E.g., 'Days of the week', 'Colors'. Empty string if isCategory is false.",
    },
  },
  required: ['isCategory', 'categoryName'],
};

const classifyTopic: AiService['classifyTopic'] = async (topic) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const prompt = `The user entered a topic to learn: "${topic}". Is this topic a closed, well-defined set of concepts (e.g., days of the week, months, colors, family members, cities, fingers)? Answer 'yes' or 'no' and suggest a short, suitable name for the category in ${lang.native}.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: topicClassificationSchema,
        temperature: 0.3,
      },
    });
    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Error classifying topic with Gemini:', error);
    throw new Error(`Failed to call the Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

const improvePhraseSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      suggestedLearning: {
        // Backward compatibility: key remains 'suggestedLearning'
        type: Type.STRING,
        description: `The improved, more natural, or grammatically correct ${lang.learning} phrase.`,
      },
      explanation: {
        type: Type.STRING,
        description: `A concise explanation in ${lang.native} about why the suggestion is better, or why the original was already correct.`,
      },
    },
    required: ['suggestedLearning', 'explanation'],
  };
};

const improvePhrase: AiService['improvePhrase'] = async (originalNative, currentLearning) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const prompt = `You are an expert in ${lang.learning}. The user wants to learn correct and natural ${lang.learning}.
Original phrase in ${lang.native}: "${originalNative}"
Current translation in ${lang.learning}: "${currentLearning}"

Your task:
1. Analyze the ${lang.learning} translation for grammatical correctness, natural flow, and idiomatic usage.
2. If the translation can be improved, suggest a better version. "Better" means more correct, more common, or more natural for a native speaker.
3. Provide a brief and clear explanation in ${lang.native} why your version is better. For example, "In this context, the preposition 'auf' fits better than 'in' because..." or "This phrasing is more polite".
4. If the current translation is already perfect, return it in 'suggestedLearning' and explain why it is the best option.

Return the result as a JSON object.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: improvePhraseSchema(),
        temperature: 0.4,
      },
    });

    const jsonText = response.text.trim();
    const parsedResult = JSON.parse(jsonText);
    // The key "suggestedLearning" is kept for backward compatibility.
    return {
      suggestedLearning: parsedResult.suggestedLearning,
      explanation: parsedResult.explanation,
    };
  } catch (error) {
    console.error('Error improving phrase with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const initialResponseSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      grammarParts: {
        type: Type.ARRAY,
        description: `REQUIRED. A CONCISE grammar analysis broken into segments. Include: 1) Word breakdown (parts of speech), 2) Word order comparison with ${lang.native}, 3) Key grammar point. Keep SHORT - max 150 words total. When mentioning ${lang.learning} words/phrases, use type 'learning' with translation.`,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: ['text', 'learning'],
              description: `Use 'text' for ${lang.native} explanatory text, 'learning' for ${lang.learning} words/phrases.`,
            },
            text: { type: Type.STRING, description: 'The segment content.' },
            translation: {
              type: Type.STRING,
              description: `${lang.native} translation, REQUIRED when type is 'learning'.`,
            },
          },
          required: ['type', 'text'],
        },
      },
      examples: {
        type: Type.ARRAY,
        description: 'List of 3-5 practical example sentences using the phrase.',
        items: {
          type: Type.OBJECT,
          properties: {
            [lang.learningCode]: { type: Type.STRING, description: `The example sentence in ${lang.learning}.` },
            [lang.nativeCode]: { type: Type.STRING, description: `The ${lang.native} translation.` },
          },
          required: [lang.learningCode, lang.nativeCode],
        },
      },
      proactiveSuggestions: {
        type: Type.ARRAY,
        description:
          "List of 1-2 proactive, unique suggestions for the user based on the phrase's context, like alternative phrasings or common related questions.",
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'A short, engaging title for the suggestion.' },
            contentParts: {
              type: Type.ARRAY,
              description: `The suggestion content, broken into segments of plain text and ${lang.learning} text.`,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    enum: ['text', 'learning'],
                    description: `Should be 'text' for plain ${lang.native} text or 'learning' for a ${lang.learning} word/phrase.`,
                  },
                  text: { type: Type.STRING, description: 'The segment of text. Do not use Markdown here.' },
                  translation: {
                    type: Type.STRING,
                    description: `${lang.native} translation of the text, ONLY if type is 'learning'.`,
                  },
                },
                required: ['type', 'text'],
              },
            },
          },
          required: ['title', 'contentParts'],
        },
      },
      promptSuggestions: {
        type: Type.ARRAY,
        description: `A list of 2-4 short, context-aware follow-up questions in ${lang.native} that the user might ask. Only suggest pronoun variations if there's a verb. Only suggest asking a question if the phrase isn't one already.`,
        items: {
          type: Type.STRING,
        },
      },
    },
    required: ['grammarParts', 'examples', 'proactiveSuggestions', 'promptSuggestions'],
  };
};

const generateInitialExamples: AiService['generateInitialExamples'] = async (phrase) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const prompt = `User is learning the ${lang.learning} phrase: "${phrase.text.learning}" (translation: "${phrase.text.native}").

Your task is to create a useful card for detailed analysis of this phrase.
Return JSON according to the schema. IMPORTANT: Use the 'grammarParts' field (ARRAY of segments) for grammar analysis.

1. **Grammar Analysis (grammarParts)** - REQUIRED, use grammarParts array:
   - Break down your explanation into an ARRAY of segments with 'type' and 'text' fields.
   - For ${lang.native} explanatory text: use type='text'.
   - For ${lang.learning} words/phrases: use type='learning' with 'translation' field.
   - Example structure: [{"type":"text","text":"The word "},{"type":"learning","text":"Monat","translation":"month"},{"type":"text","text":" is a noun (masculine)."}]
   - Include: parts of speech, word order comparison with ${lang.native}, key grammar points.
   - Keep it SHORT - max 150 words total.
   - Start DIRECTLY with content, NO intro phrases.

2. **Alternatives (proactiveSuggestions)**:
   - 1-2 alternative phrasings with contentParts (same format: text/learning segments).

3. **Examples (examples)**:
   - Exactly 5 diverse sentence examples with ${lang.learning} and ${lang.native} translations.

4. **Follow-up Questions (promptSuggestions)**:
   - 2-4 questions in ${lang.native} for continuing the conversation.

CRITICAL: The grammar analysis MUST go into 'grammarParts' as an array of {type, text, translation?} objects. Do NOT use a plain 'text' string.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: initialResponseSchema(),
        temperature: 0.7,
      },
    });

    const jsonText = response.text.trim();
    const parsedResponse = JSON.parse(jsonText);

    const examples: ChatExamplePair[] = (parsedResponse.examples || []).map((ex: any) => ({
      learning: ex[lang.learningCode],
      native: ex[lang.nativeCode],
    }));
    const suggestions: ChatProactiveSuggestion[] = parsedResponse.proactiveSuggestions || [];
    const promptSuggestions: string[] = parsedResponse.promptSuggestions || [];

    // Use AI-generated grammarParts array for interactive grammar analysis
    const grammarParts: ContentPart[] = parsedResponse.grammarParts || [];

    return {
      role: 'model' as const,
      grammarParts,
      examples,
      suggestions,
      promptSuggestions,
    };
  } catch (error) {
    console.error('Error generating initial examples with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const chatResponseSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      contentParts: {
        type: Type.ARRAY,
        description: `The response broken down into segments of plain text and ${lang.learning} text.`,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: ['text', 'learning'],
              description: `Should be 'text' for plain ${lang.native} text or 'learning' for a ${lang.learning} word/phrase.`,
            },
            text: { type: Type.STRING, description: 'The segment of text. Do not use Markdown here.' },
            translation: {
              type: Type.STRING,
              description: `${lang.native} translation of the text, ONLY if type is 'learning'.`,
            },
          },
          required: ['type', 'text'],
        },
      },
      promptSuggestions: {
        type: Type.ARRAY,
        description: `A list of 2-4 new, context-aware follow-up questions in ${lang.native} that the user might ask next, based on the current conversation. Only suggest pronoun variations if there's a verb. Only suggest asking a question if the phrase isn't one already.`,
        items: {
          type: Type.STRING,
        },
      },
    },
    required: ['contentParts', 'promptSuggestions'],
  };
};

const continueChat: AiService['continueChat'] = async (phrase, history, newMessage) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const formattedHistory = history.map((msg) => {
    let fullText = '';
    if (msg.contentParts) {
      fullText = msg.contentParts.map((p) => p.text).join('');
    } else if (msg.text) {
      fullText = msg.text;
      if (msg.examples && msg.examples.length > 0) {
        const examplesText = msg.examples.map((ex) => `- ${ex.learning} (${ex.native})`).join('\n');
        fullText += '\\n\\nExamples:\\n' + examplesText;
      }
      if (msg.suggestions && msg.suggestions.length > 0) {
        // We don't have detailed structure for suggestions in the type definition
        const suggestionsText = msg.suggestions.map((s) => `- ${s.title}`).join('\n');
        fullText += '\\n\\nSuggestions:\\n' + suggestionsText;
      }
    }
    return {
      role: msg.role,
      parts: [{ text: fullText }],
    };
  });

  const systemInstruction = `You are an AI assistant for learning ${lang.learning}. The user is learning the phrase "${phrase.text.learning}" (${phrase.text.native}).
1. Answer the user's questions. You MUST use the provided JSON schema in your response. Break down your answer into the 'contentParts' array. Each element of the array must be an object with 'type' and 'text' keys. If part of the answer is plain text in ${lang.native}, use 'type': 'text'. If it is a ${lang.learning} word or phrase, use 'type': 'learning'. If 'type' is 'learning', you MUST provide a translation in the 'translation' field. Do not use Markdown in JSON. Preserve formatting using newline characters (\\n) in text blocks.
2. After answering, generate 2 to 4 new, context-aware questions to continue the dialogue in the 'promptSuggestions' field. These questions should be based on the user's last message and the general context of the dialogue.
   - Suggest "Show variations with pronouns" only if the phrase contains a verb to conjugate and it is relevant.
   - Suggest "How to use this in a question?" only if the phrase is not a question and it is relevant.
   - Suggest new, creative questions that help the user understand the topic deeper.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: [...formattedHistory, { role: 'user', parts: [{ text: newMessage }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: chatResponseSchema(),
        temperature: 0.5,
      },
    });

    const jsonText = response.text.trim();

    // Try to extract valid JSON from response (handles cases where AI adds extra text)
    let cleanedJson = jsonText;
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedJson = jsonMatch[0];
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedJson);
    } catch (parseError) {
      console.error('JSON Parse error, raw response:', jsonText);
      // Fallback: return a generic response
      return {
        role: 'model',
        contentParts: [{ type: 'text', text: 'Sorry, I had trouble processing that. Please try again.' }],
        promptSuggestions: [],
      };
    }

    const contentParts: ContentPart[] =
      parsedResponse.contentParts && parsedResponse.contentParts.length > 0
        ? parsedResponse.contentParts
        : [{ type: 'text', text: 'Received empty response from AI.' }];

    const promptSuggestions: string[] = parsedResponse.promptSuggestions || [];

    return {
      role: 'model',
      contentParts,
      promptSuggestions,
    };
  } catch (error) {
    console.error('Error continuing chat with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const practiceConversation: AiService['practiceConversation'] = async (history, newMessage, allPhrases) => {
  return retryWithExponentialBackoff(
    async () => {
      const api = initializeApi();
      if (!api) throw new Error('Gemini API key not configured.');

      const formattedHistory = history.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text || msg.contentParts?.map((p) => p.text).join('') || '' }],
      }));

      const lang = getLang();
      const systemInstruction = `You are a friendly and patient ${lang.learning} language tutor named 'Alex'.

**CRITICAL: Your response MUST be valid JSON matching the schema below. Do NOT add any text outside the JSON.**

Here is the student's vocabulary:
${JSON.stringify(allPhrases.map((p) => ({ learning: p.text.learning, native: p.text.native, mastery: p.masteryLevel })).slice(0, 50))}

**Conversation Rules:**
1. **Start:** If first message, greet in ${lang.learning} and ask simple question.
2. **Use Their Words:** Build conversation around their known phrases.
3. **Correct Mistakes:** If student makes error, provide corrected ${lang.learning} sentence + brief ${lang.native} explanation.
4. **Keep it ${lang.learning}:** Main response in ${lang.learning}, explanations in ${lang.native}.

**RESPONSE FORMAT (STRICTLY ENFORCE):**

Your response MUST be a JSON object with this EXACT structure:

{
  "contentParts": [
    {
      "type": "learning",
      "text": "Your ${lang.learning} conversational response here",
      "translation": "${lang.native} translation of the ${lang.learning} text"
    },
    {
      "type": "text",
      "text": "Any ${lang.native} explanation here (optional)"
    }
  ],
  "promptSuggestions": [
    "${lang.learning} suggestion 1",
    "${lang.learning} suggestion 2",
    "${lang.learning} suggestion 3"
  ]
}

**EXAMPLE (${lang.native} → ${lang.learning}):**
{
  "contentParts": [
    {
      "type": "learning",
      "text": "Hallo! Wie geht es dir?",
      "translation": "Hello! How are you?"
    },
    {
      "type": "text",
      "text": "This is a friendly greeting to start our conversation."
    }
  ],
  "promptSuggestions": ["Mir geht es gut", "Danke, und dir?", "Sehr gut"]
}

**IMPORTANT:**
- contentParts is REQUIRED (array of objects)
- Each object MUST have "type" ("learning" or "text") and "text"
- If type is "learning", include "translation"
- promptSuggestions is REQUIRED (array of 2-3 strings)
- Do NOT add text outside JSON
- Do NOT use markdown code blocks`;

      const userMessage = { role: 'user', parts: [{ text: newMessage || '(Start the conversation)' }] };

      try {
        const response = await api.models.generateContent({
          model: model,
          contents: [...formattedHistory, userMessage],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: chatResponseSchema(),
            temperature: 0.7,
          },
        });

        const jsonText = response.text.trim();

        // 🔍 LOGGING for debugging
        console.log('[practiceConversation] Raw response (first 300 chars):', jsonText.substring(0, 300));

        // 🛡️ CHECK that response is not empty
        if (!jsonText) {
          console.error('[practiceConversation] Empty response from Gemini API');
          return {
            role: 'model',
            contentParts: [
              {
                type: 'text',
                text: 'I apologize, but I received an empty response. Please try again.',
              },
            ],
            promptSuggestions: [],
          };
        }

        // 🛡️ ROBUST PARSING with try-catch
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(jsonText);
        } catch (parseError) {
          console.error('[practiceConversation] JSON parse failed:', parseError);
          console.error('[practiceConversation] Raw text:', jsonText);

          // 🔄 FALLBACK: Try to extract text content
          const fallbackResponse = {
            responseParts: [
              {
                type: 'text',
                text:
                  jsonText.substring(0, 500) + (jsonText.length > 500 ? '...' : '') ||
                  'I apologize, but I had trouble generating a proper response. Could you try again?',
              },
            ],
            promptSuggestions: [],
          };
          parsedResponse = fallbackResponse;
        }

        // 🛡️ VALIDATE structure
        if (!parsedResponse.contentParts || !Array.isArray(parsedResponse.contentParts)) {
          console.warn('[practiceConversation] Invalid response structure (missing contentParts), using fallback');
          parsedResponse.contentParts = [
            {
              type: 'text',
              text: 'Response structure invalid. Please try again.',
            },
          ];
        }

        // 🛡️ ENSURE promptSuggestions is array
        if (!parsedResponse.promptSuggestions || !Array.isArray(parsedResponse.promptSuggestions)) {
          parsedResponse.promptSuggestions = [];
        }

        return {
          role: 'model',
          contentParts: parsedResponse.contentParts,
          promptSuggestions: parsedResponse.promptSuggestions,
        };
      } catch (error) {
        console.error('Error in practice conversation with Gemini:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // 🎯 RETURN fallback instead of throw
        return {
          role: 'model',
          contentParts: [
            {
              type: 'text',
              text: `I apologize, but I encountered an error: ${errorMessage}. Please try again or refresh the page.`,
            },
          ],
          promptSuggestions: [],
        };
      }
    },
    3,
    1000
  ); // 3 retries with 1-2-4 seconds delay
};

const learningAssistantResponseSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      responseParts: {
        type: Type.ARRAY,
        description: `The response broken down into segments of plain text and ${lang.learning} text.`,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: ['text', 'learning'],
              description: `Should be 'text' for plain ${lang.native} text or 'learning' for a ${lang.learning} word/phrase.`,
            },
            text: { type: Type.STRING, description: 'The segment of text. Do not use Markdown here.' },
            translation: {
              type: Type.STRING,
              description: `${lang.native} translation of the text, ONLY if type is 'learning'.`,
            },
          },
          required: ['type', 'text'],
        },
      },
      isCorrect: {
        type: Type.BOOLEAN,
        description:
          "Set to true ONLY if the user's answer is a correct and complete translation of the target phrase.",
      },
      promptSuggestions: {
        type: Type.ARRAY,
        description: `A list of 2-4 new, context-aware follow-up questions in ${lang.native} that the user might ask next, based on the current conversation. Only suggest pronoun variations if there's a verb. Only suggest asking a question if the phrase isn't one already.`,
        items: {
          type: Type.STRING,
        },
      },
      wordOptions: {
        type: Type.ARRAY,
        description:
          'A list of 7-10 shuffled word choices (correct words and distractors) to help the user construct their next response. Should be an empty array if isCorrect is true.',
        items: {
          type: Type.STRING,
        },
      },
      cheatSheetOptions: {
        type: Type.ARRAY,
        description: 'An optional list of cheat sheet buttons to show the user based on the current question.',
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['verbConjugation', 'nounDeclension', 'pronouns', 'wFragen'] },
            label: { type: Type.STRING, description: "The button text, e.g., 'Verb conjugation'" },
            data: {
              type: Type.STRING,
              description:
                'Data for the cheat sheet. Verb infinitive, or a JSON string for nouns like \'{"noun":"Tisch","article":"der"}\'.',
            },
          },
          required: ['type', 'label', 'data'],
        },
      },
    },
    required: ['responseParts', 'isCorrect', 'promptSuggestions', 'wordOptions'],
  };
};

const guideToTranslation: AiService['guideToTranslation'] = async (phrase, history, userAnswer) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');

  const formattedHistory = history.map((msg) => {
    const role = msg.role === 'user' ? 'user' : 'model';
    const text = msg.contentParts ? msg.contentParts.map((p) => p.text).join('') : msg.text || '';
    return { role, parts: [{ text }] };
  });

  // FIX: Use phrase.text.native and phrase.text.learning
  const lang = getLang();
  const systemInstruction = `You are an experienced language teacher and methodologist for ${lang.learning}. Your task is to guide the user through an interactive exercise so they understand and memorize the phrase translation. Use the method of leading questions and hints.

Original phrase: "${phrase.text.native}"
Correct ${lang.learning} translation: "${phrase.text.learning}"

**Your algorithm:**

**Step 1: Phrase Analysis (Internal).**
- Break the correct ${lang.learning} translation into **semantic chunks**. A chunk is a single word or a **stable phrase** that should not be split (e.g., "hätte gern", "es gibt", "zum Beispiel", "ich möchte").
- **KEY RULE:** Do not split the phrase into individual words. Look for combinations that carry a single meaning.

**Step 2: First Hint (First message to the user).**
1. Start with the first **chunk**.
2. Ask a leading question to help the user guess this chunk. Example for "Ich hätte gern einen Kaffee": "Let's start with a polite request. What stable expression in ${lang.learning} is used for 'I would like'?"
3. Form \`wordOptions\` including the correct chunk ("hätte gern") and several distractors (individual words "hätte", "gern", "möchte", "will").

**Step 3: Subsequent Steps.**
- **If the user answered CORRECTLY (chose the right chunk):**
    1. Praise them ("Exactly!", "Correct!").
    2. Give a HINT for the **NEXT** chunk. Your hints should be subtle and leading.
    3. Generate new \`wordOptions\` for this step.
- **If the user answered INCORRECTLY:**
    1. Gently correct them.
    2. Give a **MORE EXPLICIT**, but still not direct hint for the **CURRENT** chunk.
    3. Offer the same or slightly modified set of \`wordOptions\`.
- **If the user chose "Don't know":**
    1. Give them the direct answer for the current step. Example: "It's the expression 'hätte gern'. Let's add it."
    2. Immediately move to the hint for the next step.

**Step 4: Completion.**
- When the entire phrase is assembled correctly, set \`isCorrect: true\`.
- In \`responseParts\`, write a congratulatory message.
- \`wordOptions\` and \`promptSuggestions\` should be empty.

**Rules for generated fields:**
- \`wordOptions\`: **ALWAYS** include "Don't know" as the first element of the array, unless the phrase is fully assembled (\`isCorrect: true\`). Options can be individual words or short phrases.
- \`promptSuggestions\`: Should be educational questions, not direct hints. Examples: 'What case is needed here?', 'Why this word order?', 'Can this be said differently?'. Avoid hints like 'How to say "look"?'.
- \`cheatSheetOptions\`: Include cheat sheets only when your question directly relates to their topic. **IMPORTANT:** The button text (\`label\`) must be GENERIC and MUST NOT contain the answer itself.
    - **CORRECT:** If asking about a verb, \`label\` should be "Verb conjugation".
    - **INCORRECT:** \`label\`: "Conjugation: gehen".
    - **CORRECT:** If asking about an article, \`label\` should be "Noun declension".
    - **INCORRECT:** \`label\`: "Declension: der Tisch".
- **General Rules:**
    - **KEY RULE:** Your task is to give step-by-step hints, not the ready answer. Do not include the full ${lang.learning} phrase \`${phrase.text.learning}\` in your response (in \`responseParts\`) and do not offer "usage examples" until the user has assembled the phrase completely and correctly. Set \`isCorrect: true\` only after the user has successfully provided the COMPLETE and CORRECT translation.
    - Always answer in ${lang.native}.
    - Use JSON format with all fields from the schema. The \`cheatSheetOptions\` field is optional.`;

  const userMessage = userAnswer || '(Start of session, give the first hint)';

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: [...formattedHistory, { role: 'user', parts: [{ text: userMessage }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: learningAssistantResponseSchema(),
        temperature: 0.6,
      },
    });

    const jsonText = response.text.trim();
    const parsedResponse = JSON.parse(jsonText);

    return {
      role: 'model',
      contentParts: parsedResponse.responseParts || [{ type: 'text', text: 'An error occurred.' }],
      isCorrect: parsedResponse.isCorrect || false,
      promptSuggestions: parsedResponse.promptSuggestions || [],
      wordOptions: parsedResponse.wordOptions || [],
      cheatSheetOptions: parsedResponse.cheatSheetOptions || [],
    };
  } catch (error) {
    console.error('Error in guideToTranslation with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const translationChatResponseSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      ...chatResponseSchema().properties, // Inherit contentParts and promptSuggestions
      suggestion: {
        type: Type.OBJECT,
        description: `An optional suggested improvement for the ${lang.native} and ${lang.learning} phrases.`,
        properties: {
          [lang.nativeCode]: { type: Type.STRING, description: `The suggested new ${lang.native} phrase.` },
          [lang.learningCode]: { type: Type.STRING, description: `The suggested new ${lang.learning} phrase.` },
        },
        required: [lang.nativeCode, lang.learningCode],
      },
    },
    required: ['contentParts', 'promptSuggestions'],
  };
};

const discussTranslation: AiService['discussTranslation'] = async (request) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const systemInstruction = `You are an AI assistant and expert in ${lang.learning}. The user is unhappy with the translation and wants to improve it.
Original ${lang.native} phrase: "${request.originalNative}"
Current ${lang.learning} translation: "${request.currentLearning}"

Your task:
1. Respond to the user's request, helping them find a better translation. Communicate in ${lang.native}.
2. If during the dialogue you conclude that the phrase can be improved, YOU MUST include the \`suggestion\` field in your JSON response. This field must contain an object with keys \`${lang.nativeCode}\` and \`${lang.learningCode}\` with the final, improved version. We may need to slightly change the ${lang.native} phrase for a better translation.
3. If you do not propose a specific change, DO NOT include the \`suggestion\` field.
4. Your response MUST be ONLY in JSON format, strictly adhering to the provided schema. Do not add any text before or after the JSON. Always break your text response into the \`contentParts\` array and offer new questions in \`promptSuggestions\`. In the \`contentParts\` array, use 'type': 'text' for plain text and 'type': 'learning' for ${lang.learning} words/phrases (with mandatory 'translation' field).
5. Be concise and to the point.`;

  const formattedHistory = request.history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text || msg.contentParts?.map((p) => p.text).join('') || '' }],
  }));

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: formattedHistory,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: translationChatResponseSchema(),
        temperature: 0.6,
      },
    });

    const jsonText = response.text.trim();
    const parsedResponse = JSON.parse(jsonText);

    if (
      !parsedResponse ||
      !Array.isArray(parsedResponse.contentParts) ||
      !Array.isArray(parsedResponse.promptSuggestions)
    ) {
      console.error('Invalid response structure from Gemini discussTranslation:', parsedResponse);
      const textFallback =
        parsedResponse && typeof parsedResponse === 'object' ? JSON.stringify(parsedResponse) : 'Invalid response';
      throw new Error(`AI returned an unexpected response format. Raw: ${textFallback}`);
    }

    return {
      role: 'model',
      contentParts:
        parsedResponse.contentParts.length > 0
          ? parsedResponse.contentParts
          : [{ type: 'text', text: 'AI did not provide a text response.' }],
      suggestion: parsedResponse.suggestion
        ? { learning: parsedResponse.suggestion[lang.learningCode], native: parsedResponse.suggestion[lang.nativeCode] }
        : undefined,
      promptSuggestions: parsedResponse.promptSuggestions || [],
    };
  } catch (error) {
    console.error('Error discussing translation with Gemini:', error);
    if (error instanceof Error && error.message.includes('JSON')) {
      throw new Error('Failed to parse JSON response from AI. Invalid format.');
    }
    throw new Error(`Error calling Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

const deepDiveAnalysisSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      chunks: {
        type: Type.ARRAY,
        description: `The ${lang.learning} phrase broken down into grammatical chunks.`,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            type: {
              type: Type.STRING,
              description:
                "Grammatical type, e.g., 'Noun', 'Verb', 'Article', 'Adjective', 'Adverb', 'Preposition', 'Pronoun', 'Conjunction', 'Particle'.",
            },
            explanation: {
              type: Type.STRING,
              description: `A brief explanation of the chunk's role in ${lang.native}.`,
            },
          },
          required: ['text', 'type', 'explanation'],
        },
      },
      keyConcepts: {
        type: Type.ARRAY,
        description: 'A list of key semantic concepts within the phrase.',
        items: {
          type: Type.OBJECT,
          properties: {
            concept: { type: Type.STRING, description: `The key concept in ${lang.learning}.` },
            explanation: { type: Type.STRING, description: `A brief explanation in ${lang.native}.` },
          },
          required: ['concept', 'explanation'],
        },
      },
      personalizationQuestion: {
        type: Type.STRING,
        description: `A thought-provoking question in ${lang.native} to help the user connect the phrase to their own life (Self-Reference Effect).`,
      },
      mnemonicImage: {
        type: Type.OBJECT,
        description: 'A vivid, memorable, and slightly absurd mnemonic image to help encode the phrase.',
        properties: {
          description: {
            type: Type.STRING,
            description: `A detailed description of the memorable scene in ${lang.native}.`,
          },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Keywords from the scene.' },
        },
        required: ['description', 'keywords'],
      },
    },
    required: ['chunks', 'keyConcepts', 'personalizationQuestion', 'mnemonicImage'],
  };
};

const generateDeepDiveAnalysis: AiService['generateDeepDiveAnalysis'] = async (phrase) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const prompt = `You are an AI assistant specializing in cognitive memory techniques. The user is learning the ${lang.learning} phrase: "${phrase.text.learning}" (translation: "${phrase.text.native}").
Perform a deep cognitive analysis of this phrase following three stages and return the result as a JSON object.

**Stage 1: Deconstruction (Analysis)**
- **chunks**: Break the ${lang.learning} phrase into grammatical chunks (single words or small groups). For each chunk, specify its type (e.g., 'Noun', 'Verb', 'Adjective', 'Preposition') and a brief explanation of its role in ${lang.native}.
- **keyConcepts**: Highlight 1-3 key semantic concepts in the phrase and provide a brief explanation for them in ${lang.native}.

**Stage 2: Personalization (Elaboration)**
- **personalizationQuestion**: Formulate one leading question in ${lang.native} that helps the user connect the phrase to their personal experience, feelings, or memories. This should trigger the self-reference effect. The question should be open-ended and encourage imagination.

**Stage 3: Encoding (Mnemonic)**
- **mnemonicImage**: Create a vivid, memorable, multi-sensory, and possibly absurd mnemonic image or short scene that encodes the meaning of the entire phrase.
  - **description**: Describe this scene in detail in ${lang.native}.
  - **keywords**: List 2-4 keywords from this image.

Return only the JSON object matching the provided schema.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: deepDiveAnalysisSchema(),
        temperature: 0.8,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as DeepDiveAnalysis;
  } catch (error) {
    console.error('Error generating deep dive analysis with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const movieExamplesSchema = () => {
  const lang = getLang();
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'The original title of the movie.' },
        titleNative: { type: Type.STRING, description: `The ${lang.native} translation of the movie title.` },
        dialogueLearning: {
          type: Type.STRING,
          description: `The exact dialogue snippet in the ${lang.learning} language containing the phrase.`,
        },
        dialogueNative: { type: Type.STRING, description: `The ${lang.native} translation of the dialogue snippet.` },
      },
      required: ['title', 'titleNative', 'dialogueLearning', 'dialogueNative'],
    },
  };
};

const generateMovieExamples: AiService['generateMovieExamples'] = async (phrase) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const prompt = `Find up to 5 examples from dialogues in popular movies where the ${lang.learning} phrase "${phrase.text.learning}" is used. Movies can be produced in ${lang.learning} or popular international movies with high-quality ${lang.learning} dubbing. For each example specify:
1. Original movie title ('title').
2. Movie title in ${lang.native} ('titleNative').
3. Dialogue snippet in ${lang.learning} ('dialogueLearning').
4. Translation of this snippet to ${lang.native} ('dialogueNative').
Return the result as a JSON array of objects matching the schema.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: movieExamplesSchema(),
        temperature: 0.7,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as MovieExample[];
  } catch (error) {
    console.error('Error generating movie examples with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

// FIX: Update schema to match WordAnalysis type in types.ts
/**
 * Returns person/number example based on language code
 */
const getPersonNumberExample = (languageCode: LanguageCode): string => {
  return i18n.t('gemini.personNumberExample', { lng: languageCode });
};

const wordAnalysisSchema = () => {
  const lang = getLang();
  const personExample = getPersonNumberExample(lang.nativeCode);
  return {
    type: Type.OBJECT,
    properties: {
      word: { type: Type.STRING },
      partOfSpeech: { type: Type.STRING, description: `The part of speech in ${lang.native}.` },
      nativeTranslation: { type: Type.STRING, description: `The ${lang.native} translation of the word.` },
      baseForm: {
        type: Type.STRING,
        description: 'The base form, especially for adjectives (e.g., "gut" for "guten").',
      },
      nounDetails: {
        type: Type.OBJECT,
        properties: {
          article: { type: Type.STRING, description: 'The article (der, die, das).' },
          plural: { type: Type.STRING, description: 'The plural form.' },
        },
      },
      verbDetails: {
        type: Type.OBJECT,
        properties: {
          infinitive: { type: Type.STRING, description: 'The infinitive form.' },
          tense: { type: Type.STRING, description: 'The tense (e.g., "Präsens").' },
          person: {
            type: Type.STRING,
            description: `The person and number (e.g., "${personExample}") in ${lang.native}.`,
          },
        },
      },
      exampleSentence: { type: Type.STRING, description: `A new example sentence in ${lang.learning} using the word.` },
      exampleSentenceNative: {
        type: Type.STRING,
        description: `The ${lang.native} translation of the example sentence.`,
      },
    },
    required: ['word', 'partOfSpeech', 'nativeTranslation', 'exampleSentence', 'exampleSentenceNative'],
  };
};

/**
 * Returns word analysis prompt in the appropriate language
 */
const getWordAnalysisPrompt = (
  languageCode: LanguageCode,
  learningLang: string,
  nativeLang: string,
  word: string,
  phraseText: string
): string => {
  const prompt = `Perform a linguistic analysis of the ${learningLang} word "${word}" in the context of the phrase "${phraseText}".
Return a JSON object with the following information:
1.  **word**: the analyzed word.
2.  **partOfSpeech**: part of speech in ${nativeLang}.
3.  **nativeTranslation**: translation of the word to ${nativeLang}.
4.  **baseForm**: if the word is an adjective, provide its base (dictionary) form.
5.  **nounDetails**: if the word is a noun, provide its article ('article') and plural form ('plural'). If not, omit this field.
6.  **verbDetails**: if the word is a verb, provide its infinitive ('infinitive'), tense ('tense'), and person/number ('person'). If not, omit this field.
7.  **exampleSentence**: a new example sentence in ${learningLang} using this word.
8.  **exampleSentenceNative**: translation of the example sentence to ${nativeLang}.`;

  return prompt;
};

const analyzeWordInPhrase: AiService['analyzeWordInPhrase'] = async (phrase, word) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const prompt = getWordAnalysisPrompt(lang.nativeCode, lang.learning, lang.native, word, phrase.text.learning);

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: wordAnalysisSchema(),
        temperature: 0.5,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as WordAnalysis;
  } catch (error) {
    console.error('Error analyzing word with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const pronounConjugationSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      pronoun: {
        type: Type.STRING,
        description: `The personal pronoun in ${lang.learning} (e.g., for Spanish: "yo", "tú"; for Hindi: "मैं", "तुम").`,
      },
      pronounNative: { type: Type.STRING, description: `The same pronoun translated to ${lang.native}.` },
      // Canonical keys (language-agnostic)
      learning: { type: Type.STRING, description: `Full sentence in the learning language (${lang.learning}).` },
      native: { type: Type.STRING, description: `Translation in the native language (${lang.native}).` },
      // Dynamic keys (backward compatibility)
      [lang.learningCode]: {
        type: Type.STRING,
        description: `The full example sentence in ${lang.learning} for this pronoun.`,
      },
      [lang.nativeCode]: {
        type: Type.STRING,
        description: `The ${lang.native} translation of the ${lang.learning} sentence.`,
      },
    },
    required: ['pronoun', 'pronounNative', 'learning', 'native'],
  };
};

const tenseFormsSchema = {
  type: Type.OBJECT,
  properties: {
    statement: {
      type: Type.ARRAY,
      items: pronounConjugationSchema(),
      description: 'An array of declarative statements for all pronouns.',
    },
    question: {
      type: Type.ARRAY,
      items: pronounConjugationSchema(),
      description: 'An array of interrogative sentences for all pronouns.',
    },
    negative: {
      type: Type.ARRAY,
      items: pronounConjugationSchema(),
      description: 'An array of negative sentences for all pronouns.',
    },
  },
  required: ['statement', 'question', 'negative'],
};

const verbConjugationSchema = {
  type: Type.OBJECT,
  properties: {
    infinitive: { type: Type.STRING },
    past: { ...tenseFormsSchema, description: 'Forms for the Past (Perfekt) tense.' },
    present: { ...tenseFormsSchema, description: 'Forms for the Present (Präsens) tense.' },
    future: { ...tenseFormsSchema, description: 'Forms for the Future (Futur I) tense.' },
  },
  required: ['infinitive', 'past', 'present', 'future'],
};

const conjugateVerb: AiService['conjugateVerb'] = async (infinitive) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');

  const lang = getLang();
  const prompt = `You are an expert in ${lang.learning} grammar. Provide a complete conjugation matrix for the verb "${infinitive}".

The matrix should include three tenses (past, present, future) and three forms (statement, question, negative).

**KEY REQUIREMENT:** For each matrix cell (e.g., "Present tense, Statement"), provide a complete list of conjugations for ALL personal pronouns used in ${lang.learning} language.

Rules:
1.  For each pronoun in each cell provide:
    - 'pronoun': the pronoun itself in ${lang.learning} (e.g., for Spanish: "yo", "tú", "él/ella", "nosotros", "vosotros", "ellos/ellas"; for Hindi: "मैं", "तुम", "वह", "हम", "तुम सब", "वे").
    - 'pronounNative': the same pronoun translated to ${lang.native}.
    - '${lang.learningCode}': a complete, grammatically correct example sentence in ${lang.learning}.
    - '${lang.nativeCode}': an exact translation of that sentence into ${lang.native}.
2.  For past tense, use the standard past tense form appropriate for ${lang.learning}.
3.  For future tense, use the standard future tense form appropriate for ${lang.learning}.
4.  For negation, use the standard negation pattern for ${lang.learning}.
5.  For questions, use the standard question formation pattern for ${lang.learning}.

IMPORTANT: Do NOT use Learning pronouns (ich, du, er/sie/es, wir, ihr, sie/Sie). Use pronouns appropriate for ${lang.learning}.
IMPORTANT: Do NOT use Learning tense names (Präsens, Perfekt, Futur). Use grammatical structures appropriate for ${lang.learning}.

Return the result as a JSON object matching the provided schema.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: verbConjugationSchema,
        temperature: 0.3,
      },
    });

    const jsonText = response.text.trim();
    const parsed = JSON.parse(jsonText);

    // Helper to pick first non-empty value by keys
    const pickFirst = (obj: any, keys: string[]) => {
      for (const k of keys) {
        const v = obj?.[k];
        if (typeof v === 'string' && v.trim().length > 0) return v;
      }
      return undefined;
    };

    // Mapper: include both canonical (learning/native) and legacy (learning/native) keys
    const mapConjugation = (item: any) => {
      const learningVal = pickFirst(item, [lang.learningCode, 'de', 'learning', 'learning']);
      const nativeVal = pickFirst(item, [lang.nativeCode, 'ru', 'native', 'native']);
      return {
        pronoun: item.pronoun,
        pronounNative: item.pronounNative,
        // canonical
        learning: learningVal,
        native: nativeVal,
      };
    };

    const mapTenseForms = (tense: any) => ({
      statement: tense.statement.map(mapConjugation),
      question: tense.question.map(mapConjugation),
      negative: tense.negative.map(mapConjugation),
    });

    return {
      infinitive: parsed.infinitive,
      past: mapTenseForms(parsed.past),
      present: mapTenseForms(parsed.present),
      future: mapTenseForms(parsed.future),
    } as VerbConjugation;
  } catch (error) {
    console.error('Error conjugating verb with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const simpleVerbConjugationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      pronoun: { type: Type.STRING, description: 'Pronoun in the learning language.' },
      pronounNative: { type: Type.STRING, description: 'Pronoun in the native language.' },
      form: {
        type: Type.STRING,
        description: 'Conjugated verb form in the learning language (present/simple present).',
      },
    },
    required: ['pronoun', 'pronounNative', 'form'],
  },
};

const conjugateVerbSimple: AiService['conjugateVerbSimple'] = async (infinitive) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');

  const lang = getLang();
  const prompt = `You are an expert in ${lang.learning} grammar. Conjugate the verb "${infinitive}" in the present tense for all personal pronouns used in ${lang.learning}.

Return a JSON array of objects, where each object contains three keys:
- "pronoun": the pronoun in ${lang.learning} (e.g., for Spanish: "yo", "tú", "él/ella", etc.; for Hindi: "मैं", "तुम", "वह", etc.)
- "pronounNative": the same pronoun translated to ${lang.native}
- "form": the conjugated verb form in ${lang.learning} (only the verb form, no additional words)

IMPORTANT: Do NOT use Learning pronouns (ich, du, er/sie/es, wir, ihr, sie/Sie). Use pronouns appropriate for ${lang.learning}.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: simpleVerbConjugationSchema,
        temperature: 0.1,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Error conjugating verb simply with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const pronounsSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      learning: { type: Type.STRING, description: 'Personal pronoun in the learning language' },
      native: { type: Type.STRING, description: 'Translation of the pronoun in the native language' },
    },
    required: ['learning', 'native'],
  },
};

const generatePronouns: AiService['generatePronouns'] = async () => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');

  const lang = getLang();
  const prompt = `You are an expert in ${lang.learning} grammar. Provide a complete list of personal pronouns used in ${lang.learning}.

Return a JSON array of objects, where each object contains:
- "learning": the personal pronoun in ${lang.learning} (e.g., for Spanish: "yo", "tú", "él", "ella", "nosotros", "vosotros", "ellos", "ellas"; for Hindi: "मैं", "तुम", "वह", "हम", "आप", "वे")
- "native": the translation of that pronoun in ${lang.native}

IMPORTANT: Include ALL personal pronouns commonly used in ${lang.learning}, including variations (like él/ella for Spanish, or formal/informal forms).
IMPORTANT: Do NOT use Learning pronouns (ich, du, er/sie/es). Use pronouns appropriate for ${lang.learning}.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: pronounsSchema,
        temperature: 0.1,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Error generating pronouns with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const nounDeclensionSchema = {
  type: Type.OBJECT,
  properties: {
    noun: { type: Type.STRING },
    singular: {
      type: Type.OBJECT,
      properties: {
        nominativ: { type: Type.STRING, description: "Singular Nominativ (e.g., 'der Tisch')" },
        akkusativ: { type: Type.STRING, description: "Singular Akkusativ (e.g., 'den Tisch')" },
        dativ: { type: Type.STRING, description: "Singular Dativ (e.g., 'dem Tisch')" },
        genitiv: { type: Type.STRING, description: "Singular Genitiv (e.g., 'des Tisches')" },
      },
      required: ['nominativ', 'akkusativ', 'dativ', 'genitiv'],
    },
    plural: {
      type: Type.OBJECT,
      properties: {
        nominativ: { type: Type.STRING, description: "Plural Nominativ (e.g., 'die Tische')" },
        akkusativ: { type: Type.STRING, description: "Plural Akkusativ (e.g., 'die Tische')" },
        dativ: { type: Type.STRING, description: "Plural Dativ (e.g., 'den Tischen')" },
        genitiv: { type: Type.STRING, description: "Plural Genitiv (e.g., 'der Tische')" },
      },
      required: ['nominativ', 'akkusativ', 'dativ', 'genitiv'],
    },
  },
  required: ['noun', 'singular', 'plural'],
};

const declineNoun: AiService['declineNoun'] = async (noun, article) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');

  const lang = getLang();
  const prompt = `Provide the declension of the ${lang.learning} noun "${noun}" with the article "${article}" for all 4 cases (Nominativ, Akkusativ, Dativ, Genitiv) for singular and plural forms. Include the definite article in each form. Return a JSON object.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: nounDeclensionSchema,
        temperature: 0.2,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as NounDeclension;
  } catch (error) {
    console.error('Error declining noun with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const caseSchema = {
  type: Type.OBJECT,
  properties: {
    nominative: { type: Type.STRING },
    accusative: { type: Type.STRING },
    dative: { type: Type.STRING },
    genitive: { type: Type.STRING },
  },
  required: ['nominative', 'accusative', 'dative', 'genitive'],
};

const adjectiveDeclensionTableSchema = {
  type: Type.OBJECT,
  properties: {
    masculine: caseSchema,
    feminine: caseSchema,
    neuter: caseSchema,
    plural: caseSchema,
  },
  required: ['masculine', 'feminine', 'neuter', 'plural'],
};

const adjectiveDeclensionSchema = {
  type: Type.OBJECT,
  properties: {
    adjective: { type: Type.STRING },
    comparison: {
      type: Type.OBJECT,
      properties: {
        positive: { type: Type.STRING },
        comparative: { type: Type.STRING },
        superlative: { type: Type.STRING },
      },
      required: ['positive', 'comparative', 'superlative'],
    },
    weak: adjectiveDeclensionTableSchema,
    mixed: adjectiveDeclensionTableSchema,
    strong: adjectiveDeclensionTableSchema,
  },
  required: ['adjective', 'comparison', 'weak', 'mixed', 'strong'],
};

const declineAdjective: AiService['declineAdjective'] = async (adjective) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');

  const lang = getLang();
  const prompt = `You are an expert in ${lang.learning} grammar. Provide complete information about the adjective "${adjective}".
1.  **Comparison**: Provide the three degrees of comparison: positive, comparative, and superlative.
2.  **Declension**: Provide three complete declension tables (weak, mixed, strong).
    - Each table must include all cases (nominative, accusative, dative, genitive) for all genders (masculine, feminine, neuter) and plural.
    - IMPORTANT: In each adjective form, highlight the ending using Markdown bold, for example: "schön**en**".
Return the result as a single JSON object.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: adjectiveDeclensionSchema,
        temperature: 0.2,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as AdjectiveDeclension;
  } catch (error) {
    console.error('Error declining adjective with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const sentenceContinuationSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      learning: {
        type: Type.STRING,
        description: `The correct ${lang.learning} translation of the provided ${lang.native} phrase.`,
      },
      continuations: {
        type: Type.ARRAY,
        description: `An array of 7 to 10 short, logical, and diverse continuation options in ${lang.native}. These should be clean words or phrases without any leading punctuation or connectors.`,
        items: {
          type: Type.STRING,
        },
      },
    },
    required: ['learning', 'continuations'],
  };
};

const generateSentenceContinuations: AiService['generateSentenceContinuations'] = async (nativePhrase) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const prompt = `You are a language learning AI assistant helping the user build phrases part by part.
Current phrase of the user in ${lang.native}: "${nativePhrase}"

Your task is to analyze the phrase and suggest logical continuations.

1.  **Analysis**: Determine which part of the phrase is incomplete. Is it a pronoun, object, place, time, or manner?
    - If the phrase is "How do I get to...", it lacks a **destination** (where?).
    - If the phrase is "How do I get to the station", you can add **manner** (how?) or **time** (when?).

2.  **Generation**:
    - **learning**: Translate the current phrase "${nativePhrase}" into ${lang.learning}. Ensure grammar and punctuation are correct.
    - **continuations**: Generate 7 to 10 diverse and logical continuation options for the ${lang.native} phrase. Options should be relevant for an adult in real-life situations (work, family, daily life, friends, travel).
        - **IMPORTANT**: Options must **continue** the thought, not **replace** part of it.
        - **CORRECT**: for "How do I get to the station", suggest ways: "by metro", "on foot", "fastest way".
        - **INCORRECT**: for "How do I get to the station", suggesting "to the airport" or "to the museum". The phrase already contains the destination.
        - Options must be short, "clean" words or phrases in ${lang.native} without leading punctuation.

Return the result as a JSON object matching the schema.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: sentenceContinuationSchema(),
        temperature: 0.8,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as SentenceContinuation;
  } catch (error) {
    console.error('Error generating sentence continuations with Gemini:', error);
    const errorMessage = (error as any)?.message || 'Unknown error';
    throw new Error(`Failed to call the Gemini API: ${errorMessage}`);
  }
};

const duplicateSchema = {
  type: Type.OBJECT,
  properties: {
    duplicateGroups: {
      type: Type.ARRAY,
      description: 'An array of groups. Each group is an array of phrase IDs that are semantically duplicates.',
      items: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  },
  required: ['duplicateGroups'],
};

const findDuplicatePhrases: AiService['findDuplicatePhrases'] = async (phrases) => {
  // Local, deterministic implementation to avoid AI hallucinations.
  const normalizePhrase = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/^[аи]\s+/, '') // Remove leading 'а ' or 'и '
      .replace(/[.,!?]/g, '') // Remove punctuation
      .trim();
  };

  const phraseMap = new Map<string, string[]>();

  phrases.forEach((phrase) => {
    const normalizedNative = normalizePhrase(phrase.text.native);
    if (normalizedNative) {
      if (!phraseMap.has(normalizedNative)) {
        phraseMap.set(normalizedNative, []);
      }
      phraseMap.get(normalizedNative)!.push(phrase.id);
    }
  });

  const duplicateGroups: string[][] = [];
  for (const ids of phraseMap.values()) {
    if (ids.length > 1) {
      duplicateGroups.push(ids);
    }
  }

  return Promise.resolve({ duplicateGroups });
};

const phraseBuilderOptionsSchema = {
  type: Type.OBJECT,
  properties: {
    words: {
      type: Type.ARRAY,
      description: 'An array of shuffled word blocks including correct words and distractors.',
      items: { type: Type.STRING },
    },
  },
  required: ['words'],
};

const generatePhraseBuilderOptions: AiService['generatePhraseBuilderOptions'] = async (phrase) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');

  // FIX: Use phrase.text.learning and phrase.text.native
  const lang = getLang();
  const prompt = `Create a set of words for the "assemble the phrase" exercise.
${lang.learning} phrase: "${phrase.text.learning}" (${lang.native} translation: "${phrase.text.native}").

Rules:
1. Include ALL words from the ${lang.learning} phrase in the set. Punctuation marks must remain part of the word (e.g., "Hallo.").
2. Add 5-7 suitable but incorrect "distractor" words (e.g., wrong grammatical forms, out-of-context synonyms, extra articles).
3. Shuffle all words randomly.
4. Return a JSON object with a single key "words" containing the array of all words.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: phraseBuilderOptionsSchema,
        temperature: 0.9,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as PhraseBuilderOptions;
  } catch (error) {
    console.error('Error generating phrase builder options with Gemini:', error);
    throw new Error(`Failed to call the Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

const phraseEvaluationSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      isCorrect: { type: Type.BOOLEAN },
      feedback: { type: Type.STRING, description: `Constructive feedback in ${lang.native}.` },
      correctedPhrase: { type: Type.STRING, description: "The correct phrase, if the user's attempt was wrong." },
    },
    required: ['isCorrect', 'feedback'],
  };
};

const evaluatePhraseAttempt: AiService['evaluatePhraseAttempt'] = async (phrase, userAttempt) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const prompt = `You are an experienced and friendly ${lang.learning} teacher.
The student is learning the phrase: "${phrase.text.native}".
Correct translation: "${phrase.text.learning}".
Student's answer: "${userAttempt}".

Your task is to provide feedback on the student's answer.
1.  **Comparison**: Compare the student's answer with the correct translation, IGNORING the following minor discrepancies:
    - **Case sensitivity**: "Hallo" and "hallo" should be considered identical. The only exception is nouns in ${lang.learning} are always capitalized. If the student wrote a noun with a lowercase letter, it is a mistake.
    - **Trailing punctuation**: Missing dot or question mark at the end is not a mistake.
    - **Extra spaces** at the beginning or end.
2.  **If the answer is correct (considering assumptions above)**: Set \`isCorrect: true\`. Praise the student. You can add a short comment why this wording is good.
3.  **If there are mistakes**: Set \`isCorrect: false\`.
    - Gently point them out.
    - Explain **why** it is a mistake (e.g., "Word order is slightly different here..." or "The noun 'Tisch' is masculine, so it needs the article 'der'").
    - ALWAYS provide the correct version in the \`correctedPhrase\` field.
4.  Your tone should be positive, encouraging, and pedagogical.
5.  Answer in ${lang.native}.

Return a JSON object.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: phraseEvaluationSchema(),
        temperature: 0.5,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as PhraseEvaluation;
  } catch (error) {
    console.error('Error evaluating phrase attempt with Gemini:', error);
    throw new Error(`Failed to call the Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

const evaluateSpokenPhraseAttempt: AiService['evaluateSpokenPhraseAttempt'] = async (phrase, userAttempt) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');

  // FIX: Use phrase.text.native and phrase.text.learning
  const lang = getLang();
  const prompt = `You are an experienced and friendly ${lang.learning} teacher evaluating a SPOKEN answer.
Student is learning the phrase: "${phrase.text.native}".
Correct written translation: "${phrase.text.learning}".
Student's spoken answer (transcription): "${userAttempt}".

Your task is to provide feedback on the student's spoken answer.

**VERY IMPORTANT RULE FOR SPOKEN EVALUATION:**
- A person cannot "pronounce" a capital letter. Therefore, you MUST be lenient with capitalization.
- If the ONLY difference between the student's answer and the correct version is the capitalization of a noun (e.g., student said 'danke' instead of 'Danke'), you MUST consider the answer **CORRECT**.
- However, in the \`feedback\` field, you can politely remind them about the spelling rule: "Great! Just remember that in writing, the noun 'Danke' is capitalized."

**General Rules:**
1.  **Comparison**: Compare the student's answer with the correct translation, ignoring trailing punctuation and extra spaces.
2.  **If the answer is correct (considering the capitalization rule above)**:
    - Set \`isCorrect: true\`.
    - Give positive and encouraging feedback.
3.  **If there are other errors (besides capitalization)**:
    - Set \`isCorrect: false\`.
    - Gently point out the error.
    - Explain **why** it is an error (e.g., "Word order is slightly different here..." or "The noun 'Tisch' is masculine, so it needs the article 'der'").
    - ALWAYS provide the correct version in the \`correctedPhrase\` field.
4.  Your tone should be positive and pedagogical.
5.  Answer in ${lang.native}.

Return a JSON object.`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: phraseEvaluationSchema(),
        temperature: 0.4,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as PhraseEvaluation;
  } catch (error) {
    console.error('Error evaluating spoken phrase attempt with Gemini:', error);
    throw new Error(`Failed to call the Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

const healthCheck: AiService['healthCheck'] = async () => {
  const api = initializeApi();
  if (!api) return false;
  try {
    // Using a very simple, low-token prompt for the check
    await api.models.generateContent({ model, contents: 'Hi' });
    return true;
  } catch (error) {
    const message = (error as any)?.message || 'Unknown error';
    console.error('Gemini health check failed:', message);
    return false;
  }
};

const categoryAssistantResponseSchema = () => {
  const lang = getLang();
  return {
    type: Type.OBJECT,
    properties: {
      responseType: { type: Type.STRING, enum: ['text', 'proposed_cards', 'phrases_to_review', 'phrases_to_delete'] },
      responseParts: {
        type: Type.ARRAY,
        description: `The main text response, broken into segments of plain text and ${lang.learning} text. Use Markdown for formatting like lists or bold text within 'text' type parts. Format dialogues using Markdown like '**Person A:** '.`,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['text', 'learning'] },
            text: { type: Type.STRING },
            translation: { type: Type.STRING, description: `${lang.native} translation ONLY if type is 'learning'.` },
          },
          required: ['type', 'text'],
        },
      },
      promptSuggestions: {
        type: Type.ARRAY,
        description: `A list of 2-4 new, context-aware follow-up questions in ${lang.native} that the user might ask next.`,
        items: {
          type: Type.STRING,
        },
      },
      proposedCards: {
        type: Type.ARRAY,
        description: `A list of new cards. Only for responseType "proposed_cards". ${needsTranscription(lang.learningCode) ? `Each card MUST include romanization (transcription) for ${lang.learning} text.` : ''}`,
        maxItems: 30,
        items: {
          type: Type.OBJECT,
          properties: {
            [lang.learningCode]: {
              type: Type.STRING,
              description: `The phrase in ${lang.learning}. NEVER include romanization/transcription in parentheses here - use the separate romanization field.`,
            },
            [lang.nativeCode]: { type: Type.STRING, description: `The ${lang.native} translation.` },
            ...(needsTranscription(lang.learningCode)
              ? {
                romanization: {
                  type: Type.STRING,
                  description: `Romanization/transcription of the ${lang.learning} phrase (e.g., Pinyin for Chinese, Romaji for Japanese, Devanagari transliteration for Hindi, Arabic transliteration for Arabic). This field is REQUIRED.`,
                },
              }
              : {}),
          },
          required: [
            lang.learningCode,
            lang.nativeCode,
            ...(needsTranscription(lang.learningCode) ? ['romanization'] : []),
          ],
        },
      },
      phrasesToReview: {
        type: Type.ARRAY,
        description: 'A list of inconsistent phrases. Only for responseType "phrases_to_review".',
        items: {
          type: Type.OBJECT,
          properties: {
            [lang.learningCode]: { type: Type.STRING },
            reason: { type: Type.STRING, description: `Reason in ${lang.native}.` },
          },
          required: [lang.learningCode, 'reason'],
        },
      },
      phrasesForDeletion: {
        type: Type.ARRAY,
        description: 'A list of phrases to delete. Only for responseType "phrases_to_delete".',
        items: {
          type: Type.OBJECT,
          properties: {
            [lang.learningCode]: { type: Type.STRING },
            reason: { type: Type.STRING, description: `Reason in ${lang.native}.` },
          },
          required: [lang.learningCode, 'reason'],
        },
      },
    },
    required: ['responseType', 'responseParts', 'promptSuggestions'],
  };
};

const getCategoryAssistantResponse: AiService['getCategoryAssistantResponse'] = async (
  categoryName,
  existingPhrases,
  request,
  history = []
) => {
  const api = initializeApi();
  if (!api) throw new Error('Gemini API key not configured.');
  const lang = getLang();

  const existingPhrasesText = existingPhrases.map((p) => `"${p.text.learning}"`).join(', ');

  const requestTextMap: Record<CategoryAssistantRequestType, string> = {
    initial: 'This is the first opening. Greet the user and suggest main actions.',
    add_similar: 'Analyze existing phrases and generate 25 new ones, similar in topic. Do not repeat existing ones.',
    check_homogeneity:
      'Analyze all phrases for thematic unity. Point out those that do not fit and explain why. If everything is good, say so.',
    create_dialogue: `Create a short dialogue using as many phrases from the list as possible. Provide the ${lang.learning} version with translation in parentheses after each line and format it using Markdown.`,
    user_text: `User wrote: "${request.text}". Answer their request.`,
  };

  const romanizationRule = needsTranscription(lang.learningCode)
    ? `\n- **ROMANIZATION**: For ${lang.learning}, you MUST provide a separate "romanization" field with transcription (Pinyin for Chinese, Romaji for Japanese, transliteration for Hindi/Arabic). NEVER include transcription in brackets in the "${lang.learningCode}" field itself - use the separate "romanization" field.`
    : '';

  // Build context from history
  const conversationContext =
    history.length > 0
      ? `\n\n**CONVERSATION HISTORY:**\n${history
        .map((msg) => {
          if (msg.role === 'user') {
            return `User: ${msg.text || ''}`;
          } else if (msg.assistantResponse) {
            const summary =
              msg.assistantResponse.responseParts
                ?.filter((p) => p.type === 'text')
                .map((p) => p.text.substring(0, 150))
                .join(' ') || '';
            return `Assistant: ${summary}${summary.length >= 150 ? '...' : ''}`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n')}\n\n**CURRENT REQUEST** (consider all previous context):`
      : '';

  const prompt = `You are an AI assistant in a ${lang.learning} learning app. You are inside the category "${categoryName}".
Existing phrases in this category: ${existingPhrasesText || 'none yet'}.${conversationContext}

User request: ${requestTextMap[request.type]}

Your task is to fulfill the request and return the response STRICTLY in JSON format.

**RULES:**
- **responseType**: Response type ('text', 'proposed_cards', 'phrases_to_review', 'phrases_to_delete').
- **responseParts**: Your main text response, broken into parts. Use 'type':'learning' for ${lang.learning} words with translation. For dialogues, use Markdown formatting (e.g., \`**Speaker A:** ...\`) inside parts with 'type':'text'.
- **promptSuggestions**: ALWAYS offer 3-4 relevant questions to continue the dialogue.
- **proposedCards / phrasesToReview**: Populate these fields only if the response type corresponds.${romanizationRule}
- **PHRASE DELETION**: If the user asks to delete, remove, or clear phrases (e.g., "delete half", "keep only seasons"), perform the following actions:
  1. Determine exactly which phrases from the existing list need to be deleted.
  2. Set \`responseType: 'phrases_to_delete'\`.
  3. In the \`phrasesForDeletion\` field, return an array of objects with keys \`${lang.learningCode}\` (exact text of the phrase to delete) and \`reason\` (brief explanation in ${lang.native} why this phrase is being deleted).
  4. In \`responseParts\`, write an accompanying message, for example: "Okay, I suggest deleting the following phrases as they do not match your request:".`;

  try {
    const response = await api.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: categoryAssistantResponseSchema(),
        temperature: 0.7,
      },
    });

    const jsonText = response.text.trim();
    const parsedResult = JSON.parse(jsonText);

    const assistantResponse: CategoryAssistantResponse = {
      ...parsedResult,
      proposedCards: parsedResult.proposedCards?.map((c: any) => ({
        native: c[lang.nativeCode],
        learning: c[lang.learningCode],
        ...(c.romanization ? { romanization: c.romanization } : {}),
      })),
      phrasesToReview: parsedResult.phrasesToReview?.map((p: any) => ({
        learning: p[lang.learningCode],
        reason: p.reason,
      })),
      phrasesForDeletion: parsedResult.phrasesForDeletion?.map((p: any) => ({
        learning: p[lang.learningCode],
        reason: p.reason,
      })),
    };

    return assistantResponse;
  } catch (error) {
    console.error('Error with Category Assistant:', error);
    throw new Error(`Failed to call the Gemini API: ${(error as any)?.message || 'Unknown error'}`);
  }
};

export const geminiService: AiService = {
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
  generatePronouns,
  declineNoun,
  declineAdjective,
  generateSentenceContinuations,
  findDuplicatePhrases,
  generatePhraseBuilderOptions,
  evaluatePhraseAttempt,
  evaluateSpokenPhraseAttempt,
  healthCheck,
  getProviderName: () => 'Google Gemini',
  generateCardsFromTranscript,
  generateCardsFromImage,
  generateTopicCards,
  classifyTopic,
  getCategoryAssistantResponse,
};
