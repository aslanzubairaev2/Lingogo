import { Category, Phrase } from '../types.ts';
import { getAccessToken, notifyUnauthorized } from './authTokenStore.ts';
import { getApiBaseUrl } from './env.ts';
import * as supabaseService from './supabaseService.ts';

/**
 * backendService.ts
 *
 * This service handles all HTTP communication with the Lingogo backend API.
 * It is responsible for:
 * - Managing authentication tokens in requests.
 * - Transforming data between frontend and backend formats.
 * - Handling API errors and unauthorized states.
 * - Implementing global retry logic for network robustness.
 * - Providing typed functions for all CRUD operations on Phrases, Categories, and User Profiles.
 */

const API_BASE_URL = getApiBaseUrl();

// --- Color Conversion Maps ---
// Maps Tailwind CSS color classes to Hex codes for backend storage.
// The backend stores colors as Hex strings to be client-agnostic.
const tailwindToHexMap: Record<string, string> = {
  'bg-slate-500': '#64748b',
  'bg-red-500': '#ef4444',
  'bg-orange-500': '#f97316',
  'bg-amber-500': '#f59e0b',
  'bg-yellow-500': '#eab308',
  'bg-lime-500': '#84cc16',
  'bg-green-500': '#22c55e',
  'bg-emerald-500': '#10b981',
  'bg-teal-500': '#14b8a6',
  'bg-cyan-500': '#06b6d4',
  'bg-sky-500': '#0ea5e9',
  'bg-blue-500': '#3b82f6',
  'bg-indigo-500': '#6366f1',
  'bg-violet-500': '#8b5cf6',
  'bg-purple-500': '#a855f7',
  'bg-fuchsia-500': '#d946ef',
  'bg-pink-500': '#ec4899',
  'bg-rose-500': '#f43f5e',
};

const hexToTailwindMap: Record<string, string> = Object.fromEntries(
  Object.entries(tailwindToHexMap).map(([key, value]) => [value, key])
);

// --- Data Conversion Helpers ---
// These functions transform backend data structures (flat, snake_case)
// to frontend domain objects (nested, camelCase) and vice versa.

/**
 * Converts a raw backend category object to the frontend Category type.
 * Handles color mapping (Hex -> Tailwind).
 */
const feCategory = (beCategory: any): Category => ({
  id: beCategory.id.toString(),
  name: beCategory.name,
  color: hexToTailwindMap[beCategory.color.toLowerCase()] || 'bg-slate-500',
  isFoundational: beCategory.is_foundational,
});

/**
 * Converts a raw backend phrase object to the frontend Phrase type.
 * Maps flat backend fields to nested objects (text, romanization, context).
 */
const fePhrase = (bePhrase: any): Phrase => {
  const categoryId = bePhrase.category_id ?? bePhrase.category;
  // Map backend's flat structure to the frontend's nested `text` object.
  return {
    id: bePhrase.id.toString(),
    text: {
      native: bePhrase.native || bePhrase.native_text,
      learning: bePhrase.learning || bePhrase.learning_text,
    },
    category: categoryId.toString(),
    romanization: bePhrase.transcription ? { learning: bePhrase.transcription } : undefined,
    context: bePhrase.context ? { native: bePhrase.context } : undefined,
    masteryLevel: bePhrase.masteryLevel,
    lastReviewedAt: bePhrase.lastReviewedAt,
    nextReviewAt: bePhrase.nextReviewAt,
    knowCount: bePhrase.knowCount,
    knowStreak: bePhrase.knowStreak,
    isMastered: bePhrase.isMastered,
    lapses: bePhrase.lapses,
  };
};

/**
 * Standardized response handler.
 * - checks for 401/403 to trigger unauthorized flow.
 * - parses JSON response or throws detailed errors.
 * - handles 204 No Content.
 */
const handleResponse = async (response: Response) => {
  if (response.status === 401 || response.status === 403) {
    notifyUnauthorized();
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: any;
    try {
      errorData = JSON.parse(errorText);
    } catch (e) {
      const statusText = response.statusText || 'Error';
      errorData = { error: `${response.status} ${statusText}`, details: errorText };
    }
    const message = errorData?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wrapper around `fetch` that adds:
 * - Authorization headers with the current token.
 * - Automatic retry logic for 429 (Rate Limit) errors with exponential backoff.
 * - Default headers (Accept, Content-Type).
 */
const fetchWithRetry = async (
  url: RequestInfo,
  options: RequestInit = {},
  retries = 3,
  initialDelay = 500
): Promise<Response> => {
  let delay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try {
      const token = getAccessToken();
      const headers = new Headers(options.headers || {});
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
      }
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(url, { ...options, headers });

      if (response.ok || response.status === 401 || response.status === 403) {
        return response;
      }

      if (response.status === 429) {
        console.warn(`Rate limit exceeded. Attempt ${i + 1}/${retries}. Retrying in ${delay}ms...`);
        if (i < retries - 1) {
          await sleep(delay + Math.random() * 200);
          delay *= 2;
          continue;
        }
      }

      return response;
    } catch (error) {
      console.error(`Fetch failed on attempt ${i + 1}/${retries}:`, error);
      if (i < retries - 1) {
        await sleep(delay + Math.random() * 200);
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
  throw new Error('Request failed after all retries.');
};

/**
 * Fetches the initial data set (categories and phrases) for the application.
 * If a 404 is encountered, it triggers a data load and retries.
 *
 * @returns {Promise<{ categories: Category[]; phrases: Phrase[] }>} A promise resolving to the initial data.
 */
export const fetchInitialData = async (userId: string): Promise<{ categories: Category[]; phrases: Phrase[] }> => {

  let categories = await supabaseService.getAllCategories(userId);
  let phrases = await supabaseService.getAllPhrases(userId);

  return {
    categories: categories.map(feCategory),
    phrases: phrases.map(fePhrase),
  };
};

/**
 * Creates a new phrase.
 * Maps frontend data structure to backend expectations.
 *
 * @param {Omit<Phrase, 'id' | ...>} phraseData - The data for the new phrase.
 * @returns {Promise<Phrase>} The newly created phrase.
 */
export const createPhrase = async (userId: string,
  phraseData: Omit<
    Phrase,
    'id' | 'masteryLevel' | 'lastReviewedAt' | 'nextReviewAt' | 'knowCount' | 'knowStreak' | 'isMastered' | 'lapses'
  >
): Promise<Phrase> => {
  const phrase: DbPhrase = {
    native_text: phraseData.text.native,
    learning_text: phraseData.text.learning,
    category_id: parseInt(phraseData.category, 10),
    transcription: phraseData.romanization?.learning,
    context: phraseData.context?.native,
  }
  const created = await supabaseService.createPhrase(userId, phrase);
  return fePhrase(created);
};

/**
 * Updates an existing phrase.
 * Handles mapping of legacy fields and ensures category ID is valid.
 *
 * @param {Phrase} phrase - The phrase with updated data.
 * @returns {Promise<Phrase>} The updated phrase from the backend.
 * @throws {Error} If category ID is missing or invalid.
 */
export const updatePhrase = async (userId: string, phrase: Phrase): Promise<Phrase> => {
  // Map frontend's nested object structure to the flat properties expected by the backend.
  // Support legacy fields (native/learning) for backward compatibility
  const beData: DbPhrase = {
    id: parseInt(phrase.id, 10),
    native_text: phrase.text?.native || (phrase as any).native,
    learning_text: phrase.text?.learning || (phrase as any).learning,
    category_id: parseInt(phrase.category, 10),
    transcription: phrase.romanization?.learning,
    context: phrase.context?.native,
    masteryLevel: phrase.masteryLevel,
    lastReviewedAt: phrase.lastReviewedAt,
    nextReviewAt: phrase.nextReviewAt,
    knowCount: phrase.knowCount,
    knowStreak: phrase.knowStreak,
    isMastered: phrase.isMastered,
    lapses: phrase.lapses,
  };

  if (beData.category_id <= 0) {
    throw new Error('Category ID is required and must be a number');
  }

  const updated = await supabaseService.updatePhrase(userId, beData.id, beData);

  return fePhrase(updated);
};

/**
 * Deletes a phrase by its ID.
 *
 * @param {string} phraseId - The ID of the phrase to delete.
 * @returns {Promise<void>}
 */
export const deletePhrase = async (userId: string, phraseId: string): Promise<void> => {
  await supabaseService.deletePhrase(userId, parseInt(phraseId, 10));
};

/**
 * Creates a new category.
 * Converts Tailwind color class to Hex for storage.
 *
 * @param {Omit<Category, 'id'>} categoryData - The data for the new category.
 * @returns {Promise<Category>} The created category.
 */
export const createCategory = async (userId: string, categoryData: Omit<Category, 'id'>): Promise<Category> => {
  const hexColor = tailwindToHexMap[categoryData.color] || '#64748b';

  const beData = {
    name: categoryData.name,
    color: hexColor,
    is_foundational: categoryData.isFoundational,
  };

  const created = await supabaseService.createCategory(userId, beData);
  return feCategory(created);
};

/**
 * Updates an existing category.
 *
 * @param {Category} category - The category with updated data.
 * @returns {Promise<Category>} The updated category.
 */
export const updateCategory = async (userId: string, category: Category): Promise<Category> => {
  const hexColor = tailwindToHexMap[category.color] || '#64748b';
  const beData: DbCategory = {
    id: parseInt(category.id, 10),
    is_foundational: category.isFoundational,
    name: category.name,
    color: hexColor
  };

  const updated = await supabaseService.updateCategory(userId, beData.id, beData);
  return feCategory(updated);
};

/**
 * Deletes a category.
 * Optionally migrates phrases to another category before deletion.
 *
 * @param {string} categoryId - The ID of the category to delete.
 * @param {string | null} migrationTargetId - Optional ID of the category to move phrases to.
 * @returns {Promise<void>}
 */
export const deleteCategory = async (userId: string, categoryId: string, migrationTargetId: string): Promise<void> => {
  await supabaseService.deleteCategory(userId, parseInt(categoryId, 10), parseInt(migrationTargetId, 10));
};

/**
 * Manually triggers the loading of initial data.
 * Used when the backend indicates no data exists (404 on fetchInitialData).
 *
 * @returns {Promise<void>}
 */
export const loadInitialData = async (userId: string): Promise<void> => {
  const response = await fetchWithRetry(`${API_BASE_URL}/initial-data`, {
    method: 'POST',
  });

  let response1 = await supabaseService.getAllCategories(userId);
  let response2 = await supabaseService.getAllPhrases(userId);

  console.log('Response from /initial-data:', response);
  console.log('Response from /categories:', response1);
  console.log('Response from /phrases:', response2);

  await handleResponse(response);
};

// --- User Profile API ---
import type { LanguageProfile } from '../types.ts';
import { useAuth } from '../contexts/authContext.tsx';
import { DbCategory, DbPhrase } from './supabaseService.ts';

/**
 * Fetches the current user's language profile.
 * Returns null if the user has no profile (e.g. new user).
 *
 * @returns {Promise<LanguageProfile | null>} The user profile or null.
 */
export const getUserProfile = async (): Promise<LanguageProfile | null> => {
  const response = await fetchWithRetry(`${API_BASE_URL}/user-profile`);

  // A 404 means the user has no profile yet (brand new account)
  if (response.status === 404) {
    return null;
  }

  const data = await handleResponse(response);

  if (!data) {
    return null;
  }

  return {
    ui: data.ui_language,
    native: data.native_language,
    learning: data.learning_language,
  };
};

/**
 * Updates the existing user profile.
 *
 * @param {LanguageProfile} profile - The updated profile data.
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (profile: LanguageProfile): Promise<void> => {
  const response = await fetchWithRetry(`${API_BASE_URL}/user-profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ui_language: profile.ui,
      native_language: profile.native,
      learning_language: profile.learning,
    }),
  });
  await handleResponse(response);
};

/**
 * Creates or updates the user profile (Upsert).
 * Useful for initial profile creation or ensuring it exists.
 *
 * @param {LanguageProfile} profile - The profile data to save.
 * @returns {Promise<void>}
 */
export const upsertUserProfile = async (profile: LanguageProfile): Promise<void> => {
  const response = await fetchWithRetry(`${API_BASE_URL}/user-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ui_language: profile.ui,
      native_language: profile.native,
      learning_language: profile.learning,
    }),
  });
  await handleResponse(response);
};
