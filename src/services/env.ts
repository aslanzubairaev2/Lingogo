const isPlaceholder = (value: string | undefined | null): boolean => {
  if (!value) {
    return true;
  }
  return value.trim() === '' || value.includes('PASTE') || value.includes('YOUR_');
};

export const getSupabaseUrl = (): string | null => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return isPlaceholder(url) ? null : url!.trim();
};

export const getSupabaseAnonKey = (): string | null => {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return isPlaceholder(key) ? null : key!.trim();
};

export const getGeminiApiKey = (): string | null => {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (isPlaceholder(key)) {
    return null;
  }
  return key!.trim();
};

export const getDeepseekApiKey = (): string | null => {
  const key = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (isPlaceholder(key)) {
    return null;
  }
  return key!.trim();
};
