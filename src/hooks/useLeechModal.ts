import { useState } from 'react';

import { Phrase } from '../types';

/**
 * useLeechModal
 *
 * A custom hook to manage the state of the "Leech" modal.
 * This modal is displayed when a user struggles with a specific phrase (a "leech").
 */
export const useLeechModal = () => {
  // State to track if the leech modal is currently visible
  const [isLeechModalOpen, setIsLeechModalOpen] = useState(false);
  // State to store the specific phrase identified as a leech
  const [leechPhrase, setLeechPhrase] = useState<Phrase | null>(null);

  /**
   * Opens the modal and sets the leech phrase.
   * @param phrase The phrase that has become a leech.
   */
  const handleOpenLeechModal = (phrase: Phrase) => {
    setLeechPhrase(phrase);
    setIsLeechModalOpen(true);
  };

  /**
   * Closes the modal and clears the leech phrase.
   */
  const handleCloseLeechModal = () => {
    setIsLeechModalOpen(false);
    setLeechPhrase(null);
  };

  return {
    isLeechModalOpen,
    setIsLeechModalOpen,
    leechPhrase,
    setLeechPhrase,
    handleOpenLeechModal,
    handleCloseLeechModal,
  };
};

export default useLeechModal;
