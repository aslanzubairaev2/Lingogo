import { t } from 'i18next';
import React, { useState } from 'react';

import * as backendService from '../services/backendService';
/**
 * LeechModal.tsx
 *
 * This component displays a modal for handling "leech" phrases - phrases that the user
 * struggles with repeatedly (high lapse count or failures).
 *
 * It offers several options to the user:
 * - Improve: Open the improvement modal to edit the phrase.
 * - Discuss: Open the AI discussion modal to clear up confusion.
 * - Continue: Retry the phrase in a short interval (10 mins).
 * - Reset: Completely reset progress for the phrase to start over.
 * - Postpone: Skip the phrase for now and review it tomorrow.
 */
import { Phrase } from '../types';
import BugIcon from './icons/BugIcon';
import MessageQuestionIcon from './icons/MessageQuestionIcon';
import WandIcon from './icons/WandIcon';
import { ToastType } from './Toast';

interface LeechModalProps {
  /** The phrase identified as a leech */
  leechPhrase: Phrase | null;
  /** Whether the modal is currently visible */
  isLeechModalOpen: boolean;
  /** Function to close the modal */
  handleCloseLeechModal: () => void;
  /** Function to open the Improve Phrase modal */
  handleOpenImproveModal: (phrase: Phrase) => void;
  /** Function to open the Discuss Phrase modal */
  handleOpenDiscussModal: (phrase: Phrase) => void;
  /** Function to update local phrase state and sync with backend logic if needed (via callback) */
  updateAndSavePhrases: (callback: (phrases: Phrase[]) => Phrase[]) => void;
  /** Function to display toast notifications */
  showToast: (config: { message: string; type?: ToastType }) => void;
  /** Function to move to the next phrase in the practice session */
  transitionToNext: () => void;
}

/**
 * LeechModal Component
 */
export const LeechModal: React.FC<LeechModalProps> = ({
  leechPhrase,
  isLeechModalOpen,
  handleCloseLeechModal,
  handleOpenImproveModal,
  handleOpenDiscussModal,
  updateAndSavePhrases,
  showToast,
  transitionToNext,
}) => {
  if (!isLeechModalOpen || !leechPhrase) return null;

  /**
   * handleLeechAction
   *
   * Central handler for phrase actions within the modal.
   *
   * @param phrase The phrase being acted upon.
   * @param action The specific action to take:
   *  - 'continue': Reviews again in 10 minutes (short term retry).
   *  - 'reset': Resets mastery, streaks, and review times to zero/initial.
   *  - 'postpone': Pushes the next review to 24 hours later.
   */
  const handleLeechAction = async (phrase: Phrase, action: 'continue' | 'reset' | 'postpone') => {
    let updatedPhrase = { ...phrase };
    const now = Date.now();

    if (action === 'continue') {
      // Schedule strictly for 10 minutes from now
      updatedPhrase.nextReviewAt = now + 10 * 60 * 1000;
    } else if (action === 'reset') {
      // Reset all progress metrics
      updatedPhrase = {
        ...phrase,
        masteryLevel: 0,
        lastReviewedAt: null,
        nextReviewAt: now,
        knowCount: 0,
        knowStreak: 0,
        lapses: 0,
        isMastered: false,
      };
    } else {
      // 'postpone': Schedule for 24 hours from now
      updatedPhrase.nextReviewAt = now + 24 * 60 * 60 * 1000;
    }

    try {
      // Persist changes to backend
      await backendService.updatePhrase(updatedPhrase);
      // Update local state
      updateAndSavePhrases((prev) => prev.map((p) => (p.id === updatedPhrase.id ? updatedPhrase : p)));
    } catch (err) {
      showToast({
        message: t('notifications.genericError', {
          // Note: ensure translation key exists or is handled
          message: (err as Error).message,
        }),
      });
    }

    handleCloseLeechModal();
    transitionToNext();
  };

  // Action Handlers

  // Opens improve modal; postpones current review so it doesn't block immediately
  const handleImprove = () => {
    handleLeechAction(leechPhrase, 'postpone');
    handleOpenImproveModal(leechPhrase);
  };

  // Opens discuss modal; postpones current review
  const handleDiscuss = () => {
    handleLeechAction(leechPhrase, 'postpone');
    handleOpenDiscussModal(leechPhrase);
  };

  const handleContinue = () => handleLeechAction(leechPhrase, 'continue');
  const handleReset = () => handleLeechAction(leechPhrase, 'reset');
  const handlePostpone = () => handleLeechAction(leechPhrase, 'postpone');

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center backdrop-blur-sm p-4 animate-fade-in"
      onClick={handlePostpone} // Default action on backdrop click is to postpone
    >
      <div
        className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-sm m-4 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-900/50 flex items-center justify-center">
            <BugIcon className="w-6 h-6 text-amber-500" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-100">Difficult Phrase</h2>
        <p className="text-slate-400 mt-2 mb-4">This phrase is difficult for you. What would you like to do?</p>

        <div className="bg-slate-700/50 p-4 rounded-md text-center mb-6">
          <p className="text-slate-200 font-medium text-lg">"{leechPhrase?.text.native}"</p>
          <p className="text-slate-400 mt-1">"{leechPhrase?.text.learning}"</p>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            onClick={handleImprove}
            className="w-full px-6 py-3 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors flex items-center justify-center"
          >
            <WandIcon className="w-5 h-5 mr-2" />
            <span>Improve Phrase</span>
          </button>
          <button
            onClick={handleDiscuss}
            className="w-full px-6 py-3 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold transition-colors flex items-center justify-center"
          >
            <MessageQuestionIcon className="w-5 h-5 mr-2" />
            <span>Discuss with AI</span>
          </button>
          <div className="pt-3 mt-3 border-t border-slate-700 space-y-3">
            <button
              onClick={handleContinue}
              className="w-full px-6 py-2 rounded-md bg-transparent hover:bg-slate-700/50 text-slate-300 font-medium transition-colors"
            >
              Retry in 10 minutes
            </button>
            <button
              onClick={handleReset}
              className="w-full px-6 py-2 rounded-md bg-transparent hover:bg-slate-700/50 text-slate-300 font-medium transition-colors"
            >
              Reset Progress
            </button>
            <button
              onClick={handlePostpone}
              className="w-full px-6 py-2 rounded-md bg-transparent hover:bg-slate-700/50 text-slate-300 font-medium transition-colors"
            >
              Postpone until tomorrow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
