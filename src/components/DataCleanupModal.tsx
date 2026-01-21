import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cleanupAllPhrases, generateCleanupReport } from '../../scripts/cleanupPhraseRomanization.ts';
import type { Phrase } from '../types.ts';
import Spinner from './Spinner';

interface DataCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  allPhrases: Phrase[];
  onUpdatePhrases: (phrases: Phrase[]) => Promise<void>;
}

const DataCleanupModal: React.FC<DataCleanupModalProps> = ({ isOpen, onClose, allPhrases, onUpdatePhrases }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'initial' | 'analyzing' | 'preview' | 'processing' | 'complete'>('initial');
  const [cleanupResult, setCleanupResult] = useState<ReturnType<typeof cleanupAllPhrases> | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAnalyze = () => {
    setStep('analyzing');
    setError(null);

    try {
      const result = cleanupAllPhrases(allPhrases);
      setCleanupResult(result);

      if (result.totalUpdated === 0) {
        setStep('complete');
      } else {
        setStep('preview');
      }
    } catch (err) {
      setError((err as Error).message);
      setStep('initial');
    }
  };

  const handleApplyChanges = async () => {
    if (!cleanupResult) return;

    setStep('processing');
    setError(null);

    try {
      // Update all modified phrases
      await onUpdatePhrases(cleanupResult.updatedPhrases);
      setStep('complete');
    } catch (err) {
      setError((err as Error).message);
      setStep('preview');
    }
  };

  const handleClose = () => {
    setStep('initial');
    setCleanupResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">{t('dataCleanup.title', 'Data Cleanup')}</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'initial' && (
            <div className="space-y-4">
              <div className="bg-amber-900/30 border border-amber-600 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-amber-200">{t('dataCleanup.warning.title', 'Important')}</h3>
                    <p className="text-amber-100 text-sm mt-1">
                      {t(
                        'dataCleanup.warning.description',
                        'This tool will analyze your phrases and fix inconsistent romanization data. It will:'
                      )}
                    </p>
                    <ul className="list-disc list-inside text-amber-100 text-sm mt-2 space-y-1">
                      <li>
                        {t(
                          'dataCleanup.warning.step1',
                          'Extract romanization from phrase text (if in parentheses or brackets)'
                        )}
                      </li>
                      <li>
                        {t('dataCleanup.warning.step2', 'Clean the phrase text by removing embedded romanization')}
                      </li>
                      <li>{t('dataCleanup.warning.step3', 'Store romanization in the correct field')}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">{t('dataCleanup.stats.title', 'Current Statistics')}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">{t('dataCleanup.stats.totalPhrases', 'Total phrases:')}</span>
                    <span className="text-white font-semibold">{allPhrases.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">
                      {t('dataCleanup.stats.withRomanization', 'With romanization:')}
                    </span>
                    <span className="text-white font-semibold">
                      {allPhrases.filter((p) => p.romanization?.learning).length}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAnalyze}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
              >
                {t('dataCleanup.actions.analyze', 'Analyze Phrases')}
              </button>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Spinner className="w-12 h-12 text-purple-500" />
              <p className="text-slate-300">{t('dataCleanup.analyzing', 'Analyzing phrases...')}</p>
            </div>
          )}

          {step === 'preview' && cleanupResult && (
            <div className="space-y-4">
              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">{t('dataCleanup.preview.title', 'Preview Changes')}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">{t('dataCleanup.preview.total', 'Total processed:')}</span>
                    <span className="text-white font-semibold">{cleanupResult.totalProcessed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">{t('dataCleanup.preview.updated', 'Will be updated:')}</span>
                    <span className="text-green-400 font-semibold">{cleanupResult.totalUpdated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">{t('dataCleanup.preview.unchanged', 'Unchanged:')}</span>
                    <span className="text-slate-400 font-semibold">
                      {cleanupResult.totalProcessed - cleanupResult.totalUpdated}
                    </span>
                  </div>
                </div>
              </div>

              {cleanupResult.examples.length > 0 && (
                <div className="bg-slate-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-3">
                    {t('dataCleanup.examples.title', 'Examples of Changes')}
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {cleanupResult.examples.map((example, index) => (
                      <div key={index} className="bg-slate-800 rounded p-3 space-y-2 text-sm">
                        <div>
                          <span className="text-slate-400">{t('dataCleanup.examples.before', 'Before:')}</span>
                          <p className="text-red-300 font-mono">{example.before}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">{t('dataCleanup.examples.after', 'After:')}</span>
                          <p className="text-green-300 font-mono">{example.after}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">
                            {t('dataCleanup.examples.romanization', 'Romanization:')}
                          </span>
                          <p className="text-blue-300 font-mono">{example.romanization}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('initial')}
                  className="flex-1 py-3 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg transition-colors"
                >
                  {t('dataCleanup.actions.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleApplyChanges}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                >
                  {t('dataCleanup.actions.apply', 'Apply Changes')}
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Spinner className="w-12 h-12 text-green-500" />
              <p className="text-slate-300">{t('dataCleanup.processing', 'Applying changes...')}</p>
              {cleanupResult && (
                <p className="text-slate-400 text-sm">
                  {t('dataCleanup.processingCount', {
                    count: cleanupResult.totalUpdated,
                    defaultValue: 'Updating {{count}} phrases...',
                  })}
                </p>
              )}
            </div>
          )}

          {step === 'complete' && cleanupResult && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <CheckCircleIcon className="w-16 h-16 text-green-500" />
                <h3 className="text-xl font-semibold text-white">
                  {t('dataCleanup.complete.title', 'Cleanup Complete!')}
                </h3>
                <p className="text-slate-300 text-center">
                  {cleanupResult.totalUpdated > 0
                    ? t('dataCleanup.complete.success', {
                        count: cleanupResult.totalUpdated,
                        defaultValue: 'Successfully updated {{count}} phrases.',
                      })
                    : t('dataCleanup.complete.noChanges', 'No phrases needed updating. Your data is already clean!')}
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
              >
                {t('dataCleanup.actions.close', 'Close')}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-900/30 border border-red-600 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-200">{t('dataCleanup.error.title', 'Error')}</h3>
                  <p className="text-red-100 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataCleanupModal;
