import React from 'react';
import type { LanguageCode } from '../types.ts';
import { LANGUAGE_OPTIONS, getLanguageName } from '../src/i18n/languageMeta.ts';
import { useTranslation } from '../src/hooks/useTranslation.ts';

interface DevLanguageSelectorProps {
  visible: boolean;
  selectedLanguage: LanguageCode;
  onSelect: (lang: LanguageCode) => void;
  onUseSystem: () => void;
}

const DevLanguageSelector: React.FC<DevLanguageSelectorProps> = ({ visible, selectedLanguage, onSelect, onUseSystem }) => {
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl flex flex-col max-h-[min(92vh,720px)]">
        <div className="border-b border-slate-800 px-6 py-5 space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
            {t('devLanguageSelector.heading')}
          </p>
          <h1 className="text-2xl font-semibold text-slate-100">
            {t('devLanguageSelector.title')}
          </h1>
          <p className="text-sm text-slate-400">
            {t('devLanguageSelector.subtitle')}
          </p>
        </div>
        <div className="h-full flex-1 px-6 py-5 space-y-6 overflow-auto">
          <div className="h-full overflow-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-20">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => onSelect(lang.code)}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${lang.code === selectedLanguage
                    ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100 shadow-cyan-500/20'
                    : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                >
                  <p className="font-semibold text-base">{getLanguageName(lang.code)}</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{lang.code}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900/80">
          <p className="text-xs text-slate-500">
            {t('devLanguageSelector.note')}
          </p>
          <button
            type="button"
            onClick={onUseSystem}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:border-cyan-500 hover:text-cyan-200 transition-colors"
          >
            {t('devLanguageSelector.useSystem')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DevLanguageSelector;
