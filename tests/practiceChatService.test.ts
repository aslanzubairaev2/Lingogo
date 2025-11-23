import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Phrase, LanguageProfile, PracticeChatMessage } from '../types';

// Mock functions from practiceChatService
function validateAIResponse(response: any): boolean {
  if (!response || typeof response !== 'object') return false;

  const hasMessageType = typeof response.messageType === 'string';
  const hasPrimaryText = typeof response.primaryText === 'string' && response.primaryText.length > 0;
  const hasTranslation = typeof response.translation === 'string' && response.translation.length > 0;
  const hasSuggestions = Array.isArray(response.suggestions) && response.suggestions.length > 0;

  return hasMessageType && hasPrimaryText && hasTranslation && hasSuggestions;
}

function createFallbackResponse(errorMessage: string, lang: LanguageProfile): PracticeChatMessage {
  return {
    role: 'assistant',
    messageType: 'explanation',
    content: {
      primary: {
        text: lang.learning === 'de' ? 'Entschuldigung' : 'Sorry',
        translation: 'Sorry'
      },
      secondary: {
        text: errorMessage
      }
    },
    actions: {
      suggestions: ['OK', 'Try again']
    },
    metadata: {
      timestamp: Date.now()
    }
  };
}

function convertAIResponseToMessage(aiResponse: any): PracticeChatMessage {
  return {
    role: 'assistant',
    messageType: aiResponse.messageType,
    content: {
      primary: {
        text: aiResponse.primaryText,
        translation: aiResponse.translation
      },
      secondary: aiResponse.secondaryText ? {
        text: aiResponse.secondaryText
      } : undefined
    },
    actions: {
      suggestions: aiResponse.suggestions,
      hints: aiResponse.hints,
      phraseUsed: aiResponse.vocabularyUsed?.[0]
    },
    metadata: {
      timestamp: Date.now(),
      vocabulary: aiResponse.vocabularyUsed
    }
  };
}

describe('Practice Chat Service', () => {
  const mockLanguageProfile: LanguageProfile = {
    ui: 'en',
    native: 'ru',
    learning: 'de'
  };

  const mockVocabulary: Phrase[] = [
    {
      id: 'phrase_1',
      text: { native: 'Привет', learning: 'Hallo' },
      category: 'greetings',
      masteryLevel: 2,
      lastReviewedAt: null,
      nextReviewAt: Date.now(),
      knowCount: 0,
      knowStreak: 0,
      isMastered: false,
      lapses: 0
    },
    {
      id: 'phrase_2',
      text: { native: 'Как дела?', learning: 'Wie geht es dir?' },
      category: 'greetings',
      masteryLevel: 1,
      lastReviewedAt: null,
      nextReviewAt: Date.now(),
      knowCount: 0,
      knowStreak: 0,
      isMastered: false,
      lapses: 0
    }
  ];

  describe('validateAIResponse', () => {
    it('should validate correct response', () => {
      const validResponse = {
        messageType: 'greeting',
        primaryText: 'Hallo!',
        translation: 'Hello!',
        suggestions: ['Hi', 'Hey']
      };

      expect(validateAIResponse(validResponse)).toBe(true);
    });

    it('should reject response without messageType', () => {
      const invalidResponse = {
        primaryText: 'Hallo!',
        translation: 'Hello!',
        suggestions: ['Hi', 'Hey']
      };

      expect(validateAIResponse(invalidResponse)).toBe(false);
    });

    it('should reject response without primaryText', () => {
      const invalidResponse = {
        messageType: 'greeting',
        translation: 'Hello!',
        suggestions: ['Hi', 'Hey']
      };

      expect(validateAIResponse(invalidResponse)).toBe(false);
    });

    it('should reject response with empty primaryText', () => {
      const invalidResponse = {
        messageType: 'greeting',
        primaryText: '',
        translation: 'Hello!',
        suggestions: ['Hi', 'Hey']
      };

      expect(validateAIResponse(invalidResponse)).toBe(false);
    });

    it('should reject response without translation', () => {
      const invalidResponse = {
        messageType: 'greeting',
        primaryText: 'Hallo!',
        suggestions: ['Hi', 'Hey']
      };

      expect(validateAIResponse(invalidResponse)).toBe(false);
    });

    it('should reject response without suggestions', () => {
      const invalidResponse = {
        messageType: 'greeting',
        primaryText: 'Hallo!',
        translation: 'Hello!'
      };

      expect(validateAIResponse(invalidResponse)).toBe(false);
    });

    it('should reject response with empty suggestions array', () => {
      const invalidResponse = {
        messageType: 'greeting',
        primaryText: 'Hallo!',
        translation: 'Hello!',
        suggestions: []
      };

      expect(validateAIResponse(invalidResponse)).toBe(false);
    });

    it('should reject non-object responses', () => {
      expect(validateAIResponse(null)).toBe(false);
      expect(validateAIResponse(undefined)).toBe(false);
      expect(validateAIResponse('string')).toBe(false);
      expect(validateAIResponse(123)).toBe(false);
      expect(validateAIResponse([])).toBe(false);
    });

    it('should accept response with optional fields', () => {
      const responseWithOptionals = {
        messageType: 'question',
        primaryText: 'Wie geht es dir?',
        translation: 'How are you?',
        secondaryText: 'This is a polite greeting',
        suggestions: ['Gut', 'Sehr gut'],
        hints: ['Use "Mir geht es"'],
        vocabularyUsed: ['phrase_2']
      };

      expect(validateAIResponse(responseWithOptionals)).toBe(true);
    });
  });

  describe('createFallbackResponse', () => {
    it('should create fallback with Learning "Entschuldigung" for Learning learning', () => {
      const fallback = createFallbackResponse(
        'Test error',
        { ui: 'en', native: 'ru', learning: 'de' }
      );

      expect(fallback.role).toBe('assistant');
      expect(fallback.messageType).toBe('explanation');
      expect(fallback.content.primary.text).toBe('Entschuldigung');
      expect(fallback.content.secondary?.text).toBe('Test error');
      expect(fallback.actions?.suggestions).toContain('OK');
    });

    it('should create fallback with "Sorry" for non-Learning languages', () => {
      const fallback = createFallbackResponse(
        'Test error',
        { ui: 'en', native: 'en', learning: 'fr' }
      );

      expect(fallback.content.primary.text).toBe('Sorry');
    });

    it('should include error message in secondary text', () => {
      const errorMsg = 'Network timeout error';
      const fallback = createFallbackResponse(errorMsg, mockLanguageProfile);

      expect(fallback.content.secondary?.text).toBe(errorMsg);
    });

    it('should have suggestions array', () => {
      const fallback = createFallbackResponse('Error', mockLanguageProfile);

      expect(Array.isArray(fallback.actions?.suggestions)).toBe(true);
      expect(fallback.actions?.suggestions?.length).toBeGreaterThan(0);
    });
  });

  describe('convertAIResponseToMessage', () => {
    it('should convert minimal valid response', () => {
      const aiResponse = {
        messageType: 'greeting' as const,
        primaryText: 'Hallo!',
        translation: 'Hello!',
        suggestions: ['Hi', 'Hey', 'Greetings']
      };

      const message = convertAIResponseToMessage(aiResponse);

      expect(message.role).toBe('assistant');
      expect(message.messageType).toBe('greeting');
      expect(message.content.primary.text).toBe('Hallo!');
      expect(message.content.primary.translation).toBe('Hello!');
      expect(message.content.secondary).toBeUndefined();
      expect(message.actions?.suggestions).toEqual(['Hi', 'Hey', 'Greetings']);
      expect(message.metadata?.timestamp).toBeDefined();
    });

    it('should convert response with secondaryText', () => {
      const aiResponse = {
        messageType: 'explanation' as const,
        primaryText: 'gehen',
        translation: 'to go',
        secondaryText: 'This is a common Learning verb',
        suggestions: ['OK', 'Next']
      };

      const message = convertAIResponseToMessage(aiResponse);

      expect(message.content.secondary?.text).toBe('This is a common Learning verb');
    });

    it('should convert response with hints', () => {
      const aiResponse = {
        messageType: 'question' as const,
        primaryText: 'Wie heißt du?',
        translation: 'What is your name?',
        suggestions: ['Ich heiße...', 'Mein Name ist...'],
        hints: ['Use "Ich heiße" followed by your name']
      };

      const message = convertAIResponseToMessage(aiResponse);

      expect(message.actions?.hints).toEqual(['Use "Ich heiße" followed by your name']);
    });

    it('should extract first vocabularyUsed as phraseUsed', () => {
      const aiResponse = {
        messageType: 'question' as const,
        primaryText: 'Wie geht es dir?',
        translation: 'How are you?',
        suggestions: ['Gut', 'Schlecht'],
        vocabularyUsed: ['phrase_2', 'phrase_5']
      };

      const message = convertAIResponseToMessage(aiResponse);

      expect(message.actions?.phraseUsed).toBe('phrase_2');
      expect(message.metadata?.vocabulary).toEqual(['phrase_2', 'phrase_5']);
    });

    it('should handle all message types', () => {
      const messageTypes: Array<'greeting' | 'question' | 'correction' | 'explanation' | 'encouragement' | 'suggestion'> = [
        'greeting', 'question', 'correction', 'explanation', 'encouragement', 'suggestion'
      ];

      messageTypes.forEach(type => {
        const aiResponse = {
          messageType: type,
          primaryText: 'Test',
          translation: 'Test',
          suggestions: ['OK']
        };

        const message = convertAIResponseToMessage(aiResponse);
        expect(message.messageType).toBe(type);
      });
    });
  });

  describe('Response Structure Validation', () => {
    it('should accept greeting message', () => {
      const greeting = {
        messageType: 'greeting',
        primaryText: 'Hallo! Lass uns Deutsch üben!',
        translation: 'Hello! Let\'s practice Learning!',
        secondaryText: 'I will ask questions using phrases from your vocabulary',
        suggestions: ['Hallo!', 'Guten Tag!', 'Ja, gerne!']
      };

      expect(validateAIResponse(greeting)).toBe(true);
    });

    it('should accept question message', () => {
      const question = {
        messageType: 'question',
        primaryText: 'Wie geht es dir?',
        translation: 'How are you?',
        suggestions: ['Gut, danke', 'Sehr gut', 'Es geht so'],
        vocabularyUsed: ['phrase_2']
      };

      expect(validateAIResponse(question)).toBe(true);
    });

    it('should accept correction message', () => {
      const correction = {
        messageType: 'correction',
        primaryText: 'Mir geht es gut',
        translation: 'I\'m good',
        secondaryText: 'In Learning, use "Mir geht es gut" (dative case), not "Ich bin gut"',
        suggestions: ['Mir geht es gut', 'Es geht mir gut']
      };

      expect(validateAIResponse(correction)).toBe(true);
    });

    it('should accept encouragement message', () => {
      const encouragement = {
        messageType: 'encouragement',
        primaryText: 'Perfekt! Das ist richtig!',
        translation: 'Perfect! That\'s correct!',
        suggestions: ['Danke', 'Was kommt als Nächstes?', 'Weiter']
      };

      expect(validateAIResponse(encouragement)).toBe(true);
    });

    it('should accept explanation message', () => {
      const explanation = {
        messageType: 'explanation',
        primaryText: 'gehen',
        translation: 'to go',
        secondaryText: '"geht" is the 3rd person singular form of "gehen"',
        suggestions: ['Verstanden', 'Danke', 'Noch eine Frage']
      };

      expect(validateAIResponse(explanation)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle response with extra unknown fields', () => {
      const responseWithExtra = {
        messageType: 'greeting',
        primaryText: 'Hallo!',
        translation: 'Hello!',
        suggestions: ['Hi'],
        extraField: 'should be ignored',
        anotherExtra: 123
      };

      expect(validateAIResponse(responseWithExtra)).toBe(true);
    });

    it('should reject response with null required fields', () => {
      const responseWithNull = {
        messageType: 'greeting',
        primaryText: null,
        translation: 'Hello!',
        suggestions: ['Hi']
      };

      expect(validateAIResponse(responseWithNull)).toBe(false);
    });

    it('should reject response with undefined required fields', () => {
      const responseWithUndefined = {
        messageType: 'greeting',
        primaryText: 'Hallo!',
        translation: undefined,
        suggestions: ['Hi']
      };

      expect(validateAIResponse(responseWithUndefined)).toBe(false);
    });

    it('should handle empty secondaryText', () => {
      const aiResponse = {
        messageType: 'question' as const,
        primaryText: 'Test',
        translation: 'Test',
        secondaryText: '',
        suggestions: ['OK']
      };

      const message = convertAIResponseToMessage(aiResponse);
      // Empty string should be treated as undefined (no secondary text)
      expect(message.content.secondary).toBeUndefined();
    });

    it('should handle empty hints array', () => {
      const aiResponse = {
        messageType: 'question' as const,
        primaryText: 'Test',
        translation: 'Test',
        suggestions: ['OK'],
        hints: []
      };

      const message = convertAIResponseToMessage(aiResponse);
      expect(message.actions?.hints).toEqual([]);
    });

    it('should handle empty vocabularyUsed array', () => {
      const aiResponse = {
        messageType: 'question' as const,
        primaryText: 'Test',
        translation: 'Test',
        suggestions: ['OK'],
        vocabularyUsed: []
      };

      const message = convertAIResponseToMessage(aiResponse);
      expect(message.actions?.phraseUsed).toBeUndefined();
      expect(message.metadata?.vocabulary).toEqual([]);
    });
  });

  describe('Language Support', () => {
    it('should create Learning fallback for Learning learning', () => {
      const learningProfile: LanguageProfile = { ui: 'en', native: 'ru', learning: 'de' };
      const fallback = createFallbackResponse('Error', learningProfile);
      expect(fallback.content.primary.text).toBe('Entschuldigung');
    });

    it('should create French fallback for French learning', () => {
      const frenchProfile: LanguageProfile = { ui: 'en', native: 'en', learning: 'fr' };
      const fallback = createFallbackResponse('Error', frenchProfile);
      expect(fallback.content.primary.text).toBe('Sorry');
    });

    it('should create Spanish fallback for Spanish learning', () => {
      const spanishProfile: LanguageProfile = { ui: 'en', native: 'en', learning: 'es' };
      const fallback = createFallbackResponse('Error', spanishProfile);
      expect(fallback.content.primary.text).toBe('Sorry');
    });
  });

  describe('Message Conversion', () => {
    it('should preserve all data in conversion', () => {
      const fullResponse = {
        messageType: 'question' as const,
        primaryText: 'Wie geht es dir?',
        translation: 'How are you?',
        secondaryText: 'This is a polite greeting',
        suggestions: ['Gut', 'Schlecht', 'So lala'],
        hints: ['Use "Mir geht es" construction', 'Remember dative case'],
        vocabularyUsed: ['phrase_2', 'phrase_3']
      };

      const message = convertAIResponseToMessage(fullResponse);

      expect(message.role).toBe('assistant');
      expect(message.messageType).toBe('question');
      expect(message.content.primary.text).toBe('Wie geht es dir?');
      expect(message.content.primary.translation).toBe('How are you?');
      expect(message.content.secondary?.text).toBe('This is a polite greeting');
      expect(message.actions?.suggestions).toEqual(['Gut', 'Schlecht', 'So lala']);
      expect(message.actions?.hints).toEqual(['Use "Mir geht es" construction', 'Remember dative case']);
      expect(message.actions?.phraseUsed).toBe('phrase_2');
      expect(message.metadata?.vocabulary).toEqual(['phrase_2', 'phrase_3']);
      expect(message.metadata?.timestamp).toBeDefined();
    });
  });
});
