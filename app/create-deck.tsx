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
import { addCardsToDecks, createDeck } from '../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, shadows, spacing, typography } from '../src/shared/lib/theme';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CATEGORIES = ['General', 'Business', 'Medical', 'Technology', 'Academic', 'Daily Life', 'Travel', 'Sports'];

interface GeneratedWord {
    word: string;
    translation: string;
    cefrLevel: string;
    category: string;
    exampleSentence: string;
}

export default function CreateDeckScreen() {
    const router = useRouter();
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;
    const profile = useProfileStore();

    const [name, setName] = useState('');
    const [selectedLevel, setSelectedLevel] = useState('B1');
    const [selectedCategory, setSelectedCategory] = useState('General');
    const [wordCount, setWordCount] = useState(10);
    const [generatedWords, setGeneratedWords] = useState<GeneratedWord[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const generateWords = async () => {
        setIsGenerating(true);
        try {
            const vectorStore = getVectorStore();
            const words = vectorStore.search({
                level: selectedLevel,
                interests: profile.interests,
                limit: wordCount,
            });

            setGeneratedWords(
                words.map((w) => ({
                    word: w.word,
                    translation: w.translation,
                    cefrLevel: w.cefrLevel,
                    category: w.category,
                    exampleSentence: w.exampleSentence,
                })),
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to generate words. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const removeWord = (index: number) => {
        setGeneratedWords((prev) => prev.filter((_, i) => i !== index));
    };

    const saveDeck = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a deck name.');
            return;
        }
        if (generatedWords.length === 0) {
            Alert.alert('Error', 'Please generate words first.');
            return;
        }

        setIsSaving(true);
        try {
            const deck = await createDeck({
                name: name.trim(),
                cefrLevel: selectedLevel,
                category: selectedCategory,
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
        } catch (error) {
            Alert.alert('Error', 'Failed to save deck. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

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

                {/* CEFR Level */}
                <Animated.View entering={FadeInDown.duration(400).delay(50)}>
                    <Text style={[styles.label, { color: tc.textSecondary }]}>CEFR LEVEL</Text>
                    <View style={styles.chipRow}>
                        {CEFR_LEVELS.map((level) => (
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
                                    {level}
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

                {/* Word Count */}
                <Animated.View entering={FadeInDown.duration(400).delay(150)}>
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
                </Animated.View>

                {/* Generate Button */}
                <Animated.View entering={FadeInDown.duration(400).delay(200)}>
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

                {/* Generated Words Preview */}
                {generatedWords.length > 0 && (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text style={[styles.label, { color: tc.textSecondary }]}>
                            GENERATED WORDS ({generatedWords.length})
                        </Text>
                        {generatedWords.map((word, index) => (
                            <Animated.View
                                key={`${word.word}_${index}`}
                                entering={FadeInDown.duration(300).delay(index * 40)}
                                style={[styles.wordCard, { backgroundColor: tc.surface }]}
                            >
                                <View style={styles.wordContent}>
                                    <Text style={[styles.wordText, { color: tc.text }]}>
                                        {word.word}
                                    </Text>
                                    <Text style={[styles.translationText, { color: colors.primary[400] }]}>
                                        {word.translation}
                                    </Text>
                                    <Text
                                        style={[styles.exampleText, { color: tc.textSecondary }]}
                                        numberOfLines={2}
                                    >
                                        {word.exampleSentence}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => removeWord(index)}
                                    style={styles.removeButton}
                                >
                                    <Ionicons name="close-circle" size={22} color={colors.error.main} />
                                </TouchableOpacity>
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
    wordCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.base,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        ...shadows.sm,
    },
    wordContent: {
        flex: 1,
    },
    wordText: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
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
    removeButton: {
        padding: spacing.xs,
    },
});
