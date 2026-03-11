import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, writer } from '@nozbe/watermelondb/decorators';

export interface ProfileTags {
    profession: string;
    interests: string[];
    level: string; // A1-C2
    nativeLanguage: string;
    goals: string[];
}

export interface ApiKeys {
    openai?: string;
    gemini?: string;
}

export default class UserSettings extends Model {
    static table = 'user_settings';

    @field('profile_tags') profileTagsRaw!: string;
    @field('api_keys') apiKeysRaw!: string;
    @field('theme') theme!: string;
    @field('target_language') targetLanguage!: string;
    @field('native_language') nativeLanguage!: string;
    @field('daily_goal') dailyGoal!: number;
    @field('notifications_enabled') notificationsEnabled!: boolean;
    @readonly @date('created_at') createdAt!: Date;
    @readonly @date('updated_at') updatedAt!: Date;

    /** Parsed profile tags */
    get profileTags(): ProfileTags {
        try {
            return JSON.parse(this.profileTagsRaw);
        } catch {
            return {
                profession: '',
                interests: [],
                level: 'A1',
                nativeLanguage: 'tr',
                goals: [],
            };
        }
    }

    /** Parsed API keys */
    get apiKeys(): ApiKeys {
        try {
            return JSON.parse(this.apiKeysRaw);
        } catch {
            return {};
        }
    }

    @writer async updateProfileTags(tags: Partial<ProfileTags>) {
        const currentTags = this.profileTags;
        const mergedTags = { ...currentTags, ...tags };

        // Deduplicate array fields
        if (tags.interests) {
            mergedTags.interests = [...new Set([...currentTags.interests, ...tags.interests])];
        }
        if (tags.goals) {
            mergedTags.goals = [...new Set([...currentTags.goals, ...tags.goals])];
        }

        await this.update((settings) => {
            settings.profileTagsRaw = JSON.stringify(mergedTags);
        });
    }

    @writer async updateApiKeys(keys: Partial<ApiKeys>) {
        const currentKeys = this.apiKeys;
        await this.update((settings) => {
            settings.apiKeysRaw = JSON.stringify({ ...currentKeys, ...keys });
        });
    }

    @writer async updateSettings(updates: {
        theme?: string;
        targetLanguage?: string;
        nativeLanguage?: string;
        dailyGoal?: number;
        notificationsEnabled?: boolean;
    }) {
        await this.update((settings) => {
            if (updates.theme !== undefined) settings.theme = updates.theme;
            if (updates.targetLanguage !== undefined) settings.targetLanguage = updates.targetLanguage;
            if (updates.nativeLanguage !== undefined) settings.nativeLanguage = updates.nativeLanguage;
            if (updates.dailyGoal !== undefined) settings.dailyGoal = updates.dailyGoal;
            if (updates.notificationsEnabled !== undefined) settings.notificationsEnabled = updates.notificationsEnabled;
        });
    }
}
