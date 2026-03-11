/**
 * Quiz Engine Feature
 * Evaluates user answers, provides scoring,
 * and feeds results into the SRS algorithm
 */

import { SRSAlgorithm, type Rating, type SRSResult, type SRSState } from '../../entities/SRS/SRSAlgorithm';
import HybridLLMManager, { type WordSelection } from '../../shared/api/llm/HybridLLMManager';

export interface QuizQuestion {
    id: string;
    cardId: string;
    word: string;
    translation: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
}

export interface QuizResult {
    questionId: string;
    cardId: string;
    selectedAnswer: string;
    isCorrect: boolean;
    srsRating: Rating;
    srsResult: SRSResult;
}

export class QuizEngine {
    private llmManager: HybridLLMManager;

    constructor() {
        this.llmManager = HybridLLMManager.getInstance();
    }

    /**
     * Generate quiz questions from a list of words
     */
    async generateQuestions(words: WordSelection[]): Promise<QuizQuestion[]> {
        const quizContent = await this.llmManager.generateQuizContent(words);

        return quizContent.map((content, index) => ({
            id: `quiz_${Date.now()}_${index}`,
            cardId: `card_${index}`,
            word: words[index]?.word || '',
            translation: words[index]?.translation || '',
            question: content.question,
            options: content.options,
            correctAnswer: content.correctAnswer,
            explanation: content.explanation,
        }));
    }

    /**
     * Evaluate a user's answer and calculate SRS update
     */
    evaluateAnswer(
        question: QuizQuestion,
        selectedAnswer: string,
        currentSRSState: SRSState,
        answerTimeMs: number,
    ): QuizResult {
        const isCorrect =
            selectedAnswer.toLowerCase().trim() ===
            question.correctAnswer.toLowerCase().trim();

        // Determine SRS rating based on correctness and speed
        const srsRating = this.calculateRating(isCorrect, answerTimeMs);

        // Calculate new SRS state
        const srsResult = SRSAlgorithm.calculate(currentSRSState, srsRating);

        return {
            questionId: question.id,
            cardId: question.cardId,
            selectedAnswer,
            isCorrect,
            srsRating,
            srsResult,
        };
    }

    /**
     * Calculate SRS rating based on answer correctness and speed
     * Fast + correct = Easy
     * Slow + correct = Good
     * Wrong = Again
     */
    private calculateRating(isCorrect: boolean, answerTimeMs: number): Rating {
        if (!isCorrect) return 'again';

        const seconds = answerTimeMs / 1000;

        if (seconds < 3) return 'easy';    // Very fast = knew it instantly
        if (seconds < 8) return 'good';    // Normal speed
        return 'hard';                      // Slow but correct
    }

    /**
     * Get summary statistics for a quiz session
     */
    getSessionStats(results: QuizResult[]) {
        const total = results.length;
        const correct = results.filter((r) => r.isCorrect).length;
        const incorrect = total - correct;

        const ratingBreakdown = {
            again: results.filter((r) => r.srsRating === 'again').length,
            hard: results.filter((r) => r.srsRating === 'hard').length,
            good: results.filter((r) => r.srsRating === 'good').length,
            easy: results.filter((r) => r.srsRating === 'easy').length,
        };

        return {
            total,
            correct,
            incorrect,
            accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
            ratingBreakdown,
        };
    }
}
