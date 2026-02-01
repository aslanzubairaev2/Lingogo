import { createClient } from "@supabase/supabase-js";
import { useLanguage } from "../contexts/languageContext";
import { generateInitialData } from "./generateInitialDataService";

// Получаем URL и ключ из переменных окружения
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type DbCategory = {
  id?: number;
  name: string;
  color: string;
  is_foundational: boolean;
};

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
};

// Проверка на наличие ключей
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Service Key is missing. Make sure to set them in your .env file.");
  // В реальном приложении здесь можно остановить запуск сервера
}

// Создаем и экспортируем клиент Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw new Error('Failed to get user profile');
  }
}

async function verifyToken(token: string) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    throw new Error('Invalid token');
  }
}

export async function getAllCategories(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })
    .eq('user_id', userId);
  if (error) throw error;
  return data;
}

export async function createCategory(userId: string, { name, color, is_foundational }: DbCategory) {
  // Check if category with this name already exists for the user
  const { data: existing, error: checkError } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
    throw checkError;
  }

  if (existing) {
    const error = new Error('Category with this name already exists');
    error.cause = 409; // Conflict
    throw error;
  }

  const { data, error } = await supabase
    .from('categories')
    .insert([{ user_id: userId, name, color, is_foundational }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(userId: string, id: number, { name, color }: DbCategory) {
  const { data, error } = await supabase
    .from('categories')
    .update({ name, color })
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

export async function deleteCategory(userId: string, id: number, migrationTargetId: number) {
  try {
    // Если есть фразы для миграции, обновляем их
    if (migrationTargetId) {
      const { error: updateError } = await supabase
        .from('phrases')
        .update({ category_id: migrationTargetId })
        .eq('category_id', id)
        .eq('user_id', userId);
      if (updateError) throw updateError;
    } else {
      // Иначе (или если миграция не нужна), удаляем связанные фразы
      const { error: deletePhrasesError } = await supabase
        .from('phrases')
        .delete()
        .eq('category_id', id)
        .eq('user_id', userId);
      if (deletePhrasesError) throw deletePhrasesError;
    }

    // Удаляем саму категорию
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

export async function getAllPhrases(userId: string) {
  const { data, error } = await supabase
    .from('phrases')
    .select('*')
    .order('native_text', { ascending: true })
    .eq('user_id', userId);
  if (error) throw error;
  return data;
}

export async function createPhrase(userId: string, { native_text, learning_text, category_id, transcription, context }: DbPhrase) {
  const { data, error } = await supabase
    .from('phrases')
    .insert([{ user_id: userId, native_text, learning_text, category_id, transcription, context }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePhrase(userId: string, id: number, { native_text, learning_text, category_id, transcription, context }: DbPhrase) {
  const { data, error } = await supabase
    .from('phrases')
    .update({ native_text, learning_text, category_id, transcription, context })
    .eq('id', id)
    .eq('user_id', userId)
    .select();
  if (error) throw error;
  if (data.length === 0) {
    const notFoundError = new Error('Phrase not found');
    notFoundError.cause = 404;
    throw notFoundError;
  }
  return data[0];
}

export async function deletePhrase(userId: string, id: number) {
  const { error } = await supabase
    .from('phrases')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

async function getInitialData(userId: string) {
  try {
    console.log(`Fetching initial data for userId: ${userId}`);
    const categories = await getAllCategories(userId);
    console.log(`Fetched ${categories.length} categories`);
    const phrasesData = await getAllPhrases(userId);
    console.log(`Fetched ${phrasesData.length} phrases`);

    const phrases = phrasesData.map(p => ({
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
    throw error; // Re-throw to let controller handle it
  }
}

async function loadInitialData(userId: string) {
  try {
    console.log(`Loading initial data for userId: ${userId}`);

    // Get user's language profile
    const { profile } = useLanguage();

    if (!profile) {
      throw new Error('User profile not found. Please set up your language preferences first.');
    }

    console.log(`Generating initial data for ${profile.native} → ${profile.learning}`);

    // Generate translated data using AI
    const { categories, phrases } = await generateInitialData(
      profile.native,
      profile.learning
    );

    // Create mapping of template category ids to new database category ids
    const categoryMapping = {};

    // Load categories first
    for (const category of categories) {
      // Check if category already exists for the user
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
          is_foundational: category.isFoundational !== undefined ? category.isFoundational : false
        });
        categoryId = newCategory.id;
        console.log(`Created category "${category.name}" with id ${categoryId}`);
      }
      categoryMapping[category.id] = categoryId;
    }

    // Load phrases
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
            context: phrase.context
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
      phrasesCreated: createdCount
    };
  } catch (error) {
    console.error('Error in loadInitialData:', error);
    throw error;
  }
}

