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
import { getVectorStore } from '../../api/rag/VectorStore';

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
    targetLanguage?: string;
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
            deck.targetLanguage = params.targetLanguage || 'en';
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

export async function fetchAllCardFronts(): Promise<string[]> {
    const cards = await getCardsCollection().query().fetch();
    return cards.map((c) => c.front);
}

export async function createStarterDeck(params: {
    targetLanguage: string;
    nativeLanguage: string;
    level: number;
    interests: string[];
    profession: string;
    deckName: string;
}): Promise<void> {
    const vectorStore = getVectorStore(params.targetLanguage, params.nativeLanguage);
    if (vectorStore.isEmpty) return;

    const allInterests = [
        ...params.interests,
        ...(params.profession ? [params.profession] : []),
    ];

    // Tüm seviye kelimelerini getir
    const allWords = vectorStore.search({
        level: params.level,
        interests: allInterests,
        limit: vectorStore.getAll().length,
    });
    if (allWords.length === 0) return;

    // Fisher-Yates karıştır — genel ve ilgi alanı kelimeleri her günden itibaren karışık gelsin
    for (let i = allWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allWords[i], allWords[j]] = [allWords[j], allWords[i]];
    }

    const deck = await createDeck({
        name: params.deckName,
        cefrLevel: String(params.level),
        category: 'General',
        targetLanguage: params.targetLanguage,
    });

    await addCardsToDecks(
        deck.id,
        allWords.map((w) => ({
            front: w.word,
            back: w.translation,
            exampleSentence: w.exampleSentence,
            cefrLevel: String(w.level),
            category: w.category,
            targetLanguage: params.targetLanguage,
        })),
    );
}

export async function addCardsToDecks(
    deckId: string,
    cards: {
        front: string;
        back: string;
        exampleSentence?: string;
        cefrLevel: string;
        category?: string;
        targetLanguage?: string;
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
                card.targetLanguage = cardData.targetLanguage || deck.targetLanguage || 'en';
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

export async function fetchDueCards(deckId?: string, limit?: number): Promise<Card[]> {
    const cardsCol = getCardsCollection();
    const now = Date.now();

    if (deckId && limit !== undefined) {
        return cardsCol.query(Q.where('next_review', Q.lte(now)), Q.where('deck_id', deckId), Q.take(limit)).fetch();
    }
    if (deckId) {
        return cardsCol.query(Q.where('next_review', Q.lte(now)), Q.where('deck_id', deckId)).fetch();
    }
    if (limit !== undefined) {
        return cardsCol.query(Q.where('next_review', Q.lte(now)), Q.take(limit)).fetch();
    }
    return cardsCol.query(Q.where('next_review', Q.lte(now))).fetch();
}

export async function fetchCardsByDeck(deckId: string, limit?: number): Promise<Card[]> {
    const cardsCol = getCardsCollection();
    if (limit !== undefined) {
        return cardsCol.query(Q.where('deck_id', deckId), Q.take(limit)).fetch();
    }
    return cardsCol.query(Q.where('deck_id', deckId)).fetch();
}

export async function fetchDeckById(deckId: string): Promise<Deck | null> {
    try {
        return await getDecksCollection().find(deckId);
    } catch {
        return null;
    }
}

export async function updateCard(
    card: Card,
    updates: { front?: string; back?: string; exampleSentence?: string },
): Promise<void> {
    await card.updateContent(updates);
}

export async function deleteCard(card: Card): Promise<void> {
    const db = getDatabase();
    await db.write(async () => {
        const deck = await getDecksCollection().find(card.deckId);
        await db.batch(
            card.prepareDestroyPermanently(),
            deck.prepareUpdate((d) => {
                d.cardCount = Math.max(0, d.cardCount - 1);
            }),
        );
    });
}

export async function addCardToDeck(
    deckId: string,
    cardData: { front: string; back: string; exampleSentence?: string; cefrLevel: string; category?: string },
): Promise<void> {
    await addCardsToDecks(deckId, [cardData]);
}

export async function updateDeckMetadata(
    deck: Deck,
    updates: { name?: string; cefrLevel?: string; category?: string },
): Promise<void> {
    await deck.updateDeck(updates);
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
        const now = Date.now();

        // Total words learned & due cards — counted in DB, no full table load
        const [wordsLearned, dueCards] = await Promise.all([
            getCardsCollection().query(Q.where('status', Q.notEq('new'))).fetchCount(),
            getCardsCollection().query(Q.where('next_review', Q.lte(now))).fetchCount(),
        ]);

        // Today's sessions
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const sessions = await getStudySessionsCollection()
            .query(Q.where('completed_at', Q.gte(todayStart.getTime())))
            .fetch();
        const todayStudied = sessions.reduce((sum, s) => sum + s.cardsStudied, 0);

        // Streak calculation — limit to last 366 days to avoid loading entire history
        const streakWindowStart = new Date();
        streakWindowStart.setDate(streakWindowStart.getDate() - 366);
        const allSessions = await getStudySessionsCollection()
            .query(
                Q.where('completed_at', Q.gte(streakWindowStart.getTime())),
                Q.sortBy('completed_at', Q.desc),
            )
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

// ─── Detailed Statistics ──────────────────────────────────

export interface DayStats {
    label: string; // 'Mon', 'Tue', ...
    date: string;  // 'YYYY-MM-DD'
    count: number;
}

export interface DeckAccuracy {
    deckId: string;
    deckName: string;
    cardsStudied: number;
    cardsCorrect: number;
    accuracy: number;
    cardCount: number;
}

export interface SessionTypeBreakdown {
    flashcard: number;
    quiz: number;
}

export interface DetailedStats {
    totalWordsLearned: number;
    totalStudySeconds: number;
    longestStreak: number;
    currentStreak: number;
    last7Days: DayStats[];
    deckAccuracies: DeckAccuracy[];
    sessionBreakdown: SessionTypeBreakdown;
    totalSessions: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function getDetailedStats(): Promise<DetailedStats> {
    try {
        // Words learned counted in DB — no full card table load
        const totalWordsLearned = await getCardsCollection()
            .query(Q.where('status', Q.notEq('new')))
            .fetchCount();

        // Sessions limited to last 366 days for streaks/history
        const streakWindowStart = new Date();
        streakWindowStart.setDate(streakWindowStart.getDate() - 366);
        const allSessions = await getStudySessionsCollection()
            .query(
                Q.where('completed_at', Q.gte(streakWindowStart.getTime())),
                Q.sortBy('completed_at', Q.desc),
            )
            .fetch();

        const totalStudySeconds = allSessions.reduce((sum, s) => sum + s.durationSeconds, 0);
        const totalSessions = allSessions.length;

        // Streak calculations
        const currentStreak = calculateStreak(allSessions);
        let longestStreak = 0;
        if (allSessions.length > 0) {
            // Find longest streak by walking through all unique days
            // Use local date components — DST-safe (no millisecond arithmetic)
            const uniqueDays = Array.from(
                new Set(
                    allSessions.map((s) => {
                        const d = new Date(s.completedAt);
                        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                    }),
                ),
            ).sort();

            let run = 1;
            for (let i = 1; i < uniqueDays.length; i++) {
                const [py, pm, pd] = uniqueDays[i - 1].split('-').map(Number);
                const [cy, cm, cd] = uniqueDays[i].split('-').map(Number);
                const prev = new Date(py, pm, pd);
                prev.setDate(prev.getDate() + 1);
                if (prev.getFullYear() === cy && prev.getMonth() === cm && prev.getDate() === cd) {
                    run++;
                    longestStreak = Math.max(longestStreak, run);
                } else {
                    run = 1;
                }
            }
            longestStreak = Math.max(longestStreak, 1);
        }

        // Last 7 days
        const last7Days: DayStats[] = [];
        for (let i = 6; i >= 0; i--) {
            const day = new Date();
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() - i);
            const dayEnd = new Date(day);
            dayEnd.setHours(23, 59, 59, 999);

            const count = allSessions
                .filter((s) => s.completedAt >= day.getTime() && s.completedAt <= dayEnd.getTime())
                .reduce((sum, s) => sum + s.cardsStudied, 0);

            const dateStr = day.toISOString().split('T')[0];
            last7Days.push({
                label: DAY_LABELS[day.getDay()],
                date: dateStr,
                count,
            });
        }

        // Deck accuracies
        const decks = await getDecksCollection().query().fetch();
        const deckAccuracies: DeckAccuracy[] = [];
        for (const deck of decks) {
            const deckSessions = allSessions.filter((s) => s.deckId === deck.id);
            const total = deckSessions.reduce((sum, s) => sum + s.cardsStudied, 0);
            const correct = deckSessions.reduce((sum, s) => sum + s.cardsCorrect, 0);
            if (total > 0) {
                deckAccuracies.push({
                    deckId: deck.id,
                    deckName: deck.name,
                    cardsStudied: total,
                    cardsCorrect: correct,
                    accuracy: Math.round((correct / total) * 100),
                    cardCount: deck.cardCount,
                });
            }
        }
        deckAccuracies.sort((a, b) => b.accuracy - a.accuracy);

        // Session type breakdown
        const breakdown: SessionTypeBreakdown = { flashcard: 0, quiz: 0 };
        for (const s of allSessions) {
            if (s.sessionType === 'flashcard') breakdown.flashcard += s.cardsStudied;
            else breakdown.quiz += s.cardsStudied;
        }

        return {
            totalWordsLearned,
            totalStudySeconds,
            longestStreak,
            currentStreak,
            last7Days,
            deckAccuracies,
            sessionBreakdown: breakdown,
            totalSessions,
        };
    } catch {
        return {
            totalWordsLearned: 0,
            totalStudySeconds: 0,
            longestStreak: 0,
            currentStreak: 0,
            last7Days: [],
            deckAccuracies: [],
            sessionBreakdown: { flashcard: 0, quiz: 0 },
            totalSessions: 0,
        };
    }
}

