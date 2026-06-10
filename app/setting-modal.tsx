import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../src/shared/i18n';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import HybridLLMManager, { type CloudProvider } from '../src/shared/api/llm/HybridLLMManager';
import {
    cefrToLevel,
    getLanguageName,
    getLevelLabel,
    getLevelOptions,
    SUPPORTED_NATIVE_LANGUAGES,
    SUPPORTED_TARGET_LANGUAGES,
} from '../src/shared/lib/languageConfig';
import { getVectorStore } from '../src/shared/api/rag/VectorStore';
import { getApiKeys, setApiKeys } from '../src/shared/lib/apiKeyStore';
import { createStarterDeck, getUserSettings } from '../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, spacing, typography } from '../src/shared/lib/theme';

const DAILY_GOALS = [5, 10, 15, 20, 30, 50];

const CLOUD_PROVIDERS: { key: CloudProvider; label: string; subtitle: string }[] = [
    { key: 'openai', label: 'OpenAI', subtitle: 'GPT-4o-mini (default)' },
    { key: 'gemini', label: 'Google Gemini', subtitle: 'Gemini 2.0 Flash' },
    { key: 'custom', label: 'Custom / Microsoft AI', subtitle: 'Microsoft Foundation, Groq, Deepseek…' },
];

function detectProvider(key: string): CloudProvider {
    if (key.startsWith('sk-')) return 'openai';
    if (key.startsWith('AI') || key.startsWith('ai')) return 'gemini';
    return 'custom';
}

export default function SettingModalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ type: string; title: string; currentValue: string }>();
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;

    const { t } = useTranslation();
    const [textValue, setTextValue] = useState(params.currentValue || '');
    const [selectedValue, setSelectedValue] = useState(params.currentValue || '');

    // API key screen specific state
    const [selectedProvider, setSelectedProvider] = useState<CloudProvider>('gemini');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [customBaseUrl, setCustomBaseUrl] = useState('');
    const [customModel, setCustomModel] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleApiKeyChange = (key: string) => {
        setTextValue(key);
        // Auto-suggest provider based on key format
        if (key.length > 4) {
            setSelectedProvider(detectProvider(key));
        }
    };

    const handlePaste = async () => {
        const text = await Clipboard.getStringAsync();
        if (text?.trim()) {
            handleApiKeyChange(text.trim());
        } else {
            Alert.alert(t('common.error'), t('settingModal.apiKey.pasteEmpty'));
        }
    };

    const openKeyPage = () => {
        WebBrowser.openBrowserAsync('https://aistudio.google.com/app/apikey');
    };

    // Auto-fill existing keys when opening the API key page
    useEffect(() => {
        getApiKeys().then((keys) => {
            if (params.type === 'api_key') {
                // For API Key modal, default to the explicitly active provider, or fallback
                const fallbackActive = keys.custom?.apiKey ? 'custom' : keys.gemini ? 'gemini' : 'openai';
                const currentActive = keys.activeProvider || fallbackActive;
                
                if (currentActive === 'custom' && keys.custom?.apiKey) {
                    setSelectedProvider('custom');
                    setTextValue(keys.custom.apiKey);
                    setCustomBaseUrl(keys.custom.baseUrl || '');
                    setCustomModel(keys.custom.model || '');
                    setShowAdvanced(true); // existing non-Gemini key → reveal advanced
                } else if (currentActive === 'gemini' && keys.gemini) {
                    setSelectedProvider('gemini');
                    setTextValue(keys.gemini);
                } else if (keys.openai) {
                    setSelectedProvider('openai');
                    setTextValue(keys.openai);
                    setShowAdvanced(true); // existing non-Gemini key → reveal advanced
                }
            }
        });
    }, [params.type]);

    // After a level/target-language change, offer to create a matching starter deck.
    const offerStarterDeck = (
        targetLanguage: string,
        level: number,
        nativeLanguage: string,
        profession: string,
        interests: string[],
    ) => {
        if (getVectorStore(targetLanguage, nativeLanguage).isEmpty) return; // no base words for this pair
        const langName = getLanguageName(targetLanguage);
        const levelLabel = getLevelLabel(targetLanguage, level);
        Alert.alert(
            t('settingModal.newDeck.title'),
            t('settingModal.newDeck.message', { lang: langName, level: levelLabel }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('settingModal.newDeck.create'),
                    onPress: () => {
                        createStarterDeck({
                            targetLanguage,
                            nativeLanguage,
                            level,
                            interests,
                            profession,
                            deckName: `${langName} ${levelLabel}`,
                        }).catch(() => {});
                    },
                },
            ],
        );
    };

    const save = async () => {
        try {
            const settings = await getUserSettings();
            if (!settings) {
                Alert.alert(t('common.error'), t('settingModal.settingsNotFound'));
                return;
            }

            switch (params.type) {
                case 'api_key': {
                    const key = textValue.trim();
                    if (!key) {
                        Alert.alert(t('common.error'), t('settingModal.apiKey.enterKey'));
                        return;
                    }
                    if (selectedProvider === 'custom' && !customBaseUrl.trim()) {
                        Alert.alert(t('common.error'), t('settingModal.apiKey.enterBaseUrl'));
                        return;
                    }

                    setIsSaving(true);
                    const baseUrl = customBaseUrl.trim() || undefined;
                    const model = customModel.trim() || undefined;
                    const result = await HybridLLMManager.getInstance().configureCloudAndValidate(
                        key,
                        selectedProvider,
                        baseUrl,
                        model,
                    );
                    setIsSaving(false);

                    if (!result.success) {
                        Alert.alert(
                            t('settingModal.apiKey.connectionFailed'),
                            result.error || t('settingModal.apiKey.connectionFailedDesc'),
                        );
                        return;
                    }

                    // Full replace in secure storage: only the active provider's config
                    // is kept, so requests can't be misrouted to a stale endpoint.
                    if (selectedProvider === 'custom') {
                        await setApiKeys({
                            activeProvider: 'custom',
                            custom: {
                                apiKey: key,
                                baseUrl: customBaseUrl.trim(),
                                model: customModel.trim() || 'gpt-4o-mini',
                            },
                        });
                    } else if (selectedProvider === 'openai') {
                        await setApiKeys({ activeProvider: 'openai', openai: key });
                    } else {
                        await setApiKeys({ activeProvider: 'gemini', gemini: key });
                    }
                    useProfileStore.getState().setCloudAvailable(true);
                    useProfileStore.getState().setActiveModel('cloud');
                    break;
                }
                case 'target_language': {
                    await settings.updateSettings({ targetLanguage: selectedValue });
                    useProfileStore.getState().setTargetLanguage(selectedValue);
                    const tTags = settings.profileTags;
                    offerStarterDeck(
                        selectedValue,
                        cefrToLevel(tTags.level || '3'),
                        settings.nativeLanguage || 'tr',
                        tTags.profession || '',
                        tTags.interests || [],
                    );
                    break;
                }
                case 'level': {
                    await settings.updateProfileTags({ level: selectedValue });
                    useProfileStore.getState().setProfile({
                        ...useProfileStore.getState(),
                        level: selectedValue,
                    });
                    const lTags = settings.profileTags;
                    offerStarterDeck(
                        settings.targetLanguage || 'en',
                        parseInt(selectedValue, 10) || 3,
                        settings.nativeLanguage || 'tr',
                        lTags.profession || '',
                        lTags.interests || [],
                    );
                    break;
                }
                case 'native_language': {
                    await settings.updateSettings({ nativeLanguage: selectedValue || 'tr' });
                    const tags = settings.profileTags;
                    await settings.updateProfileTags({ ...tags, nativeLanguage: selectedValue || 'tr' });
                    useProfileStore.getState().setProfile({
                        ...useProfileStore.getState(),
                        nativeLanguage: selectedValue || 'tr',
                    });
                    // Sync UI language
                    if (selectedValue && selectedValue !== i18n.language) {
                        i18n.changeLanguage(selectedValue);
                    }
                    break;
                }
                case 'daily_goal': {
                    const goal = parseInt(selectedValue, 10) || 10;
                    await settings.updateSettings({ dailyGoal: goal });
                    useProfileStore.getState().setDailyGoal(goal);
                    break;
                }
                case 'profession': {
                    await settings.updateProfileTags({ profession: textValue.trim() });
                    useProfileStore.getState().setProfile({
                        ...useProfileStore.getState(),
                        profession: textValue.trim(),
                    });
                    break;
                }
                case 'interests': {
                    const interests = textValue
                        .split(',')
                        .map((i) => i.trim())
                        .filter(Boolean);
                    await settings.updateProfileTags({ interests });
                    useProfileStore.getState().setProfile({
                        ...useProfileStore.getState(),
                        interests,
                    });
                    break;
                }
            }
            router.back();
        } catch {
            setIsSaving(false);
            Alert.alert(t('common.error'), t('settingModal.saveFailed'));
        }
    };

    const renderContent = () => {
        switch (params.type) {
            case 'api_key':
                return (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.description, { color: tc.textSecondary }]}>
                            {t('settingModal.apiKey.simpleDescription')}
                        </Text>

                        {/* Free badge */}
                        <View style={[styles.freeBadge, { backgroundColor: colors.success.main + '18' }]}>
                            <Ionicons name="gift-outline" size={16} color={colors.success.main} />
                            <Text style={[styles.freeBadgeText, { color: colors.success.main }]}>
                                {t('settingModal.apiKey.freeBadge')}
                            </Text>
                        </View>

                        {/* Get a free Gemini key */}
                        <TouchableOpacity
                            style={[styles.getKeyButton, { backgroundColor: colors.primary[500] }]}
                            onPress={openKeyPage}
                        >
                            <Ionicons name="open-outline" size={18} color="#fff" />
                            <Text style={styles.getKeyButtonText}>{t('settingModal.apiKey.getFreeKey')}</Text>
                        </TouchableOpacity>

                        {/* 3-step guide */}
                        <View style={styles.steps}>
                            <Text style={[styles.stepText, { color: tc.textSecondary }]}>{t('settingModal.apiKey.step1')}</Text>
                            <Text style={[styles.stepText, { color: tc.textSecondary }]}>{t('settingModal.apiKey.step2')}</Text>
                            <Text style={[styles.stepText, { color: tc.textSecondary }]}>{t('settingModal.apiKey.step3')}</Text>
                        </View>

                        {/* Key input + paste */}
                        <Text style={[styles.label, { color: tc.textMuted, marginTop: spacing.md }]}>
                            {t('settingModal.apiKey.label')}
                        </Text>
                        <View style={styles.keyRow}>
                            <TextInput
                                style={[
                                    styles.input,
                                    styles.keyInput,
                                    { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border },
                                ]}
                                placeholder={
                                    selectedProvider === 'openai'
                                        ? 'sk-...'
                                        : selectedProvider === 'gemini'
                                          ? 'AIzaSy...'
                                          : t('settingModal.apiKey.yourKey')
                                }
                                placeholderTextColor={tc.textMuted}
                                value={textValue}
                                onChangeText={handleApiKeyChange}
                                secureTextEntry
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <TouchableOpacity
                                style={[styles.pasteButton, { backgroundColor: tc.surface, borderColor: tc.border }]}
                                onPress={handlePaste}
                                accessibilityLabel={t('settingModal.apiKey.paste')}
                            >
                                <Ionicons name="clipboard-outline" size={20} color={colors.primary[400]} />
                            </TouchableOpacity>
                        </View>

                        {/* Advanced settings toggle */}
                        <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced((v) => !v)}>
                            <Ionicons
                                name={showAdvanced ? 'chevron-down' : 'chevron-forward'}
                                size={16}
                                color={tc.textMuted}
                            />
                            <Text style={[styles.advancedToggleText, { color: tc.textMuted }]}>
                                {t('settingModal.apiKey.advanced')}
                            </Text>
                        </TouchableOpacity>

                        {showAdvanced && (
                            <>
                                <Text style={[styles.label, { color: tc.textMuted }]}>{t('settingModal.apiKey.provider')}</Text>
                                <View style={styles.providerRow}>
                                    {CLOUD_PROVIDERS.map((p) => (
                                        <TouchableOpacity
                                            key={p.key}
                                            style={[
                                                styles.providerChip,
                                                {
                                                    backgroundColor:
                                                        selectedProvider === p.key ? colors.primary[500] : tc.surface,
                                                    borderColor:
                                                        selectedProvider === p.key ? colors.primary[500] : tc.border,
                                                },
                                            ]}
                                            onPress={() => setSelectedProvider(p.key)}
                                        >
                                            <Text
                                                style={[
                                                    styles.providerChipText,
                                                    { color: selectedProvider === p.key ? '#fff' : tc.text },
                                                ]}
                                            >
                                                {p.label}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.providerChipSub,
                                                    {
                                                        color:
                                                            selectedProvider === p.key
                                                                ? 'rgba(255,255,255,0.75)'
                                                                : tc.textMuted,
                                                    },
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {p.subtitle}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {selectedProvider === 'custom' && (
                                    <>
                                        <Text style={[styles.label, { color: tc.textMuted, marginTop: spacing.md }]}>
                                            {t('settingModal.apiKey.baseUrl')}
                                        </Text>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border },
                                            ]}
                                            placeholder="Örn: https://models.inference.ai.azure.com"
                                            placeholderTextColor={tc.textMuted}
                                            value={customBaseUrl}
                                            onChangeText={setCustomBaseUrl}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            keyboardType="url"
                                        />
                                        <Text style={[styles.hint, { color: tc.textMuted }]}>
                                            {t('settingModal.apiKey.baseUrlHint')}
                                        </Text>

                                        <Text style={[styles.label, { color: tc.textMuted, marginTop: spacing.md }]}>
                                            {t('settingModal.apiKey.modelName')}
                                        </Text>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border },
                                            ]}
                                            placeholder="gpt-4o-mini"
                                            placeholderTextColor={tc.textMuted}
                                            value={customModel}
                                            onChangeText={setCustomModel}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                    </>
                                )}
                            </>
                        )}

                        <Text style={[styles.hint, { color: tc.textMuted, marginTop: spacing.sm }]}>
                            {t('settingModal.apiKey.hint')}
                        </Text>
                    </Animated.View>
                );

            case 'target_language':
                return (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.description, { color: tc.textSecondary }]}>
                            {t('settingModal.targetLanguage.desc')}
                        </Text>
                        {SUPPORTED_TARGET_LANGUAGES.map((lang) => (
                            <TouchableOpacity
                                key={lang.code}
                                style={[
                                    styles.optionCard,
                                    {
                                        backgroundColor: tc.surface,
                                        borderColor:
                                            selectedValue === lang.code ? colors.primary[500] : tc.border,
                                        borderWidth: selectedValue === lang.code ? 2 : 1,
                                    },
                                ]}
                                onPress={() => setSelectedValue(lang.code)}
                            >
                                <View>
                                    <Text style={[styles.optionTitle, { color: tc.text }]}>
                                        {lang.flag} {lang.name}
                                    </Text>
                                    <Text style={[styles.optionSubtitle, { color: tc.textSecondary }]}>
                                        {lang.nativeName}
                                    </Text>
                                </View>
                                {selectedValue === lang.code && (
                                    <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </Animated.View>
                );

            case 'level': {
                const targetLang = useProfileStore.getState().targetLanguage || 'en';
                const levelOpts = getLevelOptions(targetLang);
                return (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.description, { color: tc.textSecondary }]}>
                            {t('settingModal.level.desc')}
                        </Text>
                        <View style={styles.gridWrap}>
                            {levelOpts.map(({ level, label }) => (
                                <TouchableOpacity
                                    key={level}
                                    style={[
                                        styles.gridItem,
                                        {
                                            backgroundColor:
                                                selectedValue === String(level)
                                                    ? colors.primary[500]
                                                    : tc.surface,
                                            borderColor:
                                                selectedValue === String(level)
                                                    ? colors.primary[500]
                                                    : tc.border,
                                        },
                                    ]}
                                    onPress={() => setSelectedValue(String(level))}
                                >
                                    <Text
                                        style={[
                                            styles.gridItemText,
                                            { color: selectedValue === String(level) ? '#fff' : tc.text },
                                        ]}
                                    >
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>
                );
            }

            case 'daily_goal':
                return (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.description, { color: tc.textSecondary }]}>
                            {t('settingModal.dailyGoal.desc')}
                        </Text>
                        <View style={styles.gridWrap}>
                            {DAILY_GOALS.map((goal) => (
                                <TouchableOpacity
                                    key={goal}
                                    style={[
                                        styles.gridItem,
                                        {
                                            backgroundColor:
                                                selectedValue === String(goal)
                                                    ? colors.primary[500]
                                                    : tc.surface,
                                            borderColor:
                                                selectedValue === String(goal)
                                                    ? colors.primary[500]
                                                    : tc.border,
                                        },
                                    ]}
                                    onPress={() => setSelectedValue(String(goal))}
                                >
                                    <Text
                                        style={[
                                            styles.gridItemText,
                                            {
                                                color:
                                                    selectedValue === String(goal) ? '#fff' : tc.text,
                                            },
                                        ]}
                                    >
                                        {goal}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>
                );

            case 'profession':
                return (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.description, { color: tc.textSecondary }]}>
                            {t('settingModal.profession.desc')}
                        </Text>
                        <Text style={[styles.label, { color: tc.textMuted }]}>{t('settingModal.profession.label')}</Text>
                        <TextInput
                            style={[
                                styles.input,
                                { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border },
                            ]}
                            placeholder={t('settingModal.profession.placeholder')}
                            placeholderTextColor={tc.textMuted}
                            value={textValue}
                            onChangeText={setTextValue}
                        />
                    </Animated.View>
                );

            case 'interests':
                return (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.description, { color: tc.textSecondary }]}>
                            {t('settingModal.interests.desc')}
                        </Text>
                        <Text style={[styles.label, { color: tc.textMuted }]}>{t('settingModal.interests.label')}</Text>
                        <TextInput
                            style={[
                                styles.input,
                                styles.multilineInput,
                                { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border },
                            ]}
                            placeholder={t('settingModal.interests.placeholder')}
                            placeholderTextColor={tc.textMuted}
                            value={textValue}
                            onChangeText={setTextValue}
                            multiline
                        />
                    </Animated.View>
                );

            case 'native_language':
                return (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.description, { color: tc.textSecondary }]}>
                            {t('settingModal.nativeLanguage.desc')}
                        </Text>
                        {SUPPORTED_NATIVE_LANGUAGES.map((lang) => (
                            <TouchableOpacity
                                key={lang.code}
                                style={[
                                    styles.optionCard,
                                    {
                                        backgroundColor: tc.surface,
                                        borderColor:
                                            selectedValue === lang.code ? colors.primary[500] : tc.border,
                                        borderWidth: selectedValue === lang.code ? 2 : 1,
                                    },
                                ]}
                                onPress={() => setSelectedValue(lang.code)}
                            >
                                <View>
                                    <Text style={[styles.optionTitle, { color: tc.text }]}>
                                        {lang.flag} {lang.name}
                                    </Text>
                                    <Text style={[styles.optionSubtitle, { color: tc.textSecondary }]}>
                                        {lang.nativeName}
                                    </Text>
                                </View>
                                {selectedValue === lang.code && (
                                    <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </Animated.View>
                );

            default:
                return null;
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: tc.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Header */}
            <View
                style={[
                    styles.header,
                    { backgroundColor: tc.surface, borderBottomColor: tc.border },
                ]}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.headerButton}
                    disabled={isSaving}
                >
                    <Ionicons name="close" size={24} color={isSaving ? tc.textMuted : tc.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: tc.text }]}>
                    {params.title || t('settingModal.setting')}
                </Text>
                <TouchableOpacity
                    onPress={save}
                    disabled={isSaving}
                    style={[
                        styles.headerButton,
                        styles.saveButton,
                        { backgroundColor: isSaving ? colors.primary[300] : colors.primary[500] },
                    ]}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>
                            {params.type === 'api_key' ? t('settingModal.testAndSave') : t('common.save')}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {renderContent()}
            </ScrollView>
        </KeyboardAvoidingView>
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
    },
    headerTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '700',
    },
    saveButton: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        minWidth: 90,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: typography.fontSize.base,
    },
    content: {
        padding: spacing.base,
        paddingBottom: spacing['3xl'],
    },
    description: {
        fontSize: typography.fontSize.base,
        lineHeight: 22,
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: typography.fontSize.xs,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: spacing.sm,
    },
    input: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        fontSize: typography.fontSize.base,
    },
    multilineInput: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    hint: {
        fontSize: typography.fontSize.xs,
        marginTop: spacing.sm,
    },
    freeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
    },
    freeBadgeText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    getKeyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
    },
    getKeyButtonText: {
        color: '#fff',
        fontSize: typography.fontSize.base,
        fontWeight: '700',
    },
    steps: {
        gap: spacing.xs,
        marginTop: spacing.md,
    },
    stepText: {
        fontSize: typography.fontSize.sm,
        lineHeight: 20,
    },
    keyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    keyInput: {
        flex: 1,
    },
    pasteButton: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    advancedToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        marginTop: spacing.xs,
    },
    advancedToggleText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    providerRow: {
        gap: spacing.sm,
    },
    providerChip: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        marginBottom: 2,
    },
    providerChipText: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
    },
    providerChipSub: {
        fontSize: typography.fontSize.xs,
        marginTop: 2,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.base,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
    },
    optionTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
    },
    optionSubtitle: {
        fontSize: typography.fontSize.sm,
        marginTop: 2,
    },
    gridWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    gridItem: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        minWidth: 80,
        alignItems: 'center',
    },
    gridItemText: {
        fontSize: typography.fontSize.md,
        fontWeight: '700',
    },
});
