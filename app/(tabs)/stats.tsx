import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import {
    type DeckAccuracy,
    type DetailedStats,
    type DayStats,
    getDetailedStats,
} from '../../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../../src/shared/lib/stores/useProfileStore';
import { useXPStore } from '../../src/shared/lib/stores/useXPStore';
import { borderRadius, colors, shadows, spacing, typography } from '../../src/shared/lib/theme';
import { BADGES, getXPProgress } from '../../src/shared/lib/xpSystem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 120;
const CHART_WIDTH = SCREEN_WIDTH - spacing.base * 2 - spacing.xl * 2;

function formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function getLevelLabel(words: number): { label: string; color: string } {
    if (words < 100) return { label: 'Beginner', color: colors.success.main };
    if (words < 500) return { label: 'Elementary', color: colors.accent[400] };
    if (words < 1000) return { label: 'Intermediate', color: colors.primary[400] };
    if (words < 2000) return { label: 'Upper-Int.', color: colors.warning.main };
    return { label: 'Advanced', color: colors.error.main };
}

// ── Bar chart component ────────────────────────────────────
function BarChart({ days, dailyGoal }: { days: DayStats[]; dailyGoal: number }) {
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;
    const maxVal = Math.max(...days.map((d) => d.count), dailyGoal, 1);
    const todayLabel = days[days.length - 1]?.label;

    return (
        <View style={styles.chartContainer}>
            {/* Goal line */}
            <View
                style={[
                    styles.goalLine,
                    {
                        bottom: (dailyGoal / maxVal) * CHART_HEIGHT,
                        borderColor: colors.primary[400] + '60',
                    },
                ]}
            />
            <Text
                style={[
                    styles.goalLineLabel,
                    {
                        bottom: (dailyGoal / maxVal) * CHART_HEIGHT + 2,
                        color: colors.primary[400],
                    },
                ]}
            >
                Goal
            </Text>

            {/* Bars */}
            <View style={styles.barsRow}>
                {days.map((day, i) => {
                    const barH = day.count > 0 ? Math.max((day.count / maxVal) * CHART_HEIGHT, 4) : 0;
                    const isToday = day.label === todayLabel && i === days.length - 1;
                    const metGoal = day.count >= dailyGoal;
                    const barColor = metGoal
                        ? colors.success.main
                        : isToday
                            ? colors.primary[500]
                            : colors.primary[300] + '70';

                    return (
                        <Animated.View
                            key={day.date}
                            entering={FadeInUp.delay(i * 60).duration(400)}
                            style={styles.barCol}
                        >
                            <Text style={[styles.barCount, { color: day.count > 0 ? tc.textSecondary : 'transparent' }]}>
                                {day.count}
                            </Text>
                            <View style={[styles.barBg, { backgroundColor: tc.border }]}>
                                <View
                                    style={[
                                        styles.barFill,
                                        { height: barH, backgroundColor: barColor },
                                    ]}
                                />
                            </View>
                            <Text style={[styles.barLabel, { color: isToday ? colors.primary[400] : tc.textMuted, fontWeight: isToday ? '800' : '500' }]}>
                                {day.label}
                            </Text>
                        </Animated.View>
                    );
                })}
            </View>
        </View>
    );
}

// ── Circular progress component ────────────────────────────
function CircularProgress({ value, max, size = 80, color = colors.primary[500] }: {
    value: number; max: number; size?: number; color?: string;
}) {
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;
    const pct = Math.min(value / Math.max(max, 1), 1);
    const stroke = 8;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - pct);
    // SVG not available in RN without libraries. Use a custom View approach.
    const sweepAngle = pct * 360;

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {/* Background ring */}
            <View
                style={{
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: stroke,
                    borderColor: tc.border,
                }}
            />
            {/* Filled arc — approximated with a colored ring clipped to a half */}
            {[0, 1].map((half) => {
                const halfAngle = half === 0
                    ? Math.min(sweepAngle, 180)
                    : Math.max(sweepAngle - 180, 0);
                if (halfAngle === 0) return null;
                return (
                    <View
                        key={half}
                        style={{
                            position: 'absolute',
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            overflow: 'hidden',
                            transform: [{ rotate: `${half * 180}deg` }],
                        }}
                    >
                        <View
                            style={{
                                width: size,
                                height: size / 2,
                                overflow: 'hidden',
                            }}
                        >
                            <View
                                style={{
                                    width: size,
                                    height: size,
                                    borderRadius: size / 2,
                                    borderWidth: stroke,
                                    borderColor: color,
                                    transform: [{ rotate: `${halfAngle - 180}deg` }],
                                }}
                            />
                        </View>
                    </View>
                );
            })}
            {/* Center text */}
            <Text style={{ fontSize: 13, fontWeight: '800', color: tc.text }}>
                {Math.round(pct * 100)}%
            </Text>
        </View>
    );
}

export default function StatsScreen() {
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;

    // XP
    const totalXP = useXPStore((s) => s.totalXP);
    const earnedBadges = useXPStore((s) => s.earnedBadges);
    const xpProgress = getXPProgress(totalXP);

    const [stats, setStats] = useState<DetailedStats | null>(null);
    const [dailyGoal, setDailyGoal] = useState(10);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            const load = async () => {
                const { getHomeStats } = await import('../../src/shared/lib/stores/useDatabaseService');
                const [detailed, home] = await Promise.all([getDetailedStats(), getHomeStats()]);
                if (active) {
                    setStats(detailed);
                    setDailyGoal(home.dailyGoal);
                }
            };
            load();
            return () => { active = false; };
        }, []),
    );

    const tc7DaysMax = stats ? Math.max(...stats.last7Days.map((d) => d.count), dailyGoal, 1) : 1;
    const totalQuizCards = stats ? stats.sessionBreakdown.quiz : 0;
    const totalCards = stats ? stats.sessionBreakdown.flashcard + stats.sessionBreakdown.quiz : 0;
    const levelInfo = getLevelLabel(stats?.totalWordsLearned ?? 0);

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: tc.background }]}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* XP / Level card */}
            <Animated.View entering={FadeInDown.duration(500)} style={[styles.xpCard, { backgroundColor: xpProgress.current.color + '18', borderColor: xpProgress.current.color + '40' }]}>
                <View style={styles.xpCardHeader}>
                    <Text style={{ fontSize: 32 }}>{xpProgress.current.emoji}</Text>
                    <View style={styles.xpCardInfo}>
                        <Text style={[styles.xpLevelTitle, { color: xpProgress.current.color }]}>
                            Level {xpProgress.current.level} · {xpProgress.current.title}
                        </Text>
                        <Text style={[styles.xpTotalText, { color: tc.textMuted }]}>
                            {totalXP.toLocaleString()} total XP
                        </Text>
                    </View>
                </View>
                {xpProgress.next && (
                    <View style={styles.xpBarArea}>
                        <View style={[styles.xpBarBg, { backgroundColor: tc.border }]}>
                            <View style={[styles.xpBarFill, { width: `${Math.round(xpProgress.pct * 100)}%`, backgroundColor: xpProgress.current.color }]} />
                        </View>
                        <Text style={[styles.xpBarLabel, { color: tc.textMuted }]}>
                            {xpProgress.xpIntoLevel.toLocaleString()} / {xpProgress.xpForLevel.toLocaleString()} XP → {xpProgress.next.emoji} {xpProgress.next.title}
                        </Text>
                    </View>
                )}
            </Animated.View>

            {/* Overview cards */}
            <Animated.View entering={FadeInDown.duration(500)} style={styles.overviewGrid}>
                <View style={[styles.overviewCard, { backgroundColor: tc.surface }]}>
                    <Ionicons name="book" size={22} color={colors.primary[400]} />
                    <Text style={[styles.overviewValue, { color: tc.text }]}>
                        {stats?.totalWordsLearned ?? 0}
                    </Text>
                    <Text style={[styles.overviewLabel, { color: tc.textMuted }]}>Words Learned</Text>
                    <View style={[styles.levelBadge, { backgroundColor: levelInfo.color + '22' }]}>
                        <Text style={[styles.levelText, { color: levelInfo.color }]}>{levelInfo.label}</Text>
                    </View>
                </View>

                <View style={[styles.overviewCard, { backgroundColor: tc.surface }]}>
                    <Ionicons name="time" size={22} color={colors.accent[400]} />
                    <Text style={[styles.overviewValue, { color: tc.text }]}>
                        {formatTime(stats?.totalStudySeconds ?? 0)}
                    </Text>
                    <Text style={[styles.overviewLabel, { color: tc.textMuted }]}>Study Time</Text>
                    <Text style={[styles.overviewSub, { color: tc.textMuted }]}>
                        {stats?.totalSessions ?? 0} sessions
                    </Text>
                </View>

                <View style={[styles.overviewCard, { backgroundColor: tc.surface }]}>
                    <Ionicons name="flame" size={22} color={colors.warning.main} />
                    <Text style={[styles.overviewValue, { color: tc.text }]}>
                        {stats?.currentStreak ?? 0}
                    </Text>
                    <Text style={[styles.overviewLabel, { color: tc.textMuted }]}>Current Streak</Text>
                    <Text style={[styles.overviewSub, { color: tc.textMuted }]}>
                        Best: {stats?.longestStreak ?? 0} days
                    </Text>
                </View>

                <View style={[styles.overviewCard, { backgroundColor: tc.surface }]}>
                    <Ionicons name="trophy" size={22} color={colors.success.main} />
                    <Text style={[styles.overviewValue, { color: tc.text }]}>
                        {totalCards}
                    </Text>
                    <Text style={[styles.overviewLabel, { color: tc.textMuted }]}>Total Cards</Text>
                    <Text style={[styles.overviewSub, { color: tc.textMuted }]}>
                        {totalQuizCards} quiz
                    </Text>
                </View>
            </Animated.View>

            {/* 7-day chart */}
            <Animated.View entering={FadeInDown.delay(100).duration(500)} style={[styles.card, { backgroundColor: tc.surface }]}>
                <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: tc.text }]}>Last 7 Days</Text>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: colors.success.main }]} />
                        <Text style={[styles.legendText, { color: tc.textMuted }]}>Goal met</Text>
                        <View style={[styles.legendDot, { backgroundColor: colors.primary[400] }]} />
                        <Text style={[styles.legendText, { color: tc.textMuted }]}>Today</Text>
                    </View>
                </View>
                {stats && <BarChart days={stats.last7Days} dailyGoal={dailyGoal} />}
                {!stats && (
                    <View style={styles.chartEmpty}>
                        <Text style={{ color: tc.textMuted }}>Loading...</Text>
                    </View>
                )}
            </Animated.View>

            {/* Session type breakdown */}
            {stats && totalCards > 0 && (
                <Animated.View entering={FadeInDown.delay(200).duration(500)} style={[styles.card, { backgroundColor: tc.surface }]}>
                    <Text style={[styles.cardTitle, { color: tc.text }]}>Study Mode Breakdown</Text>
                    <View style={styles.breakdownRow}>
                        <View style={styles.breakdownItem}>
                            <CircularProgress
                                value={stats.sessionBreakdown.flashcard}
                                max={totalCards}
                                color={colors.primary[500]}
                            />
                            <Text style={[styles.breakdownLabel, { color: tc.text }]}>
                                {stats.sessionBreakdown.flashcard}
                            </Text>
                            <Text style={[styles.breakdownSub, { color: tc.textMuted }]}>Flashcard</Text>
                        </View>
                        <View style={[styles.breakdownDivider, { backgroundColor: tc.border }]} />
                        <View style={styles.breakdownItem}>
                            <CircularProgress
                                value={stats.sessionBreakdown.quiz}
                                max={totalCards}
                                color={colors.accent[400]}
                            />
                            <Text style={[styles.breakdownLabel, { color: tc.text }]}>
                                {stats.sessionBreakdown.quiz}
                            </Text>
                            <Text style={[styles.breakdownSub, { color: tc.textMuted }]}>Quiz / Spell</Text>
                        </View>
                    </View>
                </Animated.View>
            )}

            {/* Deck accuracy breakdown */}
            {stats && stats.deckAccuracies.length > 0 && (
                <Animated.View entering={FadeInDown.delay(300).duration(500)} style={[styles.card, { backgroundColor: tc.surface }]}>
                    <Text style={[styles.cardTitle, { color: tc.text }]}>Deck Accuracy</Text>
                    {stats.deckAccuracies.map((deck, i) => (
                        <Animated.View
                            key={deck.deckId}
                            entering={FadeInDown.delay(i * 60).duration(300)}
                            style={styles.deckRow}
                        >
                            <View style={styles.deckRowHeader}>
                                <Text style={[styles.deckName, { color: tc.text }]} numberOfLines={1}>
                                    {deck.deckName}
                                </Text>
                                <Text style={[styles.deckAccuracy, {
                                    color: deck.accuracy >= 80
                                        ? colors.success.main
                                        : deck.accuracy >= 50
                                            ? colors.warning.main
                                            : colors.error.main,
                                }]}>
                                    {deck.accuracy}%
                                </Text>
                            </View>
                            <View style={[styles.deckBarBg, { backgroundColor: tc.border }]}>
                                <Animated.View
                                    entering={FadeInDown.delay(i * 60 + 100)}
                                    style={[
                                        styles.deckBarFill,
                                        {
                                            width: `${deck.accuracy}%`,
                                            backgroundColor: deck.accuracy >= 80
                                                ? colors.success.main
                                                : deck.accuracy >= 50
                                                    ? colors.warning.main
                                                    : colors.error.main,
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={[styles.deckMeta, { color: tc.textMuted }]}>
                                {deck.cardsStudied} studied · {deck.cardCount} total cards
                            </Text>
                        </Animated.View>
                    ))}
                </Animated.View>
            )}

            {/* Badges section */}
            <Animated.View entering={FadeInDown.delay(350).duration(500)} style={[styles.card, { backgroundColor: tc.surface }]}>
                <Text style={[styles.cardTitle, { color: tc.text }]}>Badges</Text>
                <Text style={[styles.badgeSubtitle, { color: tc.textMuted }]}>
                    {earnedBadges.length} / {BADGES.length} earned
                </Text>
                <View style={styles.badgesGrid}>
                    {BADGES.map((badge) => {
                        const earned = earnedBadges.includes(badge.id);
                        return (
                            <View
                                key={badge.id}
                                style={[
                                    styles.badgeTile,
                                    {
                                        backgroundColor: earned ? badge.color + '22' : tc.border + '30',
                                        borderColor: earned ? badge.color + '60' : tc.border,
                                        opacity: earned ? 1 : 0.45,
                                    },
                                ]}
                            >
                                <Text style={{ fontSize: 22 }}>{badge.emoji}</Text>
                                <Text style={[styles.badgeTileName, { color: earned ? badge.color : tc.textMuted }]} numberOfLines={2}>
                                    {badge.name}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </Animated.View>

            {/* Empty state */}
            {stats && stats.totalSessions === 0 && (
                <Animated.View entering={FadeInDown.delay(150).duration(500)} style={[styles.emptyCard, { backgroundColor: tc.surface }]}>
                    <Text style={{ fontSize: 48, marginBottom: spacing.md }}>📊</Text>
                    <Text style={[styles.emptyTitle, { color: tc.text }]}>No Data Yet</Text>
                    <Text style={[styles.emptySub, { color: tc.textSecondary }]}>
                        Start studying your decks to see your statistics here!
                    </Text>
                </Animated.View>
            )}

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.base, paddingBottom: spacing['3xl'] },

    overviewGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    overviewCard: {
        flex: 1,
        minWidth: '46%',
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        alignItems: 'center',
        gap: 4,
        ...shadows.sm,
    },
    overviewValue: { fontSize: typography.fontSize.xl, fontWeight: '800' },
    overviewLabel: { fontSize: typography.fontSize.xs, textAlign: 'center' },
    overviewSub: { fontSize: 10, textAlign: 'center' },
    levelBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        marginTop: 2,
    },
    levelText: { fontSize: 10, fontWeight: '800' },

    card: {
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.base,
    },
    cardTitle: { fontSize: typography.fontSize.md, fontWeight: '700' },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: typography.fontSize.xs },

    // Chart
    chartContainer: {
        height: CHART_HEIGHT + 36,
        position: 'relative',
    },
    goalLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderTopWidth: 1.5,
        borderStyle: 'dashed',
    },
    goalLineLabel: {
        position: 'absolute',
        right: 0,
        fontSize: 9,
        fontWeight: '700',
    },
    barsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: CHART_HEIGHT + 36,
        gap: 4,
    },
    barCol: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: CHART_HEIGHT + 36,
    },
    barCount: { fontSize: 9, fontWeight: '600', marginBottom: 2 },
    barBg: {
        width: '80%',
        height: CHART_HEIGHT,
        borderRadius: 4,
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    barFill: { width: '100%', borderRadius: 4 },
    barLabel: { fontSize: 10, marginTop: 4 },
    chartEmpty: { height: CHART_HEIGHT + 36, alignItems: 'center', justifyContent: 'center' },

    // Breakdown
    breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.md },
    breakdownItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
    breakdownLabel: { fontSize: typography.fontSize.lg, fontWeight: '800' },
    breakdownSub: { fontSize: typography.fontSize.xs },
    breakdownDivider: { width: 1, height: 80, alignSelf: 'center' },

    // Deck accuracy
    deckRow: { marginBottom: spacing.md },
    deckRowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    deckName: { fontSize: typography.fontSize.sm, fontWeight: '600', flex: 1 },
    deckAccuracy: { fontSize: typography.fontSize.sm, fontWeight: '800' },
    deckBarBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
    deckBarFill: { height: '100%', borderRadius: 3 },
    deckMeta: { fontSize: 10 },

    // Empty
    emptyCard: {
        borderRadius: borderRadius.xl,
        padding: spacing['2xl'],
        alignItems: 'center',
        ...shadows.sm,
    },
    emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: '700', marginBottom: spacing.xs },
    emptySub: { fontSize: typography.fontSize.sm, textAlign: 'center' },

    // XP card
    xpCard: {
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        ...shadows.sm,
    },
    xpCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
    xpCardInfo: { flex: 1 },
    xpLevelTitle: { fontSize: typography.fontSize.base, fontWeight: '800' },
    xpTotalText: { fontSize: typography.fontSize.xs, marginTop: 2 },
    xpBarArea: { gap: spacing.xs },
    xpBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
    xpBarFill: { height: '100%', borderRadius: 3 },
    xpBarLabel: { fontSize: typography.fontSize.xs },

    // Badges
    badgeSubtitle: { fontSize: typography.fontSize.xs, marginBottom: spacing.md },
    badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    badgeTile: {
        width: '29%',
        alignItems: 'center',
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        gap: 4,
    },
    badgeTileName: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
});
