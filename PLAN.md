# Onboarding Flow + i18n (Çok Dilli Arayüz) Implementasyon Planı

## Özet
- **i18n**: `i18next` + `react-i18next` + `expo-localization` ile 6 dil (TR, EN, DE, FR, ES, AR)
- **Onboarding**: 3 adımlı wizard — Hoşgeldin → Dil Seçimi → Profil
- **DB**: Schema v2→v3 (onboarding_completed flag)
- Cihaz diline göre otomatik UI dili, native dil değişince UI dili de değişir

---

## Adım 1: i18n Altyapısı

### 1.1 Paket Kurulumu
```bash
npx expo install expo-localization
npm install i18next react-i18next
```

### 1.2 Çeviri Dosyaları — `src/shared/i18n/`
```
src/shared/i18n/
├── index.ts           # i18next init + config
└── locales/
    ├── en.ts          # English (base)
    ├── tr.ts          # Türkçe
    ├── de.ts          # Deutsch
    ├── fr.ts          # Français
    ├── es.ts          # Español
    └── ar.ts          # العربية
```

Her dosya düz namespace'li key-value (nested olmadan):
```typescript
export default {
  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.error': 'Error',
  'common.loading': 'Loading...',

  // Tabs
  'tabs.home': 'LinguaLearn',
  'tabs.decks': 'My Decks',
  'tabs.stats': 'Statistics',
  'tabs.chat': 'AI Chat',
  'tabs.settings': 'Settings',

  // Home screen
  'home.welcome': 'Welcome back!',
  'home.quickActions': 'Quick Actions',
  // ... tüm ekranlar

  // Onboarding
  'onboarding.welcome.title': 'Welcome to LinguaLearn',
  'onboarding.welcome.subtitle': 'Learn any language with AI-powered personalization',
  'onboarding.welcome.getStarted': 'Get Started',
  // ...
}
```

### 1.3 `src/shared/i18n/index.ts` — Init
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './locales/en';
import tr from './locales/tr';
// ... diğer diller

const deviceLang = getLocales()[0]?.languageCode || 'en';
const supportedLangs = ['en', 'tr', 'de', 'fr', 'es', 'ar'];
const initialLang = supportedLangs.includes(deviceLang) ? deviceLang : 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, tr: { translation: tr }, ... },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
export default i18n;
```

### 1.4 `app/_layout.tsx` — Provider Ekleme
- `import '../src/shared/i18n'` (top-level side-effect import)
- i18n.language'ı DB'den yüklenen nativeLanguage ile sync et

---

## Adım 2: DB Schema v3 + Migration

### 2.1 `schema.ts` — version: 3
- `user_settings` tablosuna: `{ name: 'onboarding_completed', type: 'boolean' }` ekle

### 2.2 `migrations.ts` — v2→v3 migration
```typescript
{
  toVersion: 3,
  steps: [
    addColumns({
      table: 'user_settings',
      columns: [{ name: 'onboarding_completed', type: 'boolean' }],
    }),
  ],
}
```

### 2.3 `UserProfile/model.ts` — field ekle
- `@field('onboarding_completed') onboardingCompleted!: boolean`

---

## Adım 3: Profile Store Güncelleme

### 3.1 `useProfileStore.ts`
- `onboardingCompleted: boolean` state ekle (default: false)
- `setOnboardingCompleted: (v: boolean) => void` action ekle
- `uiLanguage: string` state ekle (default: cihaz dili)
- `setUiLanguage: (lang: string) => void` → `i18n.changeLanguage(lang)` çağırır

---

## Adım 4: Onboarding Wizard Ekranı

### 4.1 `app/onboarding.tsx` — Yeni dosya (~350 satır)

3 adımlı horizontal pager (ScrollView + paging veya basit state):

**Step 1 — Welcome**
- Mascot emoji (🐴), app adı, kısa açıklama
- "Get Started" butonu
- Cihaz dili otomatik algılanmış, Arapça ise RTL

**Step 2 — Language Selection**
- Native language picker (6 dil, flag + nativeName)
  - Seçildiğinde UI dili anında değişir (`i18n.changeLanguage(code)`)
- Target language picker (6 dil)
- Level selector (target dile göre CEFR/JLPT chip'leri)

**Step 3 — Profile**
- Profession text input
- Interests tag input (virgülle ayır veya preset chip'ler)
- "Skip" ve "Complete" butonları

**Completion:**
- DB'ye kaydet: nativeLanguage, targetLanguage, level, profession, interests, onboardingCompleted=true
- Store'u güncelle
- `router.replace('/(tabs)')` ile ana ekrana yönlendir

### 4.2 `app/_layout.tsx` — Routing
- Stack'e `onboarding` screen ekle
- Init flow'da: `settings.onboardingCompleted` kontrol et
  - false → `router.replace('/onboarding')`
  - true → normal akış (tabs)

---

## Adım 5: Tüm Ekranlarda i18n Uygulama

### 5.1 Her ekranda `useTranslation()` hook ile stringleri değiştir:
- `app/(tabs)/_layout.tsx` — tab başlıkları: `t('tabs.home')` vb.
- `app/(tabs)/index.tsx` — home ekranı (~22 string)
- `app/(tabs)/decks.tsx` — deck listesi (~19 string)
- `app/(tabs)/settings.tsx` — ayarlar (~30 string)
- `app/(tabs)/stats.tsx` — istatistikler (~25 string)
- `app/(tabs)/chat.tsx` — sohbet (~18 string, Türkçe karışık olanlar düzelir)
- `app/create-deck.tsx` — deck oluşturma (~15 string)
- `app/deck-detail.tsx` — deck detay
- `app/setting-modal.tsx` — ayar modal
- `app/study.tsx` — çalışma ekranı
- `app/quiz-mc.tsx`, `quiz-spell.tsx`, `quiz-match.tsx` — quiz ekranları
- `components/FloatingTabBar.tsx` — tab bar label'ları (varsa)
- `components/ChatHistoryDrawer.tsx` — sohbet geçmişi

### 5.2 Native language değiştiğinde UI dili sync
- `setting-modal.tsx` → native_language case'inde `i18n.changeLanguage(selectedValue)` ekle
- Onboarding'de zaten yapılıyor

---

## Adım 6: Arapça RTL Desteği

- `app/_layout.tsx`'de: `I18nManager.forceRTL(isArabic)` (gerekirse)
- Veya: Expo'nun built-in RTL desteğini kullan
- `flexDirection` stilleri `I18nManager.isRTL` ile uyumlu olmalı
- İlk aşamada basit tutabiliriz — tam RTL polish sonraki iterasyonda

---

## Dosya Değişiklik Özeti

| Dosya | Değişiklik |
|-------|-----------|
| `package.json` | +expo-localization, +i18next, +react-i18next |
| `src/shared/i18n/index.ts` | YENİ — i18n init |
| `src/shared/i18n/locales/en.ts` | YENİ — İngilizce çeviriler (~189 key) |
| `src/shared/i18n/locales/tr.ts` | YENİ — Türkçe çeviriler |
| `src/shared/i18n/locales/de.ts` | YENİ — Almanca çeviriler |
| `src/shared/i18n/locales/fr.ts` | YENİ — Fransızca çeviriler |
| `src/shared/i18n/locales/es.ts` | YENİ — İspanyolca çeviriler |
| `src/shared/i18n/locales/ar.ts` | YENİ — Arapça çeviriler |
| `src/entities/database/schema.ts` | v2→v3, +onboarding_completed |
| `src/entities/database/migrations.ts` | +v2→v3 migration |
| `src/entities/UserProfile/model.ts` | +onboardingCompleted field |
| `src/shared/lib/stores/useProfileStore.ts` | +onboardingCompleted, +uiLanguage |
| `app/onboarding.tsx` | YENİ — 3 adımlı wizard |
| `app/_layout.tsx` | +i18n import, +onboarding routing |
| `app/(tabs)/_layout.tsx` | tab title'lar i18n |
| `app/(tabs)/index.tsx` | i18n stringleri |
| `app/(tabs)/decks.tsx` | i18n stringleri |
| `app/(tabs)/settings.tsx` | i18n stringleri |
| `app/(tabs)/stats.tsx` | i18n stringleri |
| `app/(tabs)/chat.tsx` | i18n stringleri + Türkçe fix |
| `app/create-deck.tsx` | i18n stringleri |
| `app/deck-detail.tsx` | i18n stringleri |
| `app/setting-modal.tsx` | i18n + native_language → UI dil sync |
| `app/study.tsx` | i18n stringleri |
| `app/quiz-mc.tsx` | i18n stringleri |
| `app/quiz-spell.tsx` | i18n stringleri |
| `app/quiz-match.tsx` | i18n stringleri |
| `components/ChatHistoryDrawer.tsx` | i18n stringleri |
| `components/FloatingTabBar.tsx` | i18n (varsa) |

**Toplam**: ~7 yeni dosya, ~20+ dosya güncelleme

## Uygulama Sırası
1. Paket kurulumu
2. i18n altyapısı + EN çeviri dosyası (base)
3. DB schema v3 + migration + model
4. Profile store güncelleme
5. Onboarding wizard ekranı
6. _layout.tsx routing + i18n init
7. Tüm ekranlarda i18n uygulama (ekran ekran)
8. Diğer 5 dil çeviri dosyaları (TR, DE, FR, ES, AR)
9. RTL desteği (temel)
10. TypeScript check + test
