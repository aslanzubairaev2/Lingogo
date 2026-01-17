import React, { FormEvent, useState } from 'react';

import { useAuth } from '../contexts/authContext.tsx';
import { useTranslation } from '../hooks/useTranslation.ts';

/**
 * Props for the SignUpPage component.
 */
interface SignUpPageProps {
  /** Callback to switch to the login page */
  onSwitchToLogin: () => void;
}

/**
 * SignUpPage Component
 *
 * Renders a registration form allowing new users to sign up.
 * Handles form validation (required fields, password mismatch) and submission.
 */
const SignUpPage: React.FC<SignUpPageProps> = ({ onSwitchToLogin }) => {
  const { signUp, loading, error } = useAuth();
  const { t } = useTranslation();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Handles the form submission.
   * Validates inputs and attempts to sign up the user via the auth context.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!email || !password || !confirmation) {
      setFormError(t('auth.signup.validation.missingFields'));
      return;
    }

    if (password !== confirmation) {
      setFormError(t('auth.signup.validation.passwordMismatch'));
      return;
    }

    try {
      await signUp(email.trim(), password);
    } catch (signUpError) {
      setFormError((signUpError as Error).message);
    }
  };

  const effectiveError = formError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur rounded-2xl shadow-xl border border-slate-800 p-8">
        <h1 className="text-2xl font-semibold mb-2 text-center">{t('auth.signup.title')}</h1>
        <p className="text-sm text-slate-400 text-center mb-6">{t('auth.signup.subtitle')}</p>
        {effectiveError && (
          <div
            className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 px-4 py-3 text-sm"
            role="alert"
          >
            {effectiveError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              {t('common.field.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder={t('common.placeholder.email')}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              {t('auth.signup.field.passwordLabel')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder={t('auth.signup.field.passwordPlaceholder')}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password-confirmation">
              {t('auth.signup.field.confirmLabel')}
            </label>
            <input
              id="password-confirmation"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder={t('auth.signup.field.confirmPlaceholder')}
              autoComplete="new-password"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 transition-colors px-4 py-2 font-semibold"
            disabled={loading}
          >
            {loading ? t('auth.signup.submit.state.loading') : t('auth.signup.submit.label')}
          </button>
        </form>
        <p className="text-sm text-slate-400 text-center mt-6">
          {t('auth.signup.switch.prompt')}{' '}
          <button type="button" onClick={onSwitchToLogin} className="text-cyan-400 hover:text-cyan-300 font-medium">
            {t('auth.signup.switch.cta')}
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignUpPage;
