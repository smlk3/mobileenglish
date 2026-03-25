import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
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

// ─── Levenshtein distance for typo tolerance ──────────────
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Timer per question: base 15s + 1s per letter
function getTimeLimit(word: string) {
    return Math.min(15 + word.length, 40);
}

type Phase = 'loading' | 'error' | 'question' | 'feedback' | 'results';
type FeedbackType = 'correct' | 'almost' | 'wrong';

export default function QuizSpellScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ deckId?: string; deckName?: string }>();
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;

    const [phase, setPhase] = useState<Phase>('loading');
    const [cards, setCards] = useState<Card[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [input, setInput] = useState('');
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [almostCount, setAlmostCount] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0); // per question
    const [hintsLeft, setHintsLeft] = useState(3);
    const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
    const [feedback, setFeedback] = useState<FeedbackType>('correct');
    const [timeLeft, setTimeLeft] = useState(30);
    const [cleanStreak, setCleanStreak] = useState(0); // no hints streak
    const [startTime] = useState(Date.now());

    const inputRef = useRef<TextInput>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // XP state
    const awardXP = useXPStore((s) => s.awardXP);
    const totalXP = useXPStore((s) => s.totalXP);
    const [xpToast, setXpToast] = useState({ visible: false, amount: 0, label: '' });
    const [levelUpData, setLevelUpData] = useState<{ visible: boolean; level: number }>({ visible: false, level: 1 });
    const [badgeQueue, setBadgeQueue] = useState<string[]>([]);
    const [activeBadge, setActiveBadge] = useState<string | null>(null);

    useEffect(() => {
        if (!activeBadge && badgeQueue.length > 0 && !levelUpData.visible) {
            setActiveBadge(badgeQueue[0]);
            setBadgeQueue((q) => q.slice(1));
        }
    }, [activeBadge, badgeQueue, levelUpData.visible]);

    const handleXPAward = useCallback(async (amount: number, label: string, context = {}) => {
        if (amount === 0) { await awardXP(0, context); return; }
        const result = await awardXP(amount, context);
        setXpToast({ visible: true, amount: result.xpAwarded, label });
        if (result.leveledUp) setTimeout(() => setLevelUpData({ visible: true, level: result.newLevel }), 1900);
        if (result.newBadges.length > 0) setBadgeQueue((q) => [...q, ...result.newBadges]);
    }, [awardXP]);

    // Animations
    const scoreScale = useSharedValue(1);
    const shakeX = useSharedValue(0);
    const questionOpacity = useSharedValue(1);
    const questionTranslateY = useSharedValue(0);
    const timerWidth = useSharedValue(1); // 1 = full, 0 = empty

    useEffect(() => {
        const load = async () => {
            try {
                if (!params.deckId) { setPhase('error'); return; }
                const fetched = await fetchCardsByDeck(params.deckId);
                if (fetched.length === 0) { setPhase('error'); return; }
                const shuffled = shuffleArray(fetched);
                setCards(shuffled);
                startQuestion(shuffled[0]);
                setPhase('question');
            } catch {
                setPhase('error');
            }
        };
        load();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
        };
    }, [params.deckId]);

    const startQuestion = useCallback((card: Card) => {
        const limit = getTimeLimit(card.front);
        setTimeLeft(limit);
        setHintsUsed(0);
        setHintsLeft(3);
        setRevealedIndices(new Set());
        setInput('');
        timerWidth.value = withTiming(0, { duration: limit * 1000 });
    }, [timerWidth]);

    // Start timer
    useEffect(() => {
        if (phase !== 'question') {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    handleTimeOut();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase, currentIndex]);

    const handleTimeOut = useCallback(() => {
        setCombo(0);
        setCleanStreak(0);
        setFeedback('wrong');
        setPhase('feedback');
        feedbackTimeout.current = setTimeout(() => advanceQuestion(), 2000);
    }, []);

    const getComboMultiplier = (c: number) => {
        if (c >= 5) return 3;
        if (c >= 3) return 2;
        return 1;
    };

    const handleSubmit = useCallback(() => {
        if (phase !== 'question') return;
        Keyboard.dismiss();
        if (timerRef.current) clearInterval(timerRef.current);

        const card = cards[currentIndex];
        const target = card.front.toLowerCase().trim();
        const answer = input.toLowerCase().trim();
        const dist = levenshtein(target, answer);

        let type: FeedbackType;
        let gained = 0;

        if (dist === 0) {
            // Perfect
            type = 'correct';
            const mult = getComboMultiplier(combo + 1);
            const noHint = hintsUsed === 0;
            gained = Math.round((noHint ? XP.SPELL_CORRECT_NO_HINT : XP.SPELL_CORRECT_WITH_HINT) * mult);
            const comboLabel = (combo + 1) >= 5 ? 'Combo x3 🔥' : (combo + 1) >= 3 ? 'Combo x2 ⚡' : '';
            handleXPAward(gained, comboLabel, { isComboX3: (combo + 1) >= 5 });
            setCombo((c) => c + 1);
            setCorrectCount((c) => c + 1);
            if (noHint) setCleanStreak((c) => c + 1);
            else setCleanStreak(0);
        } else if (dist === 1) {
            // Almost
            type = 'almost';
            gained = XP.SPELL_ALMOST;
            handleXPAward(gained, 'Almost! 👋');
            setAlmostCount((c) => c + 1);
            setCombo(0);
            setCleanStreak(0);
        } else {
            // Wrong
            type = 'wrong';
            setCombo(0);
            setCleanStreak(0);
        }

        if (gained > 0) {
            setScore((s) => s + gained);
            scoreScale.value = withSequence(
                withSpring(1.4, { damping: 6 }),
                withSpring(1, { damping: 10 }),
            );
        } else {
            shakeX.value = withSequence(
                withTiming(-10, { duration: 60 }),
                withTiming(10, { duration: 60 }),
                withTiming(-8, { duration: 60 }),
                withTiming(8, { duration: 60 }),
                withSpring(0),
            );
        }

        setFeedback(type);
        setPhase('feedback');
        feedbackTimeout.current = setTimeout(() => advanceQuestion(), 2000);
    }, [phase, cards, currentIndex, input, combo, hintsUsed, scoreScale, shakeX]);

    const advanceQuestion = useCallback(() => {
        const next = currentIndex + 1;
        if (next < cards.length) {
            questionOpacity.value = withTiming(0, { duration: 180 });
            questionTranslateY.value = withTiming(-20, { duration: 180 });
            setTimeout(() => {
                setCurrentIndex(next);
                startQuestion(cards[next]);
                setPhase('question');
                questionOpacity.value = 0;
                questionTranslateY.value = 20;
                questionOpacity.value = withTiming(1, { duration: 280 });
                questionTranslateY.value = withSpring(0, { damping: 12 });
                setTimeout(() => inputRef.current?.focus(), 100);
            }, 200);
        } else {
            finishSession();
        }
    }, [currentIndex, cards, startQuestion, questionOpacity, questionTranslateY]);

    const finishSession = useCallback(async () => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const isPerfectSession = correctCount === cards.length && almostCount === 0;
        try {
            await recordStudySession({
                deckId: params.deckId || 'all',
                cardsStudied: cards.length,
                cardsCorrect: correctCount,
                durationSeconds: elapsed,
                sessionType: 'quiz',
            });
        } catch { /* ignore */ }
        // Award perfect bonus
        if (isPerfectSession) {
            handleXPAward(XP.SPELL_PERFECT_BONUS, '🌟 Perfect Spelling!', {
                isPerfectSpelling: true,
                isPerfectQuiz: true,
                isSessionEnd: true,
            });
        } else {
            // still mark session end for non-perfect
            awardXP(0, { isSessionEnd: true }).catch(() => {});
        }
        setPhase('results');
    }, [startTime, params.deckId, cards.length, correctCount, almostCount, handleXPAward]);

    // ─── Hint handlers ────────────────────────────────────
    const handleHint = useCallback((type: 'first' | 'length' | 'letter') => {
        if (hintsLeft <= 0 || phase !== 'question') return;
        const card = cards[currentIndex];
        const word = card.front;

        if (type === 'first') {
            setInput(word[0]);
        } else if (type === 'length') {
            // Don't change input, but reveals length visually (done via revealedIndices with dummy -1)
            setRevealedIndices((prev) => {
                const next = new Set(prev);
                next.add(-1); // sentinel for "length hint used"
                return next;
            });
        } else if (type === 'letter') {
            // Reveal a random unrevealed letter (not the first if already revealed)
            const unrevealed = Array.from({ length: word.length }, (_, i) => i)
                .filter((i) => !revealedIndices.has(i) && i > 0);
            if (unrevealed.length > 0) {
                const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
                setRevealedIndices((prev) => new Set([...prev, pick]));
            }
        }

        setHintsLeft((h) => h - 1);
        setHintsUsed((h) => h + 1);
    }, [hintsLeft, phase, cards, currentIndex, revealedIndices]);

    // ─── Animated styles ──────────────────────────────────
    const scoreStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scoreScale.value }],
    }));
    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeX.value }],
    }));
    const questionStyle = useAnimatedStyle(() => ({
        opacity: questionOpacity.value,
        transform: [{ translateY: questionTranslateY.value }],
    }));
    const timerBarStyle = useAnimatedStyle(() => ({
        width: `${timerWidth.value * 100}%` as any,
    }));

    // ─── Loading ──────────────────────────────────────────
    if (phase === 'loading') {
        return (
            <View style={[styles.center, { backgroundColor: tc.background }]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text style={[styles.loadingText, { color: tc.textSecondary }]}>Preparing quiz...</Text>
            </View>
        );
    }

    // ─── Error ────────────────────────────────────────────
    if (phase === 'error') {
        return (
            <View style={[styles.center, { backgroundColor: tc.background }]}>
                <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>⚠️</Text>
                <Text style={[styles.errorTitle, { color: tc.text }]}>No Cards Found</Text>
                <Text style={[styles.errorSubtitle, { color: tc.textSecondary }]}>
                    Add some cards to this deck first.
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

    // ─── Results ──────────────────────────────────────────
    if (phase === 'results') {
        const accuracy = cards.length > 0 ? Math.round((correctCount / cards.length) * 100) : 0;
        const emoji = accuracy >= 80 ? '🏆' : accuracy >= 50 ? '👍' : '💪';
        const isPerfect = correctCount === cards.length && almostCount === 0;
        return (
            <View style={[styles.container, { backgroundColor: tc.background }]}>
                <Animated.View entering={FadeInDown.duration(600)} style={styles.resultsContent}>
                    <Text style={{ fontSize: 72, marginBottom: spacing.sm }}>{isPerfect ? '🌟' : emoji}</Text>
                    {isPerfect && (
                        <Animated.View
                            entering={FadeIn.delay(300)}
                            style={[styles.perfectBadge, { backgroundColor: colors.warning.main + '25' }]}
                        >
                            <Text style={[styles.perfectText, { color: colors.warning.main }]}>
                                ✨ Perfect — No Hints Used!
                            </Text>
                        </Animated.View>
                    )}
                    <Text style={[styles.resultsTitle, { color: tc.text }]}>Spelling Complete!</Text>
                    <Text style={[styles.resultsSubtitle, { color: tc.textSecondary }]}>
                        {params.deckName || 'Deck'}
                    </Text>

                    <View style={[styles.statsGrid, { backgroundColor: tc.surface }]}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.primary[400] }]}>{score}</Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Score</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: tc.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.success.main }]}>{correctCount}</Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Correct</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: tc.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.warning.main }]}>{almostCount}</Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Almost</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: tc.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: tc.text }]}>{accuracy}%</Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Accuracy</Text>
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

    const currentCard = cards[currentIndex];
    if (!currentCard) return null;
    const word = currentCard.front;
    const timeLimit = getTimeLimit(word);
    const timePct = timeLeft / timeLimit;
    const timerColor = timePct > 0.5
        ? colors.success.main
        : timePct > 0.25
            ? colors.warning.main
            : colors.error.main;

    // Hint: length slot display
    const lengthHintUsed = revealedIndices.has(-1);
    const showLengthSlots = lengthHintUsed || revealedIndices.size > 1;

    // Feedback overlay
    const feedbackConfig = {
        correct: { color: colors.success.main, icon: 'checkmark-circle' as const, label: 'Correct! 🎉', bg: colors.success.main + '18' },
        almost: { color: colors.warning.main, icon: 'alert-circle' as const, label: `Almost! "${word}"`, bg: colors.warning.main + '18' },
        wrong: { color: colors.error.main, icon: 'close-circle' as const, label: `"${word}"`, bg: colors.error.main + '18' },
    };
    const fb = feedbackConfig[feedback];

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: tc.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={20}
        >
            <XPToast amount={xpToast.amount} label={xpToast.label} visible={xpToast.visible} onHide={() => setXpToast((t) => ({ ...t, visible: false }))} />
            <LevelUpModal visible={levelUpData.visible} newLevel={getLevelFromXP(totalXP)} totalXP={totalXP} onClose={() => setLevelUpData({ visible: false, level: 1 })} />
            <BadgeToast badge={activeBadge ? getBadgeById(activeBadge) ?? null : null} visible={!!activeBadge} onHide={() => setActiveBadge(null)} />
            {/* Header */}
            <Animated.View entering={FadeIn} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={26} color={tc.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <View style={[styles.progressTrack, { backgroundColor: tc.border }]}>
                        <View
                            style={[
                                styles.progressFill,
                                { backgroundColor: colors.primary[500], width: `${((currentIndex + 1) / cards.length) * 100}%` },
                            ]}
                        />
                    </View>
                    <Text style={[styles.progressText, { color: tc.textMuted }]}>
                        {currentIndex + 1} / {cards.length}
                    </Text>
                </View>
                <Animated.View style={styles.scoreBox}>
                    <Animated.Text style={[styles.scoreText, { color: colors.primary[400] }, scoreStyle]}>
                        {score}
                    </Animated.Text>
                    {combo >= 3 && (
                        <Animated.View
                            entering={FadeIn}
                            style={[styles.comboBadge, { backgroundColor: colors.warning.main + '25' }]}
                        >
                            <Text style={[styles.comboText, { color: colors.warning.main }]}>
                                x{getComboMultiplier(combo)} 🔥
                            </Text>
                        </Animated.View>
                    )}
                </Animated.View>
            </Animated.View>

            {/* Timer bar */}
            <View style={[styles.timerTrack, { backgroundColor: tc.border }]}>
                <Animated.View
                    style={[styles.timerFill, { backgroundColor: timerColor }, timerBarStyle]}
                />
            </View>
            <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}s</Text>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Animated.View style={questionStyle}>
                    {/* Question card */}
                    <View style={[styles.questionCard, { backgroundColor: tc.surface }]}>
                        <View style={[styles.cefrBadge, { backgroundColor: colors.primary[500] + '20' }]}>
                            <Text style={[styles.cefrText, { color: colors.primary[400] }]}>
                                {currentCard.cefrLevel}
                            </Text>
                        </View>
                        <Text style={[styles.questionLabel, { color: tc.textMuted }]}>
                            How do you spell this word?
                        </Text>
                        <Text style={[styles.meaningText, { color: tc.text }]}>
                            {currentCard.back}
                        </Text>
                        {currentCard.exampleSentence && (
                            <Text style={[styles.exampleText, { color: tc.textSecondary }]} numberOfLines={2}>
                                "{currentCard.exampleSentence.replace(
                                    new RegExp(currentCard.front, 'gi'),
                                    '___',
                                )}"
                            </Text>
                        )}

                        {/* Letter slots (shown when length or letter hint is used) */}
                        {showLengthSlots && (
                            <Animated.View entering={FadeIn} style={styles.slotsRow}>
                                {Array.from({ length: word.length }).map((_, i) => {
                                    const revealed = revealedIndices.has(i);
                                    const inputChar = input[i];
                                    return (
                                        <View
                                            key={i}
                                            style={[
                                                styles.slot,
                                                {
                                                    borderColor: revealed
                                                        ? colors.warning.main
                                                        : inputChar
                                                            ? colors.primary[400]
                                                            : tc.border,
                                                    backgroundColor: revealed
                                                        ? colors.warning.main + '20'
                                                        : tc.surfaceElevated,
                                                },
                                            ]}
                                        >
                                            <Text style={[styles.slotChar, { color: revealed ? colors.warning.main : tc.text }]}>
                                                {revealed ? word[i] : (inputChar || '')}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </Animated.View>
                        )}
                    </View>

                    {/* Feedback overlay */}
                    {phase === 'feedback' && (
                        <Animated.View
                            entering={FadeInDown.duration(250)}
                            style={[styles.feedbackBanner, { backgroundColor: fb.bg, borderColor: fb.color }]}
                        >
                            <Ionicons name={fb.icon} size={22} color={fb.color} />
                            <Text style={[styles.feedbackText, { color: fb.color }]}>{fb.label}</Text>
                        </Animated.View>
                    )}

                    {/* Input */}
                    <Animated.View style={shakeStyle}>
                        <TextInput
                            ref={inputRef}
                            style={[
                                styles.textInput,
                                {
                                    backgroundColor: tc.surface,
                                    color: tc.text,
                                    borderColor: phase === 'feedback'
                                        ? fb.color
                                        : input.length > 0
                                            ? colors.primary[400]
                                            : tc.border,
                                },
                            ]}
                            placeholder="Type the word..."
                            placeholderTextColor={tc.textMuted}
                            value={input}
                            onChangeText={setInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                            spellCheck={false}
                            editable={phase === 'question'}
                            onSubmitEditing={handleSubmit}
                            returnKeyType="done"
                            autoFocus
                        />
                    </Animated.View>

                    {/* Submit button */}
                    {phase === 'question' && (
                        <Animated.View entering={FadeInUp.duration(300)}>
                            <TouchableOpacity
                                style={[
                                    styles.submitBtn,
                                    { backgroundColor: input.trim().length > 0 ? colors.primary[500] : tc.border },
                                ]}
                                onPress={handleSubmit}
                                disabled={input.trim().length === 0}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.submitBtnText, { color: input.trim().length > 0 ? '#fff' : tc.textMuted }]}>
                                    Check Answer
                                </Text>
                                <Ionicons
                                    name="arrow-forward"
                                    size={18}
                                    color={input.trim().length > 0 ? '#fff' : tc.textMuted}
                                />
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {/* Hints */}
                    {phase === 'question' && (
                        <Animated.View entering={FadeIn.delay(400)} style={styles.hintsRow}>
                            <Text style={[styles.hintsLabel, { color: tc.textMuted }]}>
                                💡 Hints ({hintsLeft} left):
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.hintBtn,
                                    {
                                        backgroundColor: tc.surface,
                                        borderColor: hintsLeft > 0 ? colors.primary[300] : tc.border,
                                        opacity: hintsLeft > 0 ? 1 : 0.4,
                                    },
                                ]}
                                onPress={() => handleHint('first')}
                                disabled={hintsLeft === 0}
                            >
                                <Text style={[styles.hintBtnText, { color: hintsLeft > 0 ? colors.primary[400] : tc.textMuted }]}>
                                    1st Letter
                                </Text>
                                <Text style={[styles.hintCost, { color: tc.textMuted }]}>-3</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.hintBtn,
                                    {
                                        backgroundColor: tc.surface,
                                        borderColor: hintsLeft > 0 ? colors.accent[400] : tc.border,
                                        opacity: hintsLeft > 0 ? 1 : 0.4,
                                    },
                                ]}
                                onPress={() => handleHint('length')}
                                disabled={hintsLeft === 0}
                            >
                                <Text style={[styles.hintBtnText, { color: hintsLeft > 0 ? colors.accent[400] : tc.textMuted }]}>
                                    Length
                                </Text>
                                <Text style={[styles.hintCost, { color: tc.textMuted }]}>-2</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.hintBtn,
                                    {
                                        backgroundColor: tc.surface,
                                        borderColor: hintsLeft > 0 ? colors.warning.main : tc.border,
                                        opacity: hintsLeft > 0 ? 1 : 0.4,
                                    },
                                ]}
                                onPress={() => handleHint('letter')}
                                disabled={hintsLeft === 0}
                            >
                                <Text style={[styles.hintBtnText, { color: hintsLeft > 0 ? colors.warning.main : tc.textMuted }]}>
                                    A Letter
                                </Text>
                                <Text style={[styles.hintCost, { color: tc.textMuted }]}>-5</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
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
    loadingText: { marginTop: spacing.md },
    errorTitle: { fontSize: typography.fontSize.xl, fontWeight: '700', marginBottom: spacing.sm },
    errorSubtitle: { fontSize: typography.fontSize.base, textAlign: 'center', marginBottom: spacing['2xl'] },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingTop: 56,
        paddingBottom: spacing.sm,
        gap: spacing.sm,
    },
    backBtn: { padding: spacing.xs },
    headerCenter: { flex: 1 },
    progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 2 },
    progressFill: { height: '100%', borderRadius: 3 },
    progressText: { fontSize: typography.fontSize.xs, textAlign: 'center' },
    scoreBox: { alignItems: 'flex-end', minWidth: 60 },
    scoreText: { fontSize: typography.fontSize.lg, fontWeight: '800' },
    comboBadge: {
        marginTop: 2,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
    },
    comboText: { fontSize: typography.fontSize.xs, fontWeight: '800' },

    timerTrack: { height: 4, marginHorizontal: spacing.base, borderRadius: 2, overflow: 'hidden' },
    timerFill: { height: '100%', borderRadius: 2 },
    timerText: {
        fontSize: typography.fontSize.xs,
        fontWeight: '700',
        textAlign: 'right',
        paddingRight: spacing.base,
        marginTop: 2,
    },

    scroll: { flex: 1 },
    scrollContent: { padding: spacing.base, paddingBottom: 40 },

    questionCard: {
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        marginBottom: spacing.md,
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
    meaningText: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    exampleText: {
        fontSize: typography.fontSize.sm,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: spacing.xs,
    },

    slotsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 6,
        marginTop: spacing.lg,
    },
    slot: {
        width: 28,
        height: 32,
        borderRadius: 6,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotChar: { fontSize: typography.fontSize.base, fontWeight: '700' },

    feedbackBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.base,
        borderRadius: borderRadius.lg,
        borderWidth: 1.5,
        marginBottom: spacing.sm,
    },
    feedbackText: { fontSize: typography.fontSize.base, fontWeight: '700', flex: 1 },

    textInput: {
        fontSize: typography.fontSize.xl,
        fontWeight: '700',
        textAlign: 'center',
        borderWidth: 2,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.base,
        paddingHorizontal: spacing.xl,
        letterSpacing: 2,
        ...shadows.sm,
    },

    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing.md,
        paddingVertical: spacing.base,
        borderRadius: borderRadius.lg,
    },
    submitBtnText: { fontSize: typography.fontSize.base, fontWeight: '700' },

    hintsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.lg,
        flexWrap: 'wrap',
    },
    hintsLabel: { fontSize: typography.fontSize.xs, marginRight: spacing.xs },
    hintBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1.5,
    },
    hintBtnText: { fontSize: typography.fontSize.xs, fontWeight: '700' },
    hintCost: { fontSize: 10, fontWeight: '600' },

    // Results
    resultsContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    perfectBadge: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
    },
    perfectText: { fontSize: typography.fontSize.sm, fontWeight: '800' },
    resultsTitle: { fontSize: typography.fontSize['2xl'], fontWeight: '800', marginBottom: spacing.xs },
    resultsSubtitle: { fontSize: typography.fontSize.base, marginBottom: spacing['2xl'] },
    statsGrid: {
        flexDirection: 'row',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        width: '100%',
        marginBottom: spacing['2xl'],
        ...shadows.md,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: typography.fontSize.lg, fontWeight: '800' },
    statLabel: { fontSize: typography.fontSize.xs, marginTop: 2 },
    statDivider: { width: 1, height: 36, alignSelf: 'center' },
    doneBtn: {
        paddingVertical: spacing.base,
        paddingHorizontal: spacing['3xl'],
        borderRadius: borderRadius.full,
    },
    doneBtnText: { color: '#fff', fontSize: typography.fontSize.md, fontWeight: '700' },
});
