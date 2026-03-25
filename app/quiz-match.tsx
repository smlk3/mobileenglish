import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
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

type Phase = 'loading' | 'error' | 'playing' | 'results';

interface Tile {
    id: string;
    text: string;
    cardId: string;
    side: 'front' | 'back';
    matched: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const BEST_TIME_KEY_PREFIX = 'match_best_';
const TILE_COUNT = 6; // pairs = 6 cards = 12 tiles total

export default function QuizMatchScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ deckId?: string; deckName?: string }>();
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;

    const [phase, setPhase] = useState<Phase>('loading');
    const [leftTiles, setLeftTiles] = useState<Tile[]>([]);
    const [rightTiles, setRightTiles] = useState<Tile[]>([]);
    const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
    const [selectedRight, setSelectedRight] = useState<string | null>(null);
    const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);
    const [matchedCount, setMatchedCount] = useState(0);
    const [totalMoves, setTotalMoves] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [bestTime, setBestTime] = useState<number | null>(null);
    const [finalTime, setFinalTime] = useState(0);
    const [totalPairs, setTotalPairs] = useState(0);
    const [startTime] = useState(Date.now());

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const wrongTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Shake animation for wrong pair tiles
    const shakeLeft = useSharedValue(0);
    const shakeRight = useSharedValue(0);

    useEffect(() => {
        const load = async () => {
            try {
                if (!params.deckId) { setPhase('error'); return; }
                const cards = await fetchCardsByDeck(params.deckId);
                if (cards.length < 2) { setPhase('error'); return; }

                const selected = shuffleArray(cards).slice(0, TILE_COUNT);
                setTotalPairs(selected.length);

                const left: Tile[] = shuffleArray(selected).map((c) => ({
                    id: `L_${c.id}`,
                    text: c.front,
                    cardId: c.id,
                    side: 'front',
                    matched: false,
                }));
                const right: Tile[] = shuffleArray(selected).map((c) => ({
                    id: `R_${c.id}`,
                    text: c.back,
                    cardId: c.id,
                    side: 'back',
                    matched: false,
                }));

                setLeftTiles(left);
                setRightTiles(right);

                // Load best time
                const bestKey = BEST_TIME_KEY_PREFIX + params.deckId;
                const stored = await AsyncStorage.getItem(bestKey);
                if (stored) setBestTime(parseInt(stored, 10));

                setPhase('playing');

                // Start timer
                timerRef.current = setInterval(() => {
                    setElapsedSeconds((prev) => prev + 1);
                }, 1000);
            } catch {
                setPhase('error');
            }
        };
        load();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (wrongTimeout.current) clearTimeout(wrongTimeout.current);
        };
    }, [params.deckId]);

    const handleLeftTap = (tile: Tile) => {
        if (tile.matched || wrongPair) return;
        setSelectedLeft(tile.id);
        if (selectedRight) checkMatch(tile.id, selectedRight);
    };

    const handleRightTap = (tile: Tile) => {
        if (tile.matched || wrongPair) return;
        setSelectedRight(tile.id);
        if (selectedLeft) checkMatch(selectedLeft, tile.id);
    };

    const checkMatch = (leftId: string, rightId: string) => {
        setTotalMoves((prev) => prev + 1);

        const leftCardId = leftId.replace('L_', '');
        const rightCardId = rightId.replace('R_', '');

        if (leftCardId === rightCardId) {
            // Correct match
            setLeftTiles((prev) =>
                prev.map((t) => (t.id === leftId ? { ...t, matched: true } : t)),
            );
            setRightTiles((prev) =>
                prev.map((t) => (t.id === rightId ? { ...t, matched: true } : t)),
            );
            setSelectedLeft(null);
            setSelectedRight(null);

            const newMatched = matchedCount + 1;
            setMatchedCount(newMatched);

            // XP per pair
            awardXP(XP.MATCH_PER_PAIR, { isPerfectQuiz: false }).then((result) => {
                setXpToast({ visible: true, amount: result.xpAwarded, label: '' });
                if (result.leveledUp) setTimeout(() => setLevelUpData({ visible: true, level: result.newLevel }), 1900);
                if (result.newBadges.length > 0) setBadgeQueue((q) => [...q, ...result.newBadges]);
            });

            if (newMatched === totalPairs) {
                if (timerRef.current) clearInterval(timerRef.current);
                setFinalTime(elapsedSeconds + 1);
                finishGame(elapsedSeconds + 1, newMatched);
            }
        } else {
            // Wrong match — shake + reset
            setWrongPair({ left: leftId, right: rightId });

            shakeLeft.value = withSequence(
                withTiming(-10, { duration: 60 }),
                withTiming(10, { duration: 60 }),
                withTiming(-8, { duration: 60 }),
                withTiming(8, { duration: 60 }),
                withSpring(0),
            );
            shakeRight.value = withSequence(
                withTiming(10, { duration: 60 }),
                withTiming(-10, { duration: 60 }),
                withTiming(8, { duration: 60 }),
                withTiming(-8, { duration: 60 }),
                withSpring(0),
            );

            wrongTimeout.current = setTimeout(() => {
                setSelectedLeft(null);
                setSelectedRight(null);
                setWrongPair(null);
            }, 800);
        }
    };

    const finishGame = async (timeTaken: number, matched: number) => {
        // Save best time
        const bestKey = BEST_TIME_KEY_PREFIX + params.deckId;
        const storedBest = await AsyncStorage.getItem(bestKey);
        const prevBest = storedBest ? parseInt(storedBest, 10) : null;
        if (prevBest === null || timeTaken < prevBest) {
            await AsyncStorage.setItem(bestKey, timeTaken.toString());
            setBestTime(timeTaken);
        }
        // Record session
        try {
            await recordStudySession({
                deckId: params.deckId || 'all',
                cardsStudied: matched,
                cardsCorrect: matched,
                durationSeconds: timeTaken,
                sessionType: 'quiz',
            });
        } catch { /* ignore */ }
        // Perfect bonus
        const result = await awardXP(XP.MATCH_PERFECT_BONUS, { isPerfectQuiz: true, isSessionEnd: true });
        setXpToast({ visible: true, amount: result.xpAwarded, label: '🌟 All Matched!' });
        if (result.leveledUp) setTimeout(() => setLevelUpData({ visible: true, level: result.newLevel }), 1900);
        if (result.newBadges.length > 0) setBadgeQueue((q) => [...q, ...result.newBadges]);
        setTimeout(() => setPhase('results'), 600);
    };

    const shakeLeftStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeLeft.value }],
    }));
    const shakeRightStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeRight.value }],
    }));

    // ─── Loading ───────────────────────────────────────────
    if (phase === 'loading') {
        return (
            <View style={[styles.center, { backgroundColor: tc.background }]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text style={[styles.loadingText, { color: tc.textSecondary }]}>
                    Loading cards...
                </Text>
            </View>
        );
    }

    // ─── Error ────────────────────────────────────────────
    if (phase === 'error') {
        return (
            <View style={[styles.center, { backgroundColor: tc.background }]}>
                <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>⚠️</Text>
                <Text style={[styles.errorTitle, { color: tc.text }]}>Not Enough Cards</Text>
                <Text style={[styles.errorSubtitle, { color: tc.textSecondary }]}>
                    You need at least 2 cards in this deck to play Matching.
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
        const isNewBest = bestTime !== null && finalTime <= bestTime;
        return (
            <View style={[styles.container, { backgroundColor: tc.background }]}>
                <Animated.View entering={FadeInDown.duration(600)} style={styles.resultsContent}>
                    <Text style={{ fontSize: 72, marginBottom: spacing.lg }}>
                        {isNewBest ? '🏆' : '🎉'}
                    </Text>
                    {isNewBest && (
                        <Animated.View
                            entering={FadeIn.delay(400)}
                            style={[styles.newBestBadge, { backgroundColor: colors.warning.main + '25' }]}
                        >
                            <Text style={[styles.newBestText, { color: colors.warning.main }]}>
                                🔥 New Best Time!
                            </Text>
                        </Animated.View>
                    )}
                    <Text style={[styles.resultsTitle, { color: tc.text }]}>All Matched!</Text>
                    <Text style={[styles.resultsSubtitle, { color: tc.textSecondary }]}>
                        {params.deckName || 'Deck'}
                    </Text>

                    <View style={[styles.statsRow, { backgroundColor: tc.surface }]}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.primary[400] }]}>
                                {formatTime(finalTime)}
                            </Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Time</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: tc.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.success.main }]}>
                                {totalPairs}
                            </Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Pairs</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: tc.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.warning.main }]}>
                                {totalMoves}
                            </Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Moves</Text>
                        </View>
                    </View>

                    {bestTime !== null && !isNewBest && (
                        <Text style={[styles.bestTimeInfo, { color: tc.textMuted }]}>
                            Best: {formatTime(bestTime)}
                        </Text>
                    )}

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

    // ─── Playing ──────────────────────────────────────────
    const progressPct = totalPairs > 0 ? matchedCount / totalPairs : 0;

    return (
        <View style={[styles.container, { backgroundColor: tc.background }]}>
            <XPToast amount={xpToast.amount} label={xpToast.label} visible={xpToast.visible} onHide={() => setXpToast((t) => ({ ...t, visible: false }))} />
            <LevelUpModal visible={levelUpData.visible} newLevel={getLevelFromXP(totalXP)} totalXP={totalXP} onClose={() => setLevelUpData({ visible: false, level: 1 })} />
            <BadgeToast badge={activeBadge ? getBadgeById(activeBadge) ?? null : null} visible={!!activeBadge} onHide={() => setActiveBadge(null)} />
            {/* Header */}
            <Animated.View entering={FadeIn} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={26} color={tc.text} />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: tc.text }]}>
                        {params.deckName || 'Matching'}
                    </Text>
                    <View style={[styles.progressTrack, { backgroundColor: tc.border }]}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    backgroundColor: colors.success.main,
                                    width: `${progressPct * 100}%`,
                                },
                            ]}
                        />
                    </View>
                    <Text style={[styles.progressText, { color: tc.textMuted }]}>
                        {matchedCount} / {totalPairs} matched
                    </Text>
                </View>

                {/* Timer */}
                <View style={styles.timerBox}>
                    <Ionicons name="time-outline" size={14} color={tc.textMuted} />
                    <Text style={[styles.timerText, { color: tc.textSecondary }]}>
                        {formatTime(elapsedSeconds)}
                    </Text>
                </View>
            </Animated.View>

            {/* Game board */}
            <View style={styles.board}>
                {/* Left column — keywords */}
                <Animated.View style={[styles.column, shakeLeftStyle]}>
                    {leftTiles.map((tile, idx) => {
                        const isSelected = selectedLeft === tile.id;
                        const isWrong = wrongPair?.left === tile.id;
                        let bg = tc.surface;
                        let borderC = tc.border;
                        if (tile.matched) { bg = colors.success.main + '18'; borderC = colors.success.main; }
                        else if (isWrong) { bg = colors.error.main + '18'; borderC = colors.error.main; }
                        else if (isSelected) { bg = colors.primary[500] + '20'; borderC = colors.primary[500]; }

                        return (
                            <Animated.View
                                key={tile.id}
                                entering={FadeInDown.delay(idx * 60).duration(300)}
                            >
                                <TouchableOpacity
                                    style={[styles.tile, { backgroundColor: bg, borderColor: borderC }]}
                                    onPress={() => handleLeftTap(tile)}
                                    activeOpacity={tile.matched ? 1 : 0.7}
                                    disabled={tile.matched}
                                >
                                    {tile.matched ? (
                                        <Ionicons name="checkmark-circle" size={20} color={colors.success.main} />
                                    ) : (
                                        <Text
                                            style={[styles.tileText, { color: isSelected || isWrong ? borderC : tc.text }]}
                                            numberOfLines={3}
                                        >
                                            {tile.text}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        );
                    })}
                </Animated.View>

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: tc.border }]} />

                {/* Right column — translations */}
                <Animated.View style={[styles.column, shakeRightStyle]}>
                    {rightTiles.map((tile, idx) => {
                        const isSelected = selectedRight === tile.id;
                        const isWrong = wrongPair?.right === tile.id;
                        let bg = tc.surface;
                        let borderC = tc.border;
                        if (tile.matched) { bg = colors.success.main + '18'; borderC = colors.success.main; }
                        else if (isWrong) { bg = colors.error.main + '18'; borderC = colors.error.main; }
                        else if (isSelected) { bg = colors.accent[500] + '25'; borderC = colors.accent[400]; }

                        return (
                            <Animated.View
                                key={tile.id}
                                entering={FadeInDown.delay(idx * 60 + 30).duration(300)}
                            >
                                <TouchableOpacity
                                    style={[styles.tile, { backgroundColor: bg, borderColor: borderC }]}
                                    onPress={() => handleRightTap(tile)}
                                    activeOpacity={tile.matched ? 1 : 0.7}
                                    disabled={tile.matched}
                                >
                                    {tile.matched ? (
                                        <Ionicons name="checkmark-circle" size={20} color={colors.success.main} />
                                    ) : (
                                        <Text
                                            style={[styles.tileText, { color: isSelected || isWrong ? borderC : tc.text }]}
                                            numberOfLines={3}
                                        >
                                            {tile.text}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        );
                    })}
                </Animated.View>
            </View>

            {/* Hint */}
            <Animated.View entering={FadeIn.delay(800)} style={styles.hintRow}>
                <Ionicons name="information-circle-outline" size={14} color={tc.textMuted} />
                <Text style={[styles.hintText, { color: tc.textMuted }]}>
                    Tap a word on the left, then its meaning on the right
                </Text>
            </Animated.View>
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
    headerTitle: { fontSize: typography.fontSize.sm, fontWeight: '700', marginBottom: 4 },
    progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 2 },
    progressFill: { height: '100%', borderRadius: 3 },
    progressText: { fontSize: typography.fontSize.xs },
    timerBox: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 50 },
    timerText: { fontSize: typography.fontSize.sm, fontWeight: '600' },

    board: {
        flex: 1,
        flexDirection: 'row',
        paddingHorizontal: spacing.sm,
        paddingBottom: spacing.sm,
        gap: 0,
    },
    column: {
        flex: 1,
        gap: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    divider: { width: 1, marginVertical: spacing.xs, alignSelf: 'stretch' },

    tile: {
        borderRadius: borderRadius.lg,
        borderWidth: 1.5,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 64,
        ...shadows.sm,
    },
    tileText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 18,
    },

    hintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        justifyContent: 'center',
        paddingBottom: 32,
        paddingHorizontal: spacing.xl,
    },
    hintText: { fontSize: typography.fontSize.xs, textAlign: 'center' },

    // Results
    resultsContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    newBestBadge: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
    },
    newBestText: { fontSize: typography.fontSize.sm, fontWeight: '800' },
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
        marginBottom: spacing.lg,
        ...shadows.md,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: typography.fontSize.xl, fontWeight: '800' },
    statLabel: { fontSize: typography.fontSize.xs, marginTop: 4 },
    statDivider: { width: 1, height: 40, alignSelf: 'center' },
    bestTimeInfo: { fontSize: typography.fontSize.sm, marginBottom: spacing.xl },

    doneBtn: {
        paddingVertical: spacing.base,
        paddingHorizontal: spacing['3xl'],
        borderRadius: borderRadius.full,
    },
    doneBtnText: { color: '#fff', fontSize: typography.fontSize.md, fontWeight: '700' },
});
