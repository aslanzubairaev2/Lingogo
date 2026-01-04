import React, { useEffect, useState } from 'react';

/**
 * Toast.tsx
 *
 * A notification component that displays temporary messages to the user.
 * It supports different visual styles depending on the message type (e.g., standard vs. automation success).
 */
import CheckIcon from './icons/CheckIcon';

export type ToastType = 'default' | 'automationSuccess';

export interface ToastState {
  message: string;
  id: number;
  type: ToastType;
}

interface ToastProps {
  /** The current toast data to display. If null, nothing is rendered. */
  toast: ToastState | null;
  /** Callback to clear the toast from the parent state. */
  onDismiss: () => void;
}

/**
 * Toast Component
 *
 * Renders the toast notification.
 * - 'default': Standard dark toast at the bottom.
 * - 'automationSuccess': A specialized animated toast (morphs from a checkmark to text).
 */
export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isDefaultVisible, setIsDefaultVisible] = useState(false);
  const [automationStage, setAutomationStage] = useState<'initial' | 'transformed' | 'hiding'>('initial');

  useEffect(() => {
    if (!toast) {
      return;
    }

    if (toast.type === 'automationSuccess') {
      // Logic for the 'automationSuccess' animation sequence:
      // 1. Start in 'initial' state (icon).
      // 2. Expand to 'transformed' state (text) after 1s.
      // 3. Enter 'hiding' state after another 1.8s.
      // 4. Finally dismiss.
      setIsDefaultVisible(false);
      setAutomationStage('initial');
      const transformTimer = setTimeout(() => setAutomationStage('transformed'), 1000);
      const hideTimer = setTimeout(() => {
        setAutomationStage('hiding');
        setTimeout(onDismiss, 300); // Wait for transition out
      }, 2800);

      return () => {
        clearTimeout(transformTimer);
        clearTimeout(hideTimer);
      };
    } else {
      // Standard toast: show, wait, hide, dismiss.
      setIsDefaultVisible(true);
      const timer = setTimeout(() => {
        setIsDefaultVisible(false);
        setTimeout(onDismiss, 300);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  if (!toast) {
    return null;
  }

  if (toast.type === 'automationSuccess') {
    const isInitial = automationStage === 'initial';
    const isTransformed = automationStage === 'transformed';
    const isHiding = automationStage === 'hiding';

    return (
      <div
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 rounded-full shadow-lg transition-all duration-300 ease-out z-[100] overflow-hidden ${
          isHiding ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        <div
          className={`flex items-center justify-center transition-all duration-500 ease-in-out ${
            isInitial ? 'w-9 h-9 bg-green-500' : 'w-32 h-9 bg-gray-700'
          }`}
        >
          {isInitial ? (
            <CheckIcon className="w-5 h-5 text-white" />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <span
                className={`text-white text-sm font-medium text-nowrap transition-opacity duration-200 ${isInitial ? 'opacity-0' : 'opacity-100 delay-300'}`}
              >
                {toast.message}
              </span>
              {isTransformed && <div className="automation-toast-shine"></div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback for default toast
  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800/90 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ease-out z-[100] ${
        isDefaultVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {toast.message}
    </div>
  );
};

export default Toast;
