import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import * as authService from '../services/authService.ts';
import { clearAccessToken, setAccessToken, setUnauthorizedHandler } from '../services/authTokenStore.ts';
import { clearAppCaches } from '../services/storageService.ts';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  token: string | null;
  loading: boolean;
  initializing: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  userChanged: boolean;
  resetUserChanged: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const useApplySession = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const applySession = (nextSession: Session | null) => {
    setSession(nextSession);
    const nextUser = nextSession?.user ?? null;
    setUser(nextUser);
    const nextToken = nextSession?.access_token ?? null;
    setToken(nextToken);

    if (nextToken) {
      setAccessToken(nextToken);
    } else {
      clearAccessToken();
    }
  };

  return { session, user, token, applySession };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Note: Cannot use useTranslation here as it creates circular dependency with LanguageProvider
  // LanguageProvider needs AuthProvider (for useAuth), and AuthProvider would need LanguageProvider (for useTranslation)
  const { session, user, token, applySession } = useApplySession();
  const [initializing, setInitializing] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userChanged, setUserChanged] = useState<boolean>(false);

  // Note: Removed automatic data initialization - onboarding flow handles this now
  // New users will see language selection modal before data generation

  useEffect(() => {
    setUnauthorizedHandler(() => {
      applySession(null);
      clearAppCaches();
      setError('Session expired');
      authService.signOut().catch((signOutError) => {
        console.error('Error signing out from Supabase', signOutError);
      });
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const bootstrap = async () => {
      try {
        const existingSession = await authService.getSession();
        if (!isMounted) {
          return;
        }
        applySession(existingSession);
      } catch (bootstrapError) {
        console.error('Failed to restore session', bootstrapError);
        if (isMounted) {
          setError((bootstrapError as Error).message);
        }
      } finally {
        if (isMounted) {
          setInitializing(false);
        }
      }
    };

    bootstrap();

    try {
      subscription = authService.onAuthStateChange((event, nextSession) => {
        if (!isMounted) {
          return;
        }
        applySession(nextSession);
        if (event === 'SIGNED_OUT') {
          clearAppCaches();
          setError(null);
        }
      });
    } catch (subscriptionError) {
      console.error('Failed to subscribe to auth state changes', subscriptionError);
      if (isMounted) {
        setError((subscriptionError as Error).message);
        setInitializing(false);
      }
    }

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const withLoading = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      await withLoading(async () => {
        const previousUserId = session?.user?.id;
        const { session: nextSession } = await authService.signIn(email, password);
        if (!nextSession) {
          throw new Error('No session returned after sign in');
        }
        if (!previousUserId || nextSession.user?.id !== previousUserId) {
          clearAppCaches();
          setUserChanged(true);
        }
        applySession(nextSession);
        // Data initialization handled by onboarding flow
      });
    } catch (signInError) {
      setError((signInError as Error).message);
      throw signInError;
    }
  };

  const signUp = async (email: string, password: string) => {
    setError(null);
    try {
      await withLoading(async () => {
        const { session: nextSession } = await authService.signUp(email, password);

        if (!nextSession) {
          throw new Error('No session returned after sign up');
        }

        clearAppCaches();
        applySession(nextSession);
        // Data initialization handled by onboarding flow
      });
    } catch (signUpError) {
      setError((signUpError as Error).message);
      throw signUpError;
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await withLoading(async () => {
        if (session) {
          await authService.signOut();
        }
        clearAppCaches();

        // Clear DevLanguageSelector override on logout (DEV mode)
        if (import.meta.env.DEV) {
          localStorage.removeItem('devLanguageOverride');
        }

        applySession(null);
      });
    } catch (signOutError) {
      setError((signOutError as Error).message);
      throw signOutError;
    }
  };

  const refreshSession = async () => {
    setError(null);
    try {
      await withLoading(async () => {
        const nextSession = await authService.refreshSession();
        applySession(nextSession ?? null);
      });
    } catch (refreshError) {
      setError((refreshError as Error).message);
      throw refreshError;
    }
  };

  const resetUserChanged = () => {
    setUserChanged(false);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      token,
      loading,
      initializing,
      error,
      signIn,
      signUp,
      signOut,
      refreshSession,
      userChanged,
      resetUserChanged,
    }),
    [user, session, token, loading, initializing, error, userChanged, resetUserChanged]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
