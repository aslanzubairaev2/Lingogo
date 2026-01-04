import React, { useEffect, useState } from 'react';

import { useTranslation } from '../hooks/useTranslation';
import * as backendService from '../services/backendService';
import type { Phrase } from '../types.ts';
import CloseIcon from './icons/CloseIcon';
import Spinner from './Spinner';

interface FindDuplicatesModalProps {
  onClose: () => void;
  onFindDuplicates: () => Promise<{ duplicateGroups: string[][] }>;
  updateAndSavePhrases: (updater: (prevPhrases: Phrase[]) => Phrase[]) => void;
  phrases: Phrase[];
  backendService: typeof backendService;
}

const FindDuplicatesModal: React.FC<FindDuplicatesModalProps> = ({
  onClose,
  onFindDuplicates,
  updateAndSavePhrases,
  phrases,
  backendService,
}) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(true);
  const [duplicateGroups, setDuplicateGroups] = useState<string[][]>([]);
  const [searchCompleted, setSearchCompleted] = useState(false);

  const handleFindDuplicates = async () => {
    setIsProcessing(true);
    setDuplicateGroups([]);
    setSearchCompleted(false);
    try {
      const { duplicateGroups } = await onFindDuplicates();
      setDuplicateGroups(duplicateGroups);
    } catch (error) {
      alert(t('modals.findDuplicates.errors.search', { message: (error as Error).message }));
    } finally {
      setIsProcessing(false);
      setSearchCompleted(true);
    }
  };

  useEffect(() => {
    handleFindDuplicates();
  }, []);

  const handleCleanDuplicates = async () => {
    if (duplicateGroups.length === 0) return;

    const idsToDelete = new Set<string>();
    const phraseMap = new Map(phrases.map((p) => [p.id, p]));

    duplicateGroups.forEach((group) => {
      const phrasesInGroup = group.map((id) => phraseMap.get(id)).filter((p): p is Phrase => !!p);

      if (phrasesInGroup.length < 2) return;

      phrasesInGroup.sort((a, b) => b.knowCount - a.knowCount);

      for (let i = 1; i < phrasesInGroup.length; i++) {
        idsToDelete.add(phrasesInGroup[i].id);
      }
    });

    // Optimistic UI update
    updateAndSavePhrases((currentPhrases) => currentPhrases.filter((p) => p && !idsToDelete.has(p.id)));

    onClose();
    // No need for alert here, toasts will be shown from App.tsx or another central place.

    // Background deletion with delay
    const deletionPromises = [];
    for (const id of idsToDelete) {
      deletionPromises.push(
        backendService.deletePhrase(id).catch((err) => {
          console.error(`Failed to delete phrase ${id}:`, err);
          // Optionally, show a toast for failed deletions
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 250)); // 250ms delay
    }

    await Promise.all(deletionPromises);
    // Optionally, show a final toast when all deletions are done.
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-700">
        <div className="p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-white mb-4">{t('modals.findDuplicates.title')}</h2>

          {isProcessing && (
            <div className="flex flex-col items-center justify-center h-32">
              <Spinner />
              <p className="text-slate-300 mt-4 animate-pulse">{t('modals.findDuplicates.processing')}</p>
            </div>
          )}

          {searchCompleted && !isProcessing && (
            <div>
              {duplicateGroups.length > 0 ? (
                <div>
                  <p className="text-green-400 text-lg text-center mb-2">
                    {t('modals.findDuplicates.found', { count: duplicateGroups.length })}
                  </p>
                  <div className="max-h-60 overflow-y-auto bg-slate-900/50 rounded-lg p-3 border border-slate-700 space-y-3 my-4">
                    {duplicateGroups.map((group, index) => {
                      const phrasesInGroup = group
                        .map((id) => phrases.find((p) => p.id === id))
                        .filter((p): p is Phrase => !!p);

                      return (
                        <div key={index} className="bg-slate-800 p-3 rounded-md">
                          {phrasesInGroup.map((phrase) => (
                            <div key={phrase.id} className="py-1 not-last:border-b border-slate-700">
                              <p className="text-white">{phrase.text.learning}</p>
                              <p className="text-slate-400 text-sm">{phrase.text.native}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-slate-400 text-xs mb-4 text-center">{t('modals.findDuplicates.description')}</p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={onClose}
                      className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-md transition-colors"
                    >
                      {t('modals.findDuplicates.actions.cancel')}
                    </button>
                    <button
                      onClick={handleCleanDuplicates}
                      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-colors"
                    >
                      {t('modals.findDuplicates.actions.clean')}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-blue-400 text-lg text-center mb-6">{t('modals.findDuplicates.noDuplicates')}</p>
                  <button
                    onClick={onClose}
                    className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-md transition-colors"
                  >
                    {t('modals.findDuplicates.actions.close')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FindDuplicatesModal;
