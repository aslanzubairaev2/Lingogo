/**
 * Hook for automatic phrase validation and fixing on app startup
 */

import { useEffect, useRef, useState } from 'react';

import type { AiService } from '../services/aiService';
import { fixPhrasesInBatch, generateFixReport, type RegenerationProgress } from '../services/phraseRegenerationService';
import {
  getValidationReportMessage,
  validateAllPhrases,
  type ValidationSummary,
} from '../services/phraseValidationService';
import type { Phrase } from '../types.ts';

/**
 * Auto-fix status
 */
export type AutoFixStatus = 'idle' | 'validating' | 'fixing' | 'completed' | 'error' | 'skipped';

/**
 * Auto-fix state
 */
export interface AutoFixState {
  status: AutoFixStatus;
  validationSummary: ValidationSummary | null;
  progress: RegenerationProgress | null;
  error: string | null;
  completedMessage: string | null;
}

/**
 * Hook options
 */
export interface UseAutoFixPhrasesOptions {
  enabled?: boolean; // Enable/disable auto-fix (default: true)
  onComplete?: (fixedPhrases: Phrase[]) => void; // Callback when fix is complete
  runOnce?: boolean; // Run only once per app session (default: true)
}

/**
 * Hook for automatic phrase fixing
 */
export function useAutoFixPhrases(
  allPhrases: Phrase[],
  learningLanguageCode: string,
  learningLanguageName: string,
  nativeLanguageName: string,
  aiService: AiService | null,
  updatePhrases: (phrases: Phrase[]) => Promise<void>,
  options: UseAutoFixPhrasesOptions = {}
) {
  const { enabled = true, onComplete, runOnce = true } = options;

  const [state, setState] = useState<AutoFixState>({
    status: 'idle',
    validationSummary: null,
    progress: null,
    error: null,
    completedMessage: null,
  });

  // Track if we've already run to prevent multiple runs
  const hasRunRef = useRef(false);
  const isRunningRef = useRef(false);

  /**
   * Run validation and auto-fix
   */
  const runAutoFix = async () => {
    // Prevent multiple simultaneous runs
    if (isRunningRef.current) {
      console.log('[AutoFix] Already running, skipping...');
      return;
    }

    // Check if we should run only once
    if (runOnce && hasRunRef.current) {
      console.log('[AutoFix] Already ran once, skipping...');
      setState((prev) => ({ ...prev, status: 'skipped' }));
      return;
    }

    // Check prerequisites
    if (!enabled) {
      console.log('[AutoFix] Disabled by options');
      setState((prev) => ({ ...prev, status: 'skipped' }));
      return;
    }

    if (allPhrases.length === 0) {
      console.log('[AutoFix] No phrases to validate');
      setState((prev) => ({ ...prev, status: 'skipped' }));
      return;
    }

    if (!aiService) {
      console.log('[AutoFix] AI service not available');
      setState((prev) => ({ ...prev, status: 'skipped' }));
      return;
    }

    isRunningRef.current = true;
    hasRunRef.current = true;

    try {
      // Step 1: Validate all phrases
      console.log('[AutoFix] Starting validation...');
      setState((prev) => ({
        ...prev,
        status: 'validating',
        error: null,
        completedMessage: null,
      }));

      const validation = validateAllPhrases(allPhrases, learningLanguageCode as any);

      console.log('[AutoFix] Validation complete:', getValidationReportMessage(validation));

      setState((prev) => ({
        ...prev,
        validationSummary: validation,
      }));

      // If no issues found, we're done
      if (validation.invalidPhrases === 0) {
        console.log('[AutoFix] ✅ All phrases are valid!');
        setState((prev) => ({
          ...prev,
          status: 'completed',
          completedMessage: '✅ All phrases are valid! No fixes needed.',
        }));
        isRunningRef.current = false;
        return;
      }

      // Step 2: Fix invalid phrases
      console.log(`[AutoFix] Fixing ${validation.invalidPhrases} invalid phrases...`);
      setState((prev) => ({
        ...prev,
        status: 'fixing',
      }));

      const result = await fixPhrasesInBatch(
        validation.phrasesNeedingFix,
        aiService,
        nativeLanguageName,
        learningLanguageName,
        (progress) => {
          setState((prev) => ({
            ...prev,
            progress,
          }));
        }
      );

      // Step 3: Update phrases in database
      if (result.fixedPhrases.length > 0) {
        console.log(`[AutoFix] Updating ${result.fixedPhrases.length} fixed phrases...`);
        await updatePhrases(result.fixedPhrases);

        if (onComplete) {
          onComplete(result.fixedPhrases);
        }
      }

      // Step 4: Generate completion message
      const report = generateFixReport(result);
      console.log('[AutoFix] Complete:\n', report);

      setState((prev) => ({
        ...prev,
        status: 'completed',
        completedMessage: report,
      }));
    } catch (error) {
      console.error('[AutoFix] Error:', error);
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: (error as Error).message,
      }));
    } finally {
      isRunningRef.current = false;
    }
  };

  /**
   * Manually trigger auto-fix
   */
  const trigger = () => {
    hasRunRef.current = false; // Reset the "has run" flag
    runAutoFix();
  };

  /**
   * Reset the auto-fix state
   */
  const reset = () => {
    hasRunRef.current = false;
    isRunningRef.current = false;
    setState({
      status: 'idle',
      validationSummary: null,
      progress: null,
      error: null,
      completedMessage: null,
    });
  };

  // Auto-run on mount if enabled
  useEffect(() => {
    // Wait a bit after app loads to avoid interfering with initial loading
    const timer = setTimeout(() => {
      runAutoFix();
    }, 2000); // 2 second delay

    return () => clearTimeout(timer);
  }, [runAutoFix]);

  return {
    state,
    trigger,
    reset,
    isRunning: state.status === 'validating' || state.status === 'fixing',
    isComplete: state.status === 'completed',
    hasError: state.status === 'error',
  };
}
