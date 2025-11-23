#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Replicate the logic from languageService.ts without importing problematic modules
const PLACEHOLDER_REGEX = /{{\s*([\w.-]+)\s*}}/g;

const collectEntries = (source, prefix = '') => {
  const entries = new Map();
  Object.entries(source).forEach(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      collectEntries(value, nextKey).forEach((nestedValue, nestedKey) => {
        entries.set(nestedKey, nestedValue);
      });
    } else {
      entries.set(nextKey, value);
    }
  });
  return entries;
};

const extractPlaceholders = (value) => {
  if (typeof value !== 'string') return [];
  const matches = value.matchAll(PLACEHOLDER_REGEX);
  const placeholders = new Set();
  for (const match of matches) {
    placeholders.add(match[1]);
  }
  return Array.from(placeholders).sort();
};

const placeholdersMatch = (baseValue, candidateValue) => {
  if (typeof baseValue !== 'string') return true;
  const basePlaceholders = extractPlaceholders(baseValue);
  if (basePlaceholders.length === 0) return true;
  if (typeof candidateValue !== 'string') return false;
  const candidatePlaceholders = extractPlaceholders(candidateValue);
  if (candidatePlaceholders.length !== basePlaceholders.length) return false;
  return basePlaceholders.every((placeholder, index) => candidatePlaceholders[index] === placeholder);
};

const assessLocale = async (candidate) => {
  // Read base template
  const baseTemplate = JSON.parse(await readFile(resolve('src/i18n/en.json'), 'utf-8'));
  log(`Base template has ${Object.keys(baseTemplate).length} top-level keys`);
  const baseEntries = collectEntries(baseTemplate);
  log(`Base entries has ${baseEntries.size} total entries`);

  const candidateEntries = collectEntries(candidate);

  const missingKeys = [];
  const emptyKeys = [];
  const placeholderMismatches = [];

  baseEntries.forEach((baseValue, key) => {
    if (!candidateEntries.has(key)) {
      missingKeys.push(key);
      return;
    }

    const candidateValue = candidateEntries.get(key);

    if (typeof baseValue === 'string') {
      if (typeof candidateValue !== 'string' || candidateValue.trim().length === 0) {
        emptyKeys.push(key);
        return;
      }
      if (!placeholdersMatch(baseValue, candidateValue)) {
        placeholderMismatches.push(key);
      }
    } else if (baseValue !== null && typeof baseValue === 'object') {
      if (candidateValue === null || typeof candidateValue !== 'object') {
        missingKeys.push(key);
      }
    }
  });

  return { missingKeys, emptyKeys, placeholderMismatches };
};

const validateLocaleShape = async (candidate) => {
  const { missingKeys, emptyKeys, placeholderMismatches } = await assessLocale(candidate);
  return missingKeys.length === 0 && emptyKeys.length === 0 && placeholderMismatches.length === 0;
};

const hasLocaleGaps = async (lang) => {
  try {
    const candidate = JSON.parse(await readFile(resolve(`src/i18n/${lang}.json`), 'utf-8'));
    const { missingKeys, emptyKeys, placeholderMismatches } = await assessLocale(candidate);
    return missingKeys.length > 0 || emptyKeys.length > 0 || placeholderMismatches.length > 0;
  } catch (error) {
    // If file doesn't exist or can't be read, consider it as having gaps
    return true;
  }
};

const TEST_LANG = 'fr'; // Testing with French which has gaps
const SUPPORTED_LANGS = ['en', 'de', 'ru', 'fr', 'es', 'it', 'pt', 'pl', 'zh', 'ja', 'ar'];

const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

const testLocalizationProcess = async () => {
  log('Starting localization test...');

  try {
    // Step 1: Check all languages for gaps
    log('Step 1: Checking all supported languages for gaps...');
    const languagesWithGaps = [];
    for (const lang of SUPPORTED_LANGS) {
      const hasGaps = await hasLocaleGaps(lang);
      if (hasGaps) {
        languagesWithGaps.push(lang);
      }
      log(`  ${lang}: ${hasGaps ? 'HAS GAPS' : 'complete'}`);
    }

    if (languagesWithGaps.length > 0) {
      log(`Languages with gaps: ${languagesWithGaps.join(', ')}`);
      if (languagesWithGaps.includes(TEST_LANG)) {
        log(`Test language ${TEST_LANG} has gaps - this would trigger localization`);
      } else {
        log(`Test language ${TEST_LANG} is complete`);
      }
    } else {
      log('All languages are complete - no localization should be needed');
    }

    const hasGaps = languagesWithGaps.includes(TEST_LANG);
    if (!hasGaps) {
      log('Static locale is complete - no localization needed');
      log('But let\'s check if there might be other issues...');
    }

    log('Static locale is incomplete - this would trigger localization process in the app');

    // Step 2: Read the current test locale to see what's missing
    log(`Step 2: Analyzing current ${TEST_LANG}.json locale...`);
    const testLocale = JSON.parse(await readFile(resolve(`src/i18n/${TEST_LANG}.json`), 'utf-8'));
    const assessment = await assessLocale(testLocale);

    log(`Assessment results for ${TEST_LANG}.json:`);
    log(`  - Missing keys: ${assessment.missingKeys.length}`);
    log(`  - Empty keys: ${assessment.emptyKeys.length}`);
    log(`  - Placeholder mismatches: ${assessment.placeholderMismatches.length}`);

    if (assessment.missingKeys.length > 0) {
      log('First 10 missing keys:');
      assessment.missingKeys.slice(0, 10).forEach(key => log(`  - ${key}`));
      if (assessment.missingKeys.length > 10) {
        log(`  ...and ${assessment.missingKeys.length - 10} more`);
      }
    }

    if (assessment.emptyKeys.length > 0) {
      log('First 10 empty keys:');
      assessment.emptyKeys.slice(0, 10).forEach(key => log(`  - ${key}`));
      if (assessment.emptyKeys.length > 10) {
        log(`  ...and ${assessment.emptyKeys.length - 10} more`);
      }
    }

    if (assessment.placeholderMismatches.length > 0) {
      log('First 10 placeholder mismatches:');
      assessment.placeholderMismatches.slice(0, 10).forEach(key => log(`  - ${key}`));
      if (assessment.placeholderMismatches.length > 10) {
        log(`  ...and ${assessment.placeholderMismatches.length - 10} more`);
      }
    }

    // Step 3: Test what happens when we try to simulate the AI generation
    log('Step 3: Simulating what would happen in loadLocaleResources...');
    log('Since we cannot run the full AI generation outside of the app context,');
    log('this test shows that ru.json has gaps, which would trigger the localization process.');
    log('In the actual app, this would lead to:');
    log('1. Checking static locale -> has gaps');
    log('2. Checking cache -> empty (simulated)');
    log('3. Requesting AI generation -> would attempt to call Gemini API');
    log('4. If AI generation succeeds and passes validation -> locale loaded');
    log('5. If AI generation fails or validation fails -> fallback to English');

    const isValid = await validateLocaleShape(testLocale);
    log(`Current ${TEST_LANG}.json is valid: ${isValid}`);

    if (!isValid) {
      log('❌ Current Native locale is invalid - would cause fallback in app');
      log('This explains why you see the English fallback message');
    } else {
      log('✅ Current Native locale is valid - should work without fallback');
    }

  } catch (error) {
    log(`Test failed with error: ${error.message}`);
    console.error(error);
  }
};

// Run the test
testLocalizationProcess().catch((error) => {
  console.error('Test execution failed:', error);
  process.exitCode = 1;
});