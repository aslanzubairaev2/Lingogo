import { useState } from 'react';

import { Phrase } from '../types';

/**
 * useImprovePhraseModal
 *
 * A custom hook to manage the state of the "Improve Phrase" modal.
 * It handles the visibility of the modal and tracks which phrase is currently being improved.
 */
export const useImprovePhraseModal = () => {
  // State to track if the modal is currently visible
  const [isImproveModalOpen, setIsImproveModalOpen] = useState(false);
  // State to store the specific phrase selected for improvement
  const [phraseToImprove, setPhraseToImprove] = useState<Phrase | null>(null);

  /**
   * Opens the modal and sets the target phrase.
   * @param phrase The phrase to be improved.
   */
  const handleOpenImproveModal = (phrase: Phrase) => {
    setPhraseToImprove(phrase);
    setIsImproveModalOpen(true);
  };

  /**
   * Closes the modal and clears the target phrase.
   */
  const handleCloseImproveModal = () => {
    setIsImproveModalOpen(false);
    setPhraseToImprove(null);
  };

  return {
    isImproveModalOpen,
    setIsImproveModalOpen,
    phraseToImprove,
    setPhraseToImprove,
    handleOpenImproveModal,
    handleCloseImproveModal,
  };
};

export default useImprovePhraseModal;
