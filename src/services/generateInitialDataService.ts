import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

const model = 'gemini-3-flash-preview';
// const model = 'gemini-2.5-flash-lite-preview-09-2025';
// const model = "gemini-2.5-flash";

// Language code to full name mapping
const LANGUAGE_NAMES = {
  en: "English",
  de: "German",
  ru: "Russian",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  pl: "Polish",
  zh: "Chinese",
  ja: "Japanese",
  ar: "Arabic",
  hi: "Hindi",
  mr: "Marathi",
};

// Non-European languages that need transcription
const NEEDS_TRANSCRIPTION = ["zh", "ja", "ar", "ru", "hi", "mr"];

/**
 * Validate transcription field
 * @param {string} transcription - Transcription string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidTranscription(transcription: string): boolean {
  if (!transcription || typeof transcription !== "string") {
    return false;
  }

  // Check for any type of brackets
  const hasBrackets = /[\(\)\[\]\{\}\【\】\《\》\<\>]/.test(transcription);
  if (hasBrackets) {
    return false;
  }

  // Check that it's not empty after trimming
  if (transcription.trim().length === 0) {
    return false;
  }

  return true;
}

/**
 * Detect if text uses primarily Latin alphabet
 * @param {string} text - Text to check
 * @returns {boolean} - True if text is primarily Latin alphabet
 */
function isLatinScript(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  // Remove spaces, punctuation, and numbers
  const cleanText = text.replace(/[\s\d\p{P}]/gu, "");
  if (cleanText.length === 0) return false; // Empty or only punctuation = indeterminate

  // Count Latin characters (including accented letters)
  const latinChars = (cleanText.match(/[\p{Script=Latin}]/gu) || []).length;
  const totalChars = cleanText.length;

  // Consider it Latin if more than 80% are Latin characters
  return latinChars / totalChars > 0.8;
}

/**
 * Validate that learning field is NOT just transcription
 * @param {string} learningText - Learning text to validate
 * @param {string} transcription - Transcription text
 * @param {string} learningLanguageCode - Language code (e.g., 'hi', 'ar')
 * @returns {boolean} - True if learning field appears valid
 */
function isValidLearningField(learningText: string, transcription: string, learningLanguageCode: string): boolean {
  if (!learningText || typeof learningText !== "string") return false;

  // For languages that need transcription (non-Latin scripts)
  if (NEEDS_TRANSCRIPTION.includes(learningLanguageCode)) {
    // Learning field should NOT be in Latin script for these languages
    if (isLatinScript(learningText)) {
      return false; // This is likely transcription, not actual translation
    }
  }

  // Learning and transcription should not be identical (except for Latin-script languages)
  if (transcription && learningText.toLowerCase() === transcription.toLowerCase()) {
    if (NEEDS_TRANSCRIPTION.includes(learningLanguageCode)) {
      return false; // They should be different for non-Latin languages
    }
  }

  return true;
}

/**
 * Validate translation object
 * @param {Object} translation - Translation object from AI
 * @param {boolean} needsTranscription - Whether transcription is required
 * @param {string} learningLanguage - Learning language name for error messages
 * @param {string} learningLanguageCode - Learning language code (e.g., 'hi', 'ar')
 * @returns {Object} - Object with isValid boolean and error message if invalid
 */
function validateTranslation(translation: any, needsTranscription: boolean, learningLanguage: string, learningLanguageCode: string): { isValid: boolean, error?: string } {
  // Check required fields exist
  if (!translation.native || !translation.learning) {
    return {
      isValid: false,
      error: "Missing required fields 'native' or 'learning'",
    };
  }

  // Check transcription if required
  if (needsTranscription) {
    if (!translation.transcription) {
      return {
        isValid: false,
        error: `Missing required transcription for ${learningLanguage}`,
      };
    }

    if (!isValidTranscription(translation.transcription)) {
      return {
        isValid: false,
        error: `Invalid transcription format: "${translation.transcription}". Transcription must not contain brackets and must be non-empty.`,
      };
    }

    // Validate that learning field is not just transcription
    if (!isValidLearningField(translation.learning, translation.transcription, learningLanguageCode)) {
      return {
        isValid: false,
        error: `Invalid learning field: "${translation.learning}". For ${learningLanguage}, the learning field must use ${learningLanguage} script, not Latin transcription. Transcription should go in the separate "transcription" field.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Generate translated initial data for a specific language pair
 * @param {string} nativeLanguage - Native language code (e.g., 'ru')
 * @param {string} learningLanguage - Learning language code (e.g., 'de')
 * @returns {Promise<{categories: Array, phrases: Array}>}
 */
export async function generateInitialData(nativeLanguage: string, learningLanguage: string) {
  try {
    console.log(
      `Generating initial data for ${nativeLanguage} → ${learningLanguage}`
    );

    // Load English template
    const templatePath = path.join(
      __dirname,
      "../../data/initial-data-template.json"
    );
    const templateData = JSON.parse(fs.readFileSync(templatePath, "utf8"));

    const nativeLangName = LANGUAGE_NAMES[nativeLanguage] || nativeLanguage;
    const learningLangName =
      LANGUAGE_NAMES[learningLanguage] || learningLanguage;

    // Translate categories
    const translatedCategories = await translateCategories(
      templateData.categories,
      nativeLangName
    );

    // Translate phrases in batches
    const translatedPhrases = await translatePhrases(
      templateData.phrases,
      nativeLangName,
      learningLangName,
      NEEDS_TRANSCRIPTION.includes(learningLanguage),
      learningLanguage,
      nativeLanguage // Pass native language code for batch size calculation
    );

    console.log(
      `Successfully generated ${translatedCategories.length} categories and ${translatedPhrases.length} phrases`
    );

    return {
      categories: translatedCategories,
      phrases: translatedPhrases,
    };
  } catch (error) {
    console.error("Error generating initial data:", error);
    throw error;
  }
}

/**
 * Translate category names using Gemini AI
 * @param {Array} categories - Array of category objects from template
 * @param {string} targetLanguage - Target language name
 * @returns {Promise<Array>}
 */
async function translateCategories(categories, targetLanguage) {
  const categoryNames = categories.map((c) => c.name).join("\n");

  const prompt = `Translate the following category names to ${targetLanguage}.
Return ONLY a JSON array of translated names in the exact same order, without any additional text or formatting.

Category names:
${categoryNames}

Example output format: ["Translated Name 1", "Translated Name 2", ...]`;

  const result = await genAI.models.generateContent({ model, contents: prompt });
  const response = result.text.trim();

  // Parse JSON response
  const translatedNames = JSON.parse(
    response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()
  );

  // Map back to category objects
  return categories.map((cat, index) => ({
    id: cat.id,
    name: translatedNames[index],
    color: cat.color,
    isFoundational: cat.isFoundational,
  }));
}

/**
 * Translate phrases using Gemini AI in batches
 * @param {Array} phrases - Array of phrase objects from template
 * @param {string} nativeLanguage - Native language name
 * @param {string} learningLanguage - Learning language name
 * @param {boolean} needsTranscription - Whether to generate transcription
 * @param {string} learningLanguageCode - Learning language code (e.g., 'hi', 'ar')
 * @returns {Promise<Array>}
 */
async function translatePhrases(
  phrases,
  nativeLanguage,
  learningLanguage,
  needsTranscription,
  learningLanguageCode,
  nativeLanguageCode
) {
  // Use smaller batch size if EITHER language uses non-Latin script
  const nativeNeedsSmallBatch = NEEDS_TRANSCRIPTION.includes(nativeLanguageCode);
  const learningNeedsSmallBatch = NEEDS_TRANSCRIPTION.includes(learningLanguageCode);
  const batchSize = (nativeNeedsSmallBatch || learningNeedsSmallBatch) ? 10 : 20;
  console.log(`Using batch size: ${batchSize} (native: ${nativeLanguageCode}, learning: ${learningLanguageCode})`);
  const translatedPhrases = [];

  for (let i = 0; i < phrases.length; i += batchSize) {
    const batch = phrases.slice(i, i + batchSize);
    console.log(
      `Translating phrases batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        phrases.length / batchSize
      )}`
    );

    const phrasesText = batch
      .map((p, idx) => `${idx + 1}. ${p.english}`)
      .join("\n");

    const prompt = `You are a professional translator. Translate the following English phrases to both ${nativeLanguage} and ${learningLanguage}.

CRITICAL: You must provide THREE separate pieces of information for EACH phrase:
1. "native": The translation in ${nativeLanguage} (in ${nativeLanguage} script)
2. "learning": The translation in ${learningLanguage} (in ${learningLanguage} script)
3. ${needsTranscription ? `"transcription": Latin alphabet romanization of the ${learningLanguage} word ONLY` : 'No transcription needed'}

${needsTranscription ? `
IMPORTANT EXAMPLES for ${learningLanguage} (${nativeLanguage}):
If English word is "Hello":
- "native": "${nativeLanguage} word in ${nativeLanguage} script" (e.g., "नमस्ते" for Hindi)
- "learning": "${learningLanguage} word in ${learningLanguage} script" (e.g., "Hola" for Spanish, "नमस्ते" for Hindi)
- "transcription": "Latin alphabet version of learning word" (e.g., "namaste" for Hindi word, NOT for Spanish!)

KEY RULES:
- "learning" field = ALWAYS in the native script of ${learningLanguage}
- "transcription" field = ONLY Latin alphabet romanization of "learning" field
- If ${learningLanguage} uses Latin alphabet (like Spanish, French, English), transcription might be same as learning
- If ${learningLanguage} uses non-Latin script (like Hindi, Arabic, Chinese), transcription must be romanized version
` : ''}

Return ONLY a JSON array of objects with this exact structure:
[
  {
    "native": "${nativeLanguage} translation in ${nativeLanguage} script",
    "learning": "${learningLanguage} translation in ${learningLanguage} script"${needsTranscription
        ? ',\n    "transcription": "romanized version of learning field using ONLY Latin alphabet"'
        : ""
      }
  }
]

Phrases to translate:
${phrasesText}

MANDATORY REQUIREMENTS:
- Return ONLY valid JSON, no additional text or explanations
- Maintain the exact same order as the input phrases
- Ensure translations are accurate and natural in both languages
- Each object MUST have these fields: "native", "learning"${needsTranscription ? ', and "transcription"' : ""
      }
- "native" must be in ${nativeLanguage} using ${nativeLanguage} script
- "learning" must be in ${learningLanguage} using ${learningLanguage} script
${needsTranscription
        ? `
TRANSCRIPTION RULES (MANDATORY - STRICT):
- Transcription is REQUIRED for every phrase - never omit it
- Transcription must use ONLY Latin alphabet characters (a-z, A-Z, spaces)
- Transcription is romanization of "learning" field, not "native" field
- ABSOLUTELY NO BRACKETS OR PARENTHESES: no (), no [], no {}, no 【】, no <>, no other brackets
- ABSOLUTELY NO EXPLANATIONS OR NOTES in transcription field
- DO NOT place transcription near or inside the translation text
- Transcription goes ONLY in the "transcription" field, nowhere else
- Keep transcription simple - ONLY the phonetic pronunciation
- Examples of CORRECT format:
  * "learning": "नमस्ते", "transcription": "namaste"
  * "learning": "वह", "transcription": "vah"
  * "learning": "こんにちは", "transcription": "konnichiwa"
  * "learning": "привет", "transcription": "privet"
- Examples of WRONG format (DO NOT DO THIS):
  * "transcription": "vah (purush)" ❌ NO BRACKETS!
  * "transcription": "vah (masculine)" ❌ NO EXPLANATIONS!
  * "transcription": "namaste (hello)" ❌ NO NOTES!
  * "learning": "namaste" ❌ (should be in ${learningLanguage} script!)
  * "transcription": "(namaste)" ❌ (no brackets allowed!)
  * "transcription": "नमस्ते" ❌ (must be Latin alphabet only!)

IMPORTANT: If you add brackets or explanations in transcription, the translation will be REJECTED.
Just provide the simple romanization, nothing more.
`
        : ""
      }`;

    // Retry logic for AI generation with JSON parsing
    const MAX_RETRIES = 3;
    let translations = null;
    let lastError = null;

    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        const result = await genAI.models.generateContent({ model, contents: prompt });
        const response = result.text.trim();

        // Clean up the response
        let cleanedResponse = response
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();

        // Try to parse as-is first
        try {
          translations = JSON.parse(cleanedResponse);
          break;
        } catch (firstParseError) {
          // If parsing failed, try to repair common JSON issues
          console.log(`First parse failed, attempting JSON repair for batch ${Math.floor(i / batchSize) + 1}...`);

          // Try to find the last complete object and close the array
          // Look for pattern: "}" followed by any whitespace/newlines at end
          const lastCompleteObjectMatch = cleanedResponse.match(/\}[\s\n]*(?:\][\s\n]*)?$/);
          if (!lastCompleteObjectMatch) {
            // Try to close the JSON properly
            // Find the last } and add ]
            const lastBraceIndex = cleanedResponse.lastIndexOf('}');
            if (lastBraceIndex > 0) {
              cleanedResponse = cleanedResponse.substring(0, lastBraceIndex + 1) + '\n]';
            }
          }

          // If response ends with incomplete string, try to close it
          if (!cleanedResponse.endsWith(']')) {
            // Check if we're in the middle of a string value
            const quoteCount = (cleanedResponse.match(/"/g) || []).length;
            if (quoteCount % 2 !== 0) {
              // Odd number of quotes - we have an unclosed string
              cleanedResponse += '"';
            }
            // Try to close any open objects/arrays
            if (!cleanedResponse.endsWith('}')) {
              cleanedResponse += '}';
            }
            cleanedResponse += ']';
          }

          translations = JSON.parse(cleanedResponse);
          console.log(`JSON repair successful for batch ${Math.floor(i / batchSize) + 1}`);
          break;
        }
      } catch (parseError) {
        lastError = parseError;
        console.warn(
          `JSON parse attempt ${retry + 1}/${MAX_RETRIES} failed for batch ${Math.floor(i / batchSize) + 1}: ${parseError.message}`
        );
        if (retry < MAX_RETRIES - 1) {
          // Wait before retrying with new AI request
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    if (!translations) {
      throw new Error(
        `Failed to parse AI response after ${MAX_RETRIES} attempts: ${lastError?.message}`
      );
    }

    // Validate all translations in the batch (log warnings, don't throw)
    translations.forEach((translation, idx) => {
      if (!translation || idx >= batch.length) return;
      const validation = validateTranslation(
        translation,
        needsTranscription,
        learningLanguage,
        learningLanguageCode
      );
      if (!validation.isValid) {
        console.warn(
          `Validation warning for phrase #${idx + 1} ("${batch[idx].english}"): ${validation.error}`
        );
      }
    });

    // Check if we got fewer translations than expected
    if (translations.length < batch.length) {
      console.warn(
        `Warning: Got ${translations.length} translations for batch of ${batch.length} phrases. Using only available translations.`
      );
    }

    // Map back to phrase objects with category and context (only for available translations)
    const batchTranslated = [];
    for (let idx = 0; idx < Math.min(batch.length, translations.length); idx++) {
      if (translations[idx] && translations[idx].native && translations[idx].learning) {
        batchTranslated.push({
          category: batch[idx].category,
          native: translations[idx].native,
          learning: translations[idx].learning,
          transcription: translations[idx].transcription || undefined,
          context: batch[idx].context,
        });
      }
    }

    translatedPhrases.push(...batchTranslated);

    // Small delay to avoid rate limiting
    if (i + batchSize < phrases.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return translatedPhrases;
}

/**
 * Generate and save initial data to a file (for caching/debugging)
 * @param {string} nativeLanguage - Native language code
 * @param {string} learningLanguage - Learning language code
 * @param {string} outputPath - Path to save the generated data
 * @returns {Promise<void>}
 */
async function generateAndSaveInitialData(
  nativeLanguage,
  learningLanguage,
  outputPath
) {
  const data = await generateInitialData(nativeLanguage, learningLanguage);

  const output = {
    metadata: {
      nativeLanguage,
      learningLanguage,
      generatedAt: new Date().toISOString(),
      version: "1.0.0",
    },
    data: {
      categories: data.categories,
      phrases: data.phrases,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Initial data saved to ${outputPath}`);
}
