import { create } from 'zustand';
import type { CardStatus } from '../../../entities/SRS/SRSAlgorithm';

export interface StudyCard {
    id: string;
    front: string;
    back: string;
    exampleSentence?: string;
    cefrLevel: string;
    status: CardStatus;
}

export type StudyPhase = 'idle' | 'flashcard' | 'quiz' | 'speaking' | 'results';

interface StudyState {
    // Session state
    isActive: boolean;
    currentDeckId: string | null;
    currentPhase: StudyPhase;

    // Cards
    cards: StudyCard[];
    currentCardIndex: number;

    // Quiz state
    quizQuestion: string | null;
    quizOptions: string[];
    selectedAnswer: string | null;
    isCorrect: boolean | null;

    // Stats
    totalCards: number;
    cardsReviewed: number;
    correctCount: number;
    startTime: number | null;

    // Actions
    startSession: (deckId: string, cards: StudyCard[]) => void;
    setPhase: (phase: StudyPhase) => void;
    nextCard: () => void;
    setQuiz: (question: string, options: string[]) => void;
    answerQuiz: (answer: string, correct: boolean) => void;
    recordFlashcardResult: (correct: boolean) => void;
    endSession: () => void;
    reset: () => void;
}

export const useStudyStore = create<StudyState>((set, get) => ({
    isActive: false,
    currentDeckId: null,
    currentPhase: 'idle',
    cards: [],
    currentCardIndex: 0,
    quizQuestion: null,
    quizOptions: [],
    selectedAnswer: null,
    isCorrect: null,
    totalCards: 0,
    cardsReviewed: 0,
    correctCount: 0,
    startTime: null,

    startSession: (deckId, cards) =>
        set({
            isActive: true,
            currentDeckId: deckId,
            currentPhase: 'flashcard',
            cards,
            currentCardIndex: 0,
            totalCards: cards.length,
            cardsReviewed: 0,
            correctCount: 0,
            startTime: Date.now(),
            quizQuestion: null,
            quizOptions: [],
            selectedAnswer: null,
            isCorrect: null,
        }),

    setPhase: (phase) => set({ currentPhase: phase }),

    nextCard: () => {
        const { currentCardIndex, cards } = get();
        if (currentCardIndex < cards.length - 1) {
            set({
                currentCardIndex: currentCardIndex + 1,
                currentPhase: 'flashcard',
                quizQuestion: null,
                quizOptions: [],
                selectedAnswer: null,
                isCorrect: null,
            });
        } else {
            set({ currentPhase: 'results' });
        }
    },

    setQuiz: (question, options) =>
        set({
            quizQuestion: question,
            quizOptions: options,
            selectedAnswer: null,
            isCorrect: null,
            currentPhase: 'quiz',
        }),

    answerQuiz: (answer, correct) =>
        set((state) => ({
            selectedAnswer: answer,
            isCorrect: correct,
            cardsReviewed: state.cardsReviewed + 1,
            correctCount: correct ? state.correctCount + 1 : state.correctCount,
        })),

    recordFlashcardResult: (correct) =>
        set((state) => ({
            cardsReviewed: state.cardsReviewed + 1,
            correctCount: correct ? state.correctCount + 1 : state.correctCount,
        })),

    endSession: () =>
        set({
            isActive: false,
            currentPhase: 'results',
        }),

    reset: () =>
        set({
            isActive: false,
            currentDeckId: null,
            currentPhase: 'idle',
            cards: [],
            currentCardIndex: 0,
            quizQuestion: null,
            quizOptions: [],
            selectedAnswer: null,
            isCorrect: null,
            totalCards: 0,
            cardsReviewed: 0,
            correctCount: 0,
            startTime: null,
        }),
}));
