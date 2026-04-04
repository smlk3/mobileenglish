# Changelog

All notable changes to MobileEnglish are documented here.

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
