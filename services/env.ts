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
  const key = import.meta.env.VITE_API_KEY as string | undefined;
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

const resolveApiBaseUrl = (): string | null => {
  const explicit = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (explicit) {
    return explicit;
  }

  const devUrl = (import.meta.env.VITE_API_BASE_URL_DEV as string | undefined)?.trim();
  const prodUrl = (import.meta.env.VITE_API_BASE_URL_PROD as string | undefined)?.trim();

  if (import.meta.env.DEV && devUrl) {
    return devUrl;
  }
  if (!import.meta.env.DEV && prodUrl) {
    return prodUrl;
  }

  return null;
};

export const getApiBaseUrl = (): string => {
  const resolved = resolveApiBaseUrl();
  if (resolved) {
    return resolved;
  }

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal ? 'http://localhost:3001/api' : 'https://german-phrase-practice-back.vercel.app/api';
};
