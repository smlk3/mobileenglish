# Supabase Entegrasyonu — Yapılacaklar Listesi

> Güncellenme: 2026-04-04  
> Revize öncelik sırası: Auth → DB Sync → (Wordlist bucket — ertelendi)

---

## Faz 0: Ön Koşullar (Manuel Kurulum)

- [ ] **Supabase projesi oluştur** — supabase.com üzerinden ücretsiz proje aç
- [ ] `SUPABASE_URL` ve `SUPABASE_ANON_KEY` değerlerini al
- [ ] `.env.local` dosyası oluştur (git'e ekleme — `.gitignore`'a ekle)
- [ ] `app.config.js` veya `app.config.ts` dosyasına `extra` bloğu ekle; EAS Build için `eas.json`'a secret olarak tanımla
- [ ] **Google Cloud Console** → OAuth 2.0 Client ID oluştur (Android + iOS ayrı ayrı)
  - Android: SHA-1 parmak izi gerekli (`keytool` ile üret)
  - iOS: Bundle ID gir (`com.yourname.mobileenglish`)
- [ ] Supabase Dashboard → Authentication → Providers → Google'ı etkinleştir, Client ID'leri gir

---

## Faz 1: Supabase İstemcisi

- [ ] Paketleri kur:
  ```bash
  npx expo install @supabase/supabase-js expo-secure-store react-native-url-polyfill
  ```
- [ ] `src/shared/api/supabase/client.ts` dosyasını oluştur
  - `react-native-url-polyfill/auto` import'u en üste ekle
  - `expo-secure-store` tabanlı `AsyncStorage` adaptörü yaz
  - `createClient()` ile global client export et
- [ ] `app/_layout.tsx` veya entry noktasına URL polyfill import'unu ekle

---

## Faz 2: Google OAuth (Opsiyonel — Guest Mode Korunacak)

> **Kural:** Kimlik doğrulama zorunlu değil. Kullanıcı isterse "misafir" olarak devam edebilmeli.

- [ ] `src/shared/api/supabase/AuthService.ts` dosyasını oluştur
  - `signInWithGoogle()` — `expo-auth-session` + `makeRedirectUri` kullan
  - `signOut()`
  - `getSession()` — mevcut oturumu döner, yoksa `null`
  - `onAuthStateChange()` — oturum değişikliklerini dinle
- [ ] `src/entities/UserProfile/model.ts` → `UserSettings` modeline ekle:
  - `@field('supabase_user_id') supabaseUserId!: string` (nullable)
- [ ] `src/entities/database/schema.ts` → `user_settings` tablosuna `supabase_user_id` kolonu ekle (version bump gerekli)
- [ ] `src/entities/database/migrations.ts` → yeni migration adımı ekle
- [ ] `src/shared/lib/stores/useProfileStore.ts` → `supabaseSession` state + `setSupabaseSession` action ekle
- [ ] Settings ekranına "Google ile Giriş Yap / Çıkış Yap" UI bileşeni ekle
- [ ] Oturum açıldığında `supabase_user_id`'yi WatermelonDB kaydına yaz

---

## Faz 3: WatermelonDB ↔ Supabase Senkronizasyonu

> **Uyarı:** En karmaşık faz. Supabase Edge Functions yazılmadan kodlamaya başlama.

### 3.1 Supabase Tarafı (Backend)

- [ ] Supabase Dashboard'da gerekli tabloları oluştur:
  - `cards`, `decks`, `study_sessions`, `user_settings`
  - Her tabloya `server_updated_at TIMESTAMPTZ DEFAULT now()` trigger'ı ekle
  - Row Level Security (RLS) politikaları: `auth.uid() = user_id`
- [ ] Supabase Edge Function → `sync/pull`:
  - Query parametresi: `last_pulled_at`
  - Döner: `{ changes: { tableName: { created, updated, deleted } } }`
- [ ] Supabase Edge Function → `sync/push`:
  - Body: `{ changes: { tableName: { created, updated, deleted } } }`
  - Conflict stratejisi: `server_updated_at > client_updated_at` ise server kazanır
  - Özel kural: `study_sessions` için `xp_count` — büyük olan kazanır

### 3.2 Uygulama Tarafı

- [ ] `src/entities/database/index.ts` → `synchronize()` adaptörünü import et
- [ ] `src/shared/api/supabase/SyncService.ts` dosyasını oluştur
  - `pullChanges(lastPulledAt)` — Edge Function'a GET isteği
  - `pushChanges(changes)` — Edge Function'a POST isteği
  - `syncDatabase()` — WatermelonDB `synchronize()` çağrısını wrap eder
- [ ] `useProfileStore` veya ayrı bir store'a `lastSyncedAt` state ekle (MMKV'de sakla)
- [ ] App foreground'a geçişte (AppState) `syncDatabase()` tetikle — sadece oturum açıksa
- [ ] Sync hatalarında sessizce logla; kullanıcıya yalnızca kritik hatalarda bildir

---

## Faz 4: Wordlist Bucket (Ertelendi)

> **Neden ertelendi:** Mevcut wordlist klasörü yalnızca 337KB. APK boyutuna etkisi ihmal edilebilir.  
> Dil sayısı artıp toplam boyut >5MB'ı geçince bu fazı gündeme al.

- [ ] `scripts/upload-to-bucket.ts` yaz (Supabase `service_role` key ile — asla APK'ya dahil etme)
- [ ] Supabase Dashboard → Storage → `wordlists` adında public bucket oluştur
- [ ] `scripts/generate-wordlist.ts`'e upload adımını entegre et
- [ ] `src/shared/api/supabase/VocabularySyncManager.ts` oluştur
  - App açılışta eksik dil dosyalarını kontrol et
  - Fetch → `expo-file-system` cache klasörüne yaz
  - Cache geçerlilik süresi: 7 gün
- [ ] `generate-wordlist.ts` çıktısını `assets/` yerine geçici klasöre yönlendir

---

## Doğrulama Adımları

- [ ] `npm run typecheck` — hata yok
- [ ] Staging Supabase stringleriyle development build derle
- [ ] "Google ile Giriş Yap" butonuna tıkla → sistem Google prompt'u açılıyor mu?
- [ ] Oturum açıkken uygulama kapatılıp açılınca oturum korunuyor mu?
- [ ] İki cihazda aynı hesapla giriş yap → bir cihazda kart oluştur → diğerinde görünüyor mu?
- [ ] Misafir modunda tüm özellikler çalışıyor mu? (Supabase gerektirmeyen akışlar)

---

## Kritik Güvenlik Notları

- `SUPABASE_ANON_KEY` kaynak kodunda değil, ortam değişkeninde
- `service_role` key **asla** APK'ya dahil edilmez — sadece CI/CD pipeline'da
- RLS politikaları olmadan hiçbir tablo production'a taşınmaz
- Supabase'de email doğrulaması veya Google OAuth olmadan kayıt kapatılmalı
