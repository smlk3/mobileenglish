import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import i18n from '../src/shared/i18n';
import {
    getLevelOptions,
    SUPPORTED_NATIVE_LANGUAGES,
    SUPPORTED_TARGET_LANGUAGES,
} from '../src/shared/lib/languageConfig';
import { createStarterDeck, getUserSettings } from '../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, spacing, typography } from '../src/shared/lib/theme';

type Step = 0 | 1 | 2;

export default function OnboardingScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;

    const [step, setStep] = useState<Step>(0);

    // Step 2: Language
    const [nativeLang, setNativeLang] = useState('');
    const [targetLang, setTargetLang] = useState('');
    const [level, setLevel] = useState(3);

    // Step 3: Profile
    const [profession, setProfession] = useState('');
    const [interests, setInterests] = useState('');

    const handleNativeSelect = (code: string) => {
        setNativeLang(code);
        // Change UI language immediately
        i18n.changeLanguage(code);
    };

    const handleComplete = async () => {
        try {
            const settings = await getUserSettings();
            if (!settings) return;

            // Save all settings
            await settings.updateSettings({
                nativeLanguage: nativeLang || 'tr',
                targetLanguage: targetLang || 'en',
                onboardingCompleted: true,
            });

            await settings.updateProfileTags({
                level: String(level),
                nativeLanguage: nativeLang || 'tr',
                profession: profession.trim(),
                interests: interests
                    .split(',')
                    .map((i) => i.trim())
                    .filter(Boolean),
            });

            // Update store
            const parsedInterests = interests.split(',').map((i) => i.trim()).filter(Boolean);
            const store = useProfileStore.getState();
            store.setProfile({
                profession: profession.trim(),
                interests: parsedInterests,
                level: String(level),
                nativeLanguage: nativeLang || 'tr',
                goals: [],
            });
            store.setTargetLanguage(targetLang || 'en');
            store.setOnboardingCompleted(true);

            // Create personalized starter deck from wordlist
            await createStarterDeck({
                targetLanguage: targetLang || 'en',
                nativeLanguage: nativeLang || 'tr',
                level,
                interests: parsedInterests,
                profession: profession.trim(),
                deckName: t('onboarding.starterDeckName'),
            });

            router.replace('/(tabs)');
        } catch (error) {
            console.error('Onboarding save failed:', error);
        }
    };

    const levelOptions = getLevelOptions(targetLang || 'en');

    // ── Step 0: Welcome ──────────────────────────────────
    const renderWelcome = () => (
        <Animated.View entering={FadeInDown.duration(600)} style={styles.centerContent}>
            <Text style={styles.mascot}>🐴</Text>
            <Text style={[styles.welcomeTitle, { color: tc.text }]}>
                {t('onboarding.welcome.title')}
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: tc.textSecondary }]}>
                {t('onboarding.welcome.subtitle')}
            </Text>
            <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary[500] }]}
                onPress={() => setStep(1)}
                activeOpacity={0.85}
            >
                <Text style={styles.primaryBtnText}>{t('onboarding.welcome.getStarted')}</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
        </Animated.View>
    );

    // ── Step 1: Language Selection ───────────────────────
    const renderLanguage = () => (
        <Animated.View entering={SlideInRight.duration(400)} style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: tc.text }]}>
                {t('onboarding.language.title')}
            </Text>

            {/* Native Language */}
            <Text style={[styles.label, { color: tc.textMuted }]}>
                {t('onboarding.language.nativeLabel').toUpperCase()}
            </Text>
            <View style={styles.langGrid}>
                {SUPPORTED_NATIVE_LANGUAGES.map((lang) => (
                    <TouchableOpacity
                        key={lang.code}
                        style={[
                            styles.langChip,
                            {
                                backgroundColor: nativeLang === lang.code ? colors.primary[500] : tc.surface,
                                borderColor: nativeLang === lang.code ? colors.primary[500] : tc.border,
                            },
                        ]}
                        onPress={() => handleNativeSelect(lang.code)}
                    >
                        <Text style={styles.langFlag}>{lang.flag}</Text>
                        <Text style={[styles.langName, { color: nativeLang === lang.code ? '#fff' : tc.text }]}>
                            {lang.nativeName}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Target Language */}
            <Text style={[styles.label, { color: tc.textMuted, marginTop: spacing.xl }]}>
                {t('onboarding.language.targetLabel').toUpperCase()}
            </Text>
            <View style={styles.langGrid}>
                {SUPPORTED_TARGET_LANGUAGES.map((lang) => (
                    <TouchableOpacity
                        key={lang.code}
                        style={[
                            styles.langChip,
                            {
                                backgroundColor: targetLang === lang.code ? colors.accent[500] : tc.surface,
                                borderColor: targetLang === lang.code ? colors.accent[500] : tc.border,
                            },
                        ]}
                        onPress={() => setTargetLang(lang.code)}
                    >
                        <Text style={styles.langFlag}>{lang.flag}</Text>
                        <Text style={[styles.langName, { color: targetLang === lang.code ? '#fff' : tc.text }]}>
                            {lang.nativeName}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Level */}
            {targetLang && (
                <Animated.View entering={FadeInDown.duration(300)}>
                    <Text style={[styles.label, { color: tc.textMuted, marginTop: spacing.xl }]}>
                        {t('onboarding.language.levelLabel').toUpperCase()}
                    </Text>
                    <View style={styles.chipRow}>
                        {levelOptions.map(({ level: lv, label }) => (
                            <TouchableOpacity
                                key={lv}
                                style={[
                                    styles.levelChip,
                                    {
                                        backgroundColor: level === lv ? colors.primary[500] : tc.surface,
                                        borderColor: level === lv ? colors.primary[500] : tc.border,
                                    },
                                ]}
                                onPress={() => setLevel(lv)}
                            >
                                <Text style={[styles.levelText, { color: level === lv ? '#fff' : tc.text }]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>
            )}

            <TouchableOpacity
                style={[
                    styles.primaryBtn,
                    {
                        backgroundColor: nativeLang && targetLang ? colors.primary[500] : tc.border,
                        marginTop: spacing['2xl'],
                    },
                ]}
                onPress={() => setStep(2)}
                disabled={!nativeLang || !targetLang}
                activeOpacity={0.85}
            >
                <Text style={styles.primaryBtnText}>{t('common.next')}</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
        </Animated.View>
    );

    // ── Step 2: Profile ──────────────────────────────────
    const renderProfile = () => (
        <Animated.View entering={SlideInRight.duration(400)} style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: tc.text }]}>
                {t('onboarding.profile.title')}
            </Text>
            <Text style={[styles.stepSubtitle, { color: tc.textSecondary }]}>
                {t('onboarding.profile.subtitle')}
            </Text>

            <Text style={[styles.label, { color: tc.textMuted }]}>
                {t('onboarding.profile.professionLabel').toUpperCase()}
            </Text>
            <TextInput
                style={[styles.input, { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border }]}
                placeholder={t('onboarding.profile.professionPlaceholder')}
                placeholderTextColor={tc.textMuted}
                value={profession}
                onChangeText={setProfession}
            />

            <Text style={[styles.label, { color: tc.textMuted, marginTop: spacing.lg }]}>
                {t('onboarding.profile.interestsLabel').toUpperCase()}
            </Text>
            <TextInput
                style={[
                    styles.input,
                    styles.multilineInput,
                    { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border },
                ]}
                placeholder={t('onboarding.profile.interestsPlaceholder')}
                placeholderTextColor={tc.textMuted}
                value={interests}
                onChangeText={setInterests}
                multiline
            />

            <View style={styles.profileActions}>
                <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: tc.border }]}
                    onPress={handleComplete}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.secondaryBtnText, { color: tc.textSecondary }]}>
                        {t('common.skip')}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.primary[500], flex: 1 }]}
                    onPress={handleComplete}
                    activeOpacity={0.85}
                >
                    <Text style={styles.primaryBtnText}>{t('onboarding.profile.complete')}</Text>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: tc.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Progress dots */}
            <View style={styles.dotsRow}>
                {[0, 1, 2].map((i) => (
                    <View
                        key={i}
                        style={[
                            styles.dot,
                            {
                                backgroundColor: i <= step ? colors.primary[500] : tc.border,
                                width: i === step ? 24 : 8,
                            },
                        ]}
                    />
                ))}
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {step === 0 && renderWelcome()}
                {step === 1 && renderLanguage()}
                {step === 2 && renderProfile()}
            </ScrollView>

            {/* Back button for steps > 0 */}
            {step > 0 && (
                <TouchableOpacity
                    style={[styles.backBtn, { backgroundColor: tc.surface }]}
                    onPress={() => setStep((step - 1) as Step)}
                >
                    <Ionicons name="arrow-back" size={20} color={tc.text} />
                </TouchableOpacity>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        padding: spacing.base,
        paddingBottom: spacing['3xl'],
    },
    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
        paddingTop: 60,
        paddingBottom: spacing.md,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing['2xl'],
    },
    mascot: {
        fontSize: 80,
        marginBottom: spacing.xl,
    },
    welcomeTitle: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    welcomeSubtitle: {
        fontSize: typography.fontSize.base,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing['3xl'],
    },
    stepContent: {
        paddingTop: spacing.lg,
    },
    stepTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: '800',
        marginBottom: spacing.sm,
    },
    stepSubtitle: {
        fontSize: typography.fontSize.base,
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    label: {
        fontSize: typography.fontSize.xs,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: spacing.sm,
    },
    langGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    langChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        minWidth: '47%',
        gap: spacing.sm,
    },
    langFlag: {
        fontSize: 20,
    },
    langName: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    levelChip: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        minWidth: 70,
        alignItems: 'center',
    },
    levelText: {
        fontSize: typography.fontSize.md,
        fontWeight: '700',
    },
    input: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        fontSize: typography.fontSize.base,
    },
    multilineInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.base,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: typography.fontSize.md,
        fontWeight: '700',
    },
    secondaryBtn: {
        paddingVertical: spacing.base,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
    },
    secondaryBtnText: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
    },
    profileActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: spacing['2xl'],
    },
    backBtn: {
        position: 'absolute',
        top: 58,
        left: spacing.base,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
