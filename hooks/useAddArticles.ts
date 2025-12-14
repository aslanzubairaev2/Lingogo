
import { useState, useCallback, useRef } from 'react';
import type { Phrase } from '../types';
import type { AiService } from '../services/aiService';
import { findPhrasesNeedingArticles, addArticlesToPhrases, ArticleFixResult } from '../services/articleFixService';

export type AddArticlesStatus = 'idle' | 'analyzing' | 'confirm' | 'fixing' | 'completed' | 'error';

export interface AddArticlesState {
    status: AddArticlesStatus;
    foundPhrases: Phrase[]; // Phrases identified as needing articles
    result: ArticleFixResult | null;
    progress: {
        total: number;
        processed: number;
        successful: number;
        failed: number;
        currentPhrase?: string;
    } | null;
    error: string | null;
}

export function useAddArticles(
    allPhrases: Phrase[],
    aiService: AiService | null,
    onUpdatePhrases: (phrases: Phrase[]) => Promise<void>
) {
    const [state, setState] = useState<AddArticlesState>({
        status: 'idle',
        foundPhrases: [],
        result: null,
        progress: null,
        error: null
    });

    const isRunningRef = useRef(false);

    const analyze = useCallback(() => {
        if (!allPhrases.length) return;

        setState(prev => ({ ...prev, status: 'analyzing', error: null }));

        try {
            const candidates = findPhrasesNeedingArticles(allPhrases);
            if (candidates.length === 0) {
                setState(prev => ({ ...prev, status: 'completed', foundPhrases: [] }));
            } else {
                setState(prev => ({ ...prev, status: 'confirm', foundPhrases: candidates }));
            }
        } catch (err) {
            setState(prev => ({ ...prev, status: 'error', error: (err as Error).message }));
        }
    }, [allPhrases]);

    const startFix = useCallback(async () => {
        if (!aiService || state.foundPhrases.length === 0 || isRunningRef.current) return;

        isRunningRef.current = true;
        setState(prev => ({
            ...prev,
            status: 'fixing',
            progress: { total: state.foundPhrases.length, processed: 0, successful: 0, failed: 0 }
        }));

        try {
            const result = await addArticlesToPhrases(
                state.foundPhrases,
                aiService,
                (progress) => {
                    setState(prev => ({ ...prev, progress }));
                }
            );

            if (result.fixedPhrases.length > 0) {
                await onUpdatePhrases(result.fixedPhrases);
            }

            setState(prev => ({ ...prev, status: 'completed', result }));
        } catch (err) {
            setState(prev => ({ ...prev, status: 'error', error: (err as Error).message }));
        } finally {
            isRunningRef.current = false;
        }
    }, [aiService, state.foundPhrases, onUpdatePhrases]);

    const reset = useCallback(() => {
        setState({
            status: 'idle',
            foundPhrases: [],
            result: null,
            progress: null,
            error: null
        });
        isRunningRef.current = false;
    }, []);

    return {
        state,
        analyze,
        startFix,
        reset
    };
}
