/**
 * HybridLLMManager — Cloud LLM orchestrator.
 * Live capabilities: chat (AI tutor) and personalized vocabulary selection.
 */

import { CloudLLMClient, type CloudProvider } from './CloudLLMClient';
import { cefrToLevel, getLanguageName, getLevelLabel } from '../../lib/languageConfig';

export type { CloudProvider };

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface WordSelection {
    word: string;
    translation: string;
    cefrLevel: string;       // internal "1".."6"
    exampleSentence: string;
    partOfSpeech?: string;
}

export interface ProfileAnalysis {
    profession: string;
    interests: string[];
    level: string;
    goals: string[];
}

class HybridLLMManager {
    private static instance: HybridLLMManager;
    private cloudClient: CloudLLMClient;
    private isCloudReady = false;

    private constructor() {
        this.cloudClient = new CloudLLMClient();
    }

    static getInstance(): HybridLLMManager {
        if (!HybridLLMManager.instance) {
            HybridLLMManager.instance = new HybridLLMManager();
        }
        return HybridLLMManager.instance;
    }

    // ─── Initialization ───────────────────────────────────────

    /**
     * Configure cloud without validation — used for silent startup loading of saved keys.
     * For user-entered keys, prefer configureCloudAndValidate().
     */
    configureCloud(apiKey: string, provider: CloudProvider = 'openai', baseUrl?: string, model?: string): void {
        this.cloudClient.configure(apiKey, provider, baseUrl, model);
        this.isCloudReady = true;
    }

    /**
     * Configure cloud and validate the key with a real API call.
     * Sets isCloudReady only on success.
     */
    async configureCloudAndValidate(
        apiKey: string,
        provider: CloudProvider,
        baseUrl?: string,
        model?: string,
    ): Promise<{ success: boolean; error?: string }> {
        try {
            this.cloudClient.configure(apiKey, provider, baseUrl, model);
            await this.cloudClient.validateKey();
            this.isCloudReady = true;
            return { success: true };
        } catch (err: any) {
            this.isCloudReady = false;
            const msg: string = err?.message || 'Connection failed';
            return { success: false, error: msg.length > 200 ? msg.substring(0, 200) + '…' : msg };
        }
    }

    getStatus() {
        return {
            cloudReady: this.isCloudReady,
        };
    }

    // ─── Chat ─────────────────────────────────────────────────

    async chat(messages: ChatMessage[]): Promise<string> {
        if (!this.isCloudReady) {
            return 'AI model is not available. Please configure an API key in Settings.';
        }
        return this.cloudClient.chat(messages);
    }

    // ─── Cloud LLM (The Strategist) ────────────────────────────

    async selectNewWords(
        profile: ProfileAnalysis,
        existingWords: string[],
        count: number = 5,
        nativeLanguage: string = 'tr',
        targetLanguage: string = 'en',
    ): Promise<WordSelection[]> {
        if (!this.isCloudReady) {
            return [];
        }

        const nativeLangName = getLanguageName(nativeLanguage);
        const targetLangName = getLanguageName(targetLanguage);
        const level = cefrToLevel(profile.level || '3');
        const levelLabel = getLevelLabel(targetLanguage, level);

        const profession = profile.profession?.trim() || '—';
        const interests = profile.interests?.filter(Boolean).join(', ') || '—';
        const goals = profile.goals?.filter(Boolean).join(', ') || '—';
        const exclude = existingWords.slice(-100).join(', ') || '—';

        const systemPrompt = `You are a vocabulary curriculum expert and lexicographer for ${targetLangName}. You select words STRICTLY calibrated to CEFR (the standard for ${targetLangName}). Output ONLY a valid JSON array, nothing else.`;

        const prompt = `Select ${count} ${targetLangName} vocabulary words for a ${nativeLangName}-speaking learner, personalized to their profile.

PROFILE:
- Profession: ${profession}
- Interests: ${interests}
- Goals: ${goals}
- CEFR level: ${levelLabel} (internal ${level})

CALIBRATION: every word must genuinely belong to CEFR ${levelLabel} for ${targetLangName} (calibrate by official CEFR word lists and frequency). Strongly prefer words relevant to the profession/interests above, while staying level-appropriate, practical and commonly used.

RULES:
- ASYMMETRIC: "word" and "exampleSentence" are ALWAYS in ${targetLangName}; "translation" is ALWAYS in ${nativeLangName}. Never mix.
- Write "word" in ${targetLangName}'s native script/orthography.
- Exclude these already-known words: ${exclude}
- Unique words only; no duplicates, no proper nouns, nothing offensive.
- partOfSpeech (lowercase): noun, verb, adjective, adverb, pronoun, preposition, conjunction, interjection, phrase.

Return ONLY a JSON array (no markdown):
[{"word":"...","translation":"...","level":${level},"exampleSentence":"...","partOfSpeech":"noun"}]`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
        ];

        try {
            const response = await this.cloudClient.chat(messages, true);
            const raw = this.parseJSON<any[]>(response) || [];
            return raw
                .filter((w) => w && w.word && w.translation)
                .map((w) => ({
                    word: String(w.word).trim(),
                    translation: String(w.translation).trim(),
                    cefrLevel: String(w.level ?? level),
                    exampleSentence: String(w.exampleSentence || '').trim(),
                    partOfSpeech: w.partOfSpeech ? String(w.partOfSpeech).trim() : undefined,
                }));
        } catch {
            return [];
        }
    }

    // ─── Helpers ───────────────────────────────────────────────

    private parseJSON<T>(text: string): T | null {
        try {
            const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
                return JSON.parse(codeBlockMatch[1].trim());
            }
            const arrayMatch = text.match(/\[[\s\S]*\]/);
            if (arrayMatch) return JSON.parse(arrayMatch[0]);
            const objectMatch = text.match(/\{[\s\S]*\}/);
            if (objectMatch) return JSON.parse(objectMatch[0]);
            return JSON.parse(text);
        } catch {
            console.warn('Failed to parse JSON from LLM response:', text.substring(0, 200));
            return null;
        }
    }
}

export default HybridLLMManager;
