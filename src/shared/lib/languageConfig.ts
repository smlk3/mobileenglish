/**
 * Language configuration and proficiency level mapping.
 *
 * Internally levels are always stored as integers 1-6.
 * The display label adapts per target language (CEFR / JLPT / HSK).
 */

// ─── Types ──────────────────────────────────────────────────────────

export type LevelSystem = 'cefr' | 'jlpt' | 'hsk';

export interface LanguageConfig {
    /** ISO 639-1 code */
    code: string;
    /** English name */
    name: string;
    /** Name in the language itself */
    nativeName: string;
    /** Emoji flag */
    flag: string;
    /** Which proficiency scale to display */
    levelSystem: LevelSystem;
    /** Maps internal level (1-6) → display label */
    levelLabels: Record<number, string>;
}

// ─── Supported Target Languages ─────────────────────────────────────

export const SUPPORTED_TARGET_LANGUAGES: LanguageConfig[] = [
    {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇬🇧',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
    {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        flag: '🇩🇪',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
    {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        flag: '🇫🇷',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
    {
        code: 'it',
        name: 'Italian',
        nativeName: 'Italiano',
        flag: '🇮🇹',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
    {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        flag: '🇪🇸',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
    {
        code: 'ru',
        name: 'Russian',
        nativeName: 'Русский',
        flag: '🇷🇺',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
    {
        code: 'uk',
        name: 'Ukrainian',
        nativeName: 'Українська',
        flag: '🇺🇦',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
    {
        code: 'pl',
        name: 'Polish',
        nativeName: 'Polski',
        flag: '🇵🇱',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
    {
        code: 'bg',
        name: 'Bulgarian',
        nativeName: 'Български',
        flag: '🇧🇬',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
    {
        code: 'sr',
        name: 'Serbian',
        nativeName: 'Српски',
        flag: '🇷🇸',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
    {
        code: 'hy',
        name: 'Armenian',
        nativeName: 'Հայերեն',
        flag: '🇦🇲',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
    {
        code: 'tr',
        name: 'Turkish',
        nativeName: 'Türkçe',
        flag: '🇹🇷',
        levelSystem: 'cefr',
        levelLabels: { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' },
    },
];

// ─── Supported Native Languages ─────────────────────────────────────

// Bridge-language strategy: only Turkish and English are native languages.
// Turkish speakers learn the 11 target languages; everyone else learns Turkish
// through English (assumed lingua franca). Wordlists exist only for these natives.
export const SUPPORTED_NATIVE_LANGUAGES = [
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
] as const;

// ─── Lookup Maps ────────────────────────────────────────────────────

const targetLangMap = new Map(SUPPORTED_TARGET_LANGUAGES.map((l) => [l.code, l]));

/** Get full config for a target language. Falls back to English. */
export function getLanguageConfig(targetLangCode: string): LanguageConfig {
    return targetLangMap.get(targetLangCode) ?? targetLangMap.get('en')!;
}

/** Get the display label for an internal level number. */
export function getLevelLabel(targetLangCode: string, level: number): string {
    const config = getLanguageConfig(targetLangCode);
    return config.levelLabels[level] ?? `L${level}`;
}

/** Get all level labels for a target language as an ordered array of { level, label }. */
export function getLevelOptions(targetLangCode: string): { level: number; label: string }[] {
    const config = getLanguageConfig(targetLangCode);
    return [1, 2, 3, 4, 5, 6].map((level) => ({
        level,
        label: config.levelLabels[level] ?? `L${level}`,
    }));
}

/** Get the English name for any language code (target or native). */
export function getLanguageName(code: string): string {
    const target = targetLangMap.get(code);
    if (target) return target.name;
    const native = SUPPORTED_NATIVE_LANGUAGES.find((l) => l.code === code);
    return native?.name ?? code;
}

// ─── Text-to-Speech (BCP-47) ────────────────────────────────────────

/**
 * Maps an internal 2-letter code to a BCP-47 locale for expo-speech.
 * Covers current and planned language pairs (bridge-language strategy).
 */
const BCP47_MAP: Record<string, string> = {
    en: 'en-US', tr: 'tr-TR', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
    it: 'it-IT', ar: 'ar-SA', ja: 'ja-JP', ru: 'ru-RU', pl: 'pl-PL',
    uk: 'uk-UA', bg: 'bg-BG', sr: 'sr-RS', hy: 'hy-AM',
};

/** Convert an internal language code to a BCP-47 locale (e.g. 'de' → 'de-DE'). */
export function toBcp47(code: string): string {
    if (code.includes('-')) return code; // already BCP-47
    return BCP47_MAP[code.toLowerCase()] ?? code;
}

// ─── Legacy CEFR ↔ Level Conversion ─────────────────────────────────

const CEFR_TO_LEVEL: Record<string, number> = {
    A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
};

const LEVEL_TO_CEFR: Record<number, string> = {
    1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2',
};

/** Convert a legacy CEFR string (e.g. "B1") to internal level number. Returns the number if already numeric. */
export function cefrToLevel(cefrOrLevel: string): number {
    const num = parseInt(cefrOrLevel, 10);
    if (!isNaN(num) && num >= 1 && num <= 6) return num;
    return CEFR_TO_LEVEL[cefrOrLevel.toUpperCase()] ?? 1;
}

/** Convert internal level number to legacy CEFR string. */
export function levelToCefr(level: number): string {
    return LEVEL_TO_CEFR[level] ?? 'A1';
}

// ─── Level Colors (for badges, chips, etc.) ─────────────────────────

export const LEVEL_COLORS: Record<number, string> = {
    1: '#22C55E', // green
    2: '#3B82F6', // blue
    3: '#F59E0B', // amber
    4: '#EF4444', // red
    5: '#8B5CF6', // purple
    6: '#EC4899', // pink
};
