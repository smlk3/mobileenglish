import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
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
import HybridLLMManager from '../src/shared/api/llm/HybridLLMManager';
import { getUserSettings } from '../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, spacing, typography } from '../src/shared/lib/theme';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DAILY_GOALS = [5, 10, 15, 20, 30, 50];
const PROVIDERS = [
    { key: 'openai', label: 'OpenAI', subtitle: 'GPT-4o-mini' },
    { key: 'gemini', label: 'Google Gemini', subtitle: 'Gemini 2.0 Flash' },
];

export default function SettingModalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ type: string; title: string; currentValue: string }>();
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;

    const [textValue, setTextValue] = useState(params.currentValue || '');
    const [selectedValue, setSelectedValue] = useState(params.currentValue || '');

    const save = async () => {
        try {
            const settings = await getUserSettings();
            if (!settings) {
                Alert.alert('Error', 'Settings not found. Please restart the app.');
                return;
            }

            switch (params.type) {
                case 'api_key': {
                    if (!textValue.trim()) {
                        Alert.alert('Error', 'Please enter an API key.');
                        return;
                    }
                    const currentKeys = settings.apiKeys;
                    // Detect provider from key format (sk- = OpenAI, AI = Gemini)
                    if (textValue.trim().startsWith('sk-')) {
                        await settings.updateApiKeys({ ...currentKeys, openai: textValue.trim() });
                        HybridLLMManager.getInstance().configureCloud(textValue.trim(), 'openai');
                    } else {
                        await settings.updateApiKeys({ ...currentKeys, gemini: textValue.trim() });
                        HybridLLMManager.getInstance().configureCloud(textValue.trim(), 'gemini');
                    }
                    useProfileStore.getState().setCloudAvailable(true);
                    break;
                }
                case 'ai_provider': {
                    const keys = settings.apiKeys;
                    if (selectedValue === 'openai' && keys.openai) {
                        HybridLLMManager.getInstance().configureCloud(keys.openai, 'openai');
                    } else if (selectedValue === 'gemini' && keys.gemini) {
                        HybridLLMManager.getInstance().configureCloud(keys.gemini, 'gemini');
                    } else {
                        Alert.alert('Info', `No ${selectedValue === 'openai' ? 'OpenAI' : 'Gemini'} API key configured. Please add one first.`);
                        return;
                    }
                    break;
                }
                case 'level': {
                    const tags = settings.profileTags;
                    await settings.updateProfileTags({ ...tags, level: selectedValue });
                    useProfileStore.getState().setProfile({
                        ...useProfileStore.getState(),
                        level: selectedValue,
                    });
                    break;
                }
                case 'native_language': {
                    await settings.updateSettings({ nativeLanguage: textValue.trim() || 'tr' });
                    break;
                }
                case 'daily_goal': {
                    const goal = parseInt(selectedValue, 10) || 10;
                    await settings.updateSettings({ dailyGoal: goal });
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
        } catch (error) {
            Alert.alert('Error', 'Failed to save. Please try again.');
        }
    };

    const renderContent = () => {
        switch (params.type) {
            case 'api_key':
                return (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.description, { color: tc.textSecondary }]}>
                            Enter your API key to enable cloud AI features like personalized word generation and advanced chat.
                        </Text>
                        <Text style={[styles.label, { color: tc.textMuted }]}>API KEY</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border }]}
                            placeholder="sk-... or AI..."
                            placeholderTextColor={tc.textMuted}
                            value={textValue}
                            onChangeText={setTextValue}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <Text style={[styles.hint, { color: tc.textMuted }]}>
                            Keys starting with "sk-" will be used as OpenAI. Others will be used as Gemini.
                        </Text>
                    </Animated.View>
                );

            case 'ai_provider':
                return (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        {PROVIDERS.map((provider) => (
                            <TouchableOpacity
                                key={provider.key}
                                style={[
                                    styles.optionCard,
                                    {
                                        backgroundColor: tc.surface,
                                        borderColor: selectedValue === provider.key ? colors.primary[500] : tc.border,
                                        borderWidth: selectedValue === provider.key ? 2 : 1,
                                    },
                                ]}
                                onPress={() => setSelectedValue(provider.key)}
                            >
                                <View>
                                    <Text style={[styles.optionTitle, { color: tc.text }]}>{provider.label}</Text>
                                    <Text style={[styles.optionSubtitle, { color: tc.textSecondary }]}>{provider.subtitle}</Text>
                                </View>
                                {selectedValue === provider.key && (
                                    <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </Animated.View>
                );

            case 'level':
                return (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.description, { color: tc.textSecondary }]}>
                            Choose your current CEFR level. Words will be generated around this level.
                        </Text>
                        <View style={styles.gridWrap}>
                            {CEFR_LEVELS.map((level) => (
                                <TouchableOpacity
                                    key={level}
                                    style={[
                                        styles.gridItem,
                                        {
                                            backgroundColor: selectedValue === level ? colors.primary[500] : tc.surface,
                                            borderColor: selectedValue === level ? colors.primary[500] : tc.border,
                                        },
                                    ]}
                                    onPress={() => setSelectedValue(level)}
                                >
                                    <Text
                                        style={[
                                            styles.gridItemText,
                                            { color: selectedValue === level ? '#fff' : tc.text },
                                        ]}
                                    >
                                        {level}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>
                );

            case 'daily_goal':
                return (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.description, { color: tc.textSecondary }]}>
                            How many words do you want to study per day?
                        </Text>
                        <View style={styles.gridWrap}>
                            {DAILY_GOALS.map((goal) => (
                                <TouchableOpacity
                                    key={goal}
                                    style={[
                                        styles.gridItem,
                                        {
                                            backgroundColor: selectedValue === String(goal) ? colors.primary[500] : tc.surface,
                                            borderColor: selectedValue === String(goal) ? colors.primary[500] : tc.border,
                                        },
                                    ]}
                                    onPress={() => setSelectedValue(String(goal))}
                                >
                                    <Text
                                        style={[
                                            styles.gridItemText,
                                            { color: selectedValue === String(goal) ? '#fff' : tc.text },
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
                            Your profession helps us generate relevant vocabulary (e.g. medical, engineering, legal terms).
                        </Text>
                        <Text style={[styles.label, { color: tc.textMuted }]}>PROFESSION</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border }]}
                            placeholder="e.g. Software Engineer, Nurse, Teacher"
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
                            Add your interests separated by commas. We'll use these to personalize your vocabulary.
                        </Text>
                        <Text style={[styles.label, { color: tc.textMuted }]}>INTERESTS</Text>
                        <TextInput
                            style={[styles.input, styles.multilineInput, { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border }]}
                            placeholder="e.g. football, cooking, technology, travel"
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
                            Translations will be shown in your native language.
                        </Text>
                        {[
                            { key: 'tr', label: 'Turkish (Türkçe)' },
                            { key: 'en', label: 'English' },
                            { key: 'de', label: 'German (Deutsch)' },
                            { key: 'fr', label: 'French (Français)' },
                            { key: 'es', label: 'Spanish (Español)' },
                            { key: 'ar', label: 'Arabic (العربية)' },
                        ].map((lang) => (
                            <TouchableOpacity
                                key={lang.key}
                                style={[
                                    styles.optionCard,
                                    {
                                        backgroundColor: tc.surface,
                                        borderColor: textValue === lang.key ? colors.primary[500] : tc.border,
                                        borderWidth: textValue === lang.key ? 2 : 1,
                                    },
                                ]}
                                onPress={() => setTextValue(lang.key)}
                            >
                                <Text style={[styles.optionTitle, { color: tc.text }]}>{lang.label}</Text>
                                {textValue === lang.key && (
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
            <View style={[styles.header, { backgroundColor: tc.surface, borderBottomColor: tc.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                    <Ionicons name="close" size={24} color={tc.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: tc.text }]}>{params.title || 'Setting'}</Text>
                <TouchableOpacity
                    onPress={save}
                    style={[styles.headerButton, styles.saveButton, { backgroundColor: colors.primary[500] }]}
                >
                    <Text style={styles.saveButtonText}>Save</Text>
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
