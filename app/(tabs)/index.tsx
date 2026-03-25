import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { type HomeStats, getDetailedStats, getHomeStats } from '../../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../../src/shared/lib/stores/useProfileStore';
import { useXPStore } from '../../src/shared/lib/stores/useXPStore';
import { borderRadius, colors, shadows, spacing, typography } from '../../src/shared/lib/theme';
import { getXPProgress } from '../../src/shared/lib/xpSystem';

const { width } = Dimensions.get('window');
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HomeScreen() {
  const router = useRouter();
  const themeMode = useProfileStore((s) => s.themeMode);
  const tc = themeMode === 'dark' ? colors.dark : colors.light;

  const [stats, setStats] = useState<HomeStats>({
    streak: 0,
    wordsLearned: 0,
    todayStudied: 0,
    dailyGoal: 10,
    dueCards: 0,
  });
  const [studiedDays, setStudiedDays] = useState<Set<string>>(new Set());

  // XP
  const totalXP = useXPStore((s) => s.totalXP);
  const xpProgress = getXPProgress(totalXP);

  const loadStats = useCallback(async () => {
    const [homeData, detailed] = await Promise.all([getHomeStats(), getDetailedStats()]);
    setStats(homeData);
    const studied = new Set(
      detailed.last7Days.filter((d) => d.count > 0).map((d) => d.date),
    );
    setStudiedDays(studied);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats]),
  );

  // Mascot breathing animation
  const mascotScale = useSharedValue(1);
  useEffect(() => {
    mascotScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000 }),
        withTiming(1, { duration: 2000 }),
      ),
      -1,
      true,
    );
  }, []);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mascotScale.value }],
  }));

  const goalPct = Math.min(stats.todayStudied / Math.max(stats.dailyGoal, 1), 1);
  const goalMet = goalPct >= 1;

  // Last 7 days for calendar (today is last)
  const calendarDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().split('T')[0];
    return {
      label: WEEK_DAYS[d.getDay()],
      dateStr,
      isToday: i === 6,
      studied: studiedDays.has(dateStr),
    };
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tc.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <Animated.View
        entering={FadeInDown.duration(600)}
        style={[styles.heroSection, { backgroundColor: tc.surfaceElevated }]}
      >
        <View style={styles.heroLeft}>
          <Text style={[styles.greeting, { color: tc.textSecondary }]}>Welcome back!</Text>
          <Text style={[styles.heroTitle, { color: tc.text }]}>Ready to learn?</Text>
          {/* XP Level badge */}
          <View style={styles.xpRow}>
            <Text style={{ fontSize: 16 }}>{xpProgress.current.emoji}</Text>
            <Text style={[styles.xpLevelText, { color: xpProgress.current.color }]}>
              Lv {xpProgress.current.level} · {xpProgress.current.title}
            </Text>
          </View>
          {/* XP progress bar */}
          {xpProgress.next && (
            <View style={styles.xpBarWrap}>
              <View style={[styles.xpBarBg, { backgroundColor: tc.border }]}>
                <View
                  style={[styles.xpBarFill, {
                    width: `${Math.round(xpProgress.pct * 100)}%`,
                    backgroundColor: xpProgress.current.color,
                  }]}
                />
              </View>
              <Text style={[styles.xpNextText, { color: tc.textMuted }]}>
                {xpProgress.xpIntoLevel}/{xpProgress.xpForLevel} XP
              </Text>
            </View>
          )}
        </View>
        <Animated.View style={[styles.mascotContainer, mascotStyle]}>
          <View style={styles.mascot}>
            <Text style={styles.mascotEmoji}>🦉</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Streak Card */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(80)}
        style={[styles.streakCard, {
          backgroundColor: stats.streak > 0 ? colors.warning.main + '15' : tc.surface,
          borderColor: stats.streak > 0 ? colors.warning.main + '40' : tc.border,
        }]}
      >
        <View style={styles.streakHeader}>
          <View style={styles.streakLeft}>
            <Text style={{ fontSize: 28 }}>{stats.streak > 0 ? '🔥' : '💪'}</Text>
            <View>
              <Text style={[styles.streakCount, { color: stats.streak > 0 ? colors.warning.main : tc.text }]}>
                {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
              </Text>
              <Text style={[styles.streakLabel, { color: tc.textMuted }]}>
                {stats.streak > 0 ? 'Current streak' : 'Start your streak!'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.statsShortcut, { backgroundColor: colors.primary[500] + '18' }]}
            onPress={() => router.push('/(tabs)/stats' as any)}
          >
            <Ionicons name="bar-chart" size={14} color={colors.primary[400]} />
            <Text style={[styles.statsShortcutText, { color: colors.primary[400] }]}>Stats</Text>
          </TouchableOpacity>
        </View>

        {/* 7-day week calendar */}
        <View style={styles.weekRow}>
          {calendarDays.map((day) => (
            <View key={day.dateStr} style={styles.dayCol}>
              <Text style={[styles.dayLabel, {
                color: day.isToday ? colors.primary[400] : tc.textMuted,
                fontWeight: day.isToday ? '800' : '500',
              }]}>
                {day.label}
              </Text>
              <View style={[
                styles.dayDot,
                {
                  backgroundColor: day.studied
                    ? colors.warning.main
                    : day.isToday
                      ? colors.primary[500] + '30'
                      : tc.border,
                  borderWidth: day.isToday ? 1.5 : 0,
                  borderColor: day.isToday ? colors.primary[400] : 'transparent',
                },
              ]}>
                {day.studied && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Daily Goal Card */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(160)}
        style={[styles.progressCard, {
          backgroundColor: goalMet ? colors.success.main + '12' : tc.surface,
          borderColor: goalMet ? colors.success.main + '40' : tc.border,
        }]}
      >
        <View style={styles.progressHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: tc.text }]}>
              {goalMet ? '🎉 Daily Goal Reached!' : "Today's Goal"}
            </Text>
            <Text style={[styles.progressSub, { color: tc.textMuted }]}>
              {stats.todayStudied} of {stats.dailyGoal} cards studied
            </Text>
          </View>
          <Text style={[styles.progressPct, { color: goalMet ? colors.success.main : colors.primary[400] }]}>
            {Math.round(goalPct * 100)}%
          </Text>
        </View>
        <View style={[styles.progressBarBg, { backgroundColor: goalMet ? colors.success.main + '25' : tc.border }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.round(goalPct * 100)}%`,
                backgroundColor: goalMet ? colors.success.main : colors.primary[500],
              },
            ]}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="book" size={18} color={colors.accent[400]} />
            <Text style={[styles.statValue, { color: tc.text }]}>{stats.wordsLearned}</Text>
            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Words</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: tc.border }]} />
          <View style={styles.statItem}>
            <Ionicons name="time" size={18} color={colors.primary[400]} />
            <Text style={[styles.statValue, { color: tc.text }]}>{stats.dueCards}</Text>
            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Due</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: tc.border }]} />
          <View style={styles.statItem}>
            <Ionicons name="flame" size={18} color={colors.warning.main} />
            <Text style={[styles.statValue, { color: tc.text }]}>{stats.streak}</Text>
            <Text style={[styles.statLabel, { color: tc.textMuted }]}>Streak</Text>
          </View>
        </View>
      </Animated.View>

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { color: tc.text, marginLeft: spacing.base, marginTop: spacing.lg }]}>
        Quick Actions
      </Text>

      <Animated.View entering={FadeInRight.duration(500).delay(200)}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.primary[600] }]}
          onPress={() => router.push('/study')}
          activeOpacity={0.85}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="flash" size={28} color="#fff" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Daily Review</Text>
            <Text style={styles.actionSubtitle}>{stats.dueCards} cards waiting for review</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInRight.duration(500).delay(300)}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.accent[600] }]}
          onPress={() => router.push('/create-deck' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="sparkles" size={28} color="#fff" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Generate New Words</Text>
            <Text style={styles.actionSubtitle}>AI-powered vocabulary for your interests</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInRight.duration(500).delay(400)}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#7C3AED' }]}
          onPress={() => router.push('/chat' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Practice with AI</Text>
            <Text style={styles.actionSubtitle}>Chat in English to improve fluency</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </Animated.View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: spacing.base, paddingBottom: spacing['3xl'] },

  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.base,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.sm,
  },
  heroLeft: { flex: 1 },
  greeting: { fontSize: typography.fontSize.sm, marginBottom: 4 },
  heroTitle: { fontSize: typography.fontSize['2xl'], fontWeight: '700', marginBottom: 4 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  xpLevelText: { fontSize: typography.fontSize.xs, fontWeight: '800' },
  xpBarWrap: { gap: 2 },
  xpBarBg: { height: 4, borderRadius: 2, overflow: 'hidden', width: 140 },
  xpBarFill: { height: '100%', borderRadius: 2 },
  xpNextText: { fontSize: 9 },
  mascotContainer: { marginLeft: spacing.base },
  mascot: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotEmoji: { fontSize: 44 },

  streakCard: {
    marginHorizontal: spacing.base,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  streakLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streakCount: { fontSize: typography.fontSize.xl, fontWeight: '800' },
  streakLabel: { fontSize: typography.fontSize.xs },
  statsShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  statsShortcutText: { fontSize: typography.fontSize.xs, fontWeight: '700' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 4 },
  dayLabel: { fontSize: 10 },
  dayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressCard: {
    marginHorizontal: spacing.base,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressSub: { fontSize: typography.fontSize.xs, marginTop: 2 },
  progressPct: { fontSize: typography.fontSize.xl, fontWeight: '800' },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: { alignItems: 'center', gap: 4, flex: 1 },
  statDivider: { width: 1, height: 32 },
  statValue: { fontSize: typography.fontSize.lg, fontWeight: '700' },
  statLabel: { fontSize: typography.fontSize.xs },

  sectionTitle: { fontSize: typography.fontSize.md, fontWeight: '700' },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: { flex: 1, marginLeft: spacing.base },
  actionTitle: { color: '#fff', fontSize: typography.fontSize.md, fontWeight: '700', marginBottom: 2 },
  actionSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: typography.fontSize.sm },
});
