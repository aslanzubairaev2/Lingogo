/**
 * Practice Chat Service - Redesigned
 *
 * A simplified, robust service for Practice Chat AI conversations.
 * This service replaces the problematic practiceConversation from geminiService.
 *
 * Key improvements:
 * - Simple flat JSON schema (no nested contentParts confusion)
 * - Clear field naming (primaryText, translation, suggestions)
 * - Robust validation and fallbacks
 * - Exponential backoff retry logic
 * - Better error messages
 */

import { GoogleGenAI, Type } from '@google/genai';
import type {
  Phrase,
  LanguageProfile,
  PracticeChatMessage,
  PracticeChatAIResponse,
  PracticeChatMessageType,
} from '../types';

// Retry helper (from geminiService.ts)
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

      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.log(`[retryWithExponentialBackoff] Waiting ${delayMs}ms before retry...`);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

// Language name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  de: 'German',
  ru: 'Russian',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  pl: 'Polish',
  zh: 'Chinese',
  ja: 'Japanese',
  ar: 'Arabic',
  hi: 'Hindi',
};

/**
 * Simplified JSON Schema for Practice Chat
 * No nested objects, clear field names, all required fields explicit
 */
const practiceChatResponseSchema = {
  type: Type.OBJECT,
  properties: {
    messageType: {
      type: Type.STRING,
      enum: ['greeting', 'question', 'correction', 'explanation', 'encouragement', 'suggestion'],
      description: 'Type of AI response'
    },
    primaryText: {
      type: Type.STRING,
      description: 'Main text in learning language'
    },
    translation: {
      type: Type.STRING,
      description: 'Translation of primaryText in native language'
    },
    secondaryText: {
      type: Type.STRING,
      description: 'Additional explanation in native language (optional)',
      nullable: true
    },
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2-3 quick reply suggestions in learning language'
    },
    hints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Hints if user is stuck (optional)',
      nullable: true
    },
    vocabularyUsed: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'IDs of phrases from vocabulary used (optional)',
      nullable: true
    }
  },
  required: ['messageType', 'primaryText', 'translation', 'suggestions']
};

/**
 * Validate AI response structure
 */
function validateAIResponse(response: any): response is PracticeChatAIResponse {
  if (!response || typeof response !== 'object') {
    console.error('[validateAIResponse] Response is not an object:', response);
    return false;
  }

  // Check required fields
  const hasMessageType = typeof response.messageType === 'string';
  const hasPrimaryText = typeof response.primaryText === 'string' && response.primaryText.length > 0;
  const hasTranslation = typeof response.translation === 'string' && response.translation.length > 0;
  const hasSuggestions = Array.isArray(response.suggestions) && response.suggestions.length > 0;

  if (!hasMessageType) {
    console.error('[validateAIResponse] Missing or invalid messageType');
  }
  if (!hasPrimaryText) {
    console.error('[validateAIResponse] Missing or invalid primaryText');
  }
  if (!hasTranslation) {
    console.error('[validateAIResponse] Missing or invalid translation');
  }
  if (!hasSuggestions) {
    console.error('[validateAIResponse] Missing or invalid suggestions');
  }

  return hasMessageType && hasPrimaryText && hasTranslation && hasSuggestions;
}

/**
 * Create fallback response when AI fails
 */
function createFallbackResponse(
  errorMessage: string,
  lang: LanguageProfile
): PracticeChatMessage {
  const fallbackPrimaryTexts: Record<string, string> = {
    de: 'Entschuldigung',
    en: 'Sorry',
    fr: 'Désolé',
    es: 'Lo siento',
    it: 'Mi dispiace',
    pt: 'Desculpa',
    pl: 'Przepraszam',
    zh: '对不起',
    ja: 'ごめんなさい',
    ar: 'عذرًا',
  };

  const fallbackTranslations: Record<string, string> = {
    de: 'Entschuldigung',
    en: 'Sorry',
    ru: 'Извините',
    fr: 'Désolé',
    es: 'Lo siento',
    it: 'Mi dispiace',
    pt: 'Desculpa',
    pl: 'Przepraszam',
    zh: '对不起',
    ja: 'ごめんなさい',
    ar: 'عذرًا',
  };

  const retrySuggestions: Record<string, string> = {
    de: 'Noch einmal',
    en: 'Try again',
    fr: 'Encore',
    es: 'Otra vez',
    it: 'Ancora una volta',
    pt: 'Mais uma vez',
    pl: 'Jeszcze raz',
    zh: '再试一次',
    ja: 'もう一度',
    ar: 'حاول مرة أخرى',
  };

  const fallbackPrimary = fallbackPrimaryTexts[lang.learning] ?? fallbackPrimaryTexts.en;
  const fallbackTranslation = fallbackTranslations[lang.native] ?? fallbackTranslations.en;
  const retry = retrySuggestions[lang.learning] ?? retrySuggestions.en;

  return {
    role: 'assistant',
    messageType: 'explanation',
    content: {
      primary: {
        text: fallbackPrimary,
        translation: fallbackTranslation,
      },
      secondary: {
        text: errorMessage,
      },
    },
    actions: {
      suggestions: [
        'OK',
        retry,
      ],
    },
    metadata: {
      timestamp: Date.now(),
    },
  };
}
/**
 * Convert AI response to PracticeChatMessage
 */
function convertAIResponseToMessage(
  aiResponse: PracticeChatAIResponse
): PracticeChatMessage {
  const correctnessMap: Record<PracticeChatMessageType, 'correct' | 'partial' | 'incorrect' | undefined> = {
    greeting: undefined,
    question: 'correct',
    encouragement: 'correct',
    suggestion: 'partial',
    explanation: 'partial',
    correction: 'incorrect',
  };

  const correctness = correctnessMap[aiResponse.messageType];

  return {
    role: 'assistant',
    messageType: aiResponse.messageType,
    content: {
      primary: {
        text: aiResponse.primaryText,
        translation: aiResponse.translation
      },
      secondary: (aiResponse.secondaryText !== undefined && aiResponse.secondaryText !== null && aiResponse.secondaryText !== '') ? {
        text: aiResponse.secondaryText
      } : undefined
    },
    actions: {
      suggestions: aiResponse.suggestions,
      hints: aiResponse.hints,
      phraseUsed: aiResponse.vocabularyUsed?.[0] // Take first phrase ID
    },
    metadata: {
      timestamp: Date.now(),
      vocabulary: aiResponse.vocabularyUsed,
      correctness
    }
  };
}

/**
 * Format conversation history for Gemini API
 */
function formatHistoryForAPI(history: PracticeChatMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
  return history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{
      text: msg.role === 'user'
        ? msg.content.primary.text
        : `${msg.content.primary.text}${msg.content.secondary ? `\n${msg.content.secondary.text}` : ''}`
    }]
  }));
}

/**
 * Send message to Practice Chat AI
 *
 * @param history - Previous conversation messages
 * @param userMessage - New message from user
 * @param userVocabulary - User's phrase collection
 * @param languageProfile - User's language settings
 * @returns AI response as PracticeChatMessage
 */
export async function sendPracticeChatMessage(
  history: PracticeChatMessage[],
  userMessage: string,
  userVocabulary: Phrase[],
  languageProfile: LanguageProfile
): Promise<PracticeChatMessage> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const api = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.0-flash-exp';

  const learningLang = LANGUAGE_NAMES[languageProfile.learning] || languageProfile.learning;
  const nativeLang = LANGUAGE_NAMES[languageProfile.native] || languageProfile.native;

  // Build vocabulary list (limit to 30 phrases for context window)
  const vocabList = userVocabulary
    .slice(0, 30)
    .map(p => `- "${p.text.learning}" (${p.text.native}) [id: ${p.id}]`)
    .join('\n');

  // Determine if this is first message
  const isFirstMessage = history.length === 0;

  // Create system instruction
  const systemInstruction = `You are Alex, a friendly ${learningLang} language tutor helping learners practice natural conversation.

**Mission:** Have a natural, authentic conversation in ${learningLang} at the user's level, using phrases from their vocabulary.

**User's Vocabulary (${userVocabulary.length} phrases, showing first 30):**
${vocabList || 'No phrases yet'}

**Conversation Rules:**
1. **Be natural**: Respond like a real person in conversation - NO PARROTING what the user said
2. **Use their vocabulary**: Base conversation topics around phrases they know
3. **Correct mistakes**: If user makes an error, correct it gently with explanation in ${nativeLang}
4. **Encourage progress**: Praise correct usage with "encouragement" messages
5. **Match their level**: Use appropriate complexity based on their vocabulary
6. **Track usage**: Always include vocabularyUsed IDs when you use their phrases
7. **Authentic dialogue**: Have a goal in each message - ask questions, share info, or respond naturally
8. **Don't repeat**: When user answers correctly, acknowledge and MOVE FORWARD with new content

**IMPORTANT - Natural Conversation Flow:**
❌ BAD (parroting):
User: "Ich bin müde"
AI: "Ah, du bist müde! Warum bist du müde?"

✅ GOOD (natural):
User: "Ich bin müde"
AI: "Oh nein! Hast du schlecht geschlafen?" (moves conversation forward)

**Response Format (STRICT JSON, NO MARKDOWN):**

{
  "messageType": "greeting|question|correction|explanation|encouragement|suggestion",
  "primaryText": "Your ${learningLang} response here - NATURAL conversation, NO parroting",
  "translation": "${nativeLang} translation of primaryText",
  "secondaryText": "Optional ${nativeLang} explanation/correction (ONLY use for corrections/grammar notes)",
  "suggestions": ["${learningLang} suggestion 1", "${learningLang} suggestion 2", "${learningLang} suggestion 3"],
  "hints": ["${nativeLang} hint 1", "${nativeLang} hint 2"],
  "vocabularyUsed": ["phrase_id_1", "phrase_id_2"]
}

**Message Types:**
- "greeting": Initial welcome, start conversation
- "question": Ask question to continue dialogue
- "correction": User made a mistake - correct it
- "explanation": Explain grammar/vocabulary
- "encouragement": Praise correct usage
- "suggestion": Suggest using a phrase

**Example Natural Responses:**

First greeting:
{
  "messageType": "greeting",
  "primaryText": "Hallo! Wie geht es dir heute?",
  "translation": "Hello! How are you today?",
  "secondaryText": "Давай попрактикуем разговор используя фразы из твоего словаря",
  "suggestions": ["Gut, danke!", "Sehr gut!", "Es geht so"],
  "vocabularyUsed": []
}

Natural question (user said "Gut, danke"):
{
  "messageType": "question",
  "primaryText": "Das freut mich! Was machst du heute?",
  "translation": "I'm glad! What are you doing today?",
  "suggestions": ["Ich arbeite", "Ich lerne Deutsch", "Ich habe frei"],
  "vocabularyUsed": ["phrase_id_if_used"]
}

Correction (user said "Ich habe geht"):
{
  "messageType": "correction",
  "primaryText": "Ich verstehe! Meinst du 'Ich bin gegangen'?",
  "translation": "I understand! Do you mean 'I went'?",
  "secondaryText": "Правильная форма: 'Ich bin gegangen' (прошедшее время от 'gehen'). Глаголы движения используют 'sein', не 'haben'",
  "suggestions": ["Ja, genau", "Danke für die Korrektur", "Noch einmal bitte"],
  "vocabularyUsed": []
}

Encouragement:
{
  "messageType": "encouragement",
  "primaryText": "Ausgezeichnet! Du lernst schnell!",
  "translation": "Excellent! You're learning fast!",
  "suggestions": ["Danke!", "Was kommt als Nächstes?", "Weiter üben"],
  "vocabularyUsed": []
}

**CRITICAL:**
- Return ONLY valid JSON
- NO markdown code blocks
- ALL explanations/corrections MUST be in ${nativeLang}
- primaryText is ALWAYS in ${learningLang}
- translation is ALWAYS in ${nativeLang}
- secondaryText is ALWAYS in ${nativeLang} (for corrections/explanations)
- suggestions array ALWAYS in ${learningLang}
- hints array ALWAYS in ${nativeLang}
- NO PARROTING - respond naturally, move conversation forward
- ALL required fields must be present`;

  // Wrap in retry logic
  return retryWithExponentialBackoff(async () => {
    try {
      // Format history
      const formattedHistory = formatHistoryForAPI(history);

      // Add user message
      const userMsg = {
        role: 'user',
        parts: [{ text: userMessage || '(Start the conversation)' }]
      };

      // Call Gemini API
      const response = await api.models.generateContent({
        model,
        contents: [...formattedHistory, userMsg],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: practiceChatResponseSchema,
          temperature: 0.7,
        },
      });

      const jsonText = response.text.trim();

      // Log for debugging
      console.log('[sendPracticeChatMessage] Raw response:', jsonText.substring(0, 200));

      // Check empty response
      if (!jsonText) {
        console.error('[sendPracticeChatMessage] Empty response from Gemini');
        return createFallbackResponse(
          'I received an empty response. Please try again.',
          languageProfile
        );
      }

      // Parse JSON
      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('[sendPracticeChatMessage] JSON parse failed:', parseError);
        console.error('[sendPracticeChatMessage] Raw text:', jsonText);
        return createFallbackResponse(
          'I had trouble parsing the response. Please try again.',
          languageProfile
        );
      }

      // Validate structure
      if (!validateAIResponse(parsed)) {
        console.error('[sendPracticeChatMessage] Invalid response structure:', parsed);
        return createFallbackResponse(
          'The response structure was invalid. Please try again.',
          languageProfile
        );
      }

      // Convert to PracticeChatMessage
      return convertAIResponseToMessage(parsed);

    } catch (error) {
      console.error('[sendPracticeChatMessage] Error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return createFallbackResponse(
        `Error: ${errorMsg}. Please try again.`,
        languageProfile
      );
    }
  }, 3, 1000); // 3 retries, exponential backoff
}

/**
 * Create initial greeting message
 */
export function createInitialGreeting(
  languageProfile: LanguageProfile,
  userVocabulary: Phrase[]
): PracticeChatMessage {
  const learningLang = LANGUAGE_NAMES[languageProfile.learning] || languageProfile.learning;
  const nativeLang = LANGUAGE_NAMES[languageProfile.native] || languageProfile.native;

  // Greeting templates by learning language
  const greetingTexts: Record<string, string> = {
    de: 'Hallo! Lass uns Deutsch üben!',
    en: 'Hello! Let\'s practice English!',
    fr: 'Bonjour! Pratiquons le français!',
    es: '¡Hola! ¡Practiquemos español!',
    it: 'Ciao! Pratichiamo l\'italiano!',
    pt: 'Olá! Vamos praticar português!',
    pl: 'Cześć! Ćwiczmy polski!',
    zh: '你好！让我们练习中文！',
    ja: 'こんにちは！日本語を練習しましょう！',
    ar: 'مرحبا! دعونا نمارس العربية!',
    hi: 'नमस्ते! चलो हिंदी का अभ्यास करें!',
  };

  // Translation templates by native language
  const greetingTranslations: Record<string, Record<string, string>> = {
    ru: {
      de: 'Привет! Давай практиковать немецкий!',
      en: 'Привет! Давай практиковать английский!',
      fr: 'Привет! Давай практиковать французский!',
      es: 'Привет! Давай практиковать испанский!',
      it: 'Привет! Давай практиковать итальянский!',
      pt: 'Привет! Давай практиковать португальский!',
      pl: 'Привет! Давай практиковать польский!',
      zh: 'Привет! Давай практиковать китайский!',
      ja: 'Привет! Давай практиковать японский!',
      ar: 'Привет! Давай практиковать арабский!',
      hi: 'Привет! Давай практиковать хинди!',
    },
    en: {
      de: 'Hello! Let\'s practice Learning!',
      en: 'Hello! Let\'s practice English!',
      fr: 'Hello! Let\'s practice French!',
      es: 'Hello! Let\'s practice Spanish!',
      it: 'Hello! Let\'s practice Italian!',
      pt: 'Hello! Let\'s practice Portuguese!',
      pl: 'Hello! Let\'s practice Polish!',
      zh: 'Hello! Let\'s practice Chinese!',
      ja: 'Hello! Let\'s practice Japanese!',
      ar: 'Hello! Let\'s practice Arabic!',
      hi: 'Hello! Let\'s practice Hindi!',
    },
    es: {
      hi: '¡Hola! Practiquemos hindi!',
    },
    de: {
      hi: 'Hallo! Lass uns Hindi üben!',
    },
    fr: {
      hi: 'Bonjour ! Pratiquons le hindi !',
    },
    it: {
      hi: 'Ciao! Alleniamoci con l’hindi!',
    },
    pt: {
      hi: 'Olá! Vamos praticar híndi!',
    },
    pl: {
      hi: 'Cześć! Poćwiczmy hindi!',
    },
    zh: {
      hi: '你好！我们来练习印地语吧！',
    },
    ja: {
      hi: 'こんにちは！ヒンディー語を練習しましょう！',
    },
    ar: {
      hi: 'مرحبًا! لنتمرن على الهندية!',
    },
  };

  const greetingText = greetingTexts[languageProfile.learning] || greetingTexts['en'];
  const translationMap = greetingTranslations[languageProfile.native] || greetingTranslations['en'];
  const defaultTranslation = translationMap[languageProfile.learning];
  const greetingTranslation = defaultTranslation || translationMap['en'] || `Hello! Let's practice ${learningLang}!`;

  const greeting = { text: greetingText, translation: greetingTranslation };

  const suggestionsByLang: Record<string, string[]> = {
    de: ['Hallo!', 'Guten Tag!', 'Ja, gerne!'],
    en: ['Hello!', 'Hi!', 'Yes, let\'s go!'],
    fr: ['Bonjour!', 'Salut!', 'Oui, d\'accord!'],
    es: ['¡Hola!', '¡Buenos días!', '¡Sí, claro!'],
    it: ['Ciao!', 'Buongiorno!', 'Sì, certo!'],
    pt: ['Olá!', 'Bom dia!', 'Sim, vamos!'],
    pl: ['Cześć!', 'Dzień dobry!', 'Tak, chętnie!'],
    zh: ['你好！', '早上好！', '好的！'],
    ja: ['こんにちは！', 'おはよう！', 'はい！'],
    ar: ['مرحبا!', 'صباح الخير!', 'نعم!'],
    hi: ['नमस्ते!', 'चलो शुरू करें!', 'मैं तैयार हूँ!'],
  };

  const suggestions = suggestionsByLang[languageProfile.learning] || suggestionsByLang['en'];

  // Explanations in native language
  const explanations: Record<string, string> = {
    ru: 'Я буду вести с тобой естественный разговор используя фразы из твоего словаря. Давай начнем!',
    en: `I'll have a natural conversation with you using phrases from your vocabulary. Let's begin!`,
    de: 'Ich werde ein natürliches Gespräch mit dir führen und dabei Phrasen aus deinem Vokabular verwenden. Lass uns beginnen!',
    fr: 'Je vais avoir une conversation naturelle avec toi en utilisant des phrases de ton vocabulaire. Commençons!',
    es: 'Voy a tener una conversación natural contigo usando frases de tu vocabulario. ¡Empecemos!',
    it: 'Avrò una conversazione naturale con te usando frasi dal tuo vocabolario. Cominciamo!',
    pt: 'Vou ter uma conversa natural contigo usando frases do teu vocabulário. Vamos começar!',
    pl: 'Będę prowadzić naturalną rozmowę z tobą używając fraz z twojego słownictwa. Zacznijmy!',
    zh: '我会用你词汇表中的短语与你进行自然对话。让我们开始吧！',
    ja: 'あなたの語彙のフレーズを使って自然な会話をします。始めましょう！',
    ar: 'سأجري محادثة طبيعية معك باستخدام عبارات من مفرداتك. لنبدأ!',
  };

  return {
    role: 'assistant',
    messageType: 'greeting',
    content: {
      primary: {
        text: greeting.text,
        translation: greeting.translation
      },
      secondary: {
        text: explanations[languageProfile.native] || explanations['en']
      }
    },
    actions: {
      suggestions
    },
    metadata: {
      timestamp: Date.now()
    }
  };
}
