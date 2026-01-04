import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tsParser from '@typescript-eslint/parser';
import i18nextPlugin from 'eslint-plugin-i18next';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

const sharedLanguageOptions = {
  parser: tsParser,
  parserOptions: {
    project: ["./tsconfig.json"],
  },
  globals: {
    ...globals.browser,
    ...globals.node,
  },
};

const literalRuleOptions = {
  markupOnly: false,
  ignoreAttributePatterns: ['^aria-', '^data-', '^role$', '^testId$', '^key$'],
  ignorePropertyNames: ['label', 'title', 'ariaLabel'],
  ignoreCalleeNames: ['t', 'toast', 'console', 'setError'],
};

export default [
  {
    ignores: ['dist', 'node_modules'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: sharedLanguageOptions,
    plugins: {
      "@typescript-eslint": typescriptEslint,
      prettier,
      "simple-import-sort": simpleImportSort,
      i18next: i18nextPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      "no-console": "off",
      "prettier/prettier": "warn",
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",
      camelcase: "warn",
      'i18next/no-literal-string': ['warn', literalRuleOptions],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
