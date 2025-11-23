import type { LanguageProfile } from '../types';
import { getLanguageName } from './languageNames';

/**
 * Helper class for building language-aware prompts
 * Replaces hardcoded "Native" and "Learning" with dynamic language names
 */
export class PromptLanguageHelper {
  public readonly nativeName: string;
  public readonly learningName: string;
  public readonly native: string;
  public readonly learning: string;

  constructor(languageProfile: LanguageProfile) {
    this.native = languageProfile.native;
    this.learning = languageProfile.learning;
    this.nativeName = getLanguageName(languageProfile.native);
    this.learningName = getLanguageName(languageProfile.learning);
  }

  /**
   * Replace placeholders in a prompt template
   * Supports: {native}, {learning}, {NATIVE}, {LEARNING}
   */
  public format(template: string): string {
    return template
      .replace(/\{native\}/g, this.nativeName)
      .replace(/\{learning\}/g, this.learningName)
      .replace(/\{NATIVE\}/g, this.nativeName.toUpperCase())
      .replace(/\{LEARNING\}/g, this.learningName.toUpperCase());
  }

  /**
   * Get schema description for native language field
   */
  public getNativeFieldDescription(label: string = 'phrase'): string {
    return `The ${label} in ${this.nativeName}.`;
  }

  /**
   * Get schema description for learning language field
   */
  public getLearningFieldDescription(label: string = 'phrase'): string {
    return `The ${label} in ${this.learningName}.`;
  }

  /**
   * Get translation direction description (e.g., "from Native to Learning")
   */
  public getTranslationDirection(): string {
    return `from ${this.nativeName} to ${this.learningName}`;
  }

  /**
   * Get reverse translation direction
   */
  public getReverseTranslationDirection(): string {
    return `from ${this.learningName} to ${this.nativeName}`;
  }
}

/**
 * Create a prompt language helper from language profile
 */
export function createPromptHelper(languageProfile: LanguageProfile): PromptLanguageHelper {
  return new PromptLanguageHelper(languageProfile);
}
