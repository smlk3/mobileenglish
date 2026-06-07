# Privacy Policy — AU MoDA (LinguaLearn)

**Effective date:** 2026-06-07
**Last updated:** 2026-06-07

This Privacy Policy explains how **AU MoDA** ("LinguaLearn", "the app", "we", "us") handles your information. The app is a vocabulary/language-learning application. We designed it to work with **as little personal data as possible** — you can use most of the app as a guest, without an account.

If you have questions, contact us at: **[YOUR CONTACT EMAIL]** (suggested: bitirmeprojesi51015@gmail.com).

---

## 1. Summary

- You can use the app **as a guest** — no account, no sign-in. In this mode your data stays **on your device**.
- If you **sign in with Google** (optional), we sync your learning content so you can use it across devices.
- AI features are **"bring your own key"**: you enter your own AI provider key (e.g. Google Gemini). Your text is sent **directly to that provider**, not through our servers.
- We do **not** sell your data, show ads, or use tracking/advertising SDKs.
- You can **delete your account and synced data at any time** from within the app.

---

## 2. Information we collect

**a) If you sign in with Google (optional):**
- Your **email address** and Google account identifier, used to create and identify your account (handled by our authentication provider, Supabase).

**b) Learning content & progress (only synced if you are signed in):**
- Your **decks, flashcards, and study/quiz sessions** (e.g. words, translations, example sentences, review history).
- Your **learning profile** that you enter for personalization: target language, level, and optional tags such as profession, interests, and goals.

**c) Stored only on your device (never sent to our servers):**
- Your **AI provider API key**, stored in the device's secure storage (Android Keystore via Expo SecureStore).
- App **settings** (theme, daily goal, language) and AI **chat history**.

**d) We do NOT collect:**
- Location, contacts, photos, microphone, or device identifiers for advertising.
- Any special-category/sensitive personal data.

---

## 3. How we use your information

- To provide core features: creating decks, studying, spaced-repetition scheduling, and quizzes.
- To **sync** your learning content across your devices when you are signed in.
- To **personalize** generated vocabulary using your profile (profession/interests/level), only when you use the AI generation feature.
- To authenticate you (sign in / sign out / delete account).

We do **not** use your data for advertising or sell it to third parties.

---

## 4. Third-party services

When you use certain features, data is processed by these providers under their own privacy policies:

- **Supabase** (authentication + database) — stores your account and synced learning content. https://supabase.com/privacy
- **Google Sign-In** — used only if you choose to sign in. https://policies.google.com/privacy
- **AI provider you configure (default: Google Gemini via Google AI Studio)** — when you use AI features (word generation, chat), the text you send (which may include your profile tags and vocabulary) is sent to that provider to generate a response.
  - For Google Gemini, see https://ai.google.dev/gemini-api/terms and https://policies.google.com/privacy
  - **Note:** on free API tiers, the provider may use submitted content to improve its models. Do not enter confidential information into AI features.
- **Expo / React Native** — app framework. On-device text-to-speech (Expo Speech) runs locally and sends no text to us.

---

## 5. Where your data is stored

- **On-device data** (settings, API key, chat history, and all guest-mode content) stays on your device.
- **Synced data** (for signed-in users) is stored on Supabase infrastructure and may be processed on servers located outside your country. Data is protected with row-level security so each user can access only their own data, and is transmitted over encrypted connections (HTTPS/TLS).

---

## 6. Data retention and deletion

- Guest data remains on your device until you uninstall the app or reset app data.
- For signed-in users, synced data is kept until you delete it.
- **You can delete your account and all synced data at any time:** open **Settings → Account → "Delete account"**. This permanently removes your synced decks, flashcards, study sessions, and your authentication record. This action cannot be undone.
- Alternatively, you can request deletion by emailing **[YOUR CONTACT EMAIL]**.

---

## 7. Security

- API keys are stored using the device's secure storage (Android Keystore).
- Account and synced data are protected by row-level security (each user can access only their own rows) and transmitted over encrypted connections.
- No system is 100% secure; we cannot guarantee absolute security.

---

## 8. Children's privacy

The app is intended for general audiences and is **not directed to children under 13** (or the minimum age required in your jurisdiction). We do not knowingly collect personal data from children. If you believe a child has provided personal data, contact us and we will delete it.

---

## 9. Permissions

The app requires **internet access** for sign-in, sync, and AI features. It does **not** request camera, microphone, location, or contacts permissions.

---

## 10. Changes to this policy

We may update this Privacy Policy. Material changes will be reflected by updating the "Last updated" date above and, where appropriate, via an in-app notice.

---

## 11. Contact

For privacy questions or data-deletion requests:

- **[YOUR NAME / DEVELOPER]**
- **[YOUR CONTACT EMAIL]**
