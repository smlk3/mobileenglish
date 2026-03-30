/**
 * Local SLM Client - Wrapper around llama.rn for on-device inference
 * Mock implementation for development; real llama.rn for native builds.
 */

import { initLlama } from 'llama.rn';
import type { ChatMessage } from './HybridLLMManager';

type PromptFormat = 'phi3' | 'chatml' | 'llama3';

export class LocalSLMClient {
    private context: any = null;
    private isInitialized = false;
    private useMock = true;
    private modelPath = '';

    async initialize(modelPath?: string): Promise<void> {
        if (!modelPath) {
            console.log('No model path provided. Local SLM running in mock mode.');
            this.useMock = true;
            this.isInitialized = true;
            return;
        }

        try {
            console.log(`Initializing llama.rn with model: ${modelPath}`);
            this.context = await initLlama({
                model: modelPath,
                n_ctx: 2048,
                n_batch: 512,
                n_threads: 6,
                n_gpu_layers: 32,
            });
            this.useMock = false;
            this.isInitialized = true;
            this.modelPath = modelPath;
            console.log('llama.rn successfully initialized.');
        } catch (error) {
            console.warn('Failed to initialize llama.rn. Falling back to mock mode.', error);
            this.useMock = true;
            this.isInitialized = true;
        }
    }

    get isReady(): boolean {
        return this.isInitialized;
    }

    get isMockMode(): boolean {
        return this.useMock;
    }

    async chat(messages: ChatMessage[], onToken?: (token: string) => void): Promise<string> {
        if (!this.isInitialized) {
            throw new Error('Local SLM not initialized. Call initialize() first.');
        }
        if (this.useMock) {
            return this.mockChat(messages, onToken);
        }
        return this.llamaChat(messages, onToken);
    }

    /**
     * Detects the appropriate prompt format based on model filename.
     * - SmolLM2, Qwen, Mistral → ChatML (<|im_start|>)
     * - Llama 3.x             → Llama 3 (<|begin_of_text|>)
     * - Phi-3 / default       → Phi-3 (<|system|>)
     */
    private getPromptFormat(path: string): PromptFormat {
        const lower = path.toLowerCase();
        if (lower.includes('smollm') || lower.includes('qwen') || lower.includes('mistral')) {
            return 'chatml';
        }
        if (lower.includes('llama')) {
            return 'llama3';
        }
        return 'phi3';
    }

    private buildPrompt(messages: ChatMessage[]): string {
        const format = this.getPromptFormat(this.modelPath);
        let prompt = '';

        if (format === 'chatml') {
            for (const m of messages) {
                prompt += `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`;
            }
            prompt += '<|im_start|>assistant\n';
        } else if (format === 'llama3') {
            prompt += '<|begin_of_text|>';
            for (const m of messages) {
                prompt += `<|start_header_id|>${m.role}<|end_header_id|>\n\n${m.content}<|eot_id|>`;
            }
            prompt += '<|start_header_id|>assistant<|end_header_id|>\n\n';
        } else {
            // Phi-3 format
            for (const m of messages) {
                if (m.role === 'system') {
                    prompt += `<|system|>\n${m.content}<|end|>\n`;
                } else if (m.role === 'user') {
                    prompt += `<|user|>\n${m.content}<|end|>\n`;
                } else {
                    prompt += `<|assistant|>\n${m.content}<|end|>\n`;
                }
            }
            prompt += '<|assistant|>\n';
        }

        return prompt;
    }

    private async llamaChat(messages: ChatMessage[], onToken?: (token: string) => void): Promise<string> {
        if (!this.context) {
            throw new Error('Llama context not available');
        }

        const prompt = this.buildPrompt(messages);

        try {
            const result = await this.context.completion({
                prompt,
                n_predict: 512,
                temperature: 0.7,
                top_p: 0.9,
                stop: [
                    '<|user|>', '<|system|>', '<|assistant|>', '<|end|>',
                    '<|im_end|>', '<|im_start|>',
                    '<|eot_id|>', '<|start_header_id|>', '<|end_of_text|>',
                    '</s>', '\n<|',
                ],
                onToken: (event: any) => {
                    if (onToken && event.token) {
                        onToken(event.token);
                    }
                },
            });

            const text = result.text || '';
            return text
                .replace(/<\|.*?\|>/g, '')
                .split(/\n(User|Assistant|System|USER|ASSISTANT|SYSTEM):/i)[0]
                .trim();
        } catch (error: any) {
            console.error('LLM Inference error:', error);
            throw new Error('Inference failed: ' + error.message);
        }
    }

    private async mockChat(messages: ChatMessage[], onToken?: (token: string) => void): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 300));

        const lastMessage = messages[messages.length - 1]?.content || '';
        let response = '';

        if (lastMessage.toLowerCase().includes('quiz') || lastMessage.toLowerCase().includes('fill-in')) {
            response = JSON.stringify([
                {
                    question: 'The doctor needs to ___ the patient before surgery.',
                    options: ['examine', 'exhaust', 'export', 'extend'],
                    correctAnswer: 'examine',
                    explanation: '"Examine" means to inspect or look at closely, especially in a medical context.',
                },
            ]);
        } else if (lastMessage.toLowerCase().includes('grammar') || lastMessage.toLowerCase().includes('check')) {
            response = JSON.stringify({
                isCorrect: true,
                correctedSentence: 'Your sentence is grammatically correct.',
                explanation: 'Great job! Your sentence structure is clear and natural.',
                score: 85,
            });
        } else if (lastMessage.toLowerCase().includes('select') || lastMessage.toLowerCase().includes('words')) {
            response = JSON.stringify([
                {
                    word: 'resilient',
                    translation: 'dayanikli',
                    cefrLevel: 'B2',
                    category: 'personality',
                    exampleSentence: 'She is a resilient person who never gives up.',
                },
            ]);
        } else {
            response = "Hello! I'm your English learning assistant (Mock Mode). I can help you practice vocabulary, check your grammar, and generate quizzes. What would you like to work on today?";
        }

        if (onToken) {
            const words = response.split(' ');
            for (const word of words) {
                onToken(word + ' ');
                await new Promise((r) => setTimeout(r, 30));
            }
        }

        return response;
    }

    async dispose(): Promise<void> {
        if (this.context) {
            await this.context.release();
            this.context = null;
        }
        this.isInitialized = false;
    }
}
