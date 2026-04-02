/**
 * VectorStore - Lightweight dictionary search engine
 * Uses structured JSON wordlists per language pair with level-based filtering
 * for RAG-based word selection.
 */

// Static imports for all language pairs (bundled at build time)
import enTr from '../../../../assets/wordlists/en/tr.json';
import deTr from '../../../../assets/wordlists/de/tr.json';
import frTr from '../../../../assets/wordlists/fr/tr.json';
import esTr from '../../../../assets/wordlists/es/tr.json';
import arTr from '../../../../assets/wordlists/ar/tr.json';
import jaTr from '../../../../assets/wordlists/ja/tr.json';

export interface DictionaryEntry {
    word: string;
    translation: string;
    level: number;          // 1-6 internal level
    category: string;
    exampleSentence: string;
    partOfSpeech?: string;
}

/** Map of "target-native" → wordlist data */
const WORDLIST_MAP: Record<string, DictionaryEntry[]> = {
    'en-tr': enTr as DictionaryEntry[],
    'de-tr': deTr as DictionaryEntry[],
    'fr-tr': frTr as DictionaryEntry[],
    'es-tr': esTr as DictionaryEntry[],
    'ar-tr': arTr as DictionaryEntry[],
    'ja-tr': jaTr as DictionaryEntry[],
};

export class VectorStore {
    private dictionary: DictionaryEntry[];
    readonly targetLang: string;
    readonly nativeLang: string;

    constructor(targetLang: string = 'en', nativeLang: string = 'tr') {
        this.targetLang = targetLang;
        this.nativeLang = nativeLang;
        const key = `${targetLang}-${nativeLang}`;
        this.dictionary = WORDLIST_MAP[key] ?? [];
    }

    /** Get all entries */
    getAll(): DictionaryEntry[] {
        return this.dictionary;
    }

    /** Get entries by level (1-6) */
    getByLevel(level: number): DictionaryEntry[] {
        return this.dictionary.filter((entry) => entry.level === level);
    }

    /** Get entries by category */
    getByCategory(category: string): DictionaryEntry[] {
        return this.dictionary.filter(
            (entry) => entry.category.toLowerCase() === category.toLowerCase(),
        );
    }

    /**
     * Search entries by user interests and level.
     * This is the main RAG query method.
     */
    search(params: {
        level?: number;
        categories?: string[];
        interests?: string[];
        excludeWords?: string[];
        limit?: number;
    }): DictionaryEntry[] {
        const {
            level,
            categories = [],
            interests = [],
            excludeWords = [],
            limit = 10,
        } = params;

        const excludeSet = new Set(excludeWords.map((w) => w.toLowerCase()));

        let results = this.dictionary.filter(
            (entry) => !excludeSet.has(entry.word.toLowerCase()),
        );

        // Filter by level if specified (include current level ± 1)
        if (level) {
            const minLevel = Math.max(1, level - 1);
            const maxLevel = Math.min(6, level + 1);
            results = results.filter(
                (entry) => entry.level >= minLevel && entry.level <= maxLevel,
            );
        }

        // Score entries based on relevance to interests/categories
        const scored = results.map((entry) => {
            let score = 0;

            // Category match
            if (categories.some((c) => c.toLowerCase() === entry.category.toLowerCase())) {
                score += 3;
            }

            // Interest match (fuzzy matching against category and example)
            for (const interest of interests) {
                const lower = interest.toLowerCase();
                if (entry.category.toLowerCase().includes(lower)) score += 2;
                if (entry.exampleSentence.toLowerCase().includes(lower)) score += 1;
                if (entry.word.toLowerCase().includes(lower)) score += 1;
            }

            // Exact level match bonus
            if (entry.level === level) score += 1;

            return { entry, score };
        });

        // Sort by score (highest first), then shuffle within same score
        scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return Math.random() - 0.5;
        });

        return scored.slice(0, limit).map((s) => s.entry);
    }

    /**
     * Get random words for a level (fallback when no interests)
     */
    getRandomWords(level: number, count: number = 5, excludeWords: string[] = []): DictionaryEntry[] {
        const excludeSet = new Set(excludeWords.map((w) => w.toLowerCase()));
        const levelWords = this.getByLevel(level).filter(
            (entry) => !excludeSet.has(entry.word.toLowerCase()),
        );

        // Fisher-Yates shuffle
        const shuffled = [...levelWords];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled.slice(0, count);
    }

    /** Get available categories */
    getCategories(): string[] {
        const categories = new Set(this.dictionary.map((e) => e.category));
        return Array.from(categories).sort();
    }

    /** Get available levels */
    getLevels(): number[] {
        const levels = new Set(this.dictionary.map((e) => e.level));
        return Array.from(levels).sort((a, b) => a - b);
    }

    /**
     * Find a single entry by exact word match (case-insensitive).
     * Falls back to prefix match if no exact result found.
     */
    findByWord(word: string): DictionaryEntry | null {
        const lower = word.toLowerCase().trim();
        const exact = this.dictionary.find((e) => e.word.toLowerCase() === lower);
        if (exact) return exact;
        return this.dictionary.find((e) => e.word.toLowerCase().startsWith(lower)) ?? null;
    }

    /** Get word count per level */
    getStats(): Record<number, number> {
        const stats: Record<number, number> = {};
        for (const entry of this.dictionary) {
            stats[entry.level] = (stats[entry.level] || 0) + 1;
        }
        return stats;
    }

    /** Whether this store has any words loaded */
    get isEmpty(): boolean {
        return this.dictionary.length === 0;
    }
}

// ─── Singleton instances per language pair ───────────────────────────

const instances = new Map<string, VectorStore>();

export function getVectorStore(targetLang: string = 'en', nativeLang: string = 'tr'): VectorStore {
    const key = `${targetLang}-${nativeLang}`;
    if (!instances.has(key)) {
        instances.set(key, new VectorStore(targetLang, nativeLang));
    }
    return instances.get(key)!;
}
