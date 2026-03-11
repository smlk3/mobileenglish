import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import HybridLLMManager from '../src/shared/api/llm/HybridLLMManager';
import ModelDownloadManager, { type DownloadedModel, type DownloadProgress, MODEL_CATALOG, type ModelInfo } from '../src/shared/api/llm/ModelDownloadManager';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, shadows, spacing, typography } from '../src/shared/lib/theme';

export default function ModelManagerScreen() {
    const router = useRouter();
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;

    const activeLocalModelId = useProfileStore((s) => s.activeLocalModelId);
    const setActiveLocalModelId = useProfileStore((s) => s.setActiveLocalModelId);
    const setLocalModelLoaded = useProfileStore((s) => s.setLocalModelLoaded);
    const setActiveModel = useProfileStore((s) => s.setActiveModel);

    const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({});
    const [isChecking, setIsChecking] = useState(true);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const loadData = useCallback(async () => {
        setIsChecking(true);
        const manager = ModelDownloadManager.getInstance();
        const downloaded = await manager.getDownloadedModels();
        setDownloadedModels(downloaded);

        // Sync active model state
        if (activeLocalModelId && !downloaded.find(m => m.modelId === activeLocalModelId)) {
            // Model was deleted outside
            setActiveLocalModelId(null);
            setLocalModelLoaded(false);
            if (useProfileStore.getState().activeModel === 'local') {
                setActiveModel('none'); // Fallback handled by LLM manager
            }
        }
        setIsChecking(false);
    }, [activeLocalModelId, setActiveLocalModelId, setLocalModelLoaded, setActiveModel]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleDownload = async (model: ModelInfo) => {
        const manager = ModelDownloadManager.getInstance();
        
        // Prevent multiple simultaneous downloads
        if (manager.getActiveDownloadId()) {
            Alert.alert('Download in Progress', 'Please wait for the current download to finish.');
            return;
        }

        try {
            await manager.downloadModel(model.id, (progress) => {
                setDownloadProgress((prev) => ({
                    ...prev,
                    [model.id]: progress,
                }));

                if (progress.status === 'completed') {
                    // Start initialization automatically
                    handleActivate(model.id);
                } else if (progress.status === 'error' && progress.error) {
                    Alert.alert('Download Failed', progress.error);
                }
            });
            loadData();
        } catch (error: any) {
            Alert.alert('Download Error', error.message);
        }
    };

    const handleCancelDownload = async (modelId: string) => {
        const manager = ModelDownloadManager.getInstance();
        await manager.cancelDownload();
        
        setDownloadProgress((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
        });
    };

    const handleDelete = (modelId: string, modelName: string) => {
        Alert.alert(
            'Delete Model',
            `Are you sure you want to delete ${modelName}? This will free up storage space.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const manager = ModelDownloadManager.getInstance();
                        await manager.deleteModel(modelId);
                        
                        if (activeLocalModelId === modelId) {
                            setActiveLocalModelId(null);
                            setLocalModelLoaded(true); // Mock mode is technically loaded
                            
                            // Re-init HybridLLMManager to fall back to mock
                            await HybridLLMManager.getInstance().initLocalModel();
                        }
                        
                        loadData();
                    },
                },
            ]
        );
    };

    const handleActivate = async (modelId: string) => {
        const manager = ModelDownloadManager.getInstance();
        const model = MODEL_CATALOG.find(m => m.id === modelId);
        if (!model) return;

        const path = manager.getModelPath(model);
        
        // Set UI loading state immediately
        setActiveLocalModelId('loading');

        try {
            const llm = HybridLLMManager.getInstance();
            const success = await llm.initLocalModel(path);
            
            if (success) {
                setActiveLocalModelId(modelId);
                setLocalModelLoaded(true);
                setActiveModel('local');
            } else {
                Alert.alert('Error', 'Failed to initialize the model. Falling back to mock engine.');
                setActiveLocalModelId(null);
            }
        } catch (e: any) {
            Alert.alert('Initialization Error', e.message);
            setActiveLocalModelId(null);
        }
    };

    const totalStorage = downloadedModels.reduce((sum, m) => sum + m.sizeBytes, 0);

    return (
        <View style={[styles.container, { backgroundColor: tc.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: tc.surface, borderBottomColor: tc.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                    <Ionicons name="close" size={24} color={tc.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: tc.text }]}>Local Models</Text>
                <View style={styles.headerButton} />
            </View>

            <ScrollView 
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View entering={FadeInDown.duration(400)}>
                    <Text style={[styles.description, { color: tc.textSecondary }]}>
                        Download local AI models to run chat and dictionary features completely offline, right on your device. 
                        No internet required and full privacy.
                    </Text>

                    {/* Storage info card */}
                    <View style={[styles.storageCard, { backgroundColor: tc.surfaceElevated }]}>
                        <Ionicons name="hardware-chip-outline" size={24} color={colors.primary[400]} />
                        <View style={styles.storageInfo}>
                            <Text style={[styles.storageText, { color: tc.text }]}>Local AI Storage Used</Text>
                            <Text style={[styles.storageValue, { color: colors.primary[400] }]}>
                                {isChecking ? '...' : formatBytes(totalStorage)}
                            </Text>
                        </View>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(50)}>
                    <Text style={[styles.sectionTitle, { color: tc.textMuted }]}>AVAILABLE MODELS</Text>
                </Animated.View>

                {MODEL_CATALOG.map((model, index) => {
                    const isDownloaded = downloadedModels.some(m => m.modelId === model.id);
                    const isActive = activeLocalModelId === model.id;
                    const isLoading = activeLocalModelId === 'loading';
                    const progress = downloadProgress[model.id];
                    const isDownloading = progress?.status === 'downloading';

                    return (
                        <Animated.View 
                            key={model.id}
                            entering={FadeInDown.duration(400).delay(100 + index * 50)}
                            style={[
                                styles.modelCard, 
                                { backgroundColor: tc.surface, borderColor: tc.border },
                                isActive && { borderColor: colors.primary[500], borderWidth: 2 }
                            ]}
                        >
                            {model.recommended && (
                                <View style={[styles.recommendedBadge, { backgroundColor: colors.accent[500] }]}>
                                    <Text style={styles.recommendedText}>RECOMMENDED</Text>
                                </View>
                            )}

                            <View style={styles.modelHeader}>
                                <Text style={[styles.modelName, { color: tc.text }]}>{model.name}</Text>
                                <View style={[styles.tag, { backgroundColor: tc.border }]}>
                                    <Text style={[styles.tagText, { color: tc.textSecondary }]}>{model.parameters}</Text>
                                </View>
                            </View>
                            
                            <Text style={[styles.modelDesc, { color: tc.textSecondary }]}>
                                {model.description}
                            </Text>

                            <View style={styles.modelMeta}>
                                <Text style={[styles.metaText, { color: tc.textMuted }]}>
                                    Size: {model.sizeLabel}
                                </Text>
                                <Text style={[styles.metaText, { color: tc.textMuted }]}>
                                    •
                                </Text>
                                <Text style={[styles.metaText, { color: tc.textMuted }]}>
                                    Format: {model.quantization}
                                </Text>
                            </View>

                            {/* Download Progress Bar */}
                            {isDownloading && (
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressHeader}>
                                        <Text style={[styles.progressText, { color: tc.text }]}>
                                            Downloading... {Math.round(progress.progress * 100)}%
                                        </Text>
                                        <Text style={[styles.progressText, { color: tc.textMuted }]}>
                                            {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
                                        </Text>
                                    </View>
                                    <View style={[styles.progressBarBg, { backgroundColor: tc.border }]}>
                                        <View 
                                            style={[
                                                styles.progressBarFill, 
                                                { width: `${progress.progress * 100}%`, backgroundColor: colors.primary[500] }
                                            ]} 
                                        />
                                    </View>
                                    <TouchableOpacity 
                                        style={styles.cancelButton}
                                        onPress={() => handleCancelDownload(model.id)}
                                    >
                                        <Text style={[styles.cancelText, { color: tc.textSecondary }]}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Action Buttons */}
                            {!isDownloading && (
                                <View style={styles.actionsRow}>
                                    {!isDownloaded ? (
                                        <TouchableOpacity
                                            style={[styles.primaryBtn, { backgroundColor: colors.primary[500] }]}
                                            onPress={() => handleDownload(model)}
                                        >
                                            <Ionicons name="download-outline" size={20} color="#fff" />
                                            <Text style={styles.primaryBtnText}>Download</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <>
                                            <TouchableOpacity
                                                style={[
                                                    styles.primaryBtn, 
                                                    isActive 
                                                        ? { backgroundColor: colors.success.main } 
                                                        : { backgroundColor: tc.surfaceElevated, borderWidth: 1, borderColor: colors.primary[500] },
                                                    { flex: 2 }
                                                ]}
                                                onPress={() => handleActivate(model.id)}
                                                disabled={isActive || isLoading}
                                            >
                                                <Ionicons 
                                                    name={isActive ? "checkmark-circle" : "play"} 
                                                    size={20} 
                                                    color={isActive ? "#fff" : colors.primary[500]} 
                                                />
                                                <Text style={[
                                                    styles.primaryBtnText,
                                                    isActive ? { color: '#fff' } : { color: colors.primary[500] }
                                                ]}>
                                                    {isActive ? 'Active Model' : 'Activate'}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.deleteBtn, { backgroundColor: colors.error.main + '15' }]}
                                                onPress={() => handleDelete(model.id, model.name)}
                                                disabled={isLoading}
                                            >
                                                <Ionicons name="trash-outline" size={20} color={colors.error.main} />
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            )}
                        </Animated.View>
                    );
                })}

                <View style={{ height: 40 }}/>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        paddingTop: 56,
        paddingBottom: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerButton: {
        padding: spacing.xs,
        width: 40,
    },
    headerTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '700',
    },
    content: {
        padding: spacing.base,
    },
    description: {
        fontSize: typography.fontSize.sm,
        lineHeight: 20,
        marginBottom: spacing.base,
    },
    storageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xl,
    },
    storageInfo: {
        marginLeft: spacing.md,
    },
    storageText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    storageValue: {
        fontSize: typography.fontSize.base,
        fontWeight: '700',
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: typography.fontSize.xs,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: spacing.sm,
    },
    modelCard: {
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        padding: spacing.lg,
        marginBottom: spacing.md,
        overflow: 'hidden',
    },
    recommendedBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderBottomLeftRadius: borderRadius.md,
    },
    recommendedText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    modelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    modelName: {
        fontSize: typography.fontSize.lg,
        fontWeight: '700',
        marginRight: spacing.sm,
    },
    tag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    tagText: {
        fontSize: 10,
        fontWeight: '600',
    },
    modelDesc: {
        fontSize: typography.fontSize.sm,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    modelMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    metaText: {
        fontSize: typography.fontSize.xs,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    deleteBtn: {
        width: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.md,
    },
    progressContainer: {
        marginTop: spacing.sm,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    progressText: {
        fontSize: typography.fontSize.xs,
    },
    progressBarBg: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    cancelButton: {
        alignSelf: 'flex-end',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
    },
    cancelText: {
        fontSize: typography.fontSize.xs,
        fontWeight: '600',
    },
});
