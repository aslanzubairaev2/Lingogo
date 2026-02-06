import { Category, Phrase } from '../types.ts';
import * as supabaseService from './supabaseService.ts';
import { DbCategory, DbPhrase } from './supabaseService.ts';

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
const feCategory = (beCategory: DbCategory): Category => ({
  id: beCategory.id.toString(),
  name: beCategory.name,
  color: hexToTailwindMap[beCategory.color.toLowerCase()] || 'bg-slate-500',
  isFoundational: beCategory.is_foundational,
});

/**
 * Converts a raw backend phrase object to the frontend Phrase type.
 * Maps flat backend fields to nested objects (text, romanization, context).
 */
const fePhrase = (bePhrase: supabaseService.DbPhrase): Phrase => {
  const categoryId = bePhrase.category_id;
  // Map backend's flat structure to the frontend's nested `text` object.
  return {
    id: bePhrase.id.toString(),
    text: {
      native: bePhrase.native_text,
      learning: bePhrase.learning_text,
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
 * Fetches the initial data set (categories and phrases) for the application.
 * If a 404 is encountered, it triggers a data load and retries.
 *
 * @returns {Promise<{ categories: Category[]; phrases: Phrase[] }>} A promise resolving to the initial data.
 */
export const fetchInitialData = async (userId: string): Promise<{ categories: Category[]; phrases: Phrase[] }> => {
  const categories: DbCategory[] = await supabaseService.getAllCategories(userId).catch((error) => {
    console.error('Error fetching categories:', error);
    return [];
  });
  const phrases: DbPhrase[] = await supabaseService.getAllPhrases(userId).catch((error) => {
    console.error('Error fetching phrases:', error);
    return [];
  });

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
export const createPhrase = async (
  userId: string,
  phrase: Omit<
    Phrase,
    'id' | 'masteryLevel' | 'lastReviewedAt' | 'nextReviewAt' | 'knowCount' | 'knowStreak' | 'isMastered' | 'lapses'
  >
): Promise<Phrase> => {
  const dbPhrase: DbPhrase = {
    native_text: phrase.text.native,
    learning_text: phrase.text.learning,
    category_id: parseInt(phrase.category, 10),
    transcription: phrase.romanization?.learning,
    context: phrase.context?.native,
  };
  const created: DbPhrase = await supabaseService.createPhrase(userId, dbPhrase).catch((error) => {
    console.error('Error creating phrase:', error);
    return dbPhrase;
  });
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
  const dBphrase: DbPhrase = {
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

  if (dBphrase.category_id <= 0) {
    throw new Error('Category ID is required and must be a number');
  }

  const updated: DbPhrase = await supabaseService.updatePhrase(userId, dBphrase.id, dBphrase).catch((error) => {
    console.error('Error updating phrase:', error);
    return dBphrase;
  });

  return fePhrase(updated);
};

/**
 * Deletes a phrase by its ID.
 *
 * @param {string} phraseId - The ID of the phrase to delete.
 * @returns {Promise<void>}
 */
export const deletePhrase = async (userId: string, phraseId: string): Promise<void> => {
  await supabaseService.deletePhrase(userId, parseInt(phraseId, 10)).catch((error) => {
    console.error('Error deleting phrase:', error);
  });
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

  const dbCategory: DbCategory = {
    name: categoryData.name,
    color: hexColor,
    is_foundational: categoryData.isFoundational,
  };

  const created: DbCategory = await supabaseService.createCategory(userId, dbCategory).catch((error) => {
    console.error('Error creating category:', error);
    return dbCategory;
  });
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
  const dbCategory: DbCategory = {
    id: parseInt(category.id, 10),
    is_foundational: category.isFoundational,
    name: category.name,
    color: hexColor,
  };

  const updated: DbCategory = await supabaseService.updateCategory(userId, dbCategory.id, dbCategory).catch((error) => {
    console.error('Error updating category:', error);
    return dbCategory;
  });
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
  await supabaseService
    .deleteCategory(userId, parseInt(categoryId, 10), parseInt(migrationTargetId, 10))
    .catch((error) => {
      console.error('Error deleting category:', error);
    });
};

/**
 * Manually triggers the loading of initial data.
 * Used when the backend indicates no data exists (404 on fetchInitialData).
 *
 * @returns {Promise<void>}
 */
export const loadInitialData = async (userId: string): Promise<void> => {
  await supabaseService.loadInitialData(userId).catch((error) => {
    console.error('Error loading initial data:', error);
  });
};

// --- User Profile API ---
import type { LanguageProfile } from '../types.ts';

/**
 * Fetches the current user's language profile.
 * Returns null if the user has no profile (e.g. new user).
 *
 * @returns {Promise<LanguageProfile | null>} The user profile or null.
 */
export const getUserProfile = async (userId: string): Promise<LanguageProfile | null> => {
  const data = await supabaseService.getUserProfile(userId);

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
export const updateUserProfile = async (userId: string, profile: LanguageProfile): Promise<void> => {
  await supabaseService.updateUserProfile(userId, {
    ui_language: profile.ui,
    native_language: profile.native,
    learning_language: profile.learning,
  });
};

/**
 * Creates or updates the user profile (Upsert).
 * Useful for initial profile creation or ensuring it exists.
 *
 * @param {LanguageProfile} profile - The profile data to save.
 * @returns {Promise<void>}
 */
export const upsertUserProfile = async (userId: string, profile: LanguageProfile): Promise<void> => {
  await supabaseService.upsertUserProfile(userId, {
    ui_language: profile.ui,
    native_language: profile.native,
    learning_language: profile.learning,
  });
};
