import { defineConfig } from 'i18next-cli';
import { SUPPORTED_LANGUAGE_CODES } from './src/i18n/languageMeta';

export default defineConfig({
  locales: SUPPORTED_LANGUAGE_CODES,
  extract: {
    primaryLanguage: 'en',
    input: ["./App.tsx", "src/**/*.{js,jsx,ts,tsx}"],
    output: "src/i18n/{{language}}.json"
  }
});