/**
 * Cloud LLM Client - API wrapper for OpenAI / Gemini
 */

import type { ChatMessage } from './HybridLLMManager';

interface CloudConfig {
    apiKey: string;
    provider: 'openai' | 'gemini';
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

export class CloudLLMClient {
    private config: CloudConfig | null = null;

    configure(apiKey: string, provider: 'openai' | 'gemini' = 'openai'): void {
        const providerConfig = PROVIDER_CONFIGS[provider];
        this.config = {
            apiKey,
            provider,
            model: providerConfig.model,
            baseUrl: providerConfig.baseUrl,
        };
    }

    get isConfigured(): boolean {
        return this.config !== null && this.config.apiKey.length > 0;
    }

    async chat(messages: ChatMessage[]): Promise<string> {
        if (!this.config) {
            throw new Error('Cloud LLM not configured. Call configure() first.');
        }

        if (this.config.provider === 'openai') {
            return this.chatOpenAI(messages);
        } else {
            return this.chatGemini(messages);
        }
    }

    private async chatOpenAI(messages: ChatMessage[]): Promise<string> {
        const config = this.config!;

        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages: messages.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
                temperature: 0.7,
                max_tokens: 2048,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    }

    private async chatGemini(messages: ChatMessage[]): Promise<string> {
        const config = this.config!;

        // Convert chat messages to Gemini format
        const contents = messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

        // Add system instruction from system message
        const systemMessage = messages.find((m) => m.role === 'system');

        const response = await fetch(
            `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents,
                    systemInstruction: systemMessage
                        ? { parts: [{ text: systemMessage.content }] }
                        : undefined,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048,
                        responseMimeType: 'application/json',
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
