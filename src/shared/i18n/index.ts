import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './locales/en';
import tr from './locales/tr';
import de from './locales/de';
import fr from './locales/fr';
import es from './locales/es';
import ar from './locales/ar';

const SUPPORTED_LANGS = ['en', 'tr', 'de', 'fr', 'es', 'ar'];

function getDeviceLanguage(): string {
    try {
        const locale = getLocales()[0]?.languageCode || 'en';
        return SUPPORTED_LANGS.includes(locale) ? locale : 'en';
    } catch {
        return 'en';
    }
}

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        tr: { translation: tr },
        de: { translation: de },
        fr: { translation: fr },
        es: { translation: es },
        ar: { translation: ar },
    },
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
});

export default i18n;
