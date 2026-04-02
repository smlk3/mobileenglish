import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
    version: 2,
    tables: [
        tableSchema({
            name: 'decks',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'cefr_level', type: 'string' }, // Internal level: '1'-'6'
                { name: 'category', type: 'string', isOptional: true },
                { name: 'card_count', type: 'number' },
                { name: 'is_active', type: 'boolean' },
                { name: 'target_language', type: 'string' }, // e.g. 'en', 'de', 'ja'
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'cards',
            columns: [
                { name: 'deck_id', type: 'string', isIndexed: true },
                { name: 'front', type: 'string' },
                { name: 'back', type: 'string' },
                { name: 'example_sentence', type: 'string', isOptional: true },
                { name: 'pronunciation_url', type: 'string', isOptional: true },
                { name: 'cefr_level', type: 'string' }, // Internal level: '1'-'6'
                { name: 'category', type: 'string', isOptional: true },
                { name: 'target_language', type: 'string' }, // e.g. 'en', 'de', 'ja'
                // SRS Fields (SM-2 Algorithm)
                { name: 'next_review', type: 'number' }, // timestamp
                { name: 'interval', type: 'number' },     // days
                { name: 'ease_factor', type: 'number' },   // default 2.5
                { name: 'repetitions', type: 'number' },   // review count
                { name: 'status', type: 'string' },         // new, learning, review, graduated
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'user_settings',
            columns: [
                { name: 'profile_tags', type: 'string' },  // JSON string: { profession, interests[], level }
                { name: 'api_keys', type: 'string' },       // JSON string: { openai, gemini }
                { name: 'theme', type: 'string' },           // light | dark
                { name: 'target_language', type: 'string' }, // en, tr, etc.
                { name: 'native_language', type: 'string' },
                { name: 'daily_goal', type: 'number' },      // words per day
                { name: 'notifications_enabled', type: 'boolean' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'chat_messages',
            columns: [
                { name: 'role', type: 'string' },           // user | assistant | system
                { name: 'content', type: 'string' },
                { name: 'session_id', type: 'string', isIndexed: true },
                { name: 'metadata', type: 'string', isOptional: true }, // JSON string
                { name: 'created_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'study_sessions',
            columns: [
                { name: 'deck_id', type: 'string', isIndexed: true },
                { name: 'cards_studied', type: 'number' },
                { name: 'cards_correct', type: 'number' },
                { name: 'duration_seconds', type: 'number' },
                { name: 'session_type', type: 'string' }, // flashcard, quiz, speaking
                { name: 'completed_at', type: 'number' },
                { name: 'created_at', type: 'number' },
            ],
        }),
    ],
});
