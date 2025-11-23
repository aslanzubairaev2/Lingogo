/**
 * Service for validating and automatically fixing phrase romanization issues
 */

import type { Phrase, LanguageCode } from '../types';

/**
 * Languages that require romanization
 */
export const LANGUAGES_REQUIRING_ROMANIZATION: LanguageCode[] = ['ar', 'hi', 'zh', 'ja'];

/**
 * Check if a language requires romanization
 */
export function requiresRomanization(languageCode: LanguageCode): boolean {
    return LANGUAGES_REQUIRING_ROMANIZATION.includes(languageCode);
}

/**
 * Validation result for a single phrase
 */
export interface PhraseValidationResult {
    isValid: boolean;
    issues: string[];
    needsRegeneration: boolean;
}

/**
 * Detect if text contains romanization in parentheses or brackets
 */
function hasEmbeddedRomanization(text: string): boolean {
    // Check for patterns like "текст (romanization)" or "текст [romanization]"
    const parenthesesPattern = /\([a-zA-Z0-9\s\u0300-\u036f'',.-]+\)/;
    const bracketsPattern = /\[[a-zA-Z0-9\s\u0300-\u036f'',.-]+\]/;

    return parenthesesPattern.test(text) || bracketsPattern.test(text);
}

/**
 * Check if text uses non-Latin script (requires romanization)
 */
function usesNonLatinScript(text: string): boolean {
    // Remove common punctuation and spaces
    const cleanText = text.replace(/[\s.,!?;:'"()[\]{}]/g, '');

    // Check if text contains non-Latin characters
    // This includes Arabic, Hindi, Chinese, Japanese, etc.
    const hasNonLatin = /[^\u0000-\u024F\u1E00-\u1EFF]/.test(cleanText);

    return hasNonLatin;
}

/**
 * Validate a single phrase
 */
export function validatePhrase(phrase: Phrase, learningLanguage: LanguageCode): PhraseValidationResult {
    const issues: string[] = [];
    let needsRegeneration = false;

    // Support both old (learning/native) and new (text.learning/text.native) structures
    const learningText = phrase.text?.learning || (phrase as any).learning || '';
    const hasRomanization = !!phrase.romanization?.learning;
    const languageNeedsRomanization = requiresRomanization(learningLanguage);
    const textUsesNonLatin = usesNonLatinScript(learningText);

    // Issue 1: Embedded romanization in text
    if (hasEmbeddedRomanization(learningText)) {
        issues.push('Romanization found embedded in phrase text (in parentheses or brackets)');
        needsRegeneration = true;
    }

    // Issue 2: Missing romanization for non-Latin text (but ONLY if no embedded romanization)
    if (languageNeedsRomanization && textUsesNonLatin && !hasRomanization && !hasEmbeddedRomanization(learningText)) {
        issues.push('Missing romanization for non-Latin script');
        needsRegeneration = true;
    }

    // Issue 3: Has romanization field but it's empty
    if (hasRomanization && !phrase.romanization!.learning.trim()) {
        issues.push('Romanization field exists but is empty');
        needsRegeneration = true;
    }

    return {
        isValid: issues.length === 0,
        issues,
        needsRegeneration
    };
}

/**
 * Validation summary for all phrases
 */
export interface ValidationSummary {
    totalPhrases: number;
    validPhrases: number;
    invalidPhrases: number;
    phrasesNeedingFix: Phrase[];
    issuesByType: {
        embeddedRomanization: number;
        missingRomanization: number;
        emptyRomanization: number;
    };
}

/**
 * Validate all phrases and return summary
 */
export function validateAllPhrases(phrases: Phrase[], learningLanguage: LanguageCode): ValidationSummary {
    const phrasesNeedingFix: Phrase[] = [];
    const issuesByType = {
        embeddedRomanization: 0,
        missingRomanization: 0,
        emptyRomanization: 0
    };

    for (const phrase of phrases) {
        const result = validatePhrase(phrase, learningLanguage);

        if (!result.isValid) {
            phrasesNeedingFix.push(phrase);

            // Count issues by type
            result.issues.forEach(issue => {
                if (issue.includes('embedded')) issuesByType.embeddedRomanization++;
                if (issue.includes('Missing')) issuesByType.missingRomanization++;
                if (issue.includes('empty')) issuesByType.emptyRomanization++;
            });
        }
    }

    return {
        totalPhrases: phrases.length,
        validPhrases: phrases.length - phrasesNeedingFix.length,
        invalidPhrases: phrasesNeedingFix.length,
        phrasesNeedingFix,
        issuesByType
    };
}

/**
 * Extract romanization from embedded text
 */
export function extractEmbeddedRomanization(text: string): { cleanText: string; romanization: string | null } {
    // Try parentheses pattern first
    const parenthesesPattern = /^(.+?)\s*\(([^)]+)\)\s*$/;
    const parenthesesMatch = text.match(parenthesesPattern);

    if (parenthesesMatch) {
        const cleanText = parenthesesMatch[1].trim();
        const romanization = parenthesesMatch[2].trim();

        // Validate romanization (should be Latin characters)
        if (/^[a-zA-Z0-9\s\u0300-\u036f'',.-]+$/.test(romanization)) {
            return { cleanText, romanization };
        }
    }

    // Try square brackets pattern
    const bracketsPattern = /^(.+?)\s*\[([^\]]+)\]\s*$/;
    const bracketsMatch = text.match(bracketsPattern);

    if (bracketsMatch) {
        const cleanText = bracketsMatch[1].trim();
        const romanization = bracketsMatch[2].trim();

        if (/^[a-zA-Z0-9\s\u0300-\u036f'',.-]+$/.test(romanization)) {
            return { cleanText, romanization };
        }
    }

    return { cleanText: text, romanization: null };
}

/**
 * Quick fix: Extract embedded romanization without AI
 */
export function quickFixPhrase(phrase: Phrase): Phrase | null {
    const learningText = phrase.text.learning;

    // Try to extract embedded romanization
    const { cleanText, romanization } = extractEmbeddedRomanization(learningText);

    // If we found and extracted romanization, create fixed phrase
    if (romanization && cleanText !== learningText) {
        return {
            ...phrase,
            text: {
                ...phrase.text,
                learning: cleanText
            },
            romanization: {
                learning: romanization
            }
        };
    }

    // Quick fix not possible, needs AI regeneration
    return null;
}

/**
 * Get a user-friendly report message
 */
export function getValidationReportMessage(summary: ValidationSummary): string {
    if (summary.invalidPhrases === 0) {
        return `✅ All ${summary.totalPhrases} phrases are valid!`;
    }

    let message = `Found ${summary.invalidPhrases} phrases with issues:\n`;

    if (summary.issuesByType.embeddedRomanization > 0) {
        message += `\n• ${summary.issuesByType.embeddedRomanization} phrases with embedded romanization in text`;
    }

    if (summary.issuesByType.missingRomanization > 0) {
        message += `\n• ${summary.issuesByType.missingRomanization} phrases missing romanization`;
    }

    if (summary.issuesByType.emptyRomanization > 0) {
        message += `\n• ${summary.issuesByType.emptyRomanization} phrases with empty romanization field`;
    }

    return message;
}
