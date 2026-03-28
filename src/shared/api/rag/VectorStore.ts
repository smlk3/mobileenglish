/**
 * VectorStore - Lightweight dictionary search engine
 * Uses structured JSON dictionary with CEFR levels and categories
 * for RAG-based word selection.
 */

import dictionaryData from './dictionary.json';

export interface DictionaryEntry {
    word: string;
    translation: string;
    cefrLevel: string;
    category: string;
    exampleSentence: string;
}

export class VectorStore {
    private dictionary: DictionaryEntry[];

    constructor() {
        this.dictionary = dictionaryData as DictionaryEntry[];
    }

    /** Get all entries */
    getAll(): DictionaryEntry[] {
        return this.dictionary;
    }

    /** Get entries by CEFR level */
    getByLevel(level: string): DictionaryEntry[] {
        return this.dictionary.filter((entry) => entry.cefrLevel === level);
    }

    /** Get entries by category */
    getByCategory(category: string): DictionaryEntry[] {
        return this.dictionary.filter(
            (entry) => entry.category.toLowerCase() === category.toLowerCase(),
        );
    }

    /**
     * Search entries by user interests and level
     * This is the main RAG query method
     */
    search(params: {
        level?: string;
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

        // Filter by level if specified
        if (level) {
            const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
            const targetIndex = levelOrder.indexOf(level);
            if (targetIndex >= 0) {
                // Include current level and one level below/above
                const validLevels = levelOrder.slice(
                    Math.max(0, targetIndex - 1),
                    targetIndex + 2,
                );
                results = results.filter((entry) =>
                    validLevels.includes(entry.cefrLevel),
                );
            }
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
            if (entry.cefrLevel === level) score += 1;

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
    getRandomWords(level: string, count: number = 5, excludeWords: string[] = []): DictionaryEntry[] {
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

    /** Get available CEFR levels */
    getLevels(): string[] {
        const levels = new Set(this.dictionary.map((e) => e.cefrLevel));
        return Array.from(levels).sort();
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
    getStats(): Record<string, number> {
        const stats: Record<string, number> = {};
        for (const entry of this.dictionary) {
            stats[entry.cefrLevel] = (stats[entry.cefrLevel] || 0) + 1;
        }
        return stats;
    }
}

// Singleton instance
let vectorStoreInstance: VectorStore | null = null;

export function getVectorStore(): VectorStore {
    if (!vectorStoreInstance) {
        vectorStoreInstance = new VectorStore();
    }
    return vectorStoreInstance;
}
