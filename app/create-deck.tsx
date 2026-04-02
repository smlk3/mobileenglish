import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getVectorStore } from '../src/shared/api/rag/VectorStore';
import { getLevelOptions, cefrToLevel } from '../src/shared/lib/languageConfig';
import { addCardsToDecks, createDeck } from '../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, shadows, spacing, typography } from '../src/shared/lib/theme';

const CATEGORIES = ['General', 'Business', 'Medical', 'Technology', 'Academic', 'Daily Life', 'Travel', 'Sports'];

interface GeneratedWord {
    word: string;
    translation: string;
    cefrLevel: string;
    category: string;
    exampleSentence: string;
    source: 'ai' | 'manual';
}

export default function CreateDeckScreen() {
    const router = useRouter();
    const themeMode = useProfileStore((s) => s.themeMode);
    const targetLanguage = useProfileStore((s) => s.targetLanguage);
    const nativeLanguage = useProfileStore((s) => s.nativeLanguage);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;
    const profile = useProfileStore();

    const levelOptions = getLevelOptions(targetLanguage);

    // Deck metadata
    const [name, setName] = useState('');
    const [selectedLevel, setSelectedLevel] = useState(3); // Default: level 3 (B1 / N3)
    const [selectedCategory, setSelectedCategory] = useState('General');
    const [wordCount, setWordCount] = useState(10);

    // Word list (shared between both tabs)
    const [generatedWords, setGeneratedWords] = useState<GeneratedWord[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Tab state
    const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');

    // Manual Add state
    const [manualWord, setManualWord] = useState('');
    const [manualTranslation, setManualTranslation] = useState('');
    const [manualExample, setManualExample] = useState('');
    const [showManualFields, setShowManualFields] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);

    // Inline edit state
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editWord, setEditWord] = useState('');
    const [editTranslation, setEditTranslation] = useState('');
    const [editExample, setEditExample] = useState('');

    // ─── AI Generate ───────────────────────────────────────────────
    const generateWords = async () => {
        setIsGenerating(true);
        try {
            const vectorStore = getVectorStore(targetLanguage, nativeLanguage);
            const words = vectorStore.search({
                level: selectedLevel,
                interests: profile.interests,
                limit: wordCount,
            });

            setGeneratedWords(
                words.map((w) => ({
                    word: w.word,
                    translation: w.translation,
                    cefrLevel: String(w.level),
                    category: w.category,
                    exampleSentence: w.exampleSentence,
                    source: 'ai',
                })),
            );
        } catch {
            Alert.alert('Error', 'Failed to generate words. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    // ─── Manual Add ────────────────────────────────────────────────
    const lookupWord = () => {
        const trimmed = manualWord.trim();
        if (!trimmed) return;

        // Duplicate check
        if (generatedWords.some((w) => w.word.toLowerCase() === trimmed.toLowerCase())) {
            Alert.alert('Duplicate', `"${trimmed}" is already in the list.`);
            return;
        }

        setIsLookingUp(true);
        try {
            const vectorStore = getVectorStore(targetLanguage, nativeLanguage);
            const found = vectorStore.findByWord(trimmed);

            if (found) {
                // Auto-fill from dictionary and add immediately
                setGeneratedWords((prev) => [
                    ...prev,
                    {
                        word: found.word,
                        translation: found.translation,
                        cefrLevel: String(found.level),
                        category: found.category,
                        exampleSentence: found.exampleSentence,
                        source: 'manual',
                    },
                ]);
                setManualWord('');
                setManualTranslation('');
                setManualExample('');
                setShowManualFields(false);
            } else {
                // Word not in dictionary — show manual form
                setShowManualFields(true);
                setManualTranslation('');
                setManualExample('');
            }
        } finally {
            setIsLookingUp(false);
        }
    };

    const addManualWord = () => {
        const trimmed = manualWord.trim();
        if (!trimmed || !manualTranslation.trim()) {
            Alert.alert('Required', 'Word and translation are required.');
            return;
        }

        setGeneratedWords((prev) => [
            ...prev,
            {
                word: trimmed,
                translation: manualTranslation.trim(),
                cefrLevel: String(selectedLevel),
                category: selectedCategory,
                exampleSentence: manualExample.trim(),
                source: 'manual',
            },
        ]);
        setManualWord('');
        setManualTranslation('');
        setManualExample('');
        setShowManualFields(false);
    };

    // ─── Word List Actions ──────────────────────────────────────────
    const removeWord = (index: number) => {
        setGeneratedWords((prev) => prev.filter((_, i) => i !== index));
        if (editingIndex === index) setEditingIndex(null);
    };

    const startEdit = (index: number) => {
        const w = generatedWords[index];
        setEditingIndex(index);
        setEditWord(w.word);
        setEditTranslation(w.translation);
        setEditExample(w.exampleSentence);
    };

    const saveEdit = (index: number) => {
        if (!editWord.trim() || !editTranslation.trim()) {
            Alert.alert('Required', 'Word and translation cannot be empty.');
            return;
        }
        setGeneratedWords((prev) =>
            prev.map((w, i) =>
                i === index
                    ? { ...w, word: editWord.trim(), translation: editTranslation.trim(), exampleSentence: editExample.trim() }
                    : w,
            ),
        );
        setEditingIndex(null);
    };

    const cancelEdit = () => setEditingIndex(null);

    // ─── Save Deck ─────────────────────────────────────────────────
    const saveDeck = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a deck name.');
            return;
        }
        if (generatedWords.length === 0) {
            Alert.alert('Error', 'Add at least one word before saving.');
            return;
        }

        setIsSaving(true);
        try {
            const deck = await createDeck({
                name: name.trim(),
                cefrLevel: String(selectedLevel),
                category: selectedCategory,
                targetLanguage,
            });

            await addCardsToDecks(
                deck.id,
                generatedWords.map((w) => ({
                    front: w.word,
                    back: w.translation,
                    exampleSentence: w.exampleSentence,
                    cefrLevel: w.cefrLevel,
                    category: w.category,
                })),
            );

            router.back();
        } catch {
            Alert.alert('Error', 'Failed to save deck. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Render ────────────────────────────────────────────────────
    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: tc.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Header */}
            <View style={[styles.header, { backgroundColor: tc.surface, borderBottomColor: tc.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                    <Ionicons name="close" size={24} color={tc.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: tc.text }]}>Create Deck</Text>
                <TouchableOpacity
                    onPress={saveDeck}
                    style={[styles.headerButton, styles.saveButton, { backgroundColor: colors.primary[500] }]}
                    disabled={isSaving || generatedWords.length === 0}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Deck Name */}
                <Animated.View entering={FadeInDown.duration(400)}>
                    <Text style={[styles.label, { color: tc.textSecondary }]}>DECK NAME</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border }]}
                        placeholder="e.g. Business English B2"
                        placeholderTextColor={tc.textMuted}
                        value={name}
                        onChangeText={setName}
                    />
                </Animated.View>

                {/* Proficiency Level */}
                <Animated.View entering={FadeInDown.duration(400).delay(50)}>
                    <Text style={[styles.label, { color: tc.textSecondary }]}>LEVEL</Text>
                    <View style={styles.chipRow}>
                        {levelOptions.map(({ level, label }) => (
                            <TouchableOpacity
                                key={level}
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: selectedLevel === level ? colors.primary[500] : tc.surface,
                                        borderColor: selectedLevel === level ? colors.primary[500] : tc.border,
                                    },
                                ]}
                                onPress={() => setSelectedLevel(level)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        { color: selectedLevel === level ? '#fff' : tc.text },
                                    ]}
                                >
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>

                {/* Category */}
                <Animated.View entering={FadeInDown.duration(400).delay(100)}>
                    <Text style={[styles.label, { color: tc.textSecondary }]}>CATEGORY</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                        <View style={styles.chipRow}>
                            {CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: selectedCategory === cat ? colors.accent[500] : tc.surface,
                                            borderColor: selectedCategory === cat ? colors.accent[500] : tc.border,
                                        },
                                    ]}
                                    onPress={() => setSelectedCategory(cat)}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            { color: selectedCategory === cat ? '#fff' : tc.text },
                                        ]}
                                    >
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </Animated.View>

                {/* ── Tab Switcher ─────────────────────────────── */}
                <Animated.View entering={FadeInDown.duration(400).delay(150)} style={[styles.tabSwitcher, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'ai' && { backgroundColor: colors.accent[600] }]}
                        onPress={() => setActiveTab('ai')}
                    >
                        <Ionicons name="sparkles" size={14} color={activeTab === 'ai' ? '#fff' : tc.textSecondary} />
                        <Text style={[styles.tabText, { color: activeTab === 'ai' ? '#fff' : tc.textSecondary }]}>
                            AI Generate
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'manual' && { backgroundColor: colors.primary[500] }]}
                        onPress={() => setActiveTab('manual')}
                    >
                        <Ionicons name="pencil" size={14} color={activeTab === 'manual' ? '#fff' : tc.textSecondary} />
                        <Text style={[styles.tabText, { color: activeTab === 'manual' ? '#fff' : tc.textSecondary }]}>
                            Manual Add
                        </Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* ── AI Generate Tab ──────────────────────────── */}
                {activeTab === 'ai' && (
                    <Animated.View entering={FadeInDown.duration(300)}>
                        {/* Word Count */}
                        <Text style={[styles.label, { color: tc.textSecondary }]}>WORD COUNT</Text>
                        <View style={styles.chipRow}>
                            {[5, 10, 15, 20].map((count) => (
                                <TouchableOpacity
                                    key={count}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: wordCount === count ? colors.primary[500] : tc.surface,
                                            borderColor: wordCount === count ? colors.primary[500] : tc.border,
                                        },
                                    ]}
                                    onPress={() => setWordCount(count)}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            { color: wordCount === count ? '#fff' : tc.text },
                                        ]}
                                    >
                                        {count}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Generate Button */}
                        <TouchableOpacity
                            style={[styles.generateButton, { backgroundColor: colors.accent[600] }]}
                            onPress={generateWords}
                            disabled={isGenerating}
                            activeOpacity={0.8}
                        >
                            {isGenerating ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="sparkles" size={20} color="#fff" />
                                    <Text style={styles.generateText}>Generate Words</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* ── Manual Add Tab ───────────────────────────── */}
                {activeTab === 'manual' && (
                    <Animated.View entering={FadeInDown.duration(300)}>
                        <Text style={[styles.label, { color: tc.textSecondary }]}>ADD A WORD</Text>

                        {/* Word input row */}
                        <View style={styles.manualInputRow}>
                            <TextInput
                                style={[
                                    styles.manualWordInput,
                                    { backgroundColor: tc.surface, color: tc.text, borderColor: tc.border },
                                ]}
                                placeholder="Type a word..."
                                placeholderTextColor={tc.textMuted}
                                value={manualWord}
                                onChangeText={(t) => {
                                    setManualWord(t);
                                    if (showManualFields) setShowManualFields(false);
                                }}
                                autoCapitalize="none"
                                returnKeyType="search"
                                onSubmitEditing={lookupWord}
                            />
                            <TouchableOpacity
                                style={[styles.addWordButton, { backgroundColor: colors.primary[500] }]}
                                onPress={lookupWord}
                                disabled={isLookingUp || !manualWord.trim()}
                                activeOpacity={0.8}
                            >
                                {isLookingUp ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="add" size={24} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Manual fallback form — shown when word not found in dictionary */}
                        {showManualFields && (
                            <Animated.View
                                entering={FadeInDown.duration(300)}
                                style={[styles.manualForm, { backgroundColor: tc.surface, borderColor: tc.border }]}
                            >
                                <View style={styles.manualFormHeader}>
                                    <Ionicons name="information-circle-outline" size={16} color={tc.textSecondary} />
                                    <Text style={[styles.manualFormNote, { color: tc.textSecondary }]}>
                                        Word not found in dictionary. Fill in manually:
                                    </Text>
                                </View>
                                <TextInput
                                    style={[styles.input, { backgroundColor: tc.background, color: tc.text, borderColor: tc.border, marginTop: spacing.sm }]}
                                    placeholder="Translation (required)"
                                    placeholderTextColor={tc.textMuted}
                                    value={manualTranslation}
                                    onChangeText={setManualTranslation}
                                />
                                <TextInput
                                    style={[styles.input, { backgroundColor: tc.background, color: tc.text, borderColor: tc.border, marginTop: spacing.sm }]}
                                    placeholder="Example sentence (optional)"
                                    placeholderTextColor={tc.textMuted}
                                    value={manualExample}
                                    onChangeText={setManualExample}
                                />
                                <TouchableOpacity
                                    style={[styles.generateButton, { backgroundColor: colors.primary[500], marginTop: spacing.base }]}
                                    onPress={addManualWord}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="checkmark" size={20} color="#fff" />
                                    <Text style={styles.generateText}>Add to List</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                    </Animated.View>
                )}

                {/* ── Word List (shared) ───────────────────────── */}
                {generatedWords.length > 0 && (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.label, { color: tc.textSecondary }]}>
                            WORDS ({generatedWords.length})
                        </Text>
                        {generatedWords.map((word, index) => (
                            <Animated.View
                                key={`${word.word}_${index}`}
                                entering={FadeInDown.duration(300).delay(index * 40)}
                                style={[styles.wordCard, { backgroundColor: tc.surface }]}
                            >
                                {editingIndex === index ? (
                                    /* ── Inline Edit Form ── */
                                    <View style={styles.editForm}>
                                        <TextInput
                                            style={[styles.editInput, { backgroundColor: tc.background, color: tc.text, borderColor: tc.border }]}
                                            value={editWord}
                                            onChangeText={setEditWord}
                                            placeholder="Word"
                                            placeholderTextColor={tc.textMuted}
                                        />
                                        <TextInput
                                            style={[styles.editInput, { backgroundColor: tc.background, color: tc.text, borderColor: tc.border }]}
                                            value={editTranslation}
                                            onChangeText={setEditTranslation}
                                            placeholder="Translation"
                                            placeholderTextColor={tc.textMuted}
                                        />
                                        <TextInput
                                            style={[styles.editInput, { backgroundColor: tc.background, color: tc.text, borderColor: tc.border }]}
                                            value={editExample}
                                            onChangeText={setEditExample}
                                            placeholder="Example sentence"
                                            placeholderTextColor={tc.textMuted}
                                        />
                                        <View style={styles.editActions}>
                                            <TouchableOpacity
                                                style={[styles.editActionBtn, { backgroundColor: colors.primary[500] }]}
                                                onPress={() => saveEdit(index)}
                                            >
                                                <Text style={styles.editActionText}>Save</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.editActionBtn, { backgroundColor: tc.border }]}
                                                onPress={cancelEdit}
                                            >
                                                <Text style={[styles.editActionText, { color: tc.text }]}>Cancel</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    /* ── Normal Card View ── */
                                    <>
                                        <View style={styles.wordContent}>
                                            <View style={styles.wordHeader}>
                                                <Text style={[styles.wordText, { color: tc.text }]}>
                                                    {word.word}
                                                </Text>
                                                {/* Source badge */}
                                                <View style={[
                                                    styles.sourceBadge,
                                                    { backgroundColor: word.source === 'ai' ? colors.accent[600] : colors.primary[500] },
                                                ]}>
                                                    <Text style={styles.sourceBadgeText}>
                                                        {word.source === 'ai' ? '✨ AI' : '✏️'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={[styles.translationText, { color: colors.primary[400] }]}>
                                                {word.translation}
                                            </Text>
                                            {word.exampleSentence ? (
                                                <Text
                                                    style={[styles.exampleText, { color: tc.textSecondary }]}
                                                    numberOfLines={2}
                                                >
                                                    {word.exampleSentence}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <View style={styles.cardActions}>
                                            <TouchableOpacity
                                                onPress={() => startEdit(index)}
                                                style={styles.cardActionBtn}
                                            >
                                                <Ionicons name="pencil-outline" size={18} color={tc.textSecondary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => removeWord(index)}
                                                style={styles.cardActionBtn}
                                            >
                                                <Ionicons name="close-circle" size={22} color={colors.error.main} />
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                            </Animated.View>
                        ))}
                    </Animated.View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        paddingTop: 56,
        paddingBottom: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerButton: {
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '700',
    },
    saveButton: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: typography.fontSize.base,
    },
    content: {
        padding: spacing.base,
    },
    label: {
        fontSize: typography.fontSize.xs,
        fontWeight: '700',
        letterSpacing: 1,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    input: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        fontSize: typography.fontSize.base,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    chipScroll: {
        marginHorizontal: -spacing.base,
        paddingHorizontal: spacing.base,
    },
    chip: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    chipText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    // Tab switcher
    tabSwitcher: {
        flexDirection: 'row',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        padding: 4,
        marginTop: spacing.xl,
        gap: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    tabText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    // Generate button (reused in both tabs)
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.base,
        borderRadius: borderRadius.lg,
        marginTop: spacing.xl,
        gap: spacing.sm,
        ...shadows.md,
    },
    generateText: {
        color: '#fff',
        fontSize: typography.fontSize.md,
        fontWeight: '700',
    },
    // Manual Add
    manualInputRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'center',
    },
    manualWordInput: {
        flex: 1,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        fontSize: typography.fontSize.base,
    },
    addWordButton: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.sm,
    },
    manualForm: {
        marginTop: spacing.base,
        padding: spacing.base,
        borderRadius: borderRadius.md,
        borderWidth: 1,
    },
    manualFormHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    manualFormNote: {
        fontSize: typography.fontSize.xs,
        flex: 1,
    },
    // Word card
    wordCard: {
        padding: spacing.base,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        ...shadows.sm,
    },
    wordContent: {
        flex: 1,
    },
    wordHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    wordText: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
        flex: 1,
    },
    sourceBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        marginLeft: spacing.sm,
    },
    sourceBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    translationText: {
        fontSize: typography.fontSize.sm,
        marginTop: 2,
    },
    exampleText: {
        fontSize: typography.fontSize.xs,
        marginTop: 4,
        fontStyle: 'italic',
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: spacing.sm,
        gap: spacing.xs,
    },
    cardActionBtn: {
        padding: spacing.xs,
    },
    // Inline edit
    editForm: {
        gap: spacing.sm,
    },
    editInput: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        fontSize: typography.fontSize.sm,
    },
    editActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    editActionBtn: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    editActionText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: typography.fontSize.sm,
    },
});
