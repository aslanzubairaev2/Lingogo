const CACHE_KEYS = [
  'learningPhrases',
  'learningAppSettings',
  'learningAppCategories',
  'learningAppButtonUsage',
  'learningAppMasteryButtonUsage',
  'learningAppHabitTracker',
  'learningAppCardActionUsage',
  'learningAppPracticeChatHistory'
];

export const clearAppCaches = (): void => {
  try {
    CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
    // Also clear main user data
    localStorage.removeItem('learningPhrases');
    localStorage.removeItem('learningAppCategories');
  } catch (error) {
    console.error('Не удалось очистить кеш приложения', error);
  }
};
