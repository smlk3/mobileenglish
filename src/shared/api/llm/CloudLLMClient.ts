/**
 * Cloud LLM Client - API wrapper for OpenAI / Gemini / Custom OpenAI-compatible endpoints
 */

import type { ChatMessage } from './HybridLLMManager';

export type CloudProvider = 'openai' | 'gemini' | 'custom';

interface CloudConfig {
    apiKey: string;
    provider: CloudProvider;
    model: string;
    baseUrl: string;
}

const PROVIDER_CONFIGS = {
    openai: {
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1',
    },
    gemini: {
        model: 'gemini-2.0-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    },
};

const FETCH_TIMEOUT_MS = 30_000;

export class CloudLLMClient {
    private config: CloudConfig | null = null;

    configure(apiKey: string, provider: CloudProvider = 'openai', customBaseUrl?: string, customModel?: string): void {
        if (provider === 'custom') {
            if (!customBaseUrl) throw new Error('baseUrl is required for custom provider');
            this.config = {
                apiKey,
                provider,
                model: customModel || 'gpt-4o-mini',
                baseUrl: customBaseUrl.replace(/\/$/, ''),
            };
        } else {
            const providerConfig = PROVIDER_CONFIGS[provider];
            this.config = {
                apiKey,
                provider,
                model: providerConfig.model,
                baseUrl: providerConfig.baseUrl,
            };
        }
    }

    get isConfigured(): boolean {
        return this.config !== null && this.config.apiKey.length > 0;
    }

    /**
     * Validates the API key by making a minimal test call.
     * Throws on failure.
     */
    async validateKey(): Promise<void> {
        if (!this.config) throw new Error('Not configured');
        const testMessages: ChatMessage[] = [{ role: 'user', content: 'Hi' }];
        if (this.config.provider === 'gemini') {
            await this.chatGemini(testMessages, true);
        } else {
            await this.chatOpenAI(testMessages, true);
        }
    }

    async chat(messages: ChatMessage[], jsonMode = false): Promise<string> {
        if (!this.config) {
            throw new Error('Cloud LLM not configured. Call configure() first.');
        }
        if (this.config.provider === 'gemini') {
            return this.chatGemini(messages, false, jsonMode);
        }
        // openai and custom both use OpenAI-compatible API format
        return this.chatOpenAI(messages, false, jsonMode);
    }

    private fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        return fetch(url, { ...options, signal: controller.signal }).finally(() =>
            clearTimeout(timer),
        );
    }

    private async chatOpenAI(messages: ChatMessage[], minimal = false, jsonMode = false): Promise<string> {
        const config = this.config!;

        const response = await this.fetchWithTimeout(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages: messages.map((m) => ({ role: m.role, content: m.content })),
                temperature: 0.7,
                max_tokens: minimal ? 5 : 2048,
                ...(jsonMode && !minimal ? { response_format: { type: 'json_object' } } : {}),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    }

    private async chatGemini(messages: ChatMessage[], minimal = false, jsonMode = false): Promise<string> {
        const config = this.config!;

        const contents = messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

        const systemMessage = messages.find((m) => m.role === 'system');

        const response = await this.fetchWithTimeout(
            `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    systemInstruction: systemMessage
                        ? { parts: [{ text: systemMessage.content }] }
                        : undefined,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: minimal ? 5 : 2048,
                        ...(jsonMode && !minimal ? { responseMimeType: 'application/json' } : {}),
                    },
                }),
            },
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
}
