import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { getLanguageConfig, getLevelLabel, SUPPORTED_TARGET_LANGUAGES } from '../../src/shared/lib/languageConfig';
import { getUserSettings } from '../../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, spacing, typography } from '../../src/shared/lib/theme';

export default function SettingsScreen() {
    const { t } = useTranslation();
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
            profile.setTargetLanguage(s.targetLanguage || 'en');
            // Configure LLM based on active provider or fallback to available keys
            const keys = s.apiKeys;
            const active = keys.activeProvider || (keys.custom ? 'custom' : keys.gemini ? 'gemini' : keys.openai ? 'openai' : undefined);
            
            if (active === 'custom' && keys.custom) {
                HybridLLMManager.getInstance().configureCloud(keys.custom.apiKey, 'custom', keys.custom.baseUrl, keys.custom.model);
                useProfileStore.getState().setCloudAvailable(true);
            } else if (active === 'gemini' && keys.gemini) {
                HybridLLMManager.getInstance().configureCloud(keys.gemini, 'gemini');
                useProfileStore.getState().setCloudAvailable(true);
            } else if (active === 'openai' && keys.openai) {
                HybridLLMManager.getInstance().configureCloud(keys.openai, 'openai');
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
            title: t('settings.appearance'),
            items: [
                {
                    icon: 'moon' as const,
                    iconColor: colors.primary[400],
                    title: t('settings.darkMode'),
                    subtitle: undefined as string | undefined,
                    type: 'switch' as const,
                    value: themeMode === 'dark',
                    onToggle: toggleTheme,
                },
            ],
        },
        {
            title: t('settings.aiConfig'),
            items: [
                {
                    icon: 'cloud' as const,
                    iconColor: colors.accent[400],
                    title: t('settings.cloudApiKey'),
                    subtitle: apiKeys?.openai
                        ? `OpenAI: ••••${apiKeys.openai.slice(-4)}`
                        : apiKeys?.gemini
                          ? `Gemini: ••••${apiKeys.gemini.slice(-4)}`
                          : apiKeys?.custom
                            ? `Custom: ••••${apiKeys.custom.apiKey.slice(-4)}`
                            : t('settings.notConfigured'),
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('api_key', t('settings.cloudApiKey'), ''),
                },
                {
                    icon: 'swap-horizontal' as const,
                    iconColor: colors.warning.main,
                    title: t('settings.aiProvider'),
                    subtitle: apiKeys?.activeProvider === 'custom' && apiKeys.custom
                        ? `Custom: ${apiKeys.custom.model}`
                        : apiKeys?.activeProvider === 'gemini' && apiKeys.gemini
                          ? 'Google Gemini'
                          : apiKeys?.activeProvider === 'openai' && apiKeys.openai
                            ? 'OpenAI GPT-4o-mini'
                            : t('settings.mockMode'),
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('ai_provider', t('settings.aiProvider'), apiKeys?.activeProvider || (apiKeys?.custom ? 'custom' : apiKeys?.gemini ? 'gemini' : 'openai')),
                },
            ],
        },
        {
            title: t('settings.learning'),
            items: [
                {
                    icon: 'globe' as const,
                    iconColor: '#10B981',
                    title: t('settings.targetLanguage'),
                    subtitle: (() => {
                        const cfg = getLanguageConfig(settings?.targetLanguage || 'en');
                        return `${cfg.flag} ${cfg.name}`;
                    })(),
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('target_language', t('settings.targetLanguage'), settings?.targetLanguage || 'en'),
                },
                {
                    icon: 'school' as const,
                    iconColor: colors.primary[400],
                    title: t('settings.targetLevel'),
                    subtitle: (() => {
                        const targetLang = settings?.targetLanguage || 'en';
                        const level = profileTags?.level || '1';
                        const levelNum = parseInt(level, 10) || 1;
                        const label = getLevelLabel(targetLang, levelNum);
                        return `${label} - ${getLevelName(levelNum, t)}`;
                    })(),
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('level', t('settings.targetLevel'), profileTags?.level || '1'),
                },
                {
                    icon: 'language' as const,
                    iconColor: colors.accent[400],
                    title: t('settings.nativeLanguage'),
                    subtitle: (() => {
                        const code = profileTags?.nativeLanguage || 'tr';
                        const found = SUPPORTED_TARGET_LANGUAGES.find((l) => l.code === code);
                        return found ? `${found.flag} ${found.name}` : code;
                    })(),
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('native_language', t('settings.nativeLanguage'), profileTags?.nativeLanguage || 'tr'),
                },
                {
                    icon: 'trophy' as const,
                    iconColor: colors.warning.main,
                    title: t('settings.dailyGoal'),
                    subtitle: t('settings.wordsPerDay', { count: settings?.dailyGoal || 10 }),
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('daily_goal', t('settings.dailyGoal'), String(settings?.dailyGoal || 10)),
                },
                {
                    icon: 'notifications' as const,
                    iconColor: colors.error.main,
                    title: t('settings.reminders'),
                    subtitle: undefined as string | undefined,
                    type: 'switch' as const,
                    value: settings?.notificationsEnabled ?? true,
                    onToggle: handleNotificationToggle,
                },
            ],
        },
        {
            title: t('settings.profileTags'),
            items: [
                {
                    icon: 'briefcase' as const,
                    iconColor: '#6366F1',
                    title: t('settings.profession'),
                    subtitle: profileTags?.profession || t('settings.notSet'),
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('profession', t('settings.profession'), profileTags?.profession || ''),
                },
                {
                    icon: 'heart' as const,
                    iconColor: '#EF4444',
                    title: t('settings.interests'),
                    subtitle: profileTags?.interests?.length
                        ? profileTags.interests.join(', ')
                        : t('settings.interestsPlaceholder'),
                    type: 'nav' as const,
                    onPress: () => navigateToSettingModal('interests', t('settings.interests'), profileTags?.interests?.join(', ') || ''),
                },
            ],
        },
        {
            title: t('settings.data'),
            items: [
                {
                    icon: 'trash' as const,
                    iconColor: colors.error.main,
                    title: t('settings.resetAllData'),
                    subtitle: t('settings.resetAllDataDesc'),
                    type: 'nav' as const,
                    onPress: () => {
                        Alert.alert(
                            t('settings.resetAllData'),
                            t('settings.resetConfirm'),
                            [
                                { text: t('common.cancel'), style: 'cancel' },
                                {
                                    text: t('common.reset'),
                                    style: 'destructive',
                                    onPress: () => Alert.alert(t('common.info'), t('settings.resetInfo')),
                                },
                            ],
                        );
                    },
                },
            ],
        },
        {
            title: t('settings.about'),
            items: [
                {
                    icon: 'information-circle' as const,
                    iconColor: tc.textMuted,
                    title: t('settings.version'),
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

function getLevelName(level: number, t: (key: string) => string): string {
    const keys: Record<number, string> = {
        1: 'settings.level.beginner',
        2: 'settings.level.elementary',
        3: 'settings.level.intermediate',
        4: 'settings.level.upperIntermediate',
        5: 'settings.level.advanced',
        6: 'settings.level.mastery',
    };
    return keys[level] ? t(keys[level]) : `Level ${level}`;
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
