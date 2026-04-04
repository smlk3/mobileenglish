import { addColumns, createTable, schemaMigrations, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
    migrations: [
        {
            toVersion: 2,
            steps: [
                // Add target_language column to decks
                addColumns({
                    table: 'decks',
                    columns: [
                        { name: 'target_language', type: 'string' },
                    ],
                }),
                // Add target_language column to cards
                addColumns({
                    table: 'cards',
                    columns: [
                        { name: 'target_language', type: 'string' },
                    ],
                }),
            ],
        },
        {
            toVersion: 3,
            steps: [
                addColumns({
                    table: 'user_settings',
                    columns: [
                        { name: 'onboarding_completed', type: 'boolean' },
                    ],
                }),
            ],
        },
        {
            toVersion: 4,
            steps: [
                unsafeExecuteSql('CREATE INDEX IF NOT EXISTS idx_cards_next_review ON cards (next_review);'),
                unsafeExecuteSql('CREATE INDEX IF NOT EXISTS idx_study_sessions_completed_at ON study_sessions (completed_at);'),
            ],
        },
    ],
});
