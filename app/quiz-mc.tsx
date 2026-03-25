import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import type Card from '../src/entities/Card/model';
import {
    fetchCardsByDeck,
    recordStudySession,
} from '../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';
import { useXPStore } from '../src/shared/lib/stores/useXPStore';
import { borderRadius, colors, shadows, spacing, typography } from '../src/shared/lib/theme';
import { XP, getBadgeById, getLevelFromXP } from '../src/shared/lib/xpSystem';
import { BadgeToast } from '../src/shared/ui/BadgeToast';
import { LevelUpModal } from '../src/shared/ui/LevelUpModal';
import { XPToast } from '../src/shared/ui/XPToast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Phase = 'loading' | 'error' | 'quiz' | 'feedback' | 'results';
type AnswerState = 'idle' | 'correct' | 'wrong';

interface Question {
    card: Card;
    choices: string[];
    correctIndex: number;
}

function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function buildQuestions(cards: Card[]): Question[] {
    return shuffleArray(cards).map((card) => {
        const wrongCards = cards.filter((c) => c.id !== card.id);
        const wrongChoices = shuffleArray(wrongCards)
            .slice(0, 3)
            .map((c) => c.back);
        const allChoices = shuffleArray([card.back, ...wrongChoices]);
        return {
            card,
            choices: allChoices,
            correctIndex: allChoices.indexOf(card.back),
        };
    });
}

export default function QuizMCScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ deckId?: string; deckName?: string }>();
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;

    const [phase, setPhase] = useState<Phase>('loading');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [answerStates, setAnswerStates] = useState<AnswerState[]>([]);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [startTime] = useState(Date.now());

    // XP / toast state
    const awardXP = useXPStore((s) => s.awardXP);
    const totalXP = useXPStore((s) => s.totalXP);
    const [xpToast, setXpToast] = useState({ visible: false, amount: 0, label: '' });
    const [levelUpData, setLevelUpData] = useState<{ visible: boolean; level: number }>({ visible: false, level: 1 });
    const [badgeQueue, setBadgeQueue] = useState<string[]>([]);
    const [activeBadge, setActiveBadge] = useState<string | null>(null);

    // Animation values
    const scoreScale = useSharedValue(1);
    const comboScale = useSharedValue(1);
    const questionOpacity = useSharedValue(1);
    const questionTranslateY = useSharedValue(0);

    const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Show badges one by one — wait for LevelUpModal to close first (UX #10)
    useEffect(() => {
        if (!activeBadge && badgeQueue.length > 0 && !levelUpData.visible) {
            setActiveBadge(badgeQueue[0]);
            setBadgeQueue((q) => q.slice(1));
        }
    }, [activeBadge, badgeQueue, levelUpData.visible]);

    const handleXPAward = useCallback(async (amount: number, label: string, context = {}) => {
        const result = await awardXP(amount, context);
        setXpToast({ visible: true, amount: result.xpAwarded, label });
        if (result.leveledUp) {
            setTimeout(() => setLevelUpData({ visible: true, level: result.newLevel }), 1900);
        }
        if (result.newBadges.length > 0) {
            setBadgeQueue((q) => [...q, ...result.newBadges]);
        }
    }, [awardXP]);

    useEffect(() => {
        const load = async () => {
            try {
                if (!params.deckId) {
                    setPhase('error');
                    return;
                }
                const cards = await fetchCardsByDeck(params.deckId);
                if (cards.length < 4) {
                    setPhase('error');
                    return;
                }
                const qs = buildQuestions(cards);
                setQuestions(qs);
                setAnswerStates(new Array(4).fill('idle'));
                setPhase('quiz');
            } catch {
                setPhase('error');
            }
        };
        load();
        return () => {
            if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
        };
    }, [params.deckId]);

    const currentQuestion = questions[currentIndex];

    const getComboMultiplier = useCallback((c: number) => {
        if (c >= 5) return 3;
        if (c >= 3) return 2;
        return 1;
    }, []);

    const handleAnswer = useCallback(
        (choiceIndex: number) => {
            if (selectedIndex !== null || phase === 'feedback') return;

            const q = questions[currentIndex];
            if (!q) return;

            const isCorrect = choiceIndex === q.correctIndex;
            // Use q.choices (not the outer `choices` var) to avoid stale closure
            const newStates: AnswerState[] = q.choices.map((_, i) => {
                if (i === q.correctIndex) return 'correct';
                if (i === choiceIndex && !isCorrect) return 'wrong';
                return 'idle';
            });

            setSelectedIndex(choiceIndex);
            setAnswerStates(newStates);
            setPhase('feedback');

            if (isCorrect) {
                const newCombo = combo + 1;
                const multiplier = getComboMultiplier(newCombo);
                // Bug #3 fix: use XP.MC_CORRECT instead of hardcoded 10
                const baseXP = XP.MC_CORRECT * multiplier;
                setScore((prev) => prev + baseXP);
                setCombo(newCombo);
                setCorrectCount((prev) => prev + 1);

                scoreScale.value = withSequence(
                    withSpring(1.4, { damping: 6 }),
                    withSpring(1, { damping: 10 }),
                );
                if (newCombo >= 3) {
                    comboScale.value = withSequence(
                        withSpring(1.3, { damping: 6 }),
                        withSpring(1, { damping: 10 }),
                    );
                }

                // Award XP (bonus stacks on top)
                const xpAmount = newCombo >= 5
                    ? XP.MC_CORRECT + XP.MC_COMBO_X3_BONUS
                    : newCombo >= 3
                        ? XP.MC_CORRECT + XP.MC_COMBO_X2_BONUS
                        : XP.MC_CORRECT;
                const comboLabel = newCombo >= 5 ? 'Combo x3 🔥' : newCombo >= 3 ? 'Combo x2 ⚡' : '';
                handleXPAward(xpAmount, comboLabel, { isComboX3: newCombo >= 5 });
            } else {
                setCombo(0);
            }

            feedbackTimeout.current = setTimeout(async () => {
                questionOpacity.value = withTiming(0, { duration: 200 });
                questionTranslateY.value = withTiming(-20, { duration: 200 });

                setTimeout(async () => {
                    const nextIndex = currentIndex + 1;
                    if (nextIndex < questions.length) {
                        setCurrentIndex(nextIndex);
                        setSelectedIndex(null);
                        setAnswerStates(new Array(4).fill('idle'));
                        setPhase('quiz');
                        questionOpacity.value = 0;
                        questionTranslateY.value = 20;
                        questionOpacity.value = withTiming(1, { duration: 300 });
                        questionTranslateY.value = withSpring(0, { damping: 12 });
                    } else {
                        // Session done
                        const elapsed = Math.round((Date.now() - startTime) / 1000);
                        try {
                            await recordStudySession({
                                deckId: params.deckId || 'all',
                                cardsStudied: questions.length,
                                cardsCorrect: isCorrect ? correctCount + 1 : correctCount,
                                durationSeconds: elapsed,
                                sessionType: 'quiz',
                            });
                        } catch {
                            // ignore
                        }
                        setPhase('results');
                        // Award perfect bonus at session end
                        const finalCorrect = isCorrect ? correctCount + 1 : correctCount;
                        const accuracy = Math.round((finalCorrect / questions.length) * 100);
                        if (accuracy === 100)
                            handleXPAward(XP.MC_PERFECT_BONUS, '🌟 Perfect!', {
                                isPerfectQuiz: true,
                                isSessionEnd: true,
                                // UX #7: pass streak (using 0 as placeholder — streak checked on home focus)
                            });
                        else if (accuracy >= 90)
                            handleXPAward(0, '', { isHighAccuracyMC: true, isSessionEnd: true });
                        else
                            // still mark session end even for normal finish
                            awardXP(0, { isSessionEnd: true }).catch(() => {});
                    }
                }, 220);
            }, 1200);
        },
        [
            selectedIndex,
            phase,
            currentQuestion,
            combo,
            currentIndex,
            questions,
            correctCount,
            startTime,
            params.deckId,
            getComboMultiplier,
            scoreScale,
            comboScale,
            questionOpacity,
            questionTranslateY,
        ],
    );

    const scoreStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scoreScale.value }],
    }));

    const comboStyle = useAnimatedStyle(() => ({
        transform: [{ scale: comboScale.value }],
    }));

    const questionStyle = useAnimatedStyle(() => ({
        opacity: questionOpacity.value,
        transform: [{ translateY: questionTranslateY.value }],
    }));

    // Loading
    if (phase === 'loading') {
        return (
            <View style={[styles.center, { backgroundColor: tc.background }]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text style={[styles.loadingText, { color: tc.textSecondary }]}>
                    Preparing quiz...
                </Text>
            </View>
        );
    }

    // Error
    if (phase === 'error') {
        return (
            <View style={[styles.center, { backgroundColor: tc.background }]}>
                <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>⚠️</Text>
                <Text style={[styles.errorTitle, { color: tc.text }]}>Not Enough Cards</Text>
                <Text style={[styles.errorSubtitle, { color: tc.textSecondary }]}>
                    You need at least 4 cards in this deck to start a Multiple Choice quiz.
                </Text>
                <TouchableOpacity
                    style={[styles.doneBtn, { backgroundColor: colors.primary[500] }]}
                    onPress={() => router.back()}
                >
                    <Text style={styles.doneBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Results
    if (phase === 'results') {
        const accuracy = Math.round((correctCount / questions.length) * 100);
        const emoji = accuracy >= 80 ? '🏆' : accuracy >= 50 ? '👍' : '💪';
        return (
            <View style={[styles.container, { backgroundColor: tc.background }]}>
                <Animated.View entering={FadeInDown.duration(600)} style={styles.resultsContent}>
                    <Text style={{ fontSize: 72, marginBottom: spacing.lg }}>{emoji}</Text>
                    <Text style={[styles.resultsTitle, { color: tc.text }]}>Quiz Complete!</Text>
                    <Text style={[styles.resultsSubtitle, { color: tc.textSecondary }]}>
                        {params.deckName || 'Deck'}
                    </Text>

                    <View style={[styles.statsRow, { backgroundColor: tc.surface }]}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.primary[400] }]}>
                                {score}
                            </Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Score</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: tc.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.success.main }]}>
                                {correctCount}
                            </Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Correct</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: tc.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.warning.main }]}>
                                {accuracy}%
                            </Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>
                                Accuracy
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.doneBtn, { backgroundColor: colors.primary[500] }]}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.doneBtnText}>Done</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    }

    if (!currentQuestion) return null;

    const { choices } = currentQuestion;
    const progress = (currentIndex + 1) / questions.length;
    const multiplier = getComboMultiplier(combo);

    return (
        <View style={[styles.container, { backgroundColor: tc.background }]}>
            {/* XP Toast */}
            <XPToast
                amount={xpToast.amount}
                label={xpToast.label}
                visible={xpToast.visible}
                onHide={() => setXpToast((t) => ({ ...t, visible: false }))}
            />
            {/* Level Up Modal */}
            <LevelUpModal
                visible={levelUpData.visible}
                newLevel={getLevelFromXP(totalXP)}
                totalXP={totalXP}
                onClose={() => setLevelUpData({ visible: false, level: 1 })}
            />
            {/* Badge Toast */}
            <BadgeToast
                badge={activeBadge ? getBadgeById(activeBadge) ?? null : null}
                visible={!!activeBadge}
                onHide={() => setActiveBadge(null)}
            />
            {/* Header */}
            <Animated.View entering={FadeIn} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={26} color={tc.text} />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    {/* Progress bar */}
                    <View style={[styles.progressTrack, { backgroundColor: tc.border }]}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    backgroundColor: colors.primary[500],
                                    width: `${progress * 100}%`,
                                },
                            ]}
                        />
                    </View>
                    <Text style={[styles.progressText, { color: tc.textMuted }]}>
                        {currentIndex + 1} / {questions.length}
                    </Text>
                </View>

                {/* Score + combo */}
                <View style={styles.scoreArea}>
                    <Animated.Text style={[styles.scoreText, { color: colors.primary[400] }, scoreStyle]}>
                        {score}
                    </Animated.Text>
                    {combo >= 3 && (
                        <Animated.View
                            style={[styles.comboBadge, { backgroundColor: colors.warning.main + '25' }, comboStyle]}
                        >
                            <Text style={[styles.comboText, { color: colors.warning.main }]}>
                                x{multiplier} 🔥
                            </Text>
                        </Animated.View>
                    )}
                </View>
            </Animated.View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Question card */}
                <Animated.View style={[styles.questionCard, { backgroundColor: tc.surface }, questionStyle]}>
                    <View style={[styles.cefrBadge, { backgroundColor: colors.primary[500] + '20' }]}>
                        <Text style={[styles.cefrText, { color: colors.primary[400] }]}>
                            {currentQuestion.card.cefrLevel}
                        </Text>
                    </View>
                    <Text style={[styles.questionLabel, { color: tc.textMuted }]}>
                        What does this mean?
                    </Text>
                    <Text style={[styles.questionWord, { color: tc.text }]}>
                        {currentQuestion.card.front}
                    </Text>
                    {currentQuestion.card.exampleSentence && (
                        <Text style={[styles.questionExample, { color: tc.textSecondary }]}>
                            "{currentQuestion.card.exampleSentence}"
                        </Text>
                    )}
                </Animated.View>

                {/* Choices */}
                <View style={styles.choicesGrid}>
                    {choices.map((choice, i) => {
                        const state = answerStates[i];
                        const isCorrectChoice = state === 'correct';
                        const isWrongChoice = state === 'wrong';

                        let bgColor = tc.surface;
                        let borderColor = tc.border;
                        let textColor = tc.text;

                        if (isCorrectChoice) {
                            bgColor = colors.success.main + '20';
                            borderColor = colors.success.main;
                            textColor = colors.success.main;
                        } else if (isWrongChoice) {
                            bgColor = colors.error.main + '20';
                            borderColor = colors.error.main;
                            textColor = colors.error.main;
                        }

                        return (
                            <Animated.View
                                key={i}
                                entering={FadeInUp.duration(300).delay(i * 60)}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.choiceBtn,
                                        { backgroundColor: bgColor, borderColor },
                                    ]}
                                    onPress={() => handleAnswer(i)}
                                    activeOpacity={0.75}
                                    disabled={selectedIndex !== null}
                                >
                                    <View style={[styles.choiceIndex, { backgroundColor: borderColor + '30' }]}>
                                        <Text style={[styles.choiceIndexText, { color: borderColor }]}>
                                            {String.fromCharCode(65 + i)}
                                        </Text>
                                    </View>
                                    <Text style={[styles.choiceText, { color: textColor }]} numberOfLines={3}>
                                        {choice}
                                    </Text>
                                    {isCorrectChoice && (
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={22}
                                            color={colors.success.main}
                                        />
                                    )}
                                    {isWrongChoice && (
                                        <Ionicons name="close-circle" size={22} color={colors.error.main} />
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.base },
    errorTitle: { fontSize: typography.fontSize.xl, fontWeight: '700', marginBottom: spacing.sm },
    errorSubtitle: {
        fontSize: typography.fontSize.base,
        textAlign: 'center',
        marginBottom: spacing['2xl'],
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingTop: 56,
        paddingBottom: spacing.md,
        gap: spacing.sm,
    },
    backBtn: { padding: spacing.xs },
    headerCenter: { flex: 1 },
    progressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressFill: { height: '100%', borderRadius: 3 },
    progressText: { fontSize: typography.fontSize.xs, textAlign: 'center' },
    scoreArea: { alignItems: 'flex-end', minWidth: 60 },
    scoreText: { fontSize: typography.fontSize.lg, fontWeight: '800' },
    comboBadge: {
        marginTop: 2,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
    },
    comboText: { fontSize: typography.fontSize.xs, fontWeight: '800' },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.base, paddingBottom: 40 },

    questionCard: {
        borderRadius: borderRadius.xl,
        padding: spacing['2xl'],
        marginBottom: spacing.lg,
        alignItems: 'center',
        ...shadows.md,
    },
    cefrBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
    },
    cefrText: { fontSize: typography.fontSize.xs, fontWeight: '700' },
    questionLabel: { fontSize: typography.fontSize.sm, marginBottom: spacing.sm },
    questionWord: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    questionExample: {
        fontSize: typography.fontSize.sm,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: spacing.xs,
    },

    choicesGrid: { gap: spacing.sm },
    choiceBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.base,
        borderRadius: borderRadius.lg,
        borderWidth: 1.5,
        gap: spacing.md,
        ...shadows.sm,
    },
    choiceIndex: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    choiceIndexText: { fontSize: typography.fontSize.sm, fontWeight: '800' },
    choiceText: { flex: 1, fontSize: typography.fontSize.base, fontWeight: '500' },

    resultsContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    resultsTitle: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: '800',
        marginBottom: spacing.xs,
    },
    resultsSubtitle: { fontSize: typography.fontSize.base, marginBottom: spacing['2xl'] },
    statsRow: {
        flexDirection: 'row',
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        width: '100%',
        marginBottom: spacing['2xl'],
        ...shadows.md,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: typography.fontSize.xl, fontWeight: '800' },
    statLabel: { fontSize: typography.fontSize.xs, marginTop: 4 },
    statDivider: { width: 1, height: 40, alignSelf: 'center' },

    doneBtn: {
        paddingVertical: spacing.base,
        paddingHorizontal: spacing['3xl'],
        borderRadius: borderRadius.full,
    },
    doneBtnText: { color: '#fff', fontSize: typography.fontSize.md, fontWeight: '700' },
});
