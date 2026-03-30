import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type UserSettingsModel from '../../src/entities/UserProfile/model';
import HybridLLMManager from '../../src/shared/api/llm/HybridLLMManager';
import { MODEL_CATALOG } from '../../src/shared/api/llm/ModelDownloadManager';
import { getUserSettings } from '../../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, spacing, typography } from '../../src/shared/lib/theme';

export default function SettingsScreen() {
    const router = useRouter();
    const themeMode = useProfileStore((s) => s.themeMode);
    const toggleTheme = useProfileStore((s) => s.toggleTheme);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;

    const [settings, setSettings] = useState<UserSettingsModel | null>(null);

    const loadSettings = useCallback(async () => {
        const s = await getUserSettings();
        setSettings(s);
        if (s) {
            // Sync profile store with DB
            const profile = useProfileStore.getState();
            const tags = s.profileTags;
            profile.setProfile({
                profession: tags.profession,
                interests: tags.interests,
                level: tags.level,
                nativeLanguage: tags.nativeLanguage,
                goals: tags.goals,
            });
            // Configure LLM if api key exists
            const keys = s.apiKeys;
            if (keys.openai) {
                HybridLLMManager.getInstance().configureCloud(keys.openai, 'openai');
                useProfileStore.getState().setCloudAvailable(true);
            } else if (keys.gemini) {
                HybridLLMManager.getInstance().configureCloud(keys.gemini, 'gemini');
                useProfileStore.getState().setCloudAvailable(true);
            } else if (keys.custom) {
                HybridLLMManager.getInstance().configureCloud(
                    keys.custom.apiKey, 'custom', keys.custom.baseUrl, keys.custom.model,
                );
                useProfileStore.getState().setCloudAvailable(true);
            }
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadSettings();
        }, [loadSettings]),
    );

    const profileTags = settings?.profileTags;
    const apiKeys = settings?.apiKeys;
    const isLocalModelLoaded = useProfileStore((s) => s.isLocalModelLoaded);

    const navigateToSettingModal = (type: string, title: string, currentValue: string) => {
        router.push({
            pathname: '/setting-modal',
            params: { type, title, currentValue },
        } as any);
    };

    const handleNotificationToggle = async (value: boolean) => {
        if (settings) {
            await settings.updateSettings({ notificationsEnabled: value });
            loadSettings();
        }
    };

    const sections = [
        {
            title: 'Appearance',
            items: [
                {
                    icon: 'moon' as const,
                    iconColor: colors.primary[400],
                    title: 'Dark Mode',
                    subtitle: undefined as string | undefined,
                    type: 'switch' as const,
                    value: themeMode === 'dark',
                    onToggle: toggleTheme,
                },
            ],
        },
        {
            title: 'AI Configuration',
            items: [
                {
                    icon: 'cloud' as const,
                    iconColor: colors.accent[400],
                    title: 'Cloud API Key',
                    subtitle: apiKeys?.openai
                        ? `OpenAI: ••••${apiKeys.openai.slice(-4)}`
                        : apiKeys?.gemini
                          ? `Gemini: ••••${apiKeys.gemini.slice(-4)}`
                          : apiKeys?.custom
                            ? `Custom: ••••${apiKeys.custom.apiKey.slice(-4)}`
                            : 'Not configured',
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('api_key', 'Cloud API Key', ''),
                },
                {
                    icon: 'swap-horizontal' as const,
                    iconColor: colors.warning.main,
                    title: 'AI Provider',
                    subtitle: apiKeys?.custom
                        ? `Custom: ${apiKeys.custom.model}`
                        : apiKeys?.gemini
                          ? 'Google Gemini'
                          : apiKeys?.openai
                            ? 'OpenAI GPT-4o-mini'
                            : 'Mock Mode',
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('ai_provider', 'AI Provider', apiKeys?.custom ? 'custom' : apiKeys?.gemini ? 'gemini' : 'openai'),
                },
                {
                    icon: 'hardware-chip-outline' as const,
                    iconColor: colors.primary[400],
                    title: 'Local Model',
                    subtitle: isLocalModelLoaded && useProfileStore.getState().activeLocalModelId !== 'loading' && useProfileStore.getState().activeLocalModelId ? MODEL_CATALOG.find(m => m.id === useProfileStore.getState().activeLocalModelId)?.name || 'Custom Model' : 'Mock Mode',
                    type: 'nav' as const,
                    onPress: () => router.push('/model-manager'),
                },
            ],
        },
        {
            title: 'Learning',
            items: [
                {
                    icon: 'school' as const,
                    iconColor: colors.primary[400],
                    title: 'Target Level',
                    subtitle: profileTags?.level ? `${profileTags.level} - ${getLevelName(profileTags.level)}` : 'A1 - Beginner',
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('level', 'Target Level', profileTags?.level || 'A1'),
                },
                {
                    icon: 'language' as const,
                    iconColor: colors.accent[400],
                    title: 'Native Language',
                    subtitle: profileTags?.nativeLanguage === 'tr' ? 'Turkish' : profileTags?.nativeLanguage || 'Turkish',
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('native_language', 'Native Language', profileTags?.nativeLanguage || 'tr'),
                },
                {
                    icon: 'trophy' as const,
                    iconColor: colors.warning.main,
                    title: 'Daily Goal',
                    subtitle: `${settings?.dailyGoal || 10} words/day`,
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('daily_goal', 'Daily Goal', String(settings?.dailyGoal || 10)),
                },
                {
                    icon: 'notifications' as const,
                    iconColor: colors.error.main,
                    title: 'Reminders',
                    subtitle: undefined as string | undefined,
                    type: 'switch' as const,
                    value: settings?.notificationsEnabled ?? true,
                    onToggle: handleNotificationToggle,
                },
            ],
        },
        {
            title: 'Profile Tags',
            items: [
                {
                    icon: 'briefcase' as const,
                    iconColor: '#6366F1',
                    title: 'Profession',
                    subtitle: profileTags?.profession || 'Not set',
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('profession', 'Profession', profileTags?.profession || ''),
                },
                {
                    icon: 'heart' as const,
                    iconColor: '#EF4444',
                    title: 'Interests',
                    subtitle: profileTags?.interests?.length
                        ? profileTags.interests.join(', ')
                        : 'Add your interests for personalized words',
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('interests', 'Interests', profileTags?.interests?.join(', ') || ''),
                },
            ],
        },
        {
            title: 'Data',
            items: [
                {
                    icon: 'trash' as const,
                    iconColor: colors.error.main,
                    title: 'Reset All Data',
                    subtitle: 'Delete all decks, cards, and progress',
                    type: 'nav' as const,
                    onPress: () => {
                        Alert.alert(
                            'Reset All Data',
                            'This will permanently delete all your decks, cards, study progress, and chat history. This cannot be undone.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Reset',
                                    style: 'destructive',
                                    onPress: () => Alert.alert('Info', 'Please reinstall the app to reset data.'),
                                },
                            ],
                        );
                    },
                },
            ],
        },
        {
            title: 'About',
            items: [
                {
                    icon: 'information-circle' as const,
                    iconColor: tc.textMuted,
                    title: 'Version',
                    subtitle: '1.0.0',
                    type: 'info' as const,
                },
            ],
        },
    ];

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: tc.background }]}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {sections.map((section, sIndex) => (
                <Animated.View
                    key={section.title}
                    entering={FadeInDown.duration(400).delay(sIndex * 80)}
                >
                    <Text style={[styles.sectionTitle, { color: tc.textMuted }]}>
                        {section.title.toUpperCase()}
                    </Text>
                    <View style={[styles.sectionCard, { backgroundColor: tc.surface }]}>
                        {section.items.map((item, iIndex) => (
                            <TouchableOpacity
                                key={item.title}
                                style={[
                                    styles.settingItem,
                                    iIndex < section.items.length - 1 && [styles.itemBorder, { borderBottomColor: tc.border }],
                                ]}
                                onPress={item.type === 'nav' ? (item as any).onPress : undefined}
                                activeOpacity={item.type === 'nav' ? 0.7 : 1}
                                disabled={item.type === 'switch' || item.type === 'info'}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: item.iconColor + '18' }]}>
                                    <Ionicons name={item.icon} size={20} color={item.iconColor} />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={[styles.itemTitle, { color: tc.text }]}>{item.title}</Text>
                                    {item.subtitle && (
                                        <Text style={[styles.itemSubtitle, { color: tc.textSecondary }]} numberOfLines={1}>
                                            {item.subtitle}
                                        </Text>
                                    )}
                                </View>
                                {item.type === 'switch' && (
                                    <Switch
                                        value={item.value}
                                        onValueChange={item.onToggle}
                                        trackColor={{ false: tc.border, true: colors.primary[400] }}
                                        thumbColor="#fff"
                                    />
                                )}
                                {item.type === 'nav' && (
                                    <Ionicons name="chevron-forward" size={20} color={tc.textMuted} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>
            ))}

            <View style={{ height: 60 }} />
        </ScrollView>
    );
}

function getLevelName(level: string): string {
    const names: Record<string, string> = {
        A1: 'Beginner',
        A2: 'Elementary',
        B1: 'Intermediate',
        B2: 'Upper Intermediate',
        C1: 'Advanced',
        C2: 'Mastery',
    };
    return names[level] || level;
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.base, paddingBottom: spacing['3xl'] },
    sectionTitle: {
        fontSize: typography.fontSize.xs,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: spacing.sm,
        marginTop: spacing.lg,
        marginLeft: spacing.xs,
    },
    sectionCard: {
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
    },
    itemBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    itemContent: { flex: 1 },
    itemTitle: { fontSize: typography.fontSize.base, fontWeight: '500' },
    itemSubtitle: { fontSize: typography.fontSize.sm, marginTop: 2 },
});
