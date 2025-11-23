# Copilot / AI agent instructions for Learning-Phrase-Practice

These concise instructions help AI coding agents be productive in this repository. Focus on observable patterns and files the project actually uses.

1) Big picture (what this repo is)
- Single-page React + Vite frontend (TypeScript/TSX) in the repo root. Key entry points: `index.tsx`, `App.tsx`.
- Optional/back-end folder: `Learning-Phrase-Practice-Back` contains an Express-like REST API and Supabase client (`supabaseClient.js`) used for server-side data.
- AI integrations are encapsulated as provider implementations in `services/` (notably `services/geminiService.ts` and `services/deepseekService.ts`). The app picks a provider via `services/apiProvider.ts`.

2) How the app wires AI and why
- The UI calls high-level AI methods through an `AiService` interface in `services/aiService.ts`. Concrete implementations (Gemini, DeepSeek) implement that interface. Prefer editing or adding behavior by changing or adding implementations under `services/` rather than spreading AI logic into components.
- Provider selection: `services/apiProvider.ts` exports `getProviderPriorityList()` and `getFallbackProvider()`; `App.tsx` calls `provider.healthCheck()` to select an active provider. Keep health checks fast and reliable.
- Example usage: `App.tsx` dynamically imports and calls `translateLocaleTemplate` from `services/geminiService.ts` via language tools and localization scripts.

3) Build / run / test (exact commands)
- Install dependencies: `npm install` (root).
- Run dev server: `npm run dev` (starts Vite). The `README.md` lists this exact flow.
- Build: `npm run build`; preview build: `npm run preview`.
- Lint + i18n validation: `npm run validate-i18n` (runs `eslint` and `node scripts/validate-i18n.mjs`). Use this before commits; it's wired to `precommit` script.
- Localization test helper: `scripts/test-ai-generation.js` is intended to be loaded in the browser console to exercise `translateLocaleTemplate` at runtime.

4) Environment / secrets
- Frontend expects AI credentials via environment variables (e.g. `GEMINI_API_KEY` as mentioned in `README.md`). The backend uses `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see `Learning-Phrase-Practice-Back/supabaseClient.js` and the back README).
- Do not hardcode keys. Use `.env.local` for local frontend env values and `.env` or deployment secrets for backend.

5) Project-specific conventions and patterns
- Services pattern: Put feature logic behind small service modules in `services/` (e.g., `srsService`, `cacheService`, `backendService`, `geminiService`). Components call services, not third-party SDKs directly.
- AiService contract: Implement the functions declared in `services/aiService.ts`. Many components assume these methods exist (see `services/geminiService.ts` for concrete examples like `generatePhrases`, `translatePhrase`, `improvePhrase`, `healthCheck`). When adding new AI capabilities, follow the same function-signature style.
- Localization shape: JSON locale files live in `src/i18n` (base `en.json`). The `scripts/validate-i18n.mjs` script flattens nested keys into dotted keys and validates placeholder tokens (pattern: `{{ name }}`). Keep placeholders identical between base and translations.
- Weak locales: `validate-i18n.mjs` marks some locales as "weak" (e.g., `de.json`, `fr.json`) and does not fail on empty translations for them. Be mindful when adding new locales.

6) Integration points and important files to review
- `App.tsx` — high-level app wiring, provider selection, localStorage caching keys (e.g., `learningPhrases`, `learningAppSettings`). Good starting file to understand UI flows.
- `services/geminiService.ts` — large, canonical example of how AI calls are packaged (translate, generate, evaluate, deep-dive, chat continuations, etc.). Use this as a template for other providers.
- `services/apiProvider.ts` — shows provider registration and priority. Edit here to add or reorder providers.
- `scripts/validate-i18n.mjs` — i18n validation logic and placeholder rules.
- `scripts/test-ai-generation.js` — runtime script to test translate/generation functions from the browser console.
- `src/i18n/en.json` and other locale files — canonical translation keys and placeholder examples.
- `Learning-Phrase-Practice-Back/supabaseClient.js` — backend Supabase initialization and required env vars.

7) Debugging tips and quick checks
- If AI features are unavailable, check provider health checks in `services/*Service.ts` and the `getProviderPriorityList()` order in `services/apiProvider.ts`.
- To reproduce localization failures locally, run `node scripts/validate-i18n.mjs` or `npm run validate-i18n` to see missing/placeholder mismatch reports.
- To test AI generation quickly: run the app (`npm run dev`), open the app in the browser, and paste contents of `scripts/test-ai-generation.js` into the console; use `testAIGeneration()`.

8) Example small tasks for an AI agent (with file pointers)
- Implement a new AI provider: copy `services/geminiService.ts` → `services/myProviderService.ts`, implement the `AiService` interface, then add `providers.myProvider = myProviderService;` inside `services/apiProvider.ts`.
- Fix localization placeholder mismatch: run `node scripts/validate-i18n.mjs`, find keys in output, then edit `src/i18n/<locale>.json` to match placeholders in `src/i18n/en.json`.
- Add a quick health-check metric: add a small `healthCheck()` that does a lightweight API call in the provider (see `services/geminiService.ts` healthCheck implementation) and ensure `App.tsx` selects providers correctly.

9) What *not* to change
- Don't move or rename existing translation keys in `src/i18n/en.json` without coordinating updates to `scripts/validate-i18n.mjs` and other locales.
- Avoid changing the AiService method names or signatures unless you update all providers and call sites (many components call these methods directly).

If any section is unclear or you want more examples (e.g., snippets from `services/geminiService.ts` or the provider selection logic in `App.tsx`), tell me which area to expand and I'll iterate.
