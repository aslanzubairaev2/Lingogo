/**
 * useLearningAssistantModal.ts
 *
 * Custom hook to manage the state of the Learning Assistant Modal.
 * Handles opening/closing the modal, tracking the active phrase, and caching chat history.
 */

import { useState } from 'react';

import { ChatMessage, Phrase } from '../types';

/**
 * Hook for managing Learning Assistant Modal state.
 *
 * @returns {Object} An object containing state variables and handlers.
 */
export const useLearningAssistantModal = () => {
  // --- State Variables ---

  // Controls visibility of the modal
  const [isLearningAssistantModalOpen, setIsLearningAssistantModalOpen] = useState(false);

  // The phrase currently being learned/practiced in the assistant
  const [learningAssistantPhrase, setLearningAssistantPhrase] = useState<Phrase | null>(null);

  // Cache for chat history to preserve context across opens/closes for specific phrases
  const [learningAssistantCache, setLearningAssistantCache] = useState<{
    [phraseId: string]: ChatMessage[];
  }>({});

  /**
   * Opens the Learning Assistant for a specific phrase.
   *
   * @param {Phrase} phrase - The phrase to practice.
   */
  const handleOpenLearningAssistant = (phrase: Phrase) => {
    setLearningAssistantPhrase(phrase);
    setIsLearningAssistantModalOpen(true);
  };

  /**
   * Closes the Learning Assistant.
   */
  const handleCloseLearningAssistant = () => {
    setIsLearningAssistantModalOpen(false);
  };

  return {
    /** boolean indicating if the modal is visible */
    isLearningAssistantModalOpen,
    /** The current phrase object being processed */
    learningAssistantPhrase,
    /** Chat history cache keyed by phrase ID */
    learningAssistantCache,
    setLearningAssistantCache,
    /** Function to open the modal with a phrase */
    handleOpenLearningAssistant,
    /** Function to close the modal and reset state */
    handleCloseLearningAssistant,
  };
};

export default useLearningAssistantModal;
