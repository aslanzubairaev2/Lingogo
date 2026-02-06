import { createClient } from '@supabase/supabase-js';

import { useLanguage } from '../contexts/languageContext';
import { generateInitialData } from './generateInitialDataService';

/**
 * Supabase Service
 *
 * Provides a set of utility functions to interact with Supabase database (PostgreSQL)
 * and Authentication. This service handles user profiles, categories, and phrases.
 */

// Load Supabase URL and key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Database Category type definition
 */
export type DbCategory = {
  id?: number;
  name: string;
  color: string;
  is_foundational: boolean;
  user_id?: string;
};

/**
 * Database Phrase type definition
 */
export type DbPhrase = {
  id?: number;
  native_text: string;
  learning_text: string;
  category_id: number;
  transcription: string;
  context: string;
  masteryLevel?: number;
  lastReviewedAt?: number;
  nextReviewAt?: number;
  knowCount?: number;
  knowStreak?: number;
  isMastered?: boolean;
  lapses?: number;
  user_id?: string;
};

// Check if environment variables are properly set
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Service Key is missing. Make sure to set them in your .env file.');
}

// Initialize and export the Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Retrieves a user's authentication profile from Supabase Auth.
 *
 * @param userId - The unique identifier of the user.
 * @returns The user object from Supabase Auth.
 * @throws Error if retrieval fails.
 */
export async function getAuthUserProfile(userId: string) {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw new Error('Failed to get user profile');
  }
}

/**
 * Verifies an authentication token and returns the associated user.
 *
 * @param token - The Supabase access token.
 * @returns The user object if the token is valid.
 * @throws Error if the token is invalid or verification fails.
 */
export async function verifyAuthUserToken(token: string) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    throw new Error('Invalid token');
  }
}

/**
 * Fetches the application-specific user profile from the 'user_profiles' table.
 *
 * @param userId - The unique identifier of the user.
 * @returns The profile data or null if not found.
 * @throws Error if the database query fails (excluding 'not found').
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', userId).single();

  if (error && error.code === 'PGRST116') {
    // No profile found - return null instead of creating default
    // Let the frontend handle onboarding
    return null;
  }

  if (error) throw error;
  return data;
}

/**
 * Creates a default user profile for a new user.
 *
 * @param userId - The unique identifier of the user.
 * @returns The newly created profile data.
 * @throws Error if the insertion fails.
 */
export async function createDefaultProfile(userId: string) {
  // Default to English for new users
  const { data, error } = await supabase
    .from('user_profiles')
    .insert([
      {
        user_id: userId,
        ui_language: 'en',
        native_language: 'en',
        learning_language: 'de',
        schema_version: 1,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Updates an existing user profile or creates it if it doesn't exist.
 *
 * @param userId - The unique identifier of the user.
 * @param profileData - The new language preferences for the user.
 * @returns The updated profile data.
 */
export async function updateUserProfile(userId: string, { ui_language, native_language, learning_language }) {
  const payload = {
    ui_language,
    native_language,
    learning_language,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('user_profiles')
    .update(payload)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return upsertUserProfile(userId, { ui_language, native_language, learning_language });
    }
    throw error;
  }

  if (!data) {
    // No existing profile for this user yet - create one instead of failing.
    return upsertUserProfile(userId, { ui_language, native_language, learning_language });
  }

  return data;
}

/**
 * Performs an upsert operation on the user profile.
 *
 * @param userId - The unique identifier of the user.
 * @param profileData - The profile data to upsert.
 * @returns The upserted profile data.
 * @throws Error if the operation fails.
 */
export async function upsertUserProfile(userId: string, { ui_language, native_language, learning_language }) {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        ui_language,
        native_language,
        learning_language,
        schema_version: 1,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Retrieves all categories associated with a specific user.
 *
 * @param userId - The unique identifier of the user.
 * @returns A promise that resolves to an array of categories.
 * @throws Error if retrieval fails.
 */
export async function getAllCategories(userId: string): Promise<DbCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })
    .eq('user_id', userId);
  if (error) throw error;
  return data;
}

/**
 * Creates a new category for a user, ensuring the name is unique for that user.
 *
 * @param userId - The unique identifier of the user.
 * @param category - The category data to insert.
 * @returns The newly created category.
 * @throws Error 409 if category name already exists, or other query errors.
 */
export async function createCategory(userId: string, category: DbCategory): Promise<DbCategory> {
  // Check if category with this name already exists for the user
  const { data: existing, error: checkError } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', category.name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    // PGRST116 is "not found"
    throw checkError;
  }

  if (existing) {
    const error = new Error('Category with this name already exists');
    error.cause = 409; // Conflict
    throw error;
  }

  category.user_id = userId;
  const { data, error } = await supabase.from('categories').insert([category]).select().single();
  if (error) throw error;
  return data;
}

/**
 * Updates an existing category's information.
 *
 * @param userId - The owner of the category.
 * @param id - The numeric ID of the category.
 * @param category - The updated category data.
 * @returns The updated category object.
 * @throws Error 404 if not found or other query errors.
 */
export async function updateCategory(userId: string, id: number, category: DbCategory): Promise<DbCategory> {
  const { data, error } = await supabase
    .from('categories')
    .update(category)
    .eq('id', id)
    .eq('user_id', userId)
    .select();
  if (error) throw error;
  if (data.length === 0) {
    const notFoundError = new Error('Category not found');
    notFoundError.cause = 404;
    throw notFoundError;
  }
  return data[0];
}

/**
 * Deletes a category and either migrates its phrases to another category or deletes them.
 *
 * @param userId - The owner of the category.
 * @param id - The ID of the category to delete.
 * @param migrationTargetId - The ID of the category to move phrases to. If null/0, phrases are deleted.
 * @throws Error if any operation fails.
 */
export async function deleteCategory(userId: string, id: number, migrationTargetId: number): Promise<void> {
  try {
    // If migration target ID is provided, move phrases to it
    if (migrationTargetId) {
      const { error: updateError } = await supabase
        .from('phrases')
        .update({ category_id: migrationTargetId })
        .eq('category_id', id)
        .eq('user_id', userId);
      if (updateError) throw updateError;
    } else {
      // Otherwise, delete all phrases in this category
      const { error: deletePhrasesError } = await supabase
        .from('phrases')
        .delete()
        .eq('category_id', id)
        .eq('user_id', userId);
      if (deletePhrasesError) throw deletePhrasesError;
    }

    // Delete the category itself
    const { error: deleteCategoryError } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (deleteCategoryError) throw deleteCategoryError;
  } catch (error) {
    throw error;
  }
}

/**
 * Retrieves all phrases belonging to a user.
 *
 * @param userId - The unique identifier of the user.
 * @returns A promise resolving to an array of phrases.
 * @throws Error if retrieval fails.
 */
export async function getAllPhrases(userId: string): Promise<DbPhrase[]> {
  const { data, error } = await supabase
    .from('phrases')
    .select('*')
    .order('native_text', { ascending: true })
    .eq('user_id', userId);
  if (error) throw error;
  return data;
}

/**
 * Creates a new phrase in the database.
 *
 * @param userId - The owner of the phrase.
 * @param phrase - The phrase data.
 * @returns The newly created phrase.
 * @throws Error if insertion fails.
 */
export async function createPhrase(userId: string, phrase: DbPhrase): Promise<DbPhrase> {
  phrase.user_id = userId;
  const { data, error } = await supabase.from('phrases').insert([phrase]).select().single();
  if (error) throw error;
  return data;
}

/**
 * Updates an existing phrase.
 *
 * @param userId - The owner of the phrase.
 * @param id - The numeric ID of the phrase.
 * @param phrase - The updated phrase data.
 * @returns The updated phrase object.
 * @throws Error 404 if not found or other query errors.
 */
export async function updatePhrase(userId: string, id: number, phrase: DbPhrase): Promise<DbPhrase> {
  console.log('Updating phrase:', phrase);
  const { data, error } = await supabase.from('phrases').update(phrase).eq('id', id).eq('user_id', userId).select();
  if (error) throw error;
  if (data.length === 0) {
    const notFoundError = new Error('Phrase not found');
    notFoundError.cause = 404;
    throw notFoundError;
  }
  return data[0];
}

/**
 * Deletes a phrase from the database.
 *
 * @param userId - The owner of the phrase.
 * @param id - The numeric ID of the phrase.
 * @returns A promise that resolves when the phrase is deleted.
 * @throws Error if deletion fails.
 */
export async function deletePhrase(userId: string, id: number): Promise<void> {
  const { error } = await supabase.from('phrases').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/**
 * Internal helper to fetch all categories and phrases for a user.
 *
 * @param userId - The user ID.
 * @returns An object containing categories and mapped phrases.
 */
async function getInitialData(userId: string) {
  try {
    console.log(`Fetching initial data for userId: ${userId}`);
    const categories = await getAllCategories(userId);
    console.log(`Fetched ${categories.length} categories`);
    const phrasesData = await getAllPhrases(userId);
    console.log(`Fetched ${phrasesData.length} phrases`);

    const phrases = phrasesData.map((p) => ({
      id: p.id,
      native: p.native_text,
      learning: p.learning_text,
      category: p.category_id,
      transcription: p.transcription,
      context: p.context,
      masteryLevel: p.masteryLevel || 0,
      lastReviewedAt: p.lastReviewedAt,
      nextReviewAt: p.nextReviewAt || Date.now(),
      knowCount: p.knowCount || 0,
      knowStreak: p.knowStreak || 0,
      isMastered: p.isMastered || false,
      lapses: p.lapses || 0,
    }));

    return { categories, phrases };
  } catch (error) {
    console.error('Error in getInitialData:', error);
    throw error;
  }
}

/**
 * Triggers the generation of initial data (categories and phrases) for a user
 * using an AI service and saves it to Supabase.
 *
 * @param userId - The unique identifier of the user.
 * @returns A result summary object.
 * @throws Error if generation or saving fails.
 */
export async function loadInitialData(userId: string) {
  try {
    console.log(`Loading initial data for userId: ${userId}`);

    // Get user's language profile from context (requires active hook session)
    const { profile } = useLanguage();

    if (!profile) {
      throw new Error('User profile not found. Please set up your language preferences first.');
    }

    console.log(`Generating initial data for ${profile.native} → ${profile.learning}`);

    // Generate translated data templates using AI
    const { categories, phrases } = await generateInitialData(profile.native, profile.learning);

    // Map template category IDs to newly created DB IDs
    const categoryMapping = {};

    // First, process categories
    for (const category of categories) {
      // Check if a category with the same name already exists to avoid duplicates
      const { data: existingCategory, error: checkError } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .eq('name', category.name)
        .single();

      let categoryId;
      if (existingCategory) {
        categoryId = existingCategory.id;
        console.log(`Category "${category.name}" already exists with id ${categoryId}`);
      } else {
        const newCategory = await createCategory(userId, {
          name: category.name,
          color: category.color,
          is_foundational: category.isFoundational !== undefined ? category.isFoundational : false,
        });
        categoryId = newCategory.id;
        console.log(`Created category "${category.name}" with id ${categoryId}`);
      }
      categoryMapping[category.id] = categoryId;
    }

    // Next, process phrases
    let createdCount = 0;
    let errorCount = 0;
    for (const phrase of phrases) {
      const categoryId = categoryMapping[phrase.category];
      if (categoryId) {
        try {
          await createPhrase(userId, {
            native_text: phrase.native,
            learning_text: phrase.learning,
            category_id: categoryId,
            transcription: phrase.transcription,
            context: phrase.context,
          });
          createdCount++;
        } catch (phraseError) {
          errorCount++;
          console.error(`Failed to create phrase: "${phrase.native}" -> "${phrase.learning}"`, phraseError.message);
        }
      }
    }

    if (errorCount > 0) {
      console.warn(`Created ${createdCount} phrases with ${errorCount} errors`);
    }

    console.log(`Initial data loaded: ${categories.length} categories, ${createdCount} phrases`);
    return {
      message: 'Initial data loaded successfully',
      categoriesCreated: categories.length,
      phrasesCreated: createdCount,
    };
  } catch (error) {
    console.error('Error in loadInitialData:', error);
    throw error;
  }
}
