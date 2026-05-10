import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type Card from '../src/entities/Card/model';
import type Deck from '../src/entities/Deck/model';
import { getVectorStore } from '../src/shared/api/rag/VectorStore';
import { getLevelLabel, getLevelOptions, LEVEL_COLORS } from '../src/shared/lib/languageConfig';
import {
    addCardToDeck,
    deleteCard,
    fetchCardsByDeck,
    fetchDeckById,
    updateCard,
    updateDeckMetadata,
} from '../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, shadows, spacing, typography } from '../src/shared/lib/theme';

const CATEGORY_KEYS = [
    { key: 'createDeck.categories.general', value: 'General' },
    { key: 'createDeck.categories.business', value: 'Business' },
    { key: 'createDeck.categories.medical', value: 'Medical' },
    { key: 'createDeck.categories.technology', value: 'Technology' },
    { key: 'createDeck.categories.academic', value: 'Academic' },
    { key: 'createDeck.categories.dailyLife', value: 'Daily Life' },
    { key: 'createDeck.categories.travel', value: 'Travel' },
    { key: 'createDeck.categories.sports', value: 'Sports' },
];

const STATUS_FILTERS = [
    { key: 'all', labelKey: 'deckDetail.status.all' },
    { key: 'new', labelKey: 'deckDetail.status.new' },
    { key: 'learning', labelKey: 'deckDetail.status.learning' },
    { key: 'review', labelKey: 'deckDetail.status.review' },
    { key: 'graduated', labelKey: 'deckDetail.status.graduated' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['key'];
type SortMode = 'date' | 'alpha' | 'status';

const STATUS_COLORS: Record<string, string> = {
    new: '#6366F1',
    learning: '#F59E0B',
    review: '#14B8A6',
    graduated: '#10B981',
};

/** Map level string (from DB) to color. Supports both legacy "A1" and new "1" format. */
function getLevelColor(level: string): string {
    const num = parseInt(level, 10);
    if (!isNaN(num) && LEVEL_COLORS[num]) return LEVEL_COLORS[num];
    // Legacy CEFR fallback
    const legacyMap: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
    return LEVEL_COLORS[legacyMap[level] ?? 1];
}

export default function DeckDetailScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { deckId } = useLocalSearchParams<{ deckId: string }>();
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;

    // ─── Data ───────────────────────────────────────────────────────
    const [deck, setDeck] = useState<Deck | null>(null);
    const [cards, setCards] = useState<Card[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // ─── Filter & Sort ──────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortMode, setSortMode] = useState<SortMode>('date');

    // ─── Inline Card Edit ───────────────────────────────────────────
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [editFront, setEditFront] = useState('');
    const [editBack, setEditBack] = useState('');
    const [editExample, setEditExample] = useState('');
    const [isSavingCard, setIsSavingCard] = useState(false);

    // ─── Add Word ───────────────────────────────────────────────────
    const [showAddWord, setShowAddWord] = useState(false);
    const [manualWord, setManualWord] = useState('');
    const [manualTranslation, setManualTranslation] = useState('');
    const [manualExample, setManualExample] = useState('');
    const [showManualFields, setShowManualFields] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);

    // ─── Edit Deck Metadata ─────────────────────────────────────────
    const [showEditDeck, setShowEditDeck] = useState(false);
    const [editDeckName, setEditDeckName] = useState('');
    const [editDeckLevel, setEditDeckLevel] = useState('');
    const [editDeckCategory, setEditDeckCategory] = useState('');
    const [isSavingDeck, setIsSavingDeck] = useState(false);

    // ─── Quiz Modal ─────────────────────────────────────────────────
    const [showQuizModal, setShowQuizModal] = useState(false);

    // ─── Load ───────────────────────────────────────────────────────
    const load = async () => {
        if (!deckId) return;
        try {
            const [deckData, cardsData] = await Promise.all([
                fetchDeckById(deckId),
                fetchCardsByDeck(deckId),
            ]);
            setDeck(deckData);
            setCards(cardsData);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [deckId]);

    // ─── Derived Data ───────────────────────────────────────────────
    const displayCards = useMemo(() => {
        let result = [...cards];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (c) =>
                    c.front.toLowerCase().includes(q) ||
                    c.back.toLowerCase().includes(q) ||
                    (c.exampleSentence || '').toLowerCase().includes(q),
            );
        }

        if (statusFilter !== 'all') {
            result = result.filter((c) => c.status === statusFilter);
        }

        if (sortMode === 'alpha') {
            result.sort((a, b) => a.front.localeCompare(b.front));
        } else if (sortMode === 'status') {
            const order = ['new', 'learning', 'review', 'graduated'];
            result.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
        } else {
            result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        return result;
    }, [cards, searchQuery, statusFilter, sortMode]);

    const dueCount = cards.filter((c) => c.isDue).length;
    const graduatedCount = cards.filter((c) => c.status === 'graduated').length;
    const progressPercent = cards.length > 0 ? Math.round((graduatedCount / cards.length) * 100) : 0;

    const SORT_LABELS: Record<SortMode, string> = { date: t('deckDetail.sort.date'), alpha: t('deckDetail.sort.alpha'), status: t('deckDetail.sort.status') };
    const SORT_CYCLE: SortMode[] = ['date', 'alpha', 'status'];

    // ─── Card Edit ──────────────────────────────────────────────────
    const startEditCard = (card: Card) => {
        setEditingCardId(card.id);
        setEditFront(card.front);
        setEditBack(card.back);
        setEditExample(card.exampleSentence || '');
    };

    const saveEditCard = async (card: Card) => {
        if (!editFront.trim() || !editBack.trim()) {
            Alert.alert(t('deckDetail.required'), t('deckDetail.emptyCardFields'));
            return;
        }
        setIsSavingCard(true);
        try {
            await updateCard(card, {
                front: editFront.trim(),
                back: editBack.trim(),
                exampleSentence: editExample.trim(),
            });
            await load();
            setEditingCardId(null);
        } catch {
            Alert.alert(t('common.error'), t('deckDetail.saveFailed'));
        } finally {
            setIsSavingCard(false);
        }
    };

    const handleDeleteCard = (card: Card) => {
        Alert.alert(t('deckDetail.deleteCard.title'), t('deckDetail.deleteCard.message', { word: card.front }), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                    await deleteCard(card);
                    await load();
                },
            },
        ]);
    };

    // ─── Add Word ───────────────────────────────────────────────────
    const lookupWord = async () => {
        const trimmed = manualWord.trim();
        if (!trimmed) return;

        if (cards.some((c) => c.front.toLowerCase() === trimmed.toLowerCase())) {
            Alert.alert(t('createDeck.duplicate'), t('deckDetail.duplicate', { word: trimmed }));
            return;
        }

        setIsLookingUp(true);
        try {
            const targetLang = deck?.targetLanguage || 'en';
            const nativeLang = useProfileStore.getState().nativeLanguage || 'tr';
            const vectorStore = getVectorStore(targetLang, nativeLang);
            const found = vectorStore.findByWord(trimmed);

            if (found) {
                await addNewCard(found.word, found.translation, found.exampleSentence, String(found.level), found.category);
            } else {
                setShowManualFields(true);
                setManualTranslation('');
                setManualExample('');
            }
        } finally {
            setIsLookingUp(false);
        }
    };

    const addNewCard = async (
        front: string,
        back: string,
        example: string,
        cefrLevel: string,
        category: string,
    ) => {
        if (!deckId) return;
        try {
            await addCardToDeck(deckId, { front, back, exampleSentence: example, cefrLevel, category });
            await load();
            setManualWord('');
            setManualTranslation('');
            setManualExample('');
            setShowManualFields(false);
            setShowAddWord(false);
        } catch {
            Alert.alert(t('common.error'), t('deckDetail.addFailed'));
        }
    };

    const addManualCard = async () => {
        const trimmed = manualWord.trim();
        if (!trimmed || !manualTranslation.trim()) {
            Alert.alert(t('deckDetail.required'), t('deckDetail.addRequired'));
            return;
        }
        await addNewCard(
            trimmed,
            manualTranslation.trim(),
            manualExample.trim(),
            deck?.cefrLevel || 'B1',
            deck?.category || 'General',
        );
    };

    const closeAddWord = () => {
        setShowAddWord(false);
        setManualWord('');
        setManualTranslation('');
        setManualExample('');
        setShowManualFields(false);
    };

    // ─── Edit Deck ──────────────────────────────────────────────────
    const openEditDeck = () => {
        if (!deck) return;
        setEditDeckName(deck.name);
        setEditDeckLevel(deck.cefrLevel);
        setEditDeckCategory(deck.category || 'General');
        setShowEditDeck(true);
    };

    const saveEditDeck = async () => {
        if (!deck || !editDeckName.trim()) {
            Alert.alert(t('deckDetail.required'), t('deckDetail.deckNameRequired'));
            return;
        }
        setIsSavingDeck(true);
        try {
            await updateDeckMetadata(deck, {
                name: editDeckName.trim(),
                cefrLevel: editDeckLevel,
                category: editDeckCategory,
            });
            await load();
            setShowEditDeck(false);
        } catch {
            Alert.alert(t('common.error'), t('deckDetail.updateFailed'));
        } finally {
            setIsSavingDeck(false);
        }
    };

    // ─── Quiz ───────────────────────────────────────────────────────
    const handleQuizMode = (mode: 'mc' | 'match' | 'spell') => {
        setShowQuizModal(false);
        const route = mode === 'mc' ? '/quiz-mc' : mode === 'match' ? '/quiz-match' : '/quiz-spell';
        router.push({ pathname: route as any, params: { deckId, deckName: deck?.name } });
    };

    // ─── Loading State ──────────────────────────────────────────────
    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: tc.background }]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    // ─── Render ─────────────────────────────────────────────────────
    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: tc.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* ── Header ─────────────────────────────────────────── */}
            <View style={[styles.header, { backgroundColor: tc.surface, borderBottomColor: tc.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color={tc.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: tc.text }]} numberOfLines={1}>
                    {deck?.name || 'Deck'}
                </Text>
                <TouchableOpacity onPress={openEditDeck} style={styles.headerBtn}>
                    <Ionicons name="create-outline" size={24} color={tc.text} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={displayCards}
                keyExtractor={(card) => card.id}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={5}
                renderItem={({ item: card }) => (
                    <View
                        style={[styles.cardItem, { backgroundColor: tc.surface }]}
                    >
                        {editingCardId === card.id ? (
                            /* ── Inline Edit Form ── */
                            <View style={styles.editForm}>
                                <TextInput
                                    style={[
                                        styles.editInput,
                                        { backgroundColor: tc.background, color: tc.text, borderColor: tc.border },
                                    ]}
                                    value={editFront}
                                    onChangeText={setEditFront}
                                    placeholder={t('deckDetail.wordPlaceholder')}
                                    placeholderTextColor={tc.textMuted}
                                    autoFocus
                                />
                                <TextInput
                                    style={[
                                        styles.editInput,
                                        { backgroundColor: tc.background, color: tc.text, borderColor: tc.border },
                                    ]}
                                    value={editBack}
                                    onChangeText={setEditBack}
                                    placeholder={t('deckDetail.translationPlaceholder')}
                                    placeholderTextColor={tc.textMuted}
                                />
                                <TextInput
                                    style={[
                                        styles.editInput,
                                        { backgroundColor: tc.background, color: tc.text, borderColor: tc.border },
                                    ]}
                                    value={editExample}
                                    onChangeText={setEditExample}
                                    placeholder={t('deckDetail.exampleOptional')}
                                    placeholderTextColor={tc.textMuted}
                                />
                                <View style={styles.editActions}>
                                    <TouchableOpacity
                                        style={[styles.editActionBtn, { backgroundColor: colors.primary[500] }]}
                                        onPress={() => saveEditCard(card)}
                                        disabled={isSavingCard}
                                    >
                                        {isSavingCard ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.editActionBtnText}>{t('common.save')}</Text>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.editActionBtn, { backgroundColor: tc.border }]}
                                        onPress={() => setEditingCardId(null)}
                                    >
                                        <Text style={[styles.editActionBtnText, { color: tc.text }]}>
                                            {t('common.cancel')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            /* ── Normal Card View ── */
                            <View style={styles.cardNormal}>
                                <View style={styles.cardContent}>
                                    <View style={styles.cardTopRow}>
                                        <Text style={[styles.cardFront, { color: tc.text }]} numberOfLines={1}>
                                            {card.front}
                                        </Text>
                                        <View style={styles.cardBadges}>
                                            <View
                                                style={[
                                                    styles.cefrBadge,
                                                    {
                                                        backgroundColor:
                                                            (getLevelColor(card.cefrLevel)) + '22',
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.cefrBadgeText,
                                                        { color: getLevelColor(card.cefrLevel) },
                                                    ]}
                                                >
                                                    {getLevelLabel(card.targetLanguage || deck?.targetLanguage || 'en', parseInt(card.cefrLevel, 10) || 1)}
                                                </Text>
                                            </View>
                                            <View
                                                style={[
                                                    styles.statusDot,
                                                    {
                                                        backgroundColor:
                                                            STATUS_COLORS[card.status] || '#6366F1',
                                                    },
                                                ]}
                                            />
                                        </View>
                                    </View>
                                    <Text style={[styles.cardBack, { color: colors.primary[400] }]}>
                                        {card.back}
                                    </Text>
                                    {card.exampleSentence ? (
                                        <Text
                                            style={[styles.cardExample, { color: tc.textSecondary }]}
                                            numberOfLines={2}
                                        >
                                            {card.exampleSentence}
                                        </Text>
                                    ) : null}
                                </View>
                                <View style={styles.cardActions}>
                                    <TouchableOpacity
                                        style={styles.cardActionBtn}
                                        onPress={() => startEditCard(card)}
                                    >
                                        <Ionicons name="pencil-outline" size={18} color={tc.textSecondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.cardActionBtn}
                                        onPress={() => handleDeleteCard(card)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={colors.error.main} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                )}
                ListHeaderComponent={<>
                {/* ── Stats Card ─────────────────────────────────── */}
                <Animated.View
                    entering={FadeInDown.duration(400)}
                    style={[styles.statsCard, { backgroundColor: tc.surface }]}
                >
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.primary[400] }]}>{cards.length}</Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>{t('deckDetail.statsCards')}</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: tc.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.warning.main }]}>{dueCount}</Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>{t('deckDetail.statsDue')}</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: tc.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.success.main }]}>{progressPercent}%</Text>
                            <Text style={[styles.statLabel, { color: tc.textMuted }]}>{t('deckDetail.statsDone')}</Text>
                        </View>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: tc.border }]}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progressPercent}%` as any, backgroundColor: colors.success.main },
                            ]}
                        />
                    </View>
                    <View style={styles.deckMetaRow}>
                        <View
                            style={[
                                styles.cefrPill,
                                { backgroundColor: (getLevelColor(deck?.cefrLevel || '1')) + '25' },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.cefrPillText,
                                    { color: getLevelColor(deck?.cefrLevel || '1') },
                                ]}
                            >
                                {getLevelLabel(deck?.targetLanguage || 'en', parseInt(deck?.cefrLevel || '1', 10) || 1)}
                            </Text>
                        </View>
                        {deck?.category && (
                            <Text style={[styles.categoryText, { color: tc.textSecondary }]}>{deck.category}</Text>
                        )}
                    </View>
                </Animated.View>

                {/* ── CTA Buttons ────────────────────────────────── */}
                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.ctaRow}>
                    <TouchableOpacity
                        style={[styles.ctaBtn, { backgroundColor: colors.accent[600], flex: 1 }]}
                        onPress={() =>
                            router.push({ pathname: '/study', params: { deckId, deckName: deck?.name } })
                        }
                        activeOpacity={0.8}
                    >
                        <Ionicons name="book-outline" size={18} color="#fff" />
                        <Text style={styles.ctaBtnTextWhite}>{t('deckDetail.studyBtn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.ctaBtn,
                            {
                                flex: 1,
                                backgroundColor: colors.primary[500] + '18',
                                borderWidth: 1.5,
                                borderColor: colors.primary[500],
                                elevation: 0,
                                shadowOpacity: 0,
                            },
                        ]}
                        onPress={() => setShowQuizModal(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="trophy-outline" size={18} color={colors.primary[400]} />
                        <Text style={[styles.ctaBtnText, { color: colors.primary[400] }]}>{t('deckDetail.testBtn')}</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* ── Search + Sort ───────────────────────────────── */}
                <Animated.View entering={FadeInDown.duration(400).delay(100)}>
                    <View style={styles.searchRow}>
                        <View
                            style={[styles.searchBox, { backgroundColor: tc.surface, borderColor: tc.border }]}
                        >
                            <Ionicons name="search-outline" size={16} color={tc.textMuted} />
                            <TextInput
                                style={[styles.searchInput, { color: tc.text }]}
                                placeholder={t('deckDetail.searchPlaceholder')}
                                placeholderTextColor={tc.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={16} color={tc.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity
                            style={[styles.sortBtn, { backgroundColor: tc.surface, borderColor: tc.border }]}
                            onPress={() =>
                                setSortMode((m) => {
                                    const idx = SORT_CYCLE.indexOf(m);
                                    return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
                                })
                            }
                        >
                            <Ionicons name="swap-vertical-outline" size={15} color={tc.textSecondary} />
                            <Text style={[styles.sortBtnText, { color: tc.textSecondary }]}>
                                {SORT_LABELS[sortMode]}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Status filter chips */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScroll}
                    >
                        <View style={styles.filterRow}>
                            {STATUS_FILTERS.map((f) => (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[
                                        styles.filterChip,
                                        {
                                            backgroundColor:
                                                statusFilter === f.key ? colors.primary[500] : tc.surface,
                                            borderColor:
                                                statusFilter === f.key ? colors.primary[500] : tc.border,
                                        },
                                    ]}
                                    onPress={() => setStatusFilter(f.key)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            { color: statusFilter === f.key ? '#fff' : tc.textSecondary },
                                        ]}
                                    >
                                        {t(f.labelKey)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </Animated.View>

                {/* ── Add Word Toggle ─────────────────────────────── */}
                <Animated.View entering={FadeInDown.duration(400).delay(120)}>
                    <TouchableOpacity
                        style={[
                            styles.addWordToggle,
                            {
                                backgroundColor: showAddWord ? colors.primary[500] : tc.surface,
                                borderColor: showAddWord ? colors.primary[500] : tc.border,
                            },
                        ]}
                        onPress={() => (showAddWord ? closeAddWord() : setShowAddWord(true))}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name={showAddWord ? 'close' : 'add'}
                            size={18}
                            color={showAddWord ? '#fff' : colors.primary[400]}
                        />
                        <Text
                            style={[
                                styles.addWordToggleText,
                                { color: showAddWord ? '#fff' : colors.primary[400] },
                            ]}
                        >
                            {showAddWord ? t('common.cancel') : t('deckDetail.addWord')}
                        </Text>
                    </TouchableOpacity>

                    {showAddWord && (
                        <Animated.View
                            entering={FadeInDown.duration(300)}
                            style={[styles.addWordPanel, { backgroundColor: tc.surface, borderColor: tc.border }]}
                        >
                            <View style={styles.addWordRow}>
                                <TextInput
                                    style={[
                                        styles.addWordInput,
                                        { backgroundColor: tc.background, color: tc.text, borderColor: tc.border },
                                    ]}
                                    placeholder={t('deckDetail.typeWord')}
                                    placeholderTextColor={tc.textMuted}
                                    value={manualWord}
                                    onChangeText={(t) => {
                                        setManualWord(t);
                                        if (showManualFields) setShowManualFields(false);
                                    }}
                                    autoCapitalize="none"
                                    returnKeyType="search"
                                    onSubmitEditing={lookupWord}
                                    autoFocus
                                />
                                <TouchableOpacity
                                    style={[styles.addWordSearchBtn, { backgroundColor: colors.primary[500] }]}
                                    onPress={lookupWord}
                                    disabled={isLookingUp || !manualWord.trim()}
                                    activeOpacity={0.8}
                                >
                                    {isLookingUp ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Ionicons name="search" size={20} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {showManualFields && (
                                <Animated.View entering={FadeInDown.duration(300)} style={styles.manualFields}>
                                    <View style={styles.manualNote}>
                                        <Ionicons
                                            name="information-circle-outline"
                                            size={14}
                                            color={tc.textSecondary}
                                        />
                                        <Text style={[styles.manualNoteText, { color: tc.textSecondary }]}>
                                            {t('deckDetail.notInDict')}
                                        </Text>
                                    </View>
                                    <TextInput
                                        style={[
                                            styles.manualInput,
                                            {
                                                backgroundColor: tc.background,
                                                color: tc.text,
                                                borderColor: tc.border,
                                            },
                                        ]}
                                        placeholder={t('deckDetail.translationRequired')}
                                        placeholderTextColor={tc.textMuted}
                                        value={manualTranslation}
                                        onChangeText={setManualTranslation}
                                    />
                                    <TextInput
                                        style={[
                                            styles.manualInput,
                                            {
                                                backgroundColor: tc.background,
                                                color: tc.text,
                                                borderColor: tc.border,
                                            },
                                        ]}
                                        placeholder={t('deckDetail.exampleOptional')}
                                        placeholderTextColor={tc.textMuted}
                                        value={manualExample}
                                        onChangeText={setManualExample}
                                    />
                                    <TouchableOpacity
                                        style={[styles.manualAddBtn, { backgroundColor: colors.primary[500] }]}
                                        onPress={addManualCard}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="checkmark" size={18} color="#fff" />
                                        <Text style={styles.manualAddBtnText}>{t('deckDetail.addToDeck')}</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            )}
                        </Animated.View>
                    )}
                </Animated.View>

                {/* ── Card List Header ────────────────────────────── */}
                <Text style={[styles.cardListLabel, { color: tc.textSecondary }]}>
                    {searchQuery || statusFilter !== 'all'
                        ? t('deckDetail.cardsOf', { shown: displayCards.length, total: cards.length })
                        : t('deckDetail.cardsTotal', { count: cards.length })}
                </Text>
                </>}
                ListEmptyComponent={
                    <View style={[styles.emptyState, { backgroundColor: tc.surface }]}>
                        <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>
                            {cards.length === 0 ? '📭' : '🔍'}
                        </Text>
                        <Text style={[styles.emptyText, { color: tc.textSecondary }]}>
                            {cards.length === 0
                                ? t('deckDetail.noCardsMsg')
                                : t('deckDetail.noCardsFilter')}
                        </Text>
                    </View>
                }
                ListFooterComponent={<View style={{ height: 60 }} />}
            />

            {/* ── Edit Deck Modal ───────────────────────────────── */}
            <Modal
                visible={showEditDeck}
                transparent
                animationType="slide"
                onRequestClose={() => setShowEditDeck(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowEditDeck(false)}>
                    <Pressable style={[styles.modalBox, { backgroundColor: tc.surface }]} onPress={() => {}}>
                        <Text style={[styles.modalTitle, { color: tc.text }]}>{t('deckDetail.editModal.title')}</Text>

                        <Text style={[styles.modalLabel, { color: tc.textSecondary }]}>{t('deckDetail.editModal.nameLabel')}</Text>
                        <TextInput
                            style={[
                                styles.modalInput,
                                { backgroundColor: tc.background, color: tc.text, borderColor: tc.border },
                            ]}
                            value={editDeckName}
                            onChangeText={setEditDeckName}
                            placeholder={t('deckDetail.editModal.namePlaceholder')}
                            placeholderTextColor={tc.textMuted}
                        />

                        <Text style={[styles.modalLabel, { color: tc.textSecondary }]}>{t('deckDetail.editModal.levelLabel')}</Text>
                        <View style={styles.chipRow}>
                            {getLevelOptions(deck?.targetLanguage || 'en').map(({ level, label }) => (
                                <TouchableOpacity
                                    key={level}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor:
                                                editDeckLevel === String(level) ? colors.primary[500] : tc.background,
                                            borderColor:
                                                editDeckLevel === String(level) ? colors.primary[500] : tc.border,
                                        },
                                    ]}
                                    onPress={() => setEditDeckLevel(String(level))}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            { color: editDeckLevel === String(level) ? '#fff' : tc.text },
                                        ]}
                                    >
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.modalLabel, { color: tc.textSecondary }]}>{t('deckDetail.editModal.categoryLabel')}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.chipRow}>
                                {CATEGORY_KEYS.map((cat) => (
                                    <TouchableOpacity
                                        key={cat.value}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor:
                                                    editDeckCategory === cat.value ? colors.accent[500] : tc.background,
                                                borderColor:
                                                    editDeckCategory === cat.value ? colors.accent[500] : tc.border,
                                            },
                                        ]}
                                        onPress={() => setEditDeckCategory(cat.value)}
                                    >
                                        <Text
                                            style={[
                                                styles.chipText,
                                                { color: editDeckCategory === cat.value ? '#fff' : tc.text },
                                            ]}
                                        >
                                            {t(cat.key)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.modalSaveBtn, { backgroundColor: colors.primary[500] }]}
                            onPress={saveEditDeck}
                            disabled={isSavingDeck}
                        >
                            {isSavingDeck ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.modalSaveBtnText}>{t('deckDetail.editModal.saveChanges')}</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditDeck(false)}>
                            <Text style={[styles.modalCancelText, { color: tc.textMuted }]}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ── Quiz Modal ────────────────────────────────────── */}
            <Modal
                visible={showQuizModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowQuizModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowQuizModal(false)}>
                    <Pressable style={[styles.modalBox, { backgroundColor: tc.surface }]} onPress={() => {}}>
                        <Text style={[styles.modalTitle, { color: tc.text }]}>{t('decks.testYourself')}</Text>
                        <Text style={[styles.modalSubtitle, { color: tc.textSecondary }]}>{deck?.name}</Text>

                        <TouchableOpacity
                            style={[
                                styles.quizModeBtn,
                                { backgroundColor: colors.primary[500] + '18', borderColor: colors.primary[500] },
                            ]}
                            onPress={() => handleQuizMode('mc')}
                            activeOpacity={0.8}
                        >
                            <View
                                style={[
                                    styles.quizModeIcon,
                                    { backgroundColor: colors.primary[500] + '25' },
                                ]}
                            >
                                <Ionicons name="list" size={22} color={colors.primary[400]} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.quizModeName, { color: tc.text }]}>{t('decks.quiz.multipleChoice')}</Text>
                                <Text style={[styles.quizModeDesc, { color: tc.textMuted }]}>
                                    {t('decks.quiz.multipleChoiceDesc')}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.quizModeBtn,
                                { backgroundColor: colors.accent[500] + '18', borderColor: colors.accent[400] },
                            ]}
                            onPress={() => handleQuizMode('match')}
                            activeOpacity={0.8}
                        >
                            <View
                                style={[
                                    styles.quizModeIcon,
                                    { backgroundColor: colors.accent[400] + '25' },
                                ]}
                            >
                                <Ionicons name="git-compare-outline" size={22} color={colors.accent[400]} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.quizModeName, { color: tc.text }]}>{t('decks.quiz.matching')}</Text>
                                <Text style={[styles.quizModeDesc, { color: tc.textMuted }]}>
                                    {t('decks.quiz.matchingDesc')}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.quizModeBtn,
                                {
                                    backgroundColor: colors.success.main + '18',
                                    borderColor: colors.success.main,
                                },
                            ]}
                            onPress={() => handleQuizMode('spell')}
                            activeOpacity={0.8}
                        >
                            <View
                                style={[
                                    styles.quizModeIcon,
                                    { backgroundColor: colors.success.main + '25' },
                                ]}
                            >
                                <Ionicons name="pencil-outline" size={22} color={colors.success.main} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.quizModeName, { color: tc.text }]}>{t('decks.quiz.spelling')}</Text>
                                <Text style={[styles.quizModeDesc, { color: tc.textMuted }]}>
                                    {t('decks.quiz.spellingDesc')}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowQuizModal(false)}>
                            <Text style={[styles.modalCancelText, { color: tc.textMuted }]}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        paddingTop: 56,
        paddingBottom: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerBtn: { padding: spacing.xs },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.md,
        fontWeight: '700',
        textAlign: 'center',
        marginHorizontal: spacing.sm,
    },

    // Content
    content: { padding: spacing.base },

    // Stats card
    statsCard: {
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: typography.fontSize.xl, fontWeight: '700' },
    statLabel: { fontSize: typography.fontSize.xs, marginTop: 2 },
    statDivider: { width: 1, height: 36 },
    progressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: spacing.md,
    },
    progressFill: { height: '100%', borderRadius: 3 },
    deckMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    cefrPill: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
    },
    cefrPillText: { fontSize: typography.fontSize.xs, fontWeight: '700' },
    categoryText: { fontSize: typography.fontSize.xs },

    // CTA buttons
    ctaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    ctaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.xs,
        ...shadows.sm,
    },
    ctaBtnTextWhite: { color: '#fff', fontWeight: '700', fontSize: typography.fontSize.base },
    ctaBtnText: { fontWeight: '700', fontSize: typography.fontSize.base },

    // Search + sort
    searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        gap: spacing.xs,
    },
    searchInput: { flex: 1, fontSize: typography.fontSize.sm },
    sortBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        gap: 4,
    },
    sortBtnText: { fontSize: typography.fontSize.xs, fontWeight: '600' },

    // Filter chips
    filterScroll: { marginBottom: spacing.md },
    filterRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
    filterChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    filterChipText: { fontSize: typography.fontSize.xs, fontWeight: '600' },

    // Add word
    addWordToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    addWordToggleText: { fontSize: typography.fontSize.sm, fontWeight: '700' },
    addWordPanel: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        padding: spacing.base,
        marginBottom: spacing.md,
    },
    addWordRow: { flexDirection: 'row', gap: spacing.sm },
    addWordInput: {
        flex: 1,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        fontSize: typography.fontSize.base,
    },
    addWordSearchBtn: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    manualFields: { marginTop: spacing.md, gap: spacing.sm },
    manualNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    manualNoteText: { fontSize: typography.fontSize.xs, flex: 1 },
    manualInput: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        fontSize: typography.fontSize.base,
    },
    manualAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
        marginTop: spacing.xs,
    },
    manualAddBtnText: { color: '#fff', fontWeight: '700', fontSize: typography.fontSize.base },

    // Card list
    cardListLabel: {
        fontSize: typography.fontSize.xs,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: spacing.sm,
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing['2xl'],
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
    },
    emptyText: {
        fontSize: typography.fontSize.base,
        textAlign: 'center',
        lineHeight: 22,
    },

    // Card item
    cardItem: {
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        padding: spacing.base,
        ...shadows.sm,
    },
    cardNormal: { flexDirection: 'row', alignItems: 'flex-start' },
    cardContent: { flex: 1 },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 3,
    },
    cardFront: { fontSize: typography.fontSize.base, fontWeight: '600', flex: 1 },
    cardBadges: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.sm },
    cefrBadge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: borderRadius.sm },
    cefrBadgeText: { fontSize: 10, fontWeight: '700' },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    cardBack: { fontSize: typography.fontSize.sm },
    cardExample: { fontSize: typography.fontSize.xs, marginTop: 3, fontStyle: 'italic' },
    cardActions: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.xs,
        marginLeft: spacing.sm,
    },
    cardActionBtn: { padding: spacing.xs },

    // Inline edit
    editForm: { gap: spacing.sm },
    editInput: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        fontSize: typography.fontSize.sm,
    },
    editActions: { flexDirection: 'row', gap: spacing.sm },
    editActionBtn: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    editActionBtnText: { color: '#fff', fontWeight: '600', fontSize: typography.fontSize.sm },

    // Chip selector (edit deck modal)
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    chip: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    chipText: { fontSize: typography.fontSize.sm, fontWeight: '600' },

    // Modals
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
    modalLabel: {
        fontSize: typography.fontSize.xs,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: spacing.sm,
        marginTop: spacing.md,
    },
    modalInput: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        fontSize: typography.fontSize.base,
        marginBottom: spacing.sm,
    },
    modalSaveBtn: {
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        marginTop: spacing.md,
    },
    modalSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: typography.fontSize.base },
    modalCancel: { alignItems: 'center', paddingTop: spacing.md },
    modalCancelText: { fontSize: typography.fontSize.base, fontWeight: '600' },

    // Quiz mode buttons
    quizModeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: borderRadius.lg,
        borderWidth: 1.5,
        padding: spacing.base,
        marginBottom: spacing.sm,
        gap: spacing.md,
    },
    quizModeIcon: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quizModeName: { fontSize: typography.fontSize.base, fontWeight: '700', marginBottom: 2 },
    quizModeDesc: { fontSize: typography.fontSize.xs },
});
