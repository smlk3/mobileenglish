import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, writer } from '@nozbe/watermelondb/decorators';
import type { ApiKeys } from '../../shared/lib/apiKeyStore';

export type { ApiKeys, CustomEndpoint } from '../../shared/lib/apiKeyStore';

export interface ProfileTags {
    profession: string;
    interests: string[];
    level: string; // A1-C2
    nativeLanguage: string;
    goals: string[];
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
    @field('onboarding_completed') onboardingCompleted!: boolean;
    @field('supabase_user_id') supabaseUserId!: string | null;
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

    /**
     * @deprecated API keys now live in secure storage (src/shared/lib/apiKeyStore).
     * This getter only reads the legacy DB column for the one-time migration.
     */
    get legacyApiKeys(): ApiKeys {
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

    /** Wipes the legacy plain-DB key column after migration to secure storage. */
    @writer async clearLegacyApiKeys() {
        await this.update((settings) => {
            settings.apiKeysRaw = JSON.stringify({});
        });
    }

    @writer async updateSettings(updates: {
        theme?: string;
        targetLanguage?: string;
        nativeLanguage?: string;
        dailyGoal?: number;
        notificationsEnabled?: boolean;
        onboardingCompleted?: boolean;
        supabaseUserId?: string | null;
    }) {
        await this.update((settings) => {
            if (updates.theme !== undefined) settings.theme = updates.theme;
            if (updates.targetLanguage !== undefined) settings.targetLanguage = updates.targetLanguage;
            if (updates.nativeLanguage !== undefined) settings.nativeLanguage = updates.nativeLanguage;
            if (updates.dailyGoal !== undefined) settings.dailyGoal = updates.dailyGoal;
            if (updates.notificationsEnabled !== undefined) settings.notificationsEnabled = updates.notificationsEnabled;
            if (updates.onboardingCompleted !== undefined) settings.onboardingCompleted = updates.onboardingCompleted;
            if (updates.supabaseUserId !== undefined) settings.supabaseUserId = updates.supabaseUserId;
        });
    }
}
