import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { migrations } from './migrations';
import { schema } from './schema';

// Models
import Card from '../Card/model';
import ChatMessage from '../ChatMessage/model';
import Deck from '../Deck/model';
import StudySession from '../StudySession/model';
import UserSettings from '../UserProfile/model';

// Export for convenience
export { Card, ChatMessage, Deck, StudySession, UserSettings };

// Lazy singleton — created on first access, not at module load
let _database: Database | null = null;

function createDatabase(): Database {
    const adapter = new SQLiteAdapter({
        schema,
        migrations,
        jsi: false,
        onSetUpError: (error) => {
            console.error('Database setup error:', error);
        },
    });

    return new Database({
        adapter,
        modelClasses: [Deck, Card, UserSettings, ChatMessage, StudySession],
    });
}

/** Get the database instance (lazy init) */
export function getDatabase(): Database {
    if (!_database) {
        _database = createDatabase();
    }
    return _database;
}

// Helper functions
export const getDecksCollection = () => getDatabase().get<Deck>('decks');
export const getCardsCollection = () => getDatabase().get<Card>('cards');
export const getUserSettingsCollection = () => getDatabase().get<UserSettings>('user_settings');
export const getChatMessagesCollection = () => getDatabase().get<ChatMessage>('chat_messages');
export const getStudySessionsCollection = () => getDatabase().get<StudySession>('study_sessions');

/**
 * Initialize default user settings if none exist.
 */
export async function initializeDefaultSettings(): Promise<UserSettings | null> {
    try {
        const db = getDatabase();
        const settingsCollection = getUserSettingsCollection();
        const existing = await settingsCollection.query().fetch();

        if (existing.length > 0) {
            return existing[0];
        }

        return await db.write(async () => {
            return await settingsCollection.create((settings) => {
                settings.profileTagsRaw = JSON.stringify({
                    profession: '',
                    interests: [],
                    level: 'A1',
                    nativeLanguage: 'tr',
                    goals: [],
                });
                settings.apiKeysRaw = JSON.stringify({});
                settings.theme = 'dark';
                settings.targetLanguage = 'en';
                settings.nativeLanguage = 'tr';
                settings.dailyGoal = 10;
                settings.notificationsEnabled = true;
                settings.onboardingCompleted = false;
            });
        });
    } catch (error) {
        console.warn('Database not available (Expo Go mode):', error);
        return null;
    }
}
