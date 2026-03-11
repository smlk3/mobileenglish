import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { type HomeStats, getHomeStats } from '../../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, shadows, spacing, typography } from '../../src/shared/lib/theme';

const { width } = Dimensions.get('window');

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

  const loadStats = useCallback(async () => {
    const data = await getHomeStats();
    setStats(data);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tc.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section with Mascot */}
      <Animated.View
        entering={FadeInDown.duration(600)}
        style={[styles.heroSection, { backgroundColor: tc.surfaceElevated }]}
      >
        <View style={styles.heroLeft}>
          <Text style={[styles.greeting, { color: tc.textSecondary }]}>
            Welcome back!
          </Text>
          <Text style={[styles.heroTitle, { color: tc.text }]}>
            Ready to learn?
          </Text>
          {stats.streak > 0 && (
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={18} color={colors.warning.main} />
              <Text style={styles.streakText}>{stats.streak} day streak</Text>
            </View>
          )}
        </View>
        <Animated.View style={[styles.mascotContainer, mascotStyle]}>
          <View style={styles.mascot}>
            <Text style={styles.mascotEmoji}>🦉</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Today's Progress */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(100)}
        style={[styles.progressCard, { backgroundColor: tc.surface }]}
      >
        <View style={styles.progressHeader}>
          <Text style={[styles.sectionTitle, { color: tc.text }]}>
            Today's Progress
          </Text>
          <Text style={[styles.progressCount, { color: colors.primary[400] }]}>
            {stats.todayStudied}/{stats.dailyGoal}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(100, (stats.todayStudied / stats.dailyGoal) * 100)}%`,
                backgroundColor: colors.primary[500],
              },
            ]}
          />
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="book" size={20} color={colors.accent[400]} />
            <Text style={[styles.statValue, { color: tc.text }]}>
              {stats.wordsLearned}
            </Text>
            <Text style={[styles.statLabel, { color: tc.textMuted }]}>
              Words
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={20} color={colors.primary[400]} />
            <Text style={[styles.statValue, { color: tc.text }]}>
              {stats.dueCards}
            </Text>
            <Text style={[styles.statLabel, { color: tc.textMuted }]}>
              Due
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={20} color={colors.warning.main} />
            <Text style={[styles.statValue, { color: tc.text }]}>
              {stats.streak}
            </Text>
            <Text style={[styles.statLabel, { color: tc.textMuted }]}>
              Streak
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Action Cards */}
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
            <Text style={styles.actionSubtitle}>
              {stats.dueCards} cards waiting for review
            </Text>
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
            <Text style={styles.actionSubtitle}>
              AI-powered vocabulary for your interests
            </Text>
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
            <Text style={styles.actionSubtitle}>
              Chat in English to improve fluency
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </Animated.View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.base,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.base,
  },
  heroLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: typography.fontSize.sm,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  streakText: {
    color: colors.warning.main,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    marginLeft: 6,
  },
  mascotContainer: {
    marginLeft: spacing.base,
  },
  mascot: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotEmoji: {
    fontSize: 48,
  },
  progressCard: {
    marginHorizontal: spacing.base,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
  },
  progressCount: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
  },
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
  actionContent: {
    flex: 1,
    marginLeft: spacing.base,
  },
  actionTitle: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: typography.fontSize.sm,
  },
});
