# Changelog

All notable changes to MobileEnglish are documented here.

---

## [Unreleased] — 2026-06-07 (continued)

### feat & fix: AI-personalized vocabulary, simpler API-key flow, SRS corrections, quiz fixes & dead-code cleanup

> **Summary:** Wire up cloud-LLM personalized word generation in deck creation; radically simplify API-key setup (Gemini-first, paste-from-clipboard, "Advanced" collapsed); fix two SM-2 scheduling bugs; fix the multiple-choice quiz results "black screen"; offer a new starter deck when the level/target language changes; and remove a large amount of dead code.

---

#### Part A: AI-personalized vocabulary generation

- Revived + rewrote `HybridLLMManager.selectNewWords` (was orphaned dead code): CEFR-calibrated prompt, clean schema (`word/translation/level/exampleSentence/partOfSpeech`), asymmetric rule (word + example in target, translation in native), native-script requirement, stronger dedup, fixed level mapping (`cefrToLevel`, not `parseInt`).
- `app/create-deck.tsx` — new "✨ Generate personalized words" button that appends profile-based cloud words to the list; disabled with a hint when no AI connection. The local "Generate Words" stays the mandatory base.
- Word-count options 5/10/15/20 → 5/10/15/20/30/50; the "AI Generate" tab renamed to "Generate Words" (it was always local generation).

#### Part B: Simpler API-key setup

- `app/setting-modal.tsx` — Gemini is the default; "Get a free Gemini key" button (opens Google AI Studio), 3-step guide, "Paste from clipboard" (`expo-clipboard`); provider / base-URL / model collapsed under "Advanced".
- Removed the redundant standalone "AI Provider" step (Settings row + `ai_provider` modal case).
- Saving a key now writes only the active provider and clears stale ones — fixes requests being misrouted to a leftover custom/Azure endpoint ("prepayment credits depleted" 429).

#### Part C: SRS scheduling fixes (`src/entities/SRS/SRSAlgorithm.ts`)

- "Good" now maps to SM-2 quality **4** (was 3) → the ease factor no longer erodes on every correct answer (intervals grow ~×2.5 instead of decaying to ×1.3).
- "Easy" graduation sets `repetitions` correctly so the next "Good" no longer collapses the interval (the 4-day → 1-day bug).

#### Part D: Level / target-language change → starter deck

- Changing level or target language in Settings now offers to create a matching CEFR starter deck (prompt + create), so study content follows the new level.

#### Part E: Quiz "black screen" fix (`app/quiz-mc.tsx`, `XPToast`, `BadgeToast`)

- Root cause: the results tree used Reanimated `Animated.*` with layout animations; on-device the layout-animation system left the results container stuck at `opacity: 0` (cleared only on touch). `XPToast` also combined a `transform` with `entering`/`exiting` (the Reanimated warning).
- Fix: results now rendered with plain `View`/`Text` (no Reanimated); removed all entering/exiting layout animations from the quiz screen and from `XPToast`/`BadgeToast`; switch to the results phase **before** the awaited DB write; visible fallback instead of a `null` render.

#### Part F: Dead-code & architecture cleanup

- Expo-template leftovers removed: `app/modal.tsx` (+ its `Stack.Screen`), `components/{hello-wave,external-link,parallax-scroll-view,themed-text,themed-view,haptic-tab,ui/collapsible}`, `hooks/{use-color-scheme,use-color-scheme.web,use-theme-color}`, `constants/theme.ts`.
- Unused `src/shared/ui` design system removed: `GlassCard, GradientButton, GhostButton, StatBadge, ProgressBar, SectionHeader, Chip` + barrel `index.ts`.
- Orphaned `ProfileUpdater`, `QuizEngine` removed; dead `HybridLLMManager` methods (`generateQuizContent`, `checkGrammar`, `analyzeProfile`, `generateFallbackQuiz`) and dead `VectorStore` methods (`getAll`, `getByLevel`, `getRandomWords`, `getLevels`, `getStats`) removed.
- Result: a single coherent UI system; empty `hooks/`, `constants/`, `src/processes/`, `src/features/` directories gone.

#### Part G: Play Store prep

- `eas.json` — Supabase env vars (`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`) added to all build profiles, so cloud (EAS) builds don't ship with an unconfigured Supabase client (auth/sync would silently fail). The anon/publishable key is client-safe.
- **Account deletion** (Google Play requirement): `supabase/delete-account.sql` adds a `delete_account()` RPC (SECURITY DEFINER, caller-only) that removes the user's data + auth row; `AuthService.deleteAccount()` calls it then signs out; Settings → Account gains a "Delete account" action (with confirmation).

---

## [Unreleased] — 2026-06-07

### feat: Google authentication, cross-device sync (Supabase) & text-to-speech

> **Summary:** Add Supabase-backed Google sign-in (guest mode preserved) and
> WatermelonDB ↔ Supabase synchronization via Postgres RPC, so a signed-in user's
> decks / cards / study sessions sync across devices. Add an on-device text-to-speech
> "speak" button across the study screens. Remove stray tracked files from the repo.

> **Breaking changes:** Database schema v4 → v5 (adds `user_settings.supabase_user_id`);
> migration included.

---

#### Part A: Text-to-Speech (SpeakButton)

**New component (`src/shared/ui/SpeakButton.tsx`):**
- Pronunciation button wrapping `expo-speech` (device TTS)
- Auto-hides when the target language has no voice on the device
  (`Speech.getAvailableVoicesAsync()` checked once, cached at module level)
- Tap to speak / tap again to stop; animated pulse while speaking (reanimated)
- Uses `toBcp47()` from languageConfig to map internal codes → locale (e.g. `de` → `de-DE`)

**Integration:**
- `app/study.tsx` — overlay button on the flashcard, placed **outside** the
  GestureDetector so it never triggers flip/swipe; speaks the word on the front and
  the example sentence on the back
- `app/deck-detail.tsx` — speak button in each card's action column
- `app/create-deck.tsx` — speak button on each generated / looked-up word
- `src/shared/ui/index.ts` — export SpeakButton

---

#### Part B: Supabase Google Authentication (guest mode preserved)

**Client (`src/shared/api/supabase/client.ts`):**
- `createClient` using `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Storage adapter: SecureStore on native, AsyncStorage on web
- **Chunked SecureStore adapter** — splits values larger than ~2 KB across multiple
  keys so large Google session tokens persist (SecureStore caps each value at ~2048 bytes);
  fixes "session not kept after restart"

**Auth service (`src/shared/api/supabase/AuthService.ts`):**
- `signInWithGoogle()` — web OAuth via `signInWithOAuth` + `expo-web-browser`
  `openAuthSessionAsync`; PKCE flow exchanges the redirect `?code=` for a session
  (`exchangeCodeForSession`), with an implicit-flow fallback
- `signOut()`, `getSession()`, `onAuthStateChange()`

**OAuth deep-link route (`app/auth/callback.tsx`):**
- Handles the `lingualearn://auth/callback?code=...` redirect (expo-router intercepts
  the deep link), exchanges the code, returns to Settings
- Fixes the "Unmatched Route" error that appeared when the browser redirected back

**State & persistence:**
- `src/shared/lib/stores/useProfileStore.ts` — `supabaseSession` + `setSupabaseSession`
  (null = guest)
- `src/entities/UserProfile/model.ts` + schema **v5** + migration — `supabase_user_id`
  (nullable)
- `app/_layout.tsx` — restore session on startup; `onAuthStateChange` keeps the store
  in sync and persists `supabase_user_id`

**Settings UI (`app/(tabs)/settings.tsx`):**
- New "Account" section: "Sign in with Google" when guest; email + sign-out when signed in
- i18n keys added (en, tr; other locales fall back to en)

---

#### Part C: WatermelonDB ↔ Supabase Sync (Postgres RPC)

**Backend (`supabase/sync.sql`) — run once in the Supabase SQL Editor:**
- Tables `decks`, `cards`, `study_sessions` mirroring the local schema, plus
  `user_id`, `_deleted` (soft delete) and `server_updated_at` (pull cursor)
- `server_updated_at` trigger on insert/update
- Row Level Security: `auth.uid() = user_id` on every table
- `pull(last_pulled_at)` — returns `{ changes: { created, updated, deleted }, timestamp }`
  per table (server-only columns stripped to match the local schema)
- `push(changes)` — upsert (last-write-wins) + soft-delete
- Table + function grants for the `authenticated` role (raw-SQL tables are **not**
  auto-granted by Supabase — fixes "permission denied for table")

**App (`src/shared/api/supabase/SyncService.ts`):**
- `syncDatabase()` — WatermelonDB `synchronize()` calling `supabase.rpc('pull' / 'push')`;
  `sendCreatedAsUpdated: true`; no-ops when not signed in or already syncing
- Triggers: after sign-in (SIGNED_IN / INITIAL_SESSION) and on app foreground (AppState)
- Manual "Sync now" button in Settings → Account (for testing / demo)

**Not synced:** `user_settings`, `chat_messages` (per-device; different ids would duplicate).

---

#### Part D: Repo cleanup & dependencies

**Removed stray tracked files:**
- `git_diff.txt` (3054 lines), `git_staged_diff.txt`, `test1.txt`, `tsc_output.txt`
- `.gitignore` — ignore `.idea/` and the above artifacts

**Dependencies added:**
- `@supabase/supabase-js`, `expo-secure-store`, `react-native-url-polyfill`,
  `expo-auth-session`, `expo-web-browser`, `expo-speech`
- Native modules → a new development build is required to run these.

---

#### Part E: Manual setup required (Supabase dashboard)

- **Authentication → Providers → Google:** enabled with a **Web** OAuth client
  (Google Cloud authorized redirect: `https://<project>.supabase.co/auth/v1/callback`)
- **Authentication → URL Configuration → Redirect URLs:** add `lingualearn://auth/callback`
- **SQL Editor:** run `supabase/sync.sql`

---

## [Unreleased] — 2026-06-06

### refactor: Complete infrastructure overhaul — bridge-language strategy, SLM removal, category elimination

> **Summary:** Remove on-device SLM (llama.rn) → cloud-only design. Eliminate category system from wordlists → simpler RAG. Expand language support via bridge-language strategy: 11 target languages → Turkish native + Turkish → English native (12 pairs total). Generate ~3,600 calibrated vocabulary entries across all new pairs.

> **Breaking Changes:** 
> - llama.rn dependency removed; cloud API key now mandatory for all AI features
> - Category system removed from VectorStore API; all wordlists stripped of category metadata
> - Language pair matrix reduced from 22 to 12 pairs (ar/ja removed per strategy pivot)
> - SUPPORTED_NATIVE_LANGUAGES reduced from 6 to 2 (tr, en only)
> - VectorStore.search() signature changed: `categories` parameter removed

---

#### Part A: Dependency & Native Module Cleanup

**Removed llama.rn and dead code:**
- Delete `src/shared/api/llm/LocalSLMClient.ts` — on-device GGUF inference client (128 lines)
- Delete `src/shared/api/llm/ModelDownloadManager.ts` — GGUF catalog manager (346 lines)
- Delete `app/model-manager.tsx` — "Local Models" screen for model download/management (198 lines)
- Delete `src/processes/LearningSession.ts` — unused SLM-era orchestrator (never imported)
- Delete `src/shared/api/rag/dictionary.json` — legacy static dictionary (no longer referenced after VectorStore refactor)
- Update `package.json` — remove `llama.rn` dependency

**Rationale:**
- Bridge-language strategy decision: all personalization delegated to cloud LLM
- On-device inference adds 120MB+ native footprint; removed to simplify builds
- All AI features now require cloud key; fallback complexity no longer justified

---

#### Part B: Category System Elimination

> **Decision Context:** User requested moving category filtering to cloud LLM for personalization. This decouples wordlist generation from learner context. Result: simpler RAG system, faster generation, no category attribute maintenance.

**Updated VectorStore (`src/shared/api/rag/VectorStore.ts`):**
- `DictionaryEntry` interface: removed `category: string` field
  - Now 5 fields only: `word`, `translation`, `level`, `exampleSentence`, `partOfSpeech?`
- Removed `getByCategory()` method (no longer needed)
- Removed `getCategories()` method (no longer needed)
- Updated `search()` signature
  - Before: `search(level?, interests?, categories?, excludeWords?, limit?)`
  - After: `search({ level?, interests?, excludeWords?, limit? })`
- Removed category-based scoring in search algorithm
  - Before: `score += 3` for category match
  - After: Only interest matching and exact level bonus remain
- `WORDLIST_MAP`: keys remain `"target-native"` format (no category subchannel)

**Updated UI — removed category selector:**
- `app/create-deck.tsx`
  - Delete `CATEGORY_KEYS` constant (8 category definitions)
  - Delete `selectedCategory` state
  - Remove category chip selector UI (horizontal ScrollView block)
  - Update `generateWords()` call to remove `categories` parameter
  - Remove `category: selectedCategory` assignment in manual word entry
  - Remove `import { cefrToLevel }` (unused after refactor)
- `app/deck-detail.tsx`
  - Remove unused `cefrToLevel` import
  - Backward compatibility: fallback category to deck's category if present in old data

**Updated i18n — removed category translations:**
- `src/shared/i18n/locales/{en|tr|de|fr|es|ar}.ts`
  - Delete keys: `createDeck.category`, `createDeck.categories.general`, `.business`, `.medical`, `.technology`, `.academic`, `.dailyLife`, `.travel`, `.sports`
  - Total: 9 keys removed per language file (6 languages → 54 total deletions)

**Updated database integration:**
- `src/shared/lib/stores/useDatabaseService.ts` — `createStarterDeck()` function
  - Remove `category: selectedCategory` assignment when creating cards from wordlist
  - Category now assigned only from card data if present, else null

---

#### Part C: Language Support Expansion — Bridge-Language Strategy

> **Rationale:** Original plan (full 22-pair matrix) caused context explosion and maintenance burden. Bridge-language strategy: assume users know either local language (Turkish) or lingua franca (English). Result: 12 focused pairs instead of 22.

**Updated language configuration (`src/shared/lib/languageConfig.ts`):**

**Target Languages (11 total):**
1. English (en)
2. German (de)
3. French (fr)
4. Italian (it) — NEW
5. Spanish (es)
6. Russian (ru) — NEW
7. Ukrainian (uk) — NEW
8. Polish (pl) — NEW
9. Bulgarian (bg) — NEW
10. Serbian (sr) — NEW
11. Armenian (hy) — NEW

**Native Languages (2 total):**
- Turkish (tr) — REDUCED from 6
- English (en) — REDUCED from 6
  - Removed: ar, de, fr, es, ja (bridge-language rationale: not served by 12-pair matrix)

**Level System Unification:**
- All 11 target languages now use CEFR (A1–C2 mapped to internal 1–6)
- Removed JLPT (Japanese removed), TORFL (Russian/Ukrainian/Bulgarian/Serbian use CEFR not TORFL)
- Simplified `levelLabels` configuration: all target langs now map 1→A1, 2→A2, ..., 6→C2

**BCP-47 Locale Expansion (`toBcp47()`):**
- Added 6 new language mappings:
  - `it: 'it-IT'` (Italian TTS)
  - `ru: 'ru-RU'` (Russian TTS)
  - `uk: 'uk-UA'` (Ukrainian TTS)
  - `pl: 'pl-PL'` (Polish TTS)
  - `bg: 'bg-BG'` (Bulgarian TTS)
  - `sr: 'sr-RS'` (Serbian TTS)
  - `hy: 'hy-AM'` (Armenian TTS)
- Ensures expo-speech TTS support for all 12 pairs

---

#### Part D: VectorStore Wiring — 12-Pair Matrix

**Updated VectorStore (`src/shared/api/rag/VectorStore.ts`):**

**Import changes:**
- Before: 6 imports (en/tr, de/tr, fr/tr, es/tr, ar/tr, ja/tr)
- After: 12 imports
  ```typescript
  import enTr from '../../../../assets/wordlists/en/tr.json';
  import deTr from '../../../../assets/wordlists/de/tr.json';
  import frTr from '../../../../assets/wordlists/fr/tr.json';
  import itTr from '../../../../assets/wordlists/it/tr.json';
  import esTr from '../../../../assets/wordlists/es/tr.json';
  import ruTr from '../../../../assets/wordlists/ru/tr.json';
  import ukTr from '../../../../assets/wordlists/uk/tr.json';
  import plTr from '../../../../assets/wordlists/pl/tr.json';
  import bgTr from '../../../../assets/wordlists/bg/tr.json';
  import srTr from '../../../../assets/wordlists/sr/tr.json';
  import hyTr from '../../../../assets/wordlists/hy/tr.json';
  import trEn from '../../../../assets/wordlists/tr/en.json';
  ```

**WORDLIST_MAP:**
- Old: 6 keys (en-tr, de-tr, fr-tr, es-tr, ar-tr, ja-tr)
- New: 12 keys (en-tr, de-tr, fr-tr, it-tr, es-tr, ru-tr, uk-tr, pl-tr, bg-tr, sr-tr, hy-tr, tr-en)

---

#### Part E: Wordlist Generation & Validation

**New wordlist files (11 pairs created):**
- `assets/wordlists/it/tr.json` — 300 words, 50/level (Italian → Turkish)
- `assets/wordlists/ru/tr.json` — 300 words, 50/level (Russian → Turkish)
- `assets/wordlists/uk/tr.json` — 300 words, 50/level (Ukrainian → Turkish)
- `assets/wordlists/pl/tr.json` — 300 words, 50/level (Polish → Turkish)
- `assets/wordlists/bg/tr.json` — 300 words, 50/level (Bulgarian → Turkish)
- `assets/wordlists/sr/tr.json` — 300 words, 50/level (Serbian → Turkish)
- `assets/wordlists/hy/tr.json` — 300 words, 50/level (Armenian → Turkish)
- `assets/wordlists/tr/en.json` — 300 words, 50/level (Turkish → English)
- `assets/wordlists/en/tr.json` — Updated (fixed 1 error, maintained ~1493 words)

**Total vocabulary generated:** 3,600 entries (11 pairs × 300 base words, plus en/tr existing corpus)

**Generation strategy (`scripts/generate-wordlist.ts`):**

1. **Removed category system:**
   - Delete `CATEGORIES` constant
   - Updated `WordEntry` interface: removed `category` field
     - Now: `{ word, translation, level, exampleSentence, partOfSpeech }`
   - Removed category fallback logic and filtering

2. **Per-language calibration (language standard used):**
   - German (de) — Goethe/CEFR (A1–C2)
   - French (fr) — DELF/DALF/CEFR (A1–C2)
   - Italian (it) — CILS/CEFR (A1–C2)
   - Spanish (es) — DELE/CEFR (A1–C2)
   - Russian (ru) — TRFL/CEFR (A1–C2)
   - Ukrainian (uk) — CEFR (A1–C2, no official scale; adapted)
   - Polish (pl) — CEFR (A1–C2)
   - Bulgarian (bg) — CEFR (A1–C2)
   - Serbian (sr) — CEFR (A1–C2)
   - Armenian (hy) — CEFR (A1–C2)
   - Turkish (tr) — TÖMER / CEFR (A1–C2)

3. **Batch generation (multi-agent parallel):**
   - 11 language pairs × 6 levels = 66 batch API calls
   - Each batch: ~50 words at specified level + language standard
   - Used `run_in_background: true` with isolated agent contexts to avoid context explosion
   - Estimated subagent token usage: ~470k

4. **Example prompt structure:**
   ```
   Generate 50 <language> words at <level> (<standard>, e.g., A1-C2 CEFR).
   Each word should:
   - Be appropriate for the proficiency level
   - Have a clear translation to Turkish
   - Include a realistic example sentence
   - Include part of speech (noun, verb, adjective, etc.)
   
   Return JSON: [{ "word": "...", "translation": "...", "level": 1-6, 
                   "exampleSentence": "...", "partOfSpeech": "..." }]
   ```

**Validation framework (custom Node.js script):**

Validated all 12 wordlists for:
- JSON structure validity
- Schema conformance (exactly 5 fields: word, translation, level, exampleSentence, partOfSpeech)
- Exact counts (300 words per pair, 50 per level, no duplicates)
- Script correctness:
  - Cyrillic script for ru/uk/bg/sr (no Latin infiltration)
  - Armenian script for hy (100% alphabetic purity)
  - Turkish script for tr (Latin + Turkish-specific chars)
  - Latin script for others
- No PLACEHOLDER strings, no empty fields
- No Unicode anomalies (zero-width spaces, invisible characters)

**Result:** All 12 pairs production-ready, 0 critical errors in final output

---

#### Part F: Error Corrections During Generation

**Error 1: en/tr.json — invalid partOfSpeech**
- Issue: Word "three" had `partOfSpeech: "number"` (non-standard value)
- Root cause: Agent-generated wordlist contained non-conforming POS tag
- Fix: Changed "three" to `partOfSpeech: "noun"` (aligned with: one, two, four, five, etc.)
- Validation: Custom script caught and flagged during post-generation check

**Error 2: hy/tr.json — Cyrillic contamination**
- Issue: Initial generation contained Cyrillic characters instead of pure Armenian
- Root cause: Agent hallucination during batch generation
- Fix: Agent's internal self-correction during generation + post-generation alphabet purity check
- Result: Final file 100% Armenian script

**Error 3: uk/tr.json — PLACEHOLDER and Russian word**
- Issue: One entry had "PLACEHOLDER" for exampleSentence; one word was Russian (врач) not Ukrainian
- Root cause: Agent partial generation during multi-agent parallel execution
- Fix: Agent corrected during validation loop
- Result: Final file clean

**Error 4: bg/tr.json — zero-width spaces**
- Issue: Two entries contained hidden/zero-width Unicode characters
- Root cause: Agent text generation artifact
- Fix: Character validation and correction
- Result: Final file validated

---

#### Part G: Updated Generated Wordlist Index

**Updated `assets/wordlists/index.json`:**
- Format: `{ version: 1, pairs: [{ target, native, wordCount, levels }] }`
- All 11 new pairs: 300 words each, levels [1, 2, 3, 4, 5, 6]
- en/tr: 1493 words (existing large corpus maintained)

Example entry:
```json
{ "target": "it", "native": "tr", "wordCount": 300, "levels": [1, 2, 3, 4, 5, 6] }
```

---

#### Part H: Architecture & API Changes

**HybridLLMManager (`src/shared/api/llm/HybridLLMManager.ts`):**
- No structural changes (already cloud-only after SLM removal in previous session)
- All methods accept `targetLanguage` parameter (existing support)
- Prompts dynamically reference language names via `getLanguageName()`

**Database integration (`src/shared/lib/stores/useDatabaseService.ts`):**
- `createStarterDeck()` function: remove category assignment when creating starter deck from wordlist
- Backward compatibility: existing decks with category metadata continue to work

---

#### Part I: Testing & Validation

**TypeScript compilation:**
- `npx tsc --noEmit` — 0 errors
- All imports valid, no missing references
- VectorStore API changes propagated to all callsites

**Wordlist coverage:**
- 12 pairs loaded in WORDLIST_MAP
- `getVectorStore(target, native)` returns singleton for each pair
- All pairs tested for: JSON validity, schema conformance, count accuracy, script correctness

---

#### Part J: Files Modified (Summary)

| File | Type | Changes |
|------|------|---------|
| `package.json` | Dependency | Removed llama.rn |
| `src/shared/lib/languageConfig.ts` | Config | Added 6 languages, reduced native to 2, unified CEFR |
| `src/shared/api/rag/VectorStore.ts` | Logic | Removed category system, updated 12 imports, removed 2 methods |
| `scripts/generate-wordlist.ts` | Tooling | Removed category system, per-language calibration prompts |
| `src/shared/i18n/locales/{en\|tr\|de\|fr\|es\|ar}.ts` | i18n | Deleted 9 category translation keys per file |
| `app/create-deck.tsx` | UI | Removed category chip selector, updated generateWords() call |
| `app/deck-detail.tsx` | UI | Removed cefrToLevel import, added category fallback |
| `src/shared/lib/stores/useDatabaseService.ts` | Logic | Updated createStarterDeck() category assignment |
| `assets/wordlists/index.json` | Data | Regenerated with 12 pairs, real counts |
| 11× new wordlist files | Data | Created it/tr, ru/tr, uk/tr, pl/tr, bg/tr, sr/tr, hy/tr, tr/en + en/tr fix |

---

#### Part K: Migration Guide (for other LLMs)

**When continuing development:**

1. **For personalized vocabulary:**
   - User profile (profession, interests, level) extracted by cloud LLM
   - Cloud LLM generates vocabulary beyond base wordlist as needed
   - Generated words **not** stored in VectorStore (VectorStore = base only)
   - Decoupling allows independent iteration on both systems

2. **To add a new target language:**
   - Add entry to `SUPPORTED_TARGET_LANGUAGES` in `languageConfig.ts`
   - Generate 300-word wordlist: `npx ts-node scripts/generate-wordlist.ts --target XX --native tr --all-levels`
   - Import and wire in `VectorStore.ts`
   - Test: `getVectorStore('xx', 'tr')` should return non-empty dict

3. **To add a new native language:**
   - Add to `SUPPORTED_NATIVE_LANGUAGES` in `languageConfig.ts`
   - Generate wordlists for all targets: `for target in en de fr...; do npx ts-node scripts/generate-wordlist.ts --target $target --native XX --all-levels; done`
   - Wire all pairs in `VectorStore.ts`
   - Update `BCP47_MAP` if TTS support needed

4. **Category system (removed):**
   - If categories needed in future, implement in cloud LLM layer (not wordlist layer)
   - Wordlists should remain simple: word + translation + level + example + POS only

---

#### Part L: Known Limitations & Future Work

- **Language pair asymmetry:** Only 12 pairs served (not all combinations possible). Supabase sync will handle cross-device sync; dynamic wordlist fetch from bucket planned (Faz 4 in SUPABASE_TODO.md, ertelendi).
- **On-device TTS:** expo-speech covers 14 languages via device OS. Unsupported pairs will silently fail TTS.
- **SLM removal:** Users cannot use app offline. Mitigation: cache cloud responses locally (future).
- **Wordlist generation cost:** Each new pair = 6 API calls (1 per level), ~$0.03–$0.05 total (OpenAI pricing).

---

## [Unreleased] — 2026-04-04 (4)

### fix: Uygulama açılışta yükleme ekranında kalıyor — sonsuz döngü

> `router.replace('/onboarding')` çağrısı `<Stack>` mount edilmeden önce yapılıyordu;
> bu sessiz bir hata fırlatarak layout'u sıfırlıyor ve sonsuz splash döngüsüne yol açıyordu.

#### Root Cause
- `init()` içinde `router.replace('/onboarding')` çağrılıyordu; ancak bu noktada
  `isReady === false` olduğu için `<Stack>` henüz render edilmemişti
- Mount edilmemiş navigator üzerinde `replace` çağrısı layout'u unmount/remount
  ettirerek tüm state'i sıfırlıyor, `init()` yeniden başlıyordu → sonsuz döngü

#### Fix
- Update `app/_layout.tsx`
  — `router.replace('/onboarding')` çağrısı `init()` içinden kaldırıldı
  — `onboardingCompleted` Zustand store'dan okunuyor
  — Yeni `useEffect([isReady, onboardingCompleted])`: yalnızca `isReady === true`
    olduğunda (yani `<Stack>` mount edildikten sonra) onboarding kontrolü yapılır
  — `setTimeout(..., 0)` ile bir tick beklenerek `<Stack>`'in tam yerleşmesi garantilendi
  — `Promise.race([init(), timeout(8000)])` eklendi: `init()` takılırsa 8 saniye
    sonra splash yine de kapanır

### perf: Deste detay ekranı — büyük deste yavaşlığı

> 782 kartlık başlangıç destesine tıklandığında uygulama donuyordu.
> İki ayrı sorun birlikte yavaşlığa yol açıyordu.

#### Starter Deck Limiti
- Update `src/shared/lib/stores/useDatabaseService.ts`
  — `createStarterDeck()` artık tüm kelime listesini değil en fazla 200 kelimeyi alıyor
  — `limit: vectorStore.getAll().length` → `limit: 200`

#### FlatList Virtualization
- Update `app/deck-detail.tsx`
  — Kart listesi `ScrollView` + `.map()` yerine `FlatList` ile render ediliyor
  — `initialNumToRender: 15`, `maxToRenderPerBatch: 10`, `windowSize: 5`,
    `removeClippedSubviews` ile sadece ekranda görünen kartlar işleniyor
  — `FadeInDown.delay(index * 25)` staggered animasyonu kaldırıldı
    (782 kart için ~20 saniyelik animasyon kuyruğu oluşturuyordu)
  — Header içeriği `ListHeaderComponent`, boş durum `ListEmptyComponent`,
    alt boşluk `ListFooterComponent`'e taşındı

---

## [Unreleased] — 2026-04-04 (3)

### fix: DST-safe longest streak calculation & stale `t` closure in chat

#### DST Fix — `getDetailedStats()` longest streak
- Update `src/shared/lib/stores/useDatabaseService.ts`
  — Ardışık gün kontrolü `uniqueDays[i] - uniqueDays[i-1] === 86400000` karşılaştırmasından
    takvim aritmetiğine (`setDate(prev + 1)`) geçirildi
  — Önceki yöntemde DST geçiş gecelerinde (23/25 saatlik günler) fark tam 86400000 tutmadığı
    için konsekütif günler kırık streak sayılıyordu
  — Yeni yöntem: `getFullYear/getMonth/getDate` ile yerel tarih bileşenleri string'e
    dönüştürülür, JS'in DST-aware `setDate()` ile bir gün ileri alınır, bileşenler karşılaştırılır

#### ESLint / Stale Closure Fix — `chat.tsx` welcome message
- Update `app/(tabs)/chat.tsx`
  — Mesaj yükleme `useEffect` bağımlılık dizisine `t` eklendi: `[activeSessionId]` → `[activeSessionId, t]`
  — Önceki durumda dil değiştiğinde `t` yeni referans alıyor ancak effect yeniden çalışmıyordu;
    yeni oturumların welcome mesajı eski dilde kalıyordu
  — Artık dil değişiminde effect yeniden çalışır: DB'de kayıtlı mesaj varsa mevcut içerik
    korunur, boş oturumda welcome mesajı yeni dilde oluşturulur

---

## [Unreleased] — 2026-04-04 (2)

### perf: Large wordlist compatibility — DB indexing & query optimization

> Devasa kelime listeleriyle uyumlu çalışması için veritabanı sorgu katmanı optimize edildi.
> İstatistik ekranları artık tüm tabloyu belleğe çekmiyor; çalışma seansı limiti günlük hedefe bağlandı.

#### Database Schema v4
- Update `src/entities/database/schema.ts` — bump to version 4
  — `cards.next_review`: `isIndexed: true` eklendi (vadesi gelen kart sorguları full table scan'dan kurtuldu)
  — `study_sessions.completed_at`: `isIndexed: true` eklendi (streak/istatistik sorguları hızlandı)
- Update `src/entities/database/migrations.ts` — v3→v4 migration
  — `unsafeExecuteSql` ile mevcut kullanıcılar için iki `CREATE INDEX` SQL'i çalıştırılır

#### Query Optimization
- Update `src/shared/lib/stores/useDatabaseService.ts`
  — `getHomeStats()`: tüm kartları belleğe çeken `query().fetch()` kaldırıldı, `fetchCount()` ile DB aggregation'a geçildi (~10x hızlanma)
  — `getDetailedStats()`: aynı optimizasyon `totalWordsLearned` için uygulandı
  — Her iki fonksiyonda streak sorgusu son 366 günle sınırlandı (sonsuz geçmiş yüklemesi engellendi)
  — `fetchDueCards()`: opsiyonel `limit` parametresi eklendi
  — `fetchCardsByDeck()`: opsiyonel `limit` parametresi eklendi
- Update `app/study.tsx`
  — `SESSION_CARD_LIMIT = 20` sabiti eklendi; "vadesi yok" fallback'i bu limitle sınırlandı
  — `fetchDueCards` çağrıları `dailyGoal` değerini limit olarak geçiyor

#### Daily Goal Integration
- Update `src/shared/lib/stores/useProfileStore.ts` — `dailyGoal` state ve `setDailyGoal()` action eklendi
- Update `app/_layout.tsx` — uygulama açılışında `dailyGoal` DB'den store'a sync ediliyor

---

### feat: Onboarding — kişiselleştirilmiş başlangıç destesi otomatik oluşturma

> Onboarding tamamlandığında kullanıcının seviyesi, ilgi alanları ve mesleğine göre
> kelime listesinden kişiselleştirilmiş bir başlangıç destesi otomatik oluşturuluyor.

#### Starter Deck Generation
- Update `src/shared/lib/stores/useDatabaseService.ts`
  — `createStarterDeck()` eklendi: seviye ± 1 aralığındaki tüm kelimeler ilgi alanı
    skoruna göre sıralanır, ardından Fisher-Yates ile karıştırılarak DB'ye kaydedilir
  — Karıştırma sayesinde genel ve ilgi alanı kelimeleri ilk günden itibaren karışık gelir
- Update `app/onboarding.tsx`
  — `handleComplete()` içinde `createStarterDeck()` çağrısı eklendi
  — `parsedInterests` tek seferde hesaplanıp hem store'a hem `createStarterDeck`'e geçiliyor
- Update `src/shared/i18n/locales/` — 6 dilde `onboarding.starterDeckName` anahtarı eklendi

---

### feat: Wordlist-deck entegrasyonu iyileştirmeleri

> Deste oluştururken kelime listesinin doğru ve verimli kullanılması için üç düzeltme.

#### Create Deck — VectorStore Fixes
- Update `app/create-deck.tsx`
  — AI Generate sekmesi artık `categories: [selectedCategory]` geçiriyor;
    seçilen kategori kelime filtrelemesini gerçekten etkiliyor (önceden etkisizdi)
  — "General" seçilince kategori filtresi devre dışı kalır, ilgi alanları öne çıkar
  — `fetchAllCardFronts()` ile DB'deki mevcut kartlar çekilip `excludeWords` olarak geçiriliyor;
    daha önce öğrenilmiş kelimeler yeni destede tekrar önerilmiyor
- Update `src/shared/lib/stores/useDatabaseService.ts`
  — `fetchAllCardFronts()` eklendi: tüm kart ön yüzlerini string[] olarak döner

---

## [Unreleased] — 2026-04-04

### feat: Full UI internationalization (i18n) — 6-language interface support

> Tüm uygulama arayüzü artık 6 dilde gösteriliyor: EN, TR, DE, FR, ES, AR.
> Dil, kullanıcının native language ayarına göre otomatik seçiliyor.
> Ayarlar değiştiğinde tüm ekranlar anında güncellenyor.

#### i18n Altyapısı
- Add `src/shared/i18n/` — i18next + react-i18next kurulumu
  — `src/shared/i18n/index.ts` — i18n instance (languageDetector, fallbackLng: 'en')
  — `src/shared/i18n/locales/en.ts` — 300+ anahtar ile master çeviri dosyası
  — `src/shared/i18n/locales/tr.ts`, `de.ts`, `fr.ts`, `es.ts`, `ar.ts` — 5 dil çevirisi
- `setting-modal.tsx` — native_language kaydedilince `i18n.changeLanguage()` çağrılır,
  arayüz dil değişimini anında yansıtır

#### Onboarding Sihirbazı
- Add `app/onboarding.tsx` — 3 adımlı ilk kurulum akışı
  — Adım 1: Karşılama ekranı
  — Adım 2: Native language + target language + seviye seçimi
  — Adım 3: Meslek ve ilgi alanları
  — Tamamlandığında `onboardingCompleted` DB'ye yazılır, bir daha gösterilmez
- Update `app/_layout.tsx` — startup'ta `onboardingCompleted` kontrolü; tamamlanmamışsa
  `/onboarding`'e yönlendir

#### Çevrilen Ekranlar
- `app/(tabs)/index.tsx` — Ana ekran (karşılama, hızlı eylemler, streak, günlük hedef)
- `app/(tabs)/decks.tsx` — Deck listesi, quiz modu seçimi, deck seçenekleri, kart sayısı
- `app/(tabs)/stats.tsx` — Tüm istatistik etiketleri, BarChart alt bileşeni dahil
- `app/(tabs)/chat.tsx` — Chat başlığı, mod etiketleri, mesaj alanı, Alert'ler
  — **Fix:** `CHAT_MODE_LABELS` Türkçe hardcode'dan i18n anahtarlarına geçirildi
- `components/ChatHistoryDrawer.tsx` — Başlık, silme onayı, yeni sohbet butonu
  — **Fix:** Alert butonları ve çekmece başlığı Türkçe hardcode'dan düzeltildi
- `app/(tabs)/settings.tsx` — Tüm bölüm başlıkları ve satır etiketleri;
  `getLevelName(level, t)` t parametresi kabul edecek şekilde güncellendi
- `app/setting-modal.tsx` — Tüm açıklamalar, etiketler, placeholder'lar, Alert'ler
- `app/create-deck.tsx` — Tüm etiketler; `CATEGORIES` → `CATEGORY_KEYS` pattern'ına
  geçirildi (DB değerleri sabit, görünen etiketler çevrildi)
- `app/deck-detail.tsx` — Tüm ekran: stat etiketleri, filtre chip'leri, sıralama,
  arama, kelime ekleme formu, satır içi düzenleme, boş durum mesajları, modal'lar
- `app/study.tsx` — Yükleme, boş durum, sonuç ekranı, kart değerlendirme butonları
- `app/quiz-mc.tsx` — Yükleme, hata, soru etiketi, sonuç ekranı
- `app/quiz-spell.tsx` — Tüm ekranlar: ipucu bölümü, geri bildirim, sonuç
- `app/quiz-match.tsx` — Yükleme, hata, sonuç ekranı, istatistik etiketleri

#### TypeScript
- `npx tsc --noEmit` — 0 hata

---

## [Unreleased] — 2026-04-02

### feat: Multi-language support — learn any language, not just English

> The app is no longer English-only. Users can now choose a target language
> (EN, DE, FR, ES, AR, JA) and a native language. The proficiency level
> display adapts per language (CEFR for European languages, JLPT for Japanese).

#### Language Configuration
- Add `src/shared/lib/languageConfig.ts`
  — Central hub for all language/level metadata
  — 6 target languages (EN, DE, FR, ES, AR, JA) and 6 native languages
  — Per-language level system: CEFR (A1–C2) for European/Arabic, JLPT (N5–N1) for Japanese
  — Internal unified level format: always 1–6 integers
  — Helpers: `getLevelLabel()`, `getLevelOptions()`, `cefrToLevel()`, `levelToCefr()`

#### Database Schema v2
- Update `src/entities/database/schema.ts` — bump to version 2
  — Add `target_language` column to `decks` and `cards` tables
  — Standardize internal level format from "A1"–"C2" to "1"–"6"
- Add `src/entities/database/migrations.ts` — WatermelonDB migration v1→v2
- Update `src/entities/database/index.ts` — wire migration into SQLiteAdapter
- Update `src/entities/Card/model.ts` — add `targetLanguage` field
- Update `src/entities/Deck/model.ts` — add `targetLanguage` field

#### Multi-language Word Lists
- Add `assets/wordlists/` directory structure
  — `index.json` manifest of available language pairs
  — `en/tr.json` — migrated from old dictionary.json (68 words)
  — `de/tr.json`, `fr/tr.json`, `es/tr.json`, `ar/tr.json`, `ja/tr.json` — placeholder files
- Rewrite `src/shared/api/rag/VectorStore.ts`
  — Language-pair-based loading instead of single hardcoded dictionary
  — Singleton Map keyed by `"target-native"` string
  — `DictionaryEntry.level` changed from `cefrLevel: string` to `level: number`
  — `getVectorStore(targetLang, nativeLang)` now requires language params

#### AI Prompt Localization
- Update `src/shared/api/llm/HybridLLMManager.ts`
  — `selectNewWords()`, `generateQuizContent()`, `checkGrammar()` accept `targetLanguage` param
  — All prompts dynamically reference target and native language names
  — Add Japanese to `LANGUAGE_NAMES` map

#### State & Init
- Update `src/shared/lib/stores/useProfileStore.ts`
  — Add `targetLanguage` state and `setTargetLanguage()` action
- Update `app/_layout.tsx` — load `targetLanguage` from DB into store on startup

#### UI Updates
- Update `app/create-deck.tsx`
  — Dynamic level chips via `getLevelOptions(targetLanguage)` instead of hardcoded CEFR
  — VectorStore calls pass current language pair
- Update `app/deck-detail.tsx`
  — Level badge uses `getLevelLabel()` with fallback for legacy CEFR strings
  — Edit deck modal uses dynamic level options
- Update `app/(tabs)/settings.tsx`
  — New "Target Language" setting with flag + name display
  — Level and native language subtitles now use dynamic labels
- Update `app/setting-modal.tsx`
  — New `target_language` selection screen with flags and native names
  — Level selection uses per-language labels
  — Native language picker uses `SUPPORTED_NATIVE_LANGUAGES`

#### Tooling
- Add `scripts/generate-wordlist.ts` — build-time AI wordlist generator
  — CLI: `npx ts-node scripts/generate-wordlist.ts --target de --native tr --all-levels`
  — Uses OpenAI API to generate 400 words/level in 50-word batches
  — Merges with existing words, auto-updates index.json

#### Fixes
- Fix `src/processes/LearningSession.ts` — adapt to new VectorStore API
  (use `cefrToLevel()` for level conversion, `entry.level` number mapping)
- Update `src/shared/lib/stores/useDatabaseService.ts`
  — `createDeck()` and `addCardsToDecks()` accept optional `targetLanguage`

---

## [Unreleased] — 2026-03-31

### feat: Chat sessions, chat modes, and SLM removal

#### Chat Sessions
- Add `src/shared/lib/stores/useChatSessionStore.ts`
  — Session CRUD backed by SQLite: `createSession()`, `listSessions()`,
    `updateSessionMeta()`, `deleteSession()`
- Add `components/ChatHistoryDrawer.tsx`
  — Side drawer listing all past sessions with rename/delete support
- Refactor `app/(tabs)/chat.tsx`
  — Replace hardcoded `SESSION_ID` with dynamic `activeSessionId` state
  — Load and persist messages per session from DB
  — Auto-generate session title from first user message
  — Integrate `ChatHistoryDrawer` for session switching

#### Chat Modes
- Add three conversation modes selectable from the chat toolbar:
  - **Tutor** (🎓) — active vocabulary teaching, explicit grammar correction,
    comprehension questions after every message
  - **Balanced** (⚖️) — default; natural conversation with light, contextual
    corrections and optional vocabulary hints
  - **Chat** (💬) — native-speaker style; no corrections or lessons unless
    the user explicitly asks
- Extend `buildSystemPrompt(nativeLanguage, mode)` with per-mode instruction
  blocks and strict formatting rules (no markdown tables/headers/bold)

#### SLM Removal (BREAKING)
> On-device Small Language Model support is removed. A cloud API key is
> now required to use all AI features.

- **Deleted** `src/shared/api/llm/LocalSLMClient.ts`
  — llama.cpp / GGUF on-device inference client
- **Deleted** `src/shared/api/llm/ModelDownloadManager.ts`
  — GGUF model download, storage, and catalog management
- **Deleted** `app/model-manager.tsx`
  — "Local Models" screen (download / activate / delete models)
- **Refactor** `HybridLLMManager` → cloud-only
  — Remove: `localClient`, `isLocalReady`, `initLocalModel()`, `chatLocal()`
  — Add: `chat()` — direct cloud call replacing `chatLocal()`
  — `generateQuizContent()` and `checkGrammar()` now always use cloud
  — `getStatus()` simplified to `{ cloudReady }`
- **Update** `app/_layout.tsx`
  — Remove `ModelDownloadManager` startup init block
  — Remove `model-manager` Stack.Screen route
- **Update** `app/(tabs)/settings.tsx`
  — Remove "Local Model" settings row and `/model-manager` navigation
- **Update** `src/shared/lib/stores/useProfileStore.ts`
  — Remove: `isLocalModelLoaded`, `activeLocalModelId`,
    `setLocalModelLoaded()`, `setActiveLocalModelId()`
  — `activeModel` type narrowed: `'local' | 'cloud' | 'none'` → `'cloud' | 'none'`
- **Update** `app/(tabs)/chat.tsx`
  — Remove `initLocalModel()` useEffect
  — Remove `onToken` streaming callback (unused with non-streaming cloud calls)
  — `chatLocal()` → `chat()`

#### Fixes & Other
- **Fix** `CloudLLMClient`: `chat()` was always sending `json_object`
  response_format even for conversational calls — now gated behind an
  explicit `jsonMode` flag passed only from structured-data methods
- Add `expo-clipboard` dependency for clipboard copy support in chat
  (requires new EAS native build)
- Add `Share` sheet support for sharing chat message content
- Change mascot emoji: 🦉 → 🐴 in home screen and system prompt

---

## [0.5.0] — 2026-03-31

### feat: Custom LLM endpoint support and critical AI integration fixes

- Add **Custom / OpenAI-compatible endpoint** option in AI Provider settings
  — Accepts arbitrary `baseUrl`, `apiKey`, and `model` name
  — Persisted to DB and restored on startup alongside OpenAI/Gemini keys
- Add real-time **API key validation** on entry (`configureCloudAndValidate()`)
  — Makes a minimal test call before accepting the key
  — Surface readable error messages (truncated at 200 chars)
- Refactor `CloudLLMClient`
  — Add `jsonMode` parameter to `chat()` / `chatOpenAI()` / `chatGemini()`
  — Fix Gemini response format: `responseMimeType: 'application/json'` now
    only set when `jsonMode && !minimal`
  — Add 30-second fetch timeout via `AbortController`
- Refactor `LocalSLMClient` — mock mode improvements and error handling
- Extend `setting-modal.tsx` with custom endpoint form (baseUrl + model fields)
- Update `HybridLLMManager`
  — `configureCloud()` for silent startup key loading (no validation)
  — `configureCloudAndValidate()` for user-entered keys (validates live)
  — `chatLocal()` gains `forceCloud` parameter (used by turbo mode toggle)
- Update `UserProfile` model — add `custom` key storage structure
- Update `app/_layout.tsx` — restore custom key on startup

---

## [0.4.1] — 2026-03-29

### fix: Restore header and fix tab bar layout overflow

- Fix safe-area padding on the floating tab bar causing content overflow
  on devices with a home indicator
- Restore the main navigation header that was hidden in the previous redesign
- Minor layout adjustments to `FloatingTabBar` component

---

## [0.4.0] — 2026-03-29

### feat: Redesign UI with cosmic dashboard, floating tab bar, and immersive interactions

- Complete visual overhaul of the home screen (`index.tsx`)
  — Cosmic / dark-space aesthetic with gradient backgrounds
  — Animated orbital XP ring around the mascot
  — Hero streak card with animated pulse
  — Daily goal progress bar
  — Quick-action cards grid
- Replace native bottom tab bar with custom `components/FloatingTabBar.tsx`
  — Floating pill design with blur backdrop
  — Active tab indicator with spring animation
  — Haptic feedback on tab switch
- Update `app/(tabs)/decks.tsx` — cards redesigned to match new theme
- Update `app/quiz-mc.tsx` — question card redesign with progress indicator
- Update `app/study.tsx` — immersive full-screen study mode tweaks

---

## [0.3.1] — 2026-03-29

### feat: Add deck detail screen with full card management

- Add `app/deck-detail.tsx` (1265 lines)
  — Full card list with swipe-to-delete
  — Inline card editing (front / back / notes)
  — SRS status badge per card (New / Learning / Review / Mastered)
  — Deck stats summary (total cards, due count, mastery %)
  — Start study session shortcut
- Update `app/(tabs)/decks.tsx` — navigate to deck detail on deck tap
- Update `app/_layout.tsx` — register `deck-detail` route with slide animation
- Extend `useDatabaseService` — add `getCardsByDeckId()`, `updateCard()`,
  `deleteCard()` with full SRS field support

---

## [0.3.0] — 2026-03-28

### feat: Add manual word entry to create deck screen

- Redesign `app/create-deck.tsx`
  — Tab switcher: **AI Generate** vs **Manual Entry**
  — Manual entry form: word, translation, example sentence, CEFR level
  — Inline card preview list with remove button
  — Bulk import via plain text (one word per line)
- Extend `VectorStore` — expose `addEntry()` for manually added words so
  they are included in future RAG-based word selection

---

## [0.2.0] — 2026-03-25

### feat: XP system, badge notifications, and new quiz modes

#### XP & Progression
- Add `src/shared/lib/xpSystem.ts`
  — Level thresholds, XP-per-action table, streak multipliers
- Add `src/shared/lib/stores/useXPStore.ts`
  — Zustand store: current XP, level, streak, badges earned
  — `addXP()` action with level-up detection
- Add `src/shared/ui/XPToast.tsx` — animated +XP popup after correct answers
- Add `src/shared/ui/LevelUpModal.tsx` — full-screen level-up celebration modal
- Add `src/shared/ui/BadgeToast.tsx` — badge unlock notification

#### New Quiz Modes
- Add `app/quiz-mc.tsx` — multiple-choice quiz (4 options per question)
- Add `app/quiz-match.tsx` — word-translation matching pairs game
- Add `app/quiz-spell.tsx` — spelling challenge with letter-by-letter input

#### Stats Screen
- Add `app/(tabs)/stats.tsx`
  — Weekly XP bar chart
  — Streak calendar heatmap
  — Badge showcase grid
  — All-time learning statistics

#### Other
- Extend `useDatabaseService` — XP history, badge storage, daily goal tracking
- Update `app/(tabs)/decks.tsx` — trigger XP awards on study completion
- Update `app/study.tsx` — link to quiz modes after session
- Add `react-native-chart-kit` dependency

---

## [0.1.0] — 2026-03-11

### feat: Core language learning features — initial full build

#### Architecture
- Expo Router file-based navigation with typed routes
- SQLite database via `expo-sqlite` with versioned schema migrations
- Zustand for all client-side state management
- Feature-sliced design: `src/entities`, `src/features`, `src/processes`,
  `src/shared`

#### AI / LLM Integration
- Add `src/shared/api/llm/CloudLLMClient.ts`
  — OpenAI and Google Gemini support via REST
  — Configurable model and endpoint
- Add `src/shared/api/llm/LocalSLMClient.ts`
  — On-device GGUF model inference via llama.cpp bindings (mock mode fallback)
- Add `src/shared/api/llm/HybridLLMManager.ts`
  — Singleton orchestrator: routes to local SLM (tutor) or cloud LLM (strategist)
  — `chatLocal()`, `generateQuizContent()`, `checkGrammar()`,
    `selectNewWords()`, `analyzeProfile()`
- Add `src/shared/api/llm/ModelDownloadManager.ts`
  — GGUF model catalog, download with progress, local storage management

#### RAG / Dictionary
- Add `src/shared/api/rag/VectorStore.ts`
  — In-memory cosine-similarity vector store over TF-IDF embeddings
  — Used for personalized word selection and definition lookup
- Add `src/shared/api/rag/dictionary.json`
  — Seed dictionary with ~100 entries (word, translation, CEFR level, example)

#### Database & Entities
- Add `src/entities/database/schema.ts` — full SQLite schema
- Add `src/entities/database/index.ts` — migration runner and seed helpers
- Add entity models: `Card`, `Deck`, `ChatMessage`, `StudySession`,
  `UserProfile`, `SRS/SRSAlgorithm` (SM-2 implementation)

#### Features & Processes
- Add `src/features/quiz-engine/QuizEngine.ts`
  — Generates fill-in-the-blank, multiple-choice, and grammar-check quizzes
- Add `src/features/profile-update/ProfileUpdater.ts`
  — Extracts profession, interests, level from chat history via LLM
- Add `src/processes/LearningSession.ts`
  — Orchestrates full study loop: word selection → study → quiz → SRS update

#### Screens
- `app/(tabs)/index.tsx` — home dashboard with streak, XP, daily goal
- `app/(tabs)/chat.tsx` — AI conversation practice
- `app/(tabs)/decks.tsx` — deck library
- `app/(tabs)/settings.tsx` — app and AI provider settings
- `app/create-deck.tsx` — AI-powered deck creation
- `app/study.tsx` — flashcard study session
- `app/model-manager.tsx` — local model download and management
- `app/setting-modal.tsx` — individual setting editor

#### Stores & Theme
- `useProfileStore` — user profile, AI model status, theme mode
- `useStudyStore` — active study session state
- `useDatabaseService` — all DB query helpers
- `src/shared/lib/theme.ts` — design tokens (colors, spacing, typography)

#### Tooling
- EAS Build configuration (`eas.json`)
- `.npmrc` with legacy peer deps flag
- TypeScript strict mode
