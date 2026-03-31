/**
 * SM-2 Spaced Repetition Algorithm
 * Pure TypeScript - Deterministic, no AI involvement
 *
 * Based on SuperMemo SM-2 with modifications:
 * - 4 rating levels: Again (0), Hard (1), Good (2), Easy (3)
 * - New cards start with a learning phase
 * - Graduated cards use full SM-2 interval calculation
 */

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type CardStatus = 'new' | 'learning' | 'review' | 'graduated';

export interface SRSState {
    interval: number;       // Current interval in days
    easeFactor: number;     // Ease factor (minimum 1.3)
    repetitions: number;    // Number of successful reviews
    status: CardStatus;
}

export interface SRSResult extends SRSState {
    nextReview: number;     // Timestamp of next review
}

// Rating to quality mapping for SM-2
const RATING_QUALITY: Record<Rating, number> = {
    again: 0,
    hard: 2,
    good: 3,
    easy: 5,
};

// Learning phase step intervals (in minutes)
const LEARNING_STEPS = [1, 10]; // 1 min, then 10 min

// Default values for new cards
const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const GRADUATING_INTERVAL = 1;      // 1 day after learning
const EASY_GRADUATING_INTERVAL = 4; // 4 days if Easy during learning

export class SRSAlgorithm {
    /**
     * Calculate the next review state based on current state and user rating.
     * This is the main entry point - 100% deterministic, no randomness.
     */
    static calculate(currentState: SRSState, rating: Rating): SRSResult {
        const { status } = currentState;

        switch (status) {
            case 'new':
            case 'learning':
                return SRSAlgorithm.handleLearningPhase(currentState, rating);
            case 'review':
            case 'graduated':
                return SRSAlgorithm.handleReviewPhase(currentState, rating);
            default:
                return SRSAlgorithm.handleLearningPhase(currentState, rating);
        }
    }

    /**
     * Handle cards in the learning phase (new or learning status).
     * Cards step through learning intervals before graduating.
     */
    private static handleLearningPhase(state: SRSState, rating: Rating): SRSResult {
        const now = Date.now();

        switch (rating) {
            case 'again':
                // Reset to first learning step
                return {
                    interval: 0,
                    easeFactor: Math.max(MIN_EASE_FACTOR, state.easeFactor - 0.2),
                    repetitions: 0,
                    status: 'learning',
                    nextReview: now + LEARNING_STEPS[0] * 60 * 1000, // 1 minute
                };

            case 'hard':
                // Stay at current step or advance slowly
                return {
                    interval: 0,
                    easeFactor: Math.max(MIN_EASE_FACTOR, state.easeFactor - 0.15),
                    repetitions: state.repetitions,
                    status: 'learning',
                    nextReview: now + LEARNING_STEPS[0] * 60 * 1000, // Repeat first step
                };

            case 'good':
                // Advance through learning steps
                if (state.repetitions < LEARNING_STEPS.length - 1) {
                    // Move to next learning step
                    const nextStep = LEARNING_STEPS[state.repetitions + 1] || LEARNING_STEPS[LEARNING_STEPS.length - 1];
                    return {
                        interval: 0,
                        easeFactor: state.easeFactor,
                        repetitions: state.repetitions + 1,
                        status: 'learning',
                        nextReview: now + nextStep * 60 * 1000,
                    };
                } else {
                    // Graduate the card
                    return {
                        interval: GRADUATING_INTERVAL,
                        easeFactor: state.easeFactor,
                        repetitions: state.repetitions + 1,
                        status: 'review',
                        nextReview: now + GRADUATING_INTERVAL * 24 * 60 * 60 * 1000,
                    };
                }

            case 'easy':
                // Immediately graduate with a longer interval
                return {
                    interval: EASY_GRADUATING_INTERVAL,
                    easeFactor: state.easeFactor + 0.15,
                    repetitions: state.repetitions + 1,
                    status: 'graduated',
                    nextReview: now + EASY_GRADUATING_INTERVAL * 24 * 60 * 60 * 1000,
                };

            default:
                return {
                    ...state,
                    nextReview: now + LEARNING_STEPS[0] * 60 * 1000,
                };
        }
    }

    /**
     * Handle cards in the review phase.
     * Uses the full SM-2 algorithm for interval calculation.
     */
    private static handleReviewPhase(state: SRSState, rating: Rating): SRSResult {
        const now = Date.now();
        const quality = RATING_QUALITY[rating];

        switch (rating) {
            case 'again': {
                // Lapse: card goes back to learning
                const newEaseFactor = Math.max(MIN_EASE_FACTOR, state.easeFactor - 0.2);
                return {
                    interval: 0,
                    easeFactor: newEaseFactor,
                    repetitions: 0,
                    status: 'learning',
                    nextReview: now + LEARNING_STEPS[0] * 60 * 1000,
                };
            }

            case 'hard': {
                // Harder review: smaller interval increase
                const newEaseFactor = Math.max(MIN_EASE_FACTOR, state.easeFactor - 0.15);
                const newInterval = Math.max(1, Math.round(state.interval * 1.2));
                return {
                    interval: newInterval,
                    easeFactor: newEaseFactor,
                    repetitions: state.repetitions + 1,
                    status: 'review',
                    nextReview: now + newInterval * 24 * 60 * 60 * 1000,
                };
            }

            case 'good': {
                // Standard SM-2 calculation
                const newEaseFactor = SRSAlgorithm.calculateNewEaseFactor(state.easeFactor, quality);
                const newInterval = SRSAlgorithm.calculateNewInterval(state.interval, newEaseFactor);
                return {
                    interval: newInterval,
                    easeFactor: newEaseFactor,
                    repetitions: state.repetitions + 1,
                    status: 'review',
                    nextReview: now + newInterval * 24 * 60 * 60 * 1000,
                };
            }

            case 'easy': {
                // Easy review: bigger interval multiplier
                const newEaseFactor = Math.min(3.0, state.easeFactor + 0.15);
                const newInterval = Math.round(state.interval * newEaseFactor * 1.3);
                return {
                    interval: newInterval,
                    easeFactor: newEaseFactor,
                    repetitions: state.repetitions + 1,
                    status: 'graduated',
                    nextReview: now + newInterval * 24 * 60 * 60 * 1000,
                };
            }

            default:
                return {
                    ...state,
                    nextReview: now + state.interval * 24 * 60 * 60 * 1000,
                };
        }
    }

    /**
     * SM-2 ease factor calculation
     * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
     */
    private static calculateNewEaseFactor(currentEF: number, quality: number): number {
        const newEF = currentEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        return Math.max(MIN_EASE_FACTOR, Math.round(newEF * 100) / 100);
    }

    /**
     * SM-2 interval calculation - interval-based (not repetition-based)
     * interval=0 or 1 → 6 days (standard second-step jump)
     * interval>1     → interval × easeFactor (clamped to at least interval+1)
     */
    private static calculateNewInterval(
        currentInterval: number,
        easeFactor: number,
    ): number {
        if (currentInterval <= 1) return 6;
        return Math.max(currentInterval + 1, Math.round(currentInterval * easeFactor));
    }

    /**
     * Preview the next review time for all 4 ratings without applying changes.
     * Used to show e.g. "Again: <1m  Hard: 10m  Good: 1d  Easy: 4d" on buttons.
     */
    static previewAll(state: SRSState): Record<Rating, string> {
        return {
            again: SRSAlgorithm.getNextReviewText(SRSAlgorithm.calculate(state, 'again').nextReview),
            hard:  SRSAlgorithm.getNextReviewText(SRSAlgorithm.calculate(state, 'hard').nextReview),
            good:  SRSAlgorithm.getNextReviewText(SRSAlgorithm.calculate(state, 'good').nextReview),
            easy:  SRSAlgorithm.getNextReviewText(SRSAlgorithm.calculate(state, 'easy').nextReview),
        };
    }

    /**
     * Get default SRS state for a new card
     */
    static getDefaultState(): SRSState {
        return {
            interval: 0,
            easeFactor: DEFAULT_EASE_FACTOR,
            repetitions: 0,
            status: 'new',
        };
    }

    /**
     * Check if a card is due for review
     */
    static isDue(nextReview: number): boolean {
        return nextReview <= Date.now();
    }

    /**
     * Get a human-readable description of when the next review is
     */
    static getNextReviewText(nextReview: number): string {
        const now = Date.now();
        const diff = nextReview - now;

        if (diff <= 0) return 'Now';

        const minutes = Math.floor(diff / (60 * 1000));
        const hours = Math.floor(diff / (60 * 60 * 1000));
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));

        if (minutes < 1) return 'Less than a minute';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        if (days < 30) return `${days}d`;
        if (days < 365) return `${Math.floor(days / 30)}mo`;
        return `${Math.floor(days / 365)}y`;
    }
}
