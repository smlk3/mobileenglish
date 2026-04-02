/**
 * Learning Session Process
 * Cross-feature workflow that orchestrates the complete learning loop:
 * 1. Select words (Cloud LLM + RAG)
 * 2. Flashcard recognition (UI)
 * 3. Quiz recall (SLM)
 * 4. Speaking production (SLM)
 * 5. Update SRS values in DB
 * 6. Request new words & cache
 */

import { SRSAlgorithm, type Rating, type SRSState } from '../entities/SRS/SRSAlgorithm';
import { QuizEngine, type QuizQuestion } from '../features/quiz-engine/QuizEngine';
import HybridLLMManager, { type WordSelection } from '../shared/api/llm/HybridLLMManager';
import { cefrToLevel } from '../shared/lib/languageConfig';
import { getVectorStore } from '../shared/api/rag/VectorStore';

export type SessionPhase = 'selecting' | 'flashcard' | 'quiz' | 'speaking' | 'review' | 'complete';

export interface SessionWord extends WordSelection {
    cardId?: string;
    srsState: SRSState;
}

export interface SessionResult {
    wordsStudied: number;
    correctCount: number;
    accuracy: number;
    timeSpentSeconds: number;
    newWordsLearned: number;
    srsUpdates: { cardId: string; newState: SRSState; nextReview: number }[];
}

export class LearningSession {
    private llmManager: HybridLLMManager;
    private quizEngine: QuizEngine;
    private words: SessionWord[] = [];
    private currentWordIndex = 0;
    private startTime: number = 0;
    private results: { wordIndex: number; rating: Rating; phase: SessionPhase }[] = [];

    constructor() {
        this.llmManager = HybridLLMManager.getInstance();
        this.quizEngine = new QuizEngine();
    }

    /**
     * Phase 1: Select words for the session
     * Uses RAG + Cloud LLM for personalized selection
     */
    async selectWords(params: {
        profile: { profession: string; interests: string[]; level: string; goals: string[] };
        existingWords: string[];
        count?: number;
    }): Promise<SessionWord[]> {
        const { profile, existingWords, count = 5 } = params;
        const vectorStore = getVectorStore();

        // Try Cloud LLM selection first
        let selectedWords: WordSelection[] = [];

        try {
            selectedWords = await this.llmManager.selectNewWords(
                profile,
                existingWords,
                count,
            );
        } catch {
            // Fallback to local RAG selection
        }

        // If Cloud didn't return enough, fill from local dictionary
        if (selectedWords.length < count) {
            const localWords = vectorStore.search({
                level: cefrToLevel(profile.level),
                interests: profile.interests,
                excludeWords: [
                    ...existingWords,
                    ...selectedWords.map((w) => w.word),
                ],
                limit: count - selectedWords.length,
            });

            selectedWords = [
                ...selectedWords,
                ...localWords.map((entry) => ({
                    word: entry.word,
                    translation: entry.translation,
                    cefrLevel: String(entry.level),
                    category: entry.category,
                    exampleSentence: entry.exampleSentence,
                })),
            ];
        }

        // Initialize SRS state for each word
        this.words = selectedWords.map((word) => ({
            ...word,
            srsState: SRSAlgorithm.getDefaultState(),
        }));

        this.startTime = Date.now();
        this.currentWordIndex = 0;
        this.results = [];

        return this.words;
    }

    /**
     * Get current word
     */
    getCurrentWord(): SessionWord | null {
        if (this.currentWordIndex >= this.words.length) return null;
        return this.words[this.currentWordIndex];
    }

    /**
     * Phase 2: Record flashcard result
     */
    recordFlashcardRating(rating: Rating): void {
        this.results.push({
            wordIndex: this.currentWordIndex,
            rating,
            phase: 'flashcard',
        });
    }

    /**
     * Phase 3: Generate quiz for current word
     */
    async generateQuiz(): Promise<QuizQuestion[]> {
        const currentWord = this.getCurrentWord();
        if (!currentWord) return [];

        return this.quizEngine.generateQuestions([currentWord]);
    }

    /**
     * Phase 4: Check speaking/writing
     */
    async checkSentence(sentence: string, targetWord: string) {
        return this.llmManager.checkGrammar(sentence, targetWord);
    }

    /**
     * Move to next word
     */
    nextWord(): boolean {
        if (this.currentWordIndex < this.words.length - 1) {
            this.currentWordIndex++;
            return true;
        }
        return false;
    }

    /**
     * Phase 5: Complete session and calculate SRS updates
     */
    completeSession(): SessionResult {
        const timeSpent = Math.round((Date.now() - this.startTime) / 1000);

        // Calculate SRS updates for each word
        const srsUpdates = this.words.map((word, index) => {
            // Find the best rating for this word from all phases
            const wordResults = this.results.filter((r) => r.wordIndex === index);
            const bestRating = this.getBestRating(wordResults.map((r) => r.rating));

            const srsResult = SRSAlgorithm.calculate(word.srsState, bestRating);

            return {
                cardId: word.cardId || `word_${index}`,
                newState: {
                    interval: srsResult.interval,
                    easeFactor: srsResult.easeFactor,
                    repetitions: srsResult.repetitions,
                    status: srsResult.status,
                },
                nextReview: srsResult.nextReview,
            };
        });

        const correctCount = this.results.filter(
            (r) => r.rating !== 'again',
        ).length;

        return {
            wordsStudied: this.words.length,
            correctCount,
            accuracy:
                this.words.length > 0
                    ? Math.round((correctCount / this.results.length) * 100)
                    : 0,
            timeSpentSeconds: timeSpent,
            newWordsLearned: this.words.filter((_, i) => {
                const ratings = this.results
                    .filter((r) => r.wordIndex === i)
                    .map((r) => r.rating);
                return ratings.includes('good') || ratings.includes('easy');
            }).length,
            srsUpdates,
        };
    }

    /**
     * Determine the overall rating from multiple phase results
     */
    private getBestRating(ratings: Rating[]): Rating {
        if (ratings.length === 0) return 'again';
        if (ratings.includes('easy')) return 'easy';
        if (ratings.includes('good')) return 'good';
        if (ratings.includes('hard')) return 'hard';
        return 'again';
    }
}
