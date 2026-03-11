import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type Deck from '../../src/entities/Deck/model';
import { deleteDeck, fetchDecks } from '../../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, shadows, spacing, typography } from '../../src/shared/lib/theme';

const CEFR_COLORS: Record<string, string> = {
  A1: '#10B981',
  A2: '#34D399',
  B1: '#6366F1',
  B2: '#818CF8',
  C1: '#7C3AED',
  C2: '#EF4444',
};

const DECK_COLORS = ['#6366F1', '#14B8A6', '#7C3AED', '#EF4444', '#F59E0B', '#EC4899', '#06B6D4'];

export default function DecksScreen() {
  const router = useRouter();
  const themeMode = useProfileStore((s) => s.themeMode);
  const tc = themeMode === 'dark' ? colors.dark : colors.light;

  const [decks, setDecks] = useState<Deck[]>([]);

  const loadDecks = useCallback(async () => {
    const data = await fetchDecks();
    setDecks(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDecks();
    }, [loadDecks]),
  );

  const totalCards = decks.reduce((sum, d) => sum + d.cardCount, 0);
  const uniqueLevels = new Set(decks.map((d) => d.cefrLevel)).size;

  const handleDeleteDeck = (deck: Deck) => {
    Alert.alert(
      'Delete Deck',
      `Are you sure you want to delete "${deck.name}" and all its cards?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDeck(deck);
            loadDecks();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tc.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Stats summary */}
      <Animated.View
        entering={FadeInDown.duration(500)}
        style={[styles.summary, { backgroundColor: tc.surface }]}
      >
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.primary[400] }]}>
            {decks.length}
          </Text>
          <Text style={[styles.summaryLabel, { color: tc.textMuted }]}>Decks</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.accent[400] }]}>
            {totalCards}
          </Text>
          <Text style={[styles.summaryLabel, { color: tc.textMuted }]}>Cards</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.warning.main }]}>
            {uniqueLevels}
          </Text>
          <Text style={[styles.summaryLabel, { color: tc.textMuted }]}>Levels</Text>
        </View>
      </Animated.View>

      {/* Empty state */}
      {decks.length === 0 && (
        <Animated.View
          entering={FadeInDown.duration(500).delay(100)}
          style={[styles.emptyState, { backgroundColor: tc.surface }]}
        >
          <Text style={{ fontSize: 48, marginBottom: spacing.md }}>📚</Text>
          <Text style={[styles.emptyTitle, { color: tc.text }]}>No Decks Yet</Text>
          <Text style={[styles.emptySubtitle, { color: tc.textSecondary }]}>
            Create your first deck to start learning new words!
          </Text>
        </Animated.View>
      )}

      {/* Deck list */}
      {decks.map((deck, index) => (
        <Animated.View
          key={deck.id}
          entering={FadeInDown.duration(400).delay(index * 80)}
        >
          <TouchableOpacity
            style={[styles.deckCard, { backgroundColor: tc.surface }]}
            onPress={() => router.push({ pathname: '/study', params: { deckId: deck.id, deckName: deck.name } })}
            onLongPress={() => handleDeleteDeck(deck)}
            activeOpacity={0.8}
          >
            <View style={[styles.deckIcon, { backgroundColor: (DECK_COLORS[index % DECK_COLORS.length]) + '20' }]}>
              <Ionicons name="library" size={24} color={DECK_COLORS[index % DECK_COLORS.length]} />
            </View>
            <View style={styles.deckInfo}>
              <Text style={[styles.deckName, { color: tc.text }]}>{deck.name}</Text>
              <View style={styles.deckMeta}>
                <View style={[styles.cefrBadge, { backgroundColor: (CEFR_COLORS[deck.cefrLevel] || '#6366F1') + '20' }]}>
                  <Text style={[styles.cefrText, { color: CEFR_COLORS[deck.cefrLevel] || '#6366F1' }]}>
                    {deck.cefrLevel}
                  </Text>
                </View>
                {deck.category && (
                  <Text style={[styles.deckCategory, { color: tc.textSecondary }]}>
                    {deck.category}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.deckRight}>
              <Text style={[styles.cardCount, { color: tc.text }]}>{deck.cardCount}</Text>
              <Text style={[styles.cardCountLabel, { color: tc.textMuted }]}>cards</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      ))}

      {/* Add new deck button */}
      <TouchableOpacity
        style={[styles.addButton, { borderColor: colors.primary[400] }]}
        onPress={() => router.push('/create-deck' as any)}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle-outline" size={24} color={colors.primary[400]} />
        <Text style={[styles.addButtonText, { color: colors.primary[400] }]}>
          Create New Deck
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base, paddingBottom: spacing['3xl'] },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: typography.fontSize.xl, fontWeight: '700' },
  summaryLabel: { fontSize: typography.fontSize.xs, marginTop: 2 },
  divider: { width: 1, height: 40 },
  emptyState: {
    padding: spacing['2xl'],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  deckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  deckIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckInfo: { flex: 1, marginLeft: spacing.md },
  deckName: { fontSize: typography.fontSize.base, fontWeight: '600', marginBottom: 4 },
  deckMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cefrBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  cefrText: { fontSize: typography.fontSize.xs, fontWeight: '700' },
  deckCategory: { fontSize: typography.fontSize.xs },
  deckRight: { alignItems: 'center' },
  cardCount: { fontSize: typography.fontSize.lg, fontWeight: '700' },
  cardCountLabel: { fontSize: typography.fontSize.xs },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  addButtonText: { fontSize: typography.fontSize.base, fontWeight: '600' },
});
