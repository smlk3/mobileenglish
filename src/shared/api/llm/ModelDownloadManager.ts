/**
 * ModelDownloadManager — Downloads and manages GGUF models from Hugging Face
 * Uses expo-file-system for download with progress tracking.
 */

import * as FileSystem from 'expo-file-system/legacy';

// ─── Model Catalog ────────────────────────────────────────

export interface ModelInfo {
    id: string;
    name: string;
    description: string;
    repo: string;
    filename: string;
    sizeBytes: number;
    sizeLabel: string;
    parameters: string;
    quantization: string;
    recommended?: boolean;
}

export const MODEL_CATALOG: ModelInfo[] = [
    {
        id: 'smollm2-360m',
        name: 'SmolLM2 360M',
        description: 'Ultra-light model for basic chat. Fast but limited quality.',
        repo: 'bartowski/SmolLM2-360M-Instruct-GGUF',
        filename: 'SmolLM2-360M-Instruct-Q4_K_M.gguf',
        sizeBytes: 260_000_000,
        sizeLabel: '~260 MB',
        parameters: '360M',
        quantization: 'Q4_K_M',
    },
    {
        id: 'smollm2-1.7b',
        name: 'SmolLM2 1.7B',
        description: 'Good quality for chat and language tasks. Recommended for most devices.',
        repo: 'bartowski/SmolLM2-1.7B-Instruct-GGUF',
        filename: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
        sizeBytes: 1_060_000_000,
        sizeLabel: '~1 GB',
        parameters: '1.7B',
        quantization: 'Q4_K_M',
        recommended: true,
    },
    {
        id: 'llama-3.2-1b',
        name: 'Llama 3.2 1B',
        description: 'Meta\'s compact model. Great balance of speed and quality.',
        repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
        filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        sizeBytes: 770_000_000,
        sizeLabel: '~770 MB',
        parameters: '1B',
        quantization: 'Q4_K_M',
    },
    {
        id: 'llama-3.2-3b',
        name: 'Llama 3.2 3B',
        description: 'Higher quality responses. Requires more RAM (4GB+).',
        repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
        filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        sizeBytes: 2_020_000_000,
        sizeLabel: '~2 GB',
        parameters: '3B',
        quantization: 'Q4_K_M',
    },
    {
        id: 'qwen2.5-1.5b',
        name: 'Qwen 2.5 1.5B',
        description: 'Multilingual model with strong reasoning capability.',
        repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
        filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
        sizeBytes: 990_000_000,
        sizeLabel: '~990 MB',
        parameters: '1.5B',
        quantization: 'Q4_K_M',
    },
];

// ─── Download State ───────────────────────────────────────

export interface DownloadProgress {
    modelId: string;
    totalBytes: number;
    downloadedBytes: number;
    progress: number; // 0-1
    status: 'idle' | 'downloading' | 'completed' | 'error' | 'cancelled';
    error?: string;
}

export interface DownloadedModel {
    modelId: string;
    name: string;
    filePath: string;
    sizeBytes: number;
    downloadedAt: number;
}

// ─── Callbacks ─────────────────────────────────────────────

type ProgressCallback = (progress: DownloadProgress) => void;

// ─── Manager ──────────────────────────────────────────────

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

class ModelDownloadManager {
    private static instance: ModelDownloadManager;
    private activeDownload: any | null = null;
    private currentModelId: string | null = null;
    private progressCallback: ProgressCallback | null = null;

    static getInstance(): ModelDownloadManager {
        if (!ModelDownloadManager.instance) {
            ModelDownloadManager.instance = new ModelDownloadManager();
        }
        return ModelDownloadManager.instance;
    }

    /** Ensure models directory exists */
    private async ensureDir(): Promise<void> {
        const info = await FileSystem.getInfoAsync(MODELS_DIR);
        if (!info.exists) {
            await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
        }
    }

    /** Build Hugging Face download URL */
    private getDownloadUrl(model: ModelInfo): string {
        return `https://huggingface.co/${model.repo}/resolve/main/${model.filename}`;
    }

    /** Get local file path for a model */
    getModelPath(model: ModelInfo): string {
        return `${MODELS_DIR}${model.filename}`;
    }

    /** Check which models are already downloaded */
    async getDownloadedModels(): Promise<DownloadedModel[]> {
        await this.ensureDir();
        const downloaded: DownloadedModel[] = [];

        for (const model of MODEL_CATALOG) {
            const filePath = this.getModelPath(model);
            const info = await FileSystem.getInfoAsync(filePath);
            if (info.exists && info.size && info.size > 0) {
                downloaded.push({
                    modelId: model.id,
                    name: model.name,
                    filePath,
                    sizeBytes: info.size,
                    downloadedAt: info.modificationTime || Date.now(),
                });
            }
        }

        return downloaded;
    }

    /** Check if a specific model is downloaded */
    async isModelDownloaded(modelId: string): Promise<boolean> {
        const model = MODEL_CATALOG.find((m) => m.id === modelId);
        if (!model) return false;
        const info = await FileSystem.getInfoAsync(this.getModelPath(model));
        return info.exists && (info.size ?? 0) > 0;
    }

    /**
     * Download a model from Hugging Face with progress tracking
     */
    async downloadModel(
        modelId: string,
        onProgress?: ProgressCallback,
    ): Promise<string> {
        const model = MODEL_CATALOG.find((m) => m.id === modelId);
        if (!model) throw new Error(`Model ${modelId} not found in catalog`);

        await this.ensureDir();
        this.currentModelId = modelId;
        this.progressCallback = onProgress || null;

        const url = this.getDownloadUrl(model);
        const filePath = this.getModelPath(model);

        // Report download start
        this.reportProgress({
            modelId,
            totalBytes: model.sizeBytes,
            downloadedBytes: 0,
            progress: 0,
            status: 'downloading',
        });

        try {
            const downloadResumable = FileSystem.createDownloadResumable(
                url,
                filePath,
                {},
                (downloadProgress: any) => {
                    const progress =
                        downloadProgress.totalBytesWritten /
                        downloadProgress.totalBytesExpectedToWrite;
                    this.reportProgress({
                        modelId,
                        totalBytes: downloadProgress.totalBytesExpectedToWrite,
                        downloadedBytes: downloadProgress.totalBytesWritten,
                        progress,
                        status: 'downloading',
                    });
                },
            );

            this.activeDownload = downloadResumable;
            const result = await downloadResumable.downloadAsync();

            this.activeDownload = null;
            this.currentModelId = null;

            if (!result || !result.uri) {
                throw new Error('Download returned no URI');
            }

            this.reportProgress({
                modelId,
                totalBytes: model.sizeBytes,
                downloadedBytes: model.sizeBytes,
                progress: 1,
                status: 'completed',
            });

            return result.uri;
        } catch (error: any) {
            this.activeDownload = null;
            this.currentModelId = null;

            const errorMessage =
                error?.message || 'Download failed';

            this.reportProgress({
                modelId,
                totalBytes: model.sizeBytes,
                downloadedBytes: 0,
                progress: 0,
                status: 'error',
                error: errorMessage,
            });

            throw new Error(errorMessage);
        }
    }

    /** Cancel active download */
    async cancelDownload(): Promise<void> {
        if (this.activeDownload) {
            try {
                await this.activeDownload.pauseAsync();
            } catch {}
            this.activeDownload = null;

            if (this.currentModelId) {
                this.reportProgress({
                    modelId: this.currentModelId,
                    totalBytes: 0,
                    downloadedBytes: 0,
                    progress: 0,
                    status: 'cancelled',
                });
            }
            this.currentModelId = null;
        }
    }

    /** Delete a downloaded model */
    async deleteModel(modelId: string): Promise<void> {
        const model = MODEL_CATALOG.find((m) => m.id === modelId);
        if (!model) return;

        const filePath = this.getModelPath(model);
        const info = await FileSystem.getInfoAsync(filePath);
        if (info.exists) {
            await FileSystem.deleteAsync(filePath, { idempotent: true });
        }
    }

    /** Get total storage used by downloaded models */
    async getTotalStorageUsed(): Promise<number> {
        const models = await this.getDownloadedModels();
        return models.reduce((sum, m) => sum + m.sizeBytes, 0);
    }

    /** Get active model ID if downloading */
    getActiveDownloadId(): string | null {
        return this.currentModelId;
    }

    private reportProgress(progress: DownloadProgress): void {
        this.progressCallback?.(progress);
    }
}

export default ModelDownloadManager;
