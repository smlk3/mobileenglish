/**
 * Database Service Hook
 * Centralizes all WatermelonDB operations for the app.
 */

import { Q } from '@nozbe/watermelondb';
import type Card from '../../../entities/Card/model';
import type Deck from '../../../entities/Deck/model';
import { SRSAlgorithm, type Rating } from '../../../entities/SRS/SRSAlgorithm';
import type StudySession from '../../../entities/StudySession/model';
import type UserSettings from '../../../entities/UserProfile/model';
import {
    getCardsCollection,
    getChatMessagesCollection,
    getDatabase,
    getDecksCollection,
    getStudySessionsCollection,
    getUserSettingsCollection,
} from '../../../entities/database';

// ─── Deck Operations ─────────────────────────────────────

export async function fetchDecks(): Promise<Deck[]> {
    const collection = getDecksCollection();
    return collection.query().fetch();
}

export async function createDeck(params: {
    name: string;
    cefrLevel: string;
    category?: string;
    description?: string;
}): Promise<Deck> {
    const db = getDatabase();
    return db.write(async () => {
        const decksCol = getDecksCollection();
        return decksCol.create((deck) => {
            deck.name = params.name;
            deck.cefrLevel = params.cefrLevel;
            deck.category = params.category || null;
            deck.description = params.description || null;
            deck.cardCount = 0;
            deck.isActive = true;
        });
    });
}

export async function deleteDeck(deck: Deck): Promise<void> {
    const db = getDatabase();
    await db.write(async () => {
        // Delete all cards in the deck first
        const cards = await getCardsCollection()
            .query(Q.where('deck_id', deck.id))
            .fetch();
        const batched: any[] = cards.map((card) => card.prepareDestroyPermanently());
        batched.push(deck.prepareDestroyPermanently());
        await db.batch(...batched);
    });
}

// ─── Card Operations ──────────────────────────────────────

export async function addCardsToDecks(
    deckId: string,
    cards: {
        front: string;
        back: string;
        exampleSentence?: string;
        cefrLevel: string;
        category?: string;
    }[],
): Promise<void> {
    const db = getDatabase();
    await db.write(async () => {
        const cardsCol = getCardsCollection();
        const decksCol = getDecksCollection();
        const deck = await decksCol.find(deckId);

        const defaultSRS = SRSAlgorithm.getDefaultState();

        const batched: any[] = cards.map((cardData) =>
            cardsCol.prepareCreate((card) => {
                card.deckId = deckId;
                card.front = cardData.front;
                card.back = cardData.back;
                card.exampleSentence = cardData.exampleSentence || null;
                card.pronunciationUrl = null;
                card.cefrLevel = cardData.cefrLevel;
                card.category = cardData.category || null;
                card.nextReview = Date.now();
                card.interval = defaultSRS.interval;
                card.easeFactor = defaultSRS.easeFactor;
                card.repetitions = defaultSRS.repetitions;
                card.status = defaultSRS.status;
            }),
        );

        // Update deck card count
        batched.push(
            deck.prepareUpdate((d) => {
                d.cardCount = d.cardCount + cards.length;
            }),
        );

        await db.batch(...batched);
    });
}

export async function fetchDueCards(deckId?: string): Promise<Card[]> {
    const cardsCol = getCardsCollection();
    const now = Date.now();

    const conditions = [Q.where('next_review', Q.lte(now))];
    if (deckId) {
        conditions.push(Q.where('deck_id', deckId));
    }

    return cardsCol.query(...conditions).fetch();
}

export async function fetchCardsByDeck(deckId: string): Promise<Card[]> {
    const cardsCol = getCardsCollection();
    return cardsCol.query(Q.where('deck_id', deckId)).fetch();
}

export async function updateCardSRS(card: Card, rating: Rating): Promise<void> {
    const result = SRSAlgorithm.calculate(card.srsState, rating);
    await card.updateSRS(result);
}

// ─── Study Session ────────────────────────────────────────

export async function recordStudySession(params: {
    deckId: string;
    cardsStudied: number;
    cardsCorrect: number;
    durationSeconds: number;
    sessionType: 'flashcard' | 'quiz' | 'speaking';
}): Promise<StudySession> {
    const db = getDatabase();
    return db.write(async () => {
        const col = getStudySessionsCollection();
        return col.create((session) => {
            session.deckId = params.deckId;
            session.cardsStudied = params.cardsStudied;
            session.cardsCorrect = params.cardsCorrect;
            session.durationSeconds = params.durationSeconds;
            session.sessionType = params.sessionType;
            session.completedAt = Date.now();
        });
    });
}

// ─── Home Stats ───────────────────────────────────────────

export interface HomeStats {
    wordsLearned: number;
    dueCards: number;
    streak: number;
    todayStudied: number;
    dailyGoal: number;
}

export async function getHomeStats(): Promise<HomeStats> {
    try {
        // Total words learned (cards that are not 'new' status)
        const allCards = await getCardsCollection().query().fetch();
        const wordsLearned = allCards.filter((c) => c.status !== 'new').length;

        // Due cards
        const now = Date.now();
        const dueCards = allCards.filter((c) => c.nextReview <= now).length;

        // Today's sessions
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const sessions = await getStudySessionsCollection()
            .query(Q.where('completed_at', Q.gte(todayStart.getTime())))
            .fetch();
        const todayStudied = sessions.reduce((sum, s) => sum + s.cardsStudied, 0);

        // Streak calculation (consecutive days with at least 1 session)
        const allSessions = await getStudySessionsCollection()
            .query(Q.sortBy('completed_at', Q.desc))
            .fetch();
        const streak = calculateStreak(allSessions);

        // Daily goal from settings
        let dailyGoal = 10;
        const settings = await getUserSettingsCollection().query().fetch();
        if (settings.length > 0) {
            dailyGoal = settings[0].dailyGoal || 10;
        }

        return { wordsLearned, dueCards, streak, todayStudied, dailyGoal };
    } catch {
        return { wordsLearned: 0, dueCards: 0, streak: 0, todayStudied: 0, dailyGoal: 10 };
    }
}

function calculateStreak(sessions: StudySession[]): number {
    if (sessions.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let checkDate = new Date(today);

    // Check if there's a session today
    const hasToday = sessions.some((s) => {
        const d = new Date(s.completedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
    });

    if (!hasToday) {
        // If no session today, start checking from yesterday
        checkDate.setDate(checkDate.getDate() - 1);
    }

    for (let i = 0; i < 365; i++) {
        const dayStart = new Date(checkDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(checkDate);
        dayEnd.setHours(23, 59, 59, 999);

        const hasSession = sessions.some((s) => {
            return s.completedAt >= dayStart.getTime() && s.completedAt <= dayEnd.getTime();
        });

        if (hasSession) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}

// ─── Chat Messages ────────────────────────────────────────

export async function saveChatMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    sessionId: string,
): Promise<void> {
    const db = getDatabase();
    await db.write(async () => {
        const col = getChatMessagesCollection();
        await col.create((msg) => {
            msg.role = role;
            msg.content = content;
            msg.sessionId = sessionId;
        });
    });
}

export async function fetchChatMessages(sessionId: string) {
    const col = getChatMessagesCollection();
    return col
        .query(Q.where('session_id', sessionId), Q.sortBy('created_at', Q.asc))
        .fetch();
}

export async function clearChatMessages(sessionId: string): Promise<void> {
    const db = getDatabase();
    await db.write(async () => {
        const col = getChatMessagesCollection();
        const messages = await col.query(Q.where('session_id', sessionId)).fetch();
        const batched = messages.map((m) => m.prepareDestroyPermanently());
        await db.batch(...batched);
    });
}

// ─── User Settings ────────────────────────────────────────

export async function getUserSettings(): Promise<UserSettings | null> {
    try {
        const col = getUserSettingsCollection();
        const settings = await col.query().fetch();
        return settings.length > 0 ? settings[0] : null;
    } catch {
        return null;
    }
}
