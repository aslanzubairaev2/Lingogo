import { describe, it, expect } from 'vitest';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n/config';

describe('Learning Assistant Localization', () => {
  it('should have dontKnow translation in English', () => {
    i18n.changeLanguage('en');
    const translation = i18n.t('modals.learningAssistant.dontKnow');
    expect(translation).toBe("I don't know");
  });

  it('should have dontKnow translation in Learning', () => {
    i18n.changeLanguage('de');
    const translation = i18n.t('modals.learningAssistant.dontKnow');
    expect(translation).toBe("Ich weiß nicht");
  });

  it('should have dontKnow translation in Spanish', () => {
    i18n.changeLanguage('es');
    const translation = i18n.t('modals.learningAssistant.dontKnow');
    expect(translation).toBe("No lo sé");
  });

  it('should have dontKnow translation in Native', () => {
    i18n.changeLanguage('ru');
    const translation = i18n.t('modals.learningAssistant.dontKnow');
    expect(translation).toBe("Не знаю");
  });
});