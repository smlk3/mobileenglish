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

// ── Floating star particle ────────────────────────────────────
function Star({ style, delay, size = 3, color = '#818CF8' }: {
  style: object;
  delay: number;
  size?: number;
  color?: string;
}) {
  const opacity = useSharedValue(0.1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1400 + delay * 200 }),
        withTiming(0.15, { duration: 1400 + delay * 200 }),
      ),
      -1,
      true,
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
        animStyle,
      ]}
    />
  );
}

// ── Orbital XP Ring ──────────────────────────────────────────
function OrbitalRing({ pct, color, size = 72 }: { pct: number; color: string; size?: number }) {
  const stroke = 6;
  const sweepAngle = pct * 360;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background ring */}
      <View
        style={{
          position: 'absolute', width: size, height: size,
          borderRadius: size / 2, borderWidth: stroke,
          borderColor: 'rgba(255,255,255,0.12)',
        }}
      />
      {/* Filled arcs */}
      {[0, 1].map((half) => {
        const halfAngle = half === 0 ? Math.min(sweepAngle, 180) : Math.max(sweepAngle - 180, 0);
        if (halfAngle === 0) return null;
        return (
          <View
            key={half}
            style={{
              position: 'absolute', width: size, height: size,
              borderRadius: size / 2, overflow: 'hidden',
              transform: [{ rotate: `${half * 180}deg` }],
            }}
          >
            <View style={{ width: size, height: size / 2, overflow: 'hidden' }}>
              <View
                style={{
                  width: size, height: size, borderRadius: size / 2,
                  borderWidth: stroke, borderColor: color,
                  transform: [{ rotate: `${halfAngle - 180}deg` }],
                  shadowColor: color,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 6,
                }}
              />
            </View>
          </View>
        );
      })}
      {/* Center % */}
      <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
        {Math.round(pct * 100)}%
      </Text>
    </View>
  );
}

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

  const totalXP    = useXPStore((s) => s.totalXP);
  const xpProgress = getXPProgress(totalXP);

  const loadStats = useCallback(async () => {
    const [homeData, detailed] = await Promise.all([getHomeStats(), getDetailedStats()]);
    setStats(homeData);
    const studied = new Set(
      detailed.last7Days.filter((d) => d.count > 0).map((d) => d.date),
    );
    setStudiedDays(studied);
  }, []);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  // Mascot breathing
  const mascotScale = useSharedValue(1);
  useEffect(() => {
    mascotScale.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 2200 }), withTiming(1, { duration: 2200 })),
      -1, true,
    );
  }, []);
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ scale: mascotScale.value }] }));

  const goalPct = Math.min(stats.todayStudied / Math.max(stats.dailyGoal, 1), 1);
  const goalMet = goalPct >= 1;

  const calendarDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().split('T')[0];
    return { label: WEEK_DAYS[d.getDay()], dateStr, isToday: i === 6, studied: studiedDays.has(dateStr) };
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tc.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── COSMIC HERO ─────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(600)}
        style={[
          styles.heroSection,
          {
            backgroundColor: themeMode === 'dark' ? '#1A1A38' : tc.surfaceElevated,
            borderColor: `${colors.primary[500]}35`,
            shadowColor: colors.primary[500],
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
            elevation: 12,
          },
        ]}
      >
        {/* Star particles */}
        <Star style={{ top: 14, right: 88 }}   delay={0}   size={3} color={colors.primary[300]} />
        <Star style={{ top: 34, right: 112 }}  delay={1}   size={2} color={colors.accent[300]} />
        <Star style={{ top: 54, right: 82 }}   delay={2}   size={4} color={colors.warning.light} />
        <Star style={{ top: 22, right: 140 }}  delay={0.5} size={2} color='#EAEAFF' />
        <Star style={{ top: 64, right: 128 }}  delay={1.5} size={2} color={colors.primary[300]} />
        <Star style={{ top: 8, right: 60 }}    delay={3}   size={2} color={colors.accent[400]} />

        <View style={styles.heroLeft}>
          <Text style={[styles.greeting, { color: tc.textSecondary }]}>Welcome back!</Text>
          <Text style={[styles.heroTitle, { color: tc.text }]}>Ready to learn?</Text>

          <View style={styles.xpRow}>
            <Text style={{ fontSize: 16 }}>{xpProgress.current.emoji}</Text>
            <Text style={[styles.xpLevelText, { color: xpProgress.current.color }]}>
              Lv {xpProgress.current.level} · {xpProgress.current.title}
            </Text>
          </View>

          {xpProgress.next && (
            <View style={styles.xpBarWrap}>
              <View style={[styles.xpBarBg, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <View
                  style={[
                    styles.xpBarFill,
                    {
                      width: `${Math.round(xpProgress.pct * 100)}%`,
                      backgroundColor: xpProgress.current.color,
                      shadowColor: xpProgress.current.color,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.8,
                      shadowRadius: 6,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.xpNextText, { color: 'rgba(255,255,255,0.5)' }]}>
                {xpProgress.xpIntoLevel}/{xpProgress.xpForLevel} XP
              </Text>
            </View>
          )}
        </View>

        {/* Mascot + orbital ring */}
        <Animated.View style={[styles.mascotContainer, mascotStyle]}>
          {/* Orbital progress ring */}
          <OrbitalRing pct={xpProgress.pct} color={xpProgress.current.color} size={80} />
          {/* Centered owl on top of ring */}
          <View style={styles.mascotInner}>
            <Text style={styles.mascotEmoji}>🦉</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* ── STREAK CARD ────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(80)}
        style={[
          styles.streakCard,
          {
            backgroundColor: stats.streak > 0
              ? (themeMode === 'dark' ? '#2A1A0A' : colors.warning.main + '10')
              : tc.surface,
            borderColor: stats.streak > 0 ? colors.warning.main + '45' : tc.border,
            shadowColor: stats.streak > 0 ? colors.warning.main : 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: stats.streak > 0 ? 0.35 : 0,
            shadowRadius: stats.streak > 0 ? 16 : 0,
            elevation: stats.streak > 0 ? 6 : 2,
          },
        ]}
      >
        <View style={styles.streakHeader}>
          <View style={styles.streakLeft}>
            <Text style={{ fontSize: 32 }}>{stats.streak > 0 ? '🔥' : '💪'}</Text>
            <View>
              <Text style={[styles.streakCount, {
                color: stats.streak > 0 ? colors.warning.main : tc.text,
              }]}>
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

        {/* 7-day calendar */}
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
                    ? colors.primary[500] + '35'
                    : tc.border,
                  borderWidth: day.isToday ? 2 : 0,
                  borderColor: day.isToday ? colors.primary[400] : 'transparent',
                  shadowColor: day.studied ? colors.warning.main : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: day.studied ? 0.6 : 0,
                  shadowRadius: day.studied ? 8 : 0,
                },
              ]}>
                {day.studied && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* ── DAILY GOAL CARD ────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(160)}
        style={[
          styles.progressCard,
          {
            backgroundColor: goalMet
              ? (themeMode === 'dark' ? '#0A2218' : colors.success.main + '10')
              : tc.surface,
            borderColor: goalMet ? colors.success.main + '45' : tc.border,
            shadowColor: goalMet ? colors.success.main : 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: goalMet ? 0.3 : 0,
            shadowRadius: goalMet ? 16 : 0,
            elevation: goalMet ? 6 : 2,
          },
        ]}
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
          <Text style={[styles.progressPct, {
            color: goalMet ? colors.success.main : colors.primary[400],
          }]}>
            {Math.round(goalPct * 100)}%
          </Text>
        </View>

        <View style={[styles.progressBarBg, {
          backgroundColor: goalMet ? colors.success.main + '22' : tc.border,
        }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.round(goalPct * 100)}%`,
                backgroundColor: goalMet ? colors.success.main : colors.primary[500],
                shadowColor: goalMet ? colors.success.main : colors.primary[400],
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 8,
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

      {/* ── QUICK ACTIONS ──────────────────────────────── */}
      <Text style={[styles.sectionTitle, {
        color: tc.text,
        marginLeft: spacing.base,
        marginTop: spacing.lg,
        marginBottom: spacing.xs,
      }]}>
        Quick Actions
      </Text>

      <Animated.View entering={FadeInRight.duration(500).delay(200)}>
        <TouchableOpacity
          style={[
            styles.actionCard,
            {
              backgroundColor: colors.primary[600],
              shadowColor: colors.primary[500],
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.45,
              shadowRadius: 16,
              elevation: 10,
            },
          ]}
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
          style={[
            styles.actionCard,
            {
              backgroundColor: colors.accent[600],
              shadowColor: colors.accent[400],
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              elevation: 10,
            },
          ]}
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
          style={[
            styles.actionCard,
            {
              backgroundColor: '#7C3AED',
              shadowColor: '#7C3AED',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.45,
              shadowRadius: 16,
              elevation: 10,
            },
          ]}
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

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { paddingTop: spacing.base, paddingBottom: spacing['3xl'] },

  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.base,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroLeft:      { flex: 1 },
  greeting:      { fontSize: typography.fontSize.sm, marginBottom: 4 },
  heroTitle:     { fontSize: typography.fontSize['2xl'], fontWeight: '700', marginBottom: 4 },
  xpRow:         { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  xpLevelText:   { fontSize: typography.fontSize.xs, fontWeight: '800' },
  xpBarWrap:     { gap: 2 },
  xpBarBg:       { height: 6, borderRadius: 3, overflow: 'hidden', width: 140 },
  xpBarFill:     { height: '100%', borderRadius: 3 },
  xpNextText:    { fontSize: 9 },

  mascotContainer: {
    marginLeft: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
  },
  mascotInner: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.18)',
  },
  mascotEmoji: { fontSize: 38 },

  streakCard: {
    marginHorizontal: spacing.base,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  streakLeft:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streakCount:        { fontSize: typography.fontSize.xl, fontWeight: '800' },
  streakLabel:        { fontSize: typography.fontSize.xs },
  statsShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  statsShortcutText: { fontSize: typography.fontSize.xs, fontWeight: '700' },
  weekRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol:   { alignItems: 'center', gap: 4 },
  dayLabel: { fontSize: 10 },
  dayDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressCard: {
    marginHorizontal: spacing.base,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressSub:     { fontSize: typography.fontSize.xs, marginTop: 2 },
  progressPct:     { fontSize: typography.fontSize.xl, fontWeight: '800' },
  progressBarBg:   { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.lg },
  progressBarFill: { height: '100%', borderRadius: 4 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem:    { alignItems: 'center', gap: 4, flex: 1 },
  statDivider: { width: 1, height: 32 },
  statValue:   { fontSize: typography.fontSize.lg, fontWeight: '700' },
  statLabel:   { fontSize: typography.fontSize.xs },

  sectionTitle: { fontSize: typography.fontSize.md, fontWeight: '700' },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent:  { flex: 1, marginLeft: spacing.base },
  actionTitle:    { color: '#fff', fontSize: typography.fontSize.md, fontWeight: '700', marginBottom: 2 },
  actionSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: typography.fontSize.sm },
});
