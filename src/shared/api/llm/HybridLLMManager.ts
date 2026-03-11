/**
 * HybridLLMManager - Singleton orchestrator for On-Device SLM and Cloud LLM
 *
 * Cloud LLM (Strategist): Deep analysis, curriculum planning, RAG word selection
 * On-Device SLM (Tutor): Offline chat, quiz generation, grammar checking
 */

import { CloudLLMClient } from './CloudLLMClient';
import { LocalSLMClient } from './LocalSLMClient';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface WordSelection {
    word: string;
    translation: string;
    cefrLevel: string;
    category: string;
    exampleSentence: string;
    pronunciation?: string;
}

export interface QuizContent {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
}

export interface GrammarResult {
    isCorrect: boolean;
    correctedSentence: string;
    explanation: string;
    score: number; // 0-100
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
    private localClient: LocalSLMClient;
    private isLocalReady = false;
    private isCloudReady = false;

    private constructor() {
        this.cloudClient = new CloudLLMClient();
        this.localClient = new LocalSLMClient();
    }

    /** Get or create the singleton instance */
    static getInstance(): HybridLLMManager {
        if (!HybridLLMManager.instance) {
            HybridLLMManager.instance = new HybridLLMManager();
        }
        return HybridLLMManager.instance;
    }

    // ─── Initialization ───────────────────────────────────────

    /** Initialize the local SLM model (llama.rn) */
    async initLocalModel(modelPath?: string): Promise<boolean> {
        try {
            await this.localClient.initialize(modelPath);
            this.isLocalReady = this.localClient.isReady && !this.localClient.isMockMode;
            // Even if it falls back to mock mode, it handles offline chat
            return true;
        } catch (error) {
            console.error('Failed to initialize local model:', error);
            this.isLocalReady = false;
            return false;
        }
    }

    /** Configure the Cloud LLM API */
    configureCloud(apiKey: string, provider: 'openai' | 'gemini' = 'openai'): void {
        this.cloudClient.configure(apiKey, provider);
        this.isCloudReady = true;
    }

    /** Check which models are available */
    getStatus() {
        return {
            localReady: this.isLocalReady,
            cloudReady: this.isCloudReady,
            preferredModel: this.isLocalReady ? 'local' : this.isCloudReady ? 'cloud' : 'none',
        };
    }

    // ─── On-Device SLM (The Tutor) ────────────────────────────

    /**
     * Chat with the local SLM - works offline
     * Maintains conversation context locally for privacy
     */
    async chatLocal(messages: ChatMessage[], onToken?: (token: string) => void, forceCloud: boolean = false): Promise<string> {
        if (forceCloud && this.isCloudReady) {
            return this.cloudClient.chat(messages);
        }
        if (!this.isLocalReady) {
            // Fallback to cloud if local is not ready
            if (this.isCloudReady) {
                return this.cloudClient.chat(messages);
            }
            return 'AI model is not available. Please configure an API key or download a local model.';
        }
        return this.localClient.chat(messages, onToken);
    }

    /**
     * Generate quiz content from a word list
     * Uses local SLM for instant, offline generation
     */
    async generateQuizContent(words: WordSelection[]): Promise<QuizContent[]> {
        const prompt = `Generate fill-in-the-blank quiz questions for these English words. 
For each word, create a sentence with a blank where the word should go, and provide 4 options.

Words: ${words.map((w) => `${w.word} (${w.translation})`).join(', ')}

Return JSON array: [{ "question": "sentence with ___", "options": ["a","b","c","d"], "correctAnswer": "word", "explanation": "brief explanation" }]`;

        const messages: ChatMessage[] = [
            { role: 'system', content: 'You are a language learning assistant. Generate quiz questions in valid JSON format.' },
            { role: 'user', content: prompt },
        ];

        try {
            const response = this.isLocalReady
                ? await this.localClient.chat(messages)
                : await this.cloudClient.chat(messages);

            return this.parseJSON<QuizContent[]>(response) || this.generateFallbackQuiz(words);
        } catch {
            return this.generateFallbackQuiz(words);
        }
    }

    /**
     * Check grammar of a user's sentence
     * Uses local SLM for immediate, non-judgmental corrections
     */
    async checkGrammar(sentence: string, targetWord?: string): Promise<GrammarResult> {
        const prompt = `Check this English sentence for grammar: "${sentence}"
${targetWord ? `The sentence should use the word "${targetWord}".` : ''}

Return JSON: { "isCorrect": bool, "correctedSentence": "...", "explanation": "brief, encouraging feedback", "score": 0-100 }`;

        const messages: ChatMessage[] = [
            { role: 'system', content: 'You are a friendly English tutor. Be encouraging and helpful. Return valid JSON.' },
            { role: 'user', content: prompt },
        ];

        try {
            const response = this.isLocalReady
                ? await this.localClient.chat(messages)
                : await this.cloudClient.chat(messages);

            return this.parseJSON<GrammarResult>(response) || {
                isCorrect: true,
                correctedSentence: sentence,
                explanation: 'Great effort! Keep practicing.',
                score: 70,
            };
        } catch {
            return {
                isCorrect: true,
                correctedSentence: sentence,
                explanation: 'Could not analyze at this time. Keep up the good work!',
                score: 70,
            };
        }
    }

    // ─── Cloud LLM (The Strategist) ────────────────────────────

    /**
     * Select new words using RAG + Cloud LLM
     * Queries local dictionary, then asks Cloud to pick the best words for the user
     */
    async selectNewWords(
        profile: ProfileAnalysis,
        existingWords: string[],
        count: number = 5,
    ): Promise<WordSelection[]> {
        if (!this.isCloudReady) {
            // Return empty if no cloud - the RAG module will handle fallback
            return [];
        }

        const prompt = `You are selecting English vocabulary words for a language learner.

User Profile:
- Profession: ${profile.profession}
- Interests: ${profile.interests.join(', ')}
- Level: ${profile.level}
- Goals: ${profile.goals.join(', ')}

Already known words (exclude these): ${existingWords.slice(-50).join(', ')}

Select ${count} new words that are:
1. Relevant to the user's profession and interests
2. Appropriate for their CEFR level (${profile.level})
3. Practical and commonly used in real life
4. NOT already in their known words list

Return JSON array: [{ "word": "...", "translation": "Turkish translation", "cefrLevel": "B1", "category": "medical/sports/daily", "exampleSentence": "...", "pronunciation": "" }]`;

        const messages: ChatMessage[] = [
            { role: 'system', content: 'You are a vocabulary selection specialist. Return valid JSON only.' },
            { role: 'user', content: prompt },
        ];

        try {
            const response = await this.cloudClient.chat(messages);
            return this.parseJSON<WordSelection[]>(response) || [];
        } catch {
            return [];
        }
    }

    /**
     * Analyze user chat history to extract profile tags
     * Uses "Smart Filtering" to ignore generic sentences
     */
    async analyzeProfile(chatHistory: string[]): Promise<Partial<ProfileAnalysis>> {
        if (!this.isCloudReady) return {};

        const prompt = `Analyze these user messages to extract profile information.

IMPORTANT: Use "Smart Filtering" - Only extract SPECIFIC, actionable information:
- KEEP: "I'm a nurse at a cardiac unit" → profession: "nurse", interests: ["cardiology"]
- IGNORE: "I like football" (too generic unless combined with specific context)
- KEEP: "I play for the local football club's reserve team" → interests: ["competitive football"]

Messages:
${chatHistory.map((m, i) => `${i + 1}. "${m}"`).join('\n')}

Return JSON with only new/specific tags found:
{ "profession": "string or empty", "interests": ["specific items"], "level": "detected level or empty", "goals": ["specific learning goals"] }

Only include fields where you found specific information. Return {} if nothing specific was found.`;

        const messages: ChatMessage[] = [
            { role: 'system', content: 'You are a profile analysis expert. Extract only specific, non-generic information. Return valid JSON.' },
            { role: 'user', content: prompt },
        ];

        try {
            const response = await this.cloudClient.chat(messages);
            return this.parseJSON<Partial<ProfileAnalysis>>(response) || {};
        } catch {
            return {};
        }
    }

    // ─── Helpers ───────────────────────────────────────────────

    private parseJSON<T>(text: string): T | null {
        try {
            // Try to extract JSON from the response (in case of markdown code blocks)
            const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1] || jsonMatch[0]);
            }
            return JSON.parse(text);
        } catch {
            console.warn('Failed to parse JSON from LLM response:', text.substring(0, 200));
            return null;
        }
    }

    /** Fallback quiz generator when AI is not available */
    private generateFallbackQuiz(words: WordSelection[]): QuizContent[] {
        return words.map((word) => ({
            question: `What is the meaning of "${word.word}"?`,
            options: [
                word.translation,
                'unknown word 1',
                'unknown word 2',
                'unknown word 3',
            ].sort(() => Math.random() - 0.5),
            correctAnswer: word.translation,
            explanation: `"${word.word}" means "${word.translation}". Example: ${word.exampleSentence}`,
        }));
    }
}

export default HybridLLMManager;
