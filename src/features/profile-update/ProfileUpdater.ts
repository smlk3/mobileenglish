/**
 * Profile Updater Service
 * Compares incoming profile information with existing data
 * to prevent duplicates and "log-junking"
 *
 * Uses "Smart Filtering" to only update profile with
 * specific, actionable information.
 */

import type { ProfileTags } from '../../entities/UserProfile/model';
import HybridLLMManager from '../../shared/api/llm/HybridLLMManager';

interface ProfileUpdateResult {
    updated: boolean;
    changes: Partial<ProfileTags>;
    reason: string;
}

export class ProfileUpdater {
    private llmManager: HybridLLMManager;

    constructor() {
        this.llmManager = HybridLLMManager.getInstance();
    }

    /**
     * Analyze chat messages and extract profile updates
     * Uses Smart Filtering to ignore generic info
     */
    async analyzeAndUpdate(
        chatMessages: string[],
        currentProfile: ProfileTags,
    ): Promise<ProfileUpdateResult> {
        if (chatMessages.length === 0) {
            return { updated: false, changes: {}, reason: 'No messages to analyze' };
        }

        // Use Cloud LLM to analyze messages
        const analysis = await this.llmManager.analyzeProfile(chatMessages);

        if (Object.keys(analysis).length === 0) {
            return {
                updated: false,
                changes: {},
                reason: 'No specific profile information found',
            };
        }

        // Smart merge: compare with existing profile to avoid duplicates
        const changes = this.calculateChanges(currentProfile, analysis);

        if (Object.keys(changes).length === 0) {
            return {
                updated: false,
                changes: {},
                reason: 'No new information to add',
            };
        }

        return {
            updated: true,
            changes,
            reason: `Updated: ${Object.keys(changes).join(', ')}`,
        };
    }

    /**
     * Calculate the diff between current profile and new analysis
     * Only returns fields that actually changed
     */
    private calculateChanges(
        current: ProfileTags,
        incoming: Partial<ProfileTags>,
    ): Partial<ProfileTags> {
        const changes: Partial<ProfileTags> = {};

        // Profession update (only if new and different)
        if (
            incoming.profession &&
            incoming.profession.length > 0 &&
            incoming.profession.toLowerCase() !== current.profession.toLowerCase()
        ) {
            changes.profession = incoming.profession;
        }

        // Interests: only add truly new ones
        if (incoming.interests && incoming.interests.length > 0) {
            const currentInterests = new Set(
                current.interests.map((i) => i.toLowerCase()),
            );
            const newInterests = incoming.interests.filter(
                (i) => !currentInterests.has(i.toLowerCase()) && this.isSpecific(i),
            );

            if (newInterests.length > 0) {
                changes.interests = [...current.interests, ...newInterests];
            }
        }

        // Level update
        if (
            incoming.level &&
            incoming.level.length > 0 &&
            incoming.level !== current.level
        ) {
            changes.level = incoming.level;
        }

        // Goals: only add new specific goals
        if (incoming.goals && incoming.goals.length > 0) {
            const currentGoals = new Set(
                current.goals.map((g) => g.toLowerCase()),
            );
            const newGoals = incoming.goals.filter(
                (g) => !currentGoals.has(g.toLowerCase()) && this.isSpecific(g),
            );

            if (newGoals.length > 0) {
                changes.goals = [...current.goals, ...newGoals];
            }
        }

        return changes;
    }

    /**
     * Check if a tag is specific enough to be useful
     * Rejects overly generic terms
     */
    private isSpecific(tag: string): boolean {
        const genericTerms = [
            'thing',
            'stuff',
            'general',
            'normal',
            'regular',
            'basic',
            'good',
            'nice',
            'like',
            'love',
            'fun',
            'cool',
        ];

        const lower = tag.toLowerCase().trim();

        // Too short
        if (lower.length < 3) return false;

        // Is a generic term
        if (genericTerms.includes(lower)) return false;

        return true;
    }
}
