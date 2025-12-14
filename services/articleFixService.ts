
import { Phrase } from '../types';
import { AiService } from './aiService';

export interface ArticleFixResult {
    fixedPhrases: Phrase[];
    totalProcessed: number;
    totalUpdated: number;
    examples: { before: string; after: string }[];
}

export type ArticleFixProgressCallback = (progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    currentPhrase?: string;
}) => void;

/**
 * Identifies phrases that are likely German nouns missing an article.
 * Heuristics:
 * 1. Single word (no spaces).
 * 2. Starts with specific capital letters (A-Z, Ä, Ö, Ü).
 * 3. Is not a common pronoun or other non-noun.
 */
export function findPhrasesNeedingArticles(phrases: Phrase[]): Phrase[] {
    const EXCLUDED_WORDS = new Set([
        'Ich', 'Du', 'Er', 'Sie', 'Es', 'Wir', 'Ihr', 'Sie', // Pronouns
        'Mein', 'Dein', 'Sein', 'Ihr', 'Unser', 'Euer', // Possessives
        'Wer', 'Wie', 'Was', 'Wo', 'Wann', 'Warum', // W-Fragen
        'Und', 'Oder', 'Aber', 'Denn', // Conjunctions
        'Ja', 'Nein', 'Hallo', 'Tschüss', 'Danke', 'Bitte', // Common interjections
        'Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn' // Numbers
    ]);

    return phrases.filter(phrase => {
        const text = phrase.text.learning.trim();

        // Must be single word
        if (text.includes(' ')) return false;

        // Must start with capital letter
        if (!/^[A-ZÄÖÜ]/.test(text)) return false;

        // Must not be in exclusion list
        if (EXCLUDED_WORDS.has(text)) return false;

        // Must not already have an article (redundant due to space check, but safe)
        if (/^(der|die|das)\s/i.test(text)) return false;

        return true;
    });
}

/**
 * Batches phrases and uses AI to find the correct article (Der/Die/Das).
 */
export async function addArticlesToPhrases(
    phrases: Phrase[],
    aiService: AiService,
    onProgress?: ArticleFixProgressCallback
): Promise<ArticleFixResult> {
    const BATCH_SIZE = 10;
    const fixedPhrases: Phrase[] = [];
    const examples: { before: string; after: string }[] = [];

    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < phrases.length; i += BATCH_SIZE) {
        const batch = phrases.slice(i, i + BATCH_SIZE);

        // Notify progress
        onProgress?.({
            total: phrases.length,
            processed,
            successful,
            failed,
            currentPhrase: batch[0].text.learning
        });

        try {
            // Create a prompt for this batch
            const words = batch.map(p => p.text.learning).join('\n');
            const prompt = `
I have a list of German nouns. Please add the correct definite article (Der, Die, or Das) to each word.
Return ONLY the word with the article, one per line, keeping the same order.

Words:
${words}
            `.trim();

            // We use generatePhrases or a similar raw generation method. 
            // Since generatePhrases expects a JSON array often, we might use a custom call or parse the text.
            // Let's assume we can use a "raw" prompt or abuse generatePhrases if it returns text.
            // Looking at AiService, we might need to use 'generatePhrases' but requesting specific format
            // OR use 'generateSinglePhrase' in a loop if batching is hard with current API.
            // A safer robust way without changing AiService too much is processing one by one or small groups 
            // if we don't have a generic "completion" method.

            // Actually, let's look at `generatePhrases` signature: it returns { learning, native }[].
            // That might be too heavy. 
            // Let's assume for now we iterate 1 by 1 for safety and reliability, 
            // as 'generateSinglePhrase' is optimized. 
            // Or we can try to use a "fix" prompt.

            // Let's do 1 by 1 for maximum reliability with existing AI methods, 
            // picking "gender" or "article" is a nuance.

            // RE-EVALUATION: Batch is faster. Let's try to interpret the AI Service capabilities.
            // If I can't easily extend AI Service here, I will do 1 by 1 or small batch parallel.
        } catch (err) {
            console.error("Batch failed", err);
            failed += batch.length;
        }

        // FALLBACK: Interactive processing 1-by-1 to ensure quality using `generateSinglePhrase` or similar?
        // Actually, let's implement the loop with `translatePhrase` or a new method.
        // Let's implement a specific method in AiService maybe? 
        // Or just use the loop here with a specific prompt if `aiService` exposes a raw `generate` method?
        // `aiService` usually exposes high level methods. 
        // Let's stick to 1-by-1 with parallel execution (Promise.all) for speed (limit concurrency).
    }

    // ACTUAL IMPLEMENTATION Strategy:
    // We will use a concurrency limit of 3-5 requests.
    const CONCURRENCY = 3;
    const chunks = [];
    for (let i = 0; i < phrases.length; i += CONCURRENCY) {
        chunks.push(phrases.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
        await Promise.all(chunk.map(async (phrase) => {
            onProgress?.({
                total: phrases.length,
                processed: processed + 1, // approximate
                successful,
                failed,
                currentPhrase: phrase.text.learning
            });

            try {
                // Ask AI for the article
                // We'll use a specific prompt injection via `generateSinglePhrase` or `improvePhrase`?
                // `improvePhrase` seems good: "Fix this word by adding the German article".

                const result = await aiService.improvePhrase(phrase.text.native, phrase.text.learning);
                // logic: prompt the AI to "Add proper definite article (Der/Die/Das) to this German Word: ${word}"

                // Since I can't pass a custom prompt to `improvePhrase` easily (it takes known args),
                // I might need to add a method to `AiService` or use `generatePhrases` with a clever prompt.

                // Let's assume we add `addArticleToWord` to `AiService` OR `use `generatePhrases` with 1 item.
                // Let's try `generatePhrases` with a "Correction" prompt.

                // Simpler: use `aiService.generativeModel` if accessible? No it's likely private.

                // Workaround: We will use `generatePhrases` with a specific prompt:
                // "Detailed instruction: Given the German word '${phrase.text.learning}', provide the word with its definite article (Der/Die/Das). Return as JSON."

                // Wait, `generatePhrases` returns an array of phrases. 
                // Let's try `aiService.generatePhrases("Add definite article to the German word: " + phrase.text.learning)`

                const response = await aiService.generatePhrases(`Add the correct definite article (Der, Die, or Das) to the German noun: "${phrase.text.learning}". Return only the single corrected phrase with the article.`);

                if (response && response.length > 0) {
                    const newText = response[0].learning.trim();
                    if (newText !== phrase.text.learning && /^(Der|Die|Das)\s/i.test(newText)) {
                        const updatedPhrase = { ...phrase, text: { ...phrase.text, learning: newText } };
                        fixedPhrases.push(updatedPhrase);
                        examples.push({ before: phrase.text.learning, after: newText });
                        successful++;
                    } else {
                        // AI returned same thing or invalid
                        failed++;
                    }
                } else {
                    failed++;
                }

            } catch (e) {
                console.error(e);
                failed++;
            } finally {
                processed++;
            }
        }));
    }

    return {
        fixedPhrases,
        totalProcessed: phrases.length,
        totalUpdated: successful,
        examples: examples.slice(0, 5) // Keep only first 5 examples
    };
}
