import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
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
  const [quizModalDeck, setQuizModalDeck] = useState<Deck | null>(null);
  const [deckOptionsFor, setDeckOptionsFor] = useState<Deck | null>(null); // UX #1

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
    setDeckOptionsFor(null);
    Alert.alert(
      'Delete Deck',
      `Delete "${deck.name}" and all its cards? This cannot be undone.`,
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

  const handleQuizMode = (mode: 'mc' | 'match' | 'spell') => {
    if (!quizModalDeck) return;
    setQuizModalDeck(null);
    const route = mode === 'mc' ? '/quiz-mc' : mode === 'match' ? '/quiz-match' : '/quiz-spell';
    router.push({ pathname: route as any, params: { deckId: quizModalDeck.id, deckName: quizModalDeck.name } });
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
            onPress={() => router.push({ pathname: '/deck-detail' as any, params: { deckId: deck.id, deckName: deck.name } })}
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
            {/* UX #1: ⋯ menu button replaces long press */}
            <TouchableOpacity
              style={styles.optionsBtn}
              onPress={() => setDeckOptionsFor(deck)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={tc.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
          {/* Test Yourself button */}
          <TouchableOpacity
            style={[styles.testBtn, { backgroundColor: colors.primary[500] + '15', borderColor: colors.primary[500] + '40' }]}
            onPress={() => setQuizModalDeck(deck)}
            activeOpacity={0.7}
          >
            <Ionicons name="trophy-outline" size={15} color={colors.primary[400]} />
            <Text style={[styles.testBtnText, { color: colors.primary[400] }]}>Test Yourself</Text>
          </TouchableOpacity>
        </Animated.View>
      ))}      {/* Quiz mode modal */}
      <Modal
        visible={quizModalDeck !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setQuizModalDeck(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setQuizModalDeck(null)}>
          <Pressable style={[styles.modalBox, { backgroundColor: tc.surface }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: tc.text }]}>Test Yourself</Text>
            <Text style={[styles.modalSubtitle, { color: tc.textSecondary }]}>
              {quizModalDeck?.name}
            </Text>
            <TouchableOpacity
              style={[styles.modeBtn, { backgroundColor: colors.primary[500] + '18', borderColor: colors.primary[500] }]}
              onPress={() => handleQuizMode('mc')}
              activeOpacity={0.8}
            >
              <View style={[styles.modeIcon, { backgroundColor: colors.primary[500] + '25' }]}>
                <Ionicons name="list" size={22} color={colors.primary[400]} />
              </View>
              <View style={styles.modeTextArea}>
                <Text style={[styles.modeName, { color: tc.text }]}>Multiple Choice</Text>
                <Text style={[styles.modeDesc, { color: tc.textMuted }]}>Pick the correct answer from 4 choices</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, { backgroundColor: colors.accent[500] + '18', borderColor: colors.accent[400] }]}
              onPress={() => handleQuizMode('match')}
              activeOpacity={0.8}
            >
              <View style={[styles.modeIcon, { backgroundColor: colors.accent[400] + '25' }]}>
                <Ionicons name="git-compare-outline" size={22} color={colors.accent[400]} />
              </View>
              <View style={styles.modeTextArea}>
                <Text style={[styles.modeName, { color: tc.text }]}>Matching</Text>
                <Text style={[styles.modeDesc, { color: tc.textMuted }]}>Match words with their meanings</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, { backgroundColor: colors.success.main + '18', borderColor: colors.success.main }]}
              onPress={() => handleQuizMode('spell')}
              activeOpacity={0.8}
            >
              <View style={[styles.modeIcon, { backgroundColor: colors.success.main + '25' }]}>
                <Ionicons name="pencil-outline" size={22} color={colors.success.main} />
              </View>
              <View style={styles.modeTextArea}>
                <Text style={[styles.modeName, { color: tc.text }]}>Spelling</Text>
                <Text style={[styles.modeDesc, { color: tc.textMuted }]}>Type the word, use hints if needed</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setQuizModalDeck(null)} style={styles.modalCancel}>
              <Text style={[styles.modalCancelText, { color: tc.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* UX #1: Deck options modal (⋯ menu) */}
      <Modal
        visible={deckOptionsFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeckOptionsFor(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDeckOptionsFor(null)}>
          <Pressable style={[styles.modalBox, { backgroundColor: tc.surface }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: tc.text }]}>{deckOptionsFor?.name}</Text>
            <Text style={[styles.modalSubtitle, { color: tc.textSecondary }]}>
              {deckOptionsFor?.cardCount} cards · {deckOptionsFor?.cefrLevel}
            </Text>
            <TouchableOpacity
              style={[styles.modeBtn, { backgroundColor: tc.border + '40', borderColor: tc.border }]}
              onPress={() => {
                if (!deckOptionsFor) return;
                setDeckOptionsFor(null);
                router.push({ pathname: '/deck-detail' as any, params: { deckId: deckOptionsFor.id, deckName: deckOptionsFor.name } });
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.modeIcon, { backgroundColor: colors.accent[500] + '20' }]}>
                <Ionicons name="layers-outline" size={22} color={colors.accent[400]} />
              </View>
              <View style={styles.modeTextArea}>
                <Text style={[styles.modeName, { color: tc.text }]}>View & Edit Cards</Text>
                <Text style={[styles.modeDesc, { color: tc.textMuted }]}>Browse, edit or add words</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, { backgroundColor: tc.border + '40', borderColor: tc.border }]}
              onPress={() => {
                if (!deckOptionsFor) return;
                setDeckOptionsFor(null);
                router.push({ pathname: '/study', params: { deckId: deckOptionsFor.id, deckName: deckOptionsFor.name } });
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.modeIcon, { backgroundColor: colors.primary[500] + '20' }]}>
                <Ionicons name="book-outline" size={22} color={colors.primary[400]} />
              </View>
              <View style={styles.modeTextArea}>
                <Text style={[styles.modeName, { color: tc.text }]}>Study</Text>
                <Text style={[styles.modeDesc, { color: tc.textMuted }]}>Review cards with flashcards</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, { backgroundColor: colors.error.main + '12', borderColor: colors.error.main + '60' }]}
              onPress={() => deckOptionsFor && handleDeleteDeck(deckOptionsFor)}
              activeOpacity={0.8}
            >
              <View style={[styles.modeIcon, { backgroundColor: colors.error.main + '20' }]}>
                <Ionicons name="trash-outline" size={22} color={colors.error.main} />
              </View>
              <View style={styles.modeTextArea}>
                <Text style={[styles.modeName, { color: colors.error.main }]}>Delete Deck</Text>
                <Text style={[styles.modeDesc, { color: tc.textMuted }]}>Remove deck and all its cards</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDeckOptionsFor(null)} style={styles.modalCancel}>
              <Text style={[styles.modalCancelText, { color: tc.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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

  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.sm,
  },
  testBtnText: { fontSize: typography.fontSize.xs, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    padding: spacing['2xl'],
    paddingBottom: 40,
    ...shadows.lg,
  },
  modalTitle: { fontSize: typography.fontSize.xl, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { fontSize: typography.fontSize.sm, marginBottom: spacing.xl },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    padding: spacing.base,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTextArea: { flex: 1 },
  modeName: { fontSize: typography.fontSize.base, fontWeight: '700', marginBottom: 2 },
  modeDesc: { fontSize: typography.fontSize.xs },
  modalCancel: { alignItems: 'center', paddingTop: spacing.md },
  modalCancelText: { fontSize: typography.fontSize.base, fontWeight: '600' },
  optionsBtn: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});
