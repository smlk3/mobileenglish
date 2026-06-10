# Security Overview — AU MoDA (LinguaLearn)

This document summarizes the app's security posture, the design decisions behind it,
and the status of known dependency advisories. It is intended for maintainers and
for project handover.

_Last reviewed: 2026-06-10_

---

## 1. Data & secrets

- **Guest-first:** the app is fully usable without an account; in guest mode all data
  stays on the device.
- **AI keys (BYOK):** the user's AI provider key is stored in the device secure storage
  (Android Keystore via `expo-secure-store` — `src/shared/lib/apiKeyStore.ts`), never in
  the database and never logged. _Note: before 2026-06-10 keys lived in the local SQLite
  `user_settings` table; a one-time startup migration moves them into secure storage and
  wipes the DB copy._
- **Android backups:** `android:allowBackup` is disabled (`expo-build-properties`), so
  app data (including the local SQLite DB) is excluded from device/cloud backups.
- **Supabase keys:** only the **anon / publishable** key ships in the app (it is
  client-safe by design). The **`service_role` key is never bundled** — it is not used
  anywhere in the client.
- **No secrets in git:** `.env*` is git-ignored; `eas.json` contains only the public
  `EXPO_PUBLIC_*` values. A scan of the codebase and git history found no leaked secrets.

## 2. Authentication & authorization

- **Google OAuth via Supabase, PKCE flow.** The OAuth `code` is exchanged client-side
  with a code-verifier kept in secure storage, which mitigates custom-scheme
  (`lingualearn://`) interception.
- **Sessions** are persisted in `expo-secure-store` (chunked to handle large tokens).
- **Row Level Security (RLS)** is enabled on every synced table (`decks`, `cards`,
  `study_sessions`) with `auth.uid() = user_id` for both `USING` and `WITH CHECK`.
  A user can only read or modify their own rows.
- **Sync RPCs** (`pull` / `push`, `SECURITY INVOKER`) run under the caller's RLS and
  force `user_id = auth.uid()` on writes, so cross-user reads/overwrites are not possible.
  Dynamic SQL in `pull` uses only hard-coded table names (no user input) with `%I`
  quoting — no SQL injection surface.
- **Account deletion** (`delete_account`, `SECURITY DEFINER`) is argument-free, pins
  `search_path = public`, and only ever touches `auth.uid()`'s own data + auth row.

## 3. Hardening applied

**2026-06-08**

- Removed chat message **content** from `console` logs (privacy).
- Gemini API key now sent via the **`x-goog-api-key` header** instead of the URL query
  string.
- `.gitignore` broadened to ignore **all** `.env*` files.

**2026-06-10**

- **AI API keys moved out of plain SQLite into secure storage** (Android Keystore via
  `expo-secure-store`), with a one-time migration that wipes the legacy DB column.
- **`android:allowBackup` disabled** via `expo-build-properties` — the local DB no
  longer lands in Android auto-backups.
- **`_changes_for` RPC hardened with a table whitelist** (`decks`/`cards`/
  `study_sessions`): the helper is reachable via PostgREST, and although
  `SECURITY INVOKER` + RLS already prevented data access, arbitrary table names could
  be probed via error messages. Re-run `supabase/sync.sql` to apply.

## 4. Dependency advisories (`npm audit`)

`npm audit` reports advisories (mostly in **build / development tooling**: Expo CLI,
Metro, prebuild-config, `xcode`, `postcss`, `ws`, `yaml`, `node-forge`, `xmldom`,
`undici`, …). Assessment:

- **These run on developer machines / EAS build servers, not on end-user devices.**
  React Native bundles only imported app code; the runtime uses native `fetch`, so
  packages like `undici` and `ws` are never executed in the shipped APK.
- `npm audit fix` (non-breaking) is effectively a **no-op** here — the fixes are pinned
  by the current Expo SDK (54). `npm audit fix --force` would force-upgrade Expo to a
  new major SDK and **break the project**; do **not** run it.
- **End-user exploitability of the shipped app from these advisories is negligible.**

### Remediation plan

1. **Before launch:** no action required (no safe + effective `npm audit` fix exists;
   the items are build-time only).
2. **After launch (planned):** upgrade the Expo SDK deliberately, then run full
   regression tests:
   ```bash
   npx expo install expo@latest
   npx expo install --fix
   npx expo-doctor
   ```
   This clears the bulk of the advisories.
3. Treat `npm audit` in CI as **informational**, not a build blocker.

## 5. Known low-risk items

- **Web** session storage falls back to AsyncStorage (no SecureStore on web); the app
  is mobile-first.
- **Local SQLite (WatermelonDB)** is unencrypted on device; it holds only learning
  content (no API keys, which live in the Keystore). Standard mobile risk.

## 6. Reporting

Report security issues to: **[YOUR CONTACT EMAIL]**.
