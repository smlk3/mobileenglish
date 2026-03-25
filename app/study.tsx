import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    FadeIn,
    FadeInDown,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import type Card from '../src/entities/Card/model';
import { type Rating } from '../src/entities/SRS/SRSAlgorithm';
import {
    fetchCardsByDeck,
    fetchDueCards,
    recordStudySession,
    updateCardSRS,
} from '../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';
import { useXPStore } from '../src/shared/lib/stores/useXPStore';
import { borderRadius, colors, shadows, spacing, typography } from '../src/shared/lib/theme';
import { XP } from '../src/shared/lib/xpSystem';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

type Phase = 'loading' | 'empty' | 'flashcard' | 'results';

export default function StudyScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ deckId?: string; deckName?: string }>();
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;
    const awardXP = useXPStore((s) => s.awardXP);

    const [cards, setCards] = useState<Card[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [phase, setPhase] = useState<Phase>('loading');
    const [results, setResults] = useState<{ rating: Rating; cardId: string }[]>([]);
    const [startTime] = useState(Date.now());
    const [isReviewingAll, setIsReviewingAll] = useState(false); // UX #5
    const [sessionXP, setSessionXP] = useState(0); // UX #6

    // Card swipe animation values
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const rotation = useSharedValue(0);
    const cardScale = useSharedValue(1);
    const flipRotation = useSharedValue(0);

    // Load cards
    useEffect(() => {
        const load = async () => {
            try {
                let loadedCards: Card[];
                if (params.deckId) {
                    loadedCards = await fetchDueCards(params.deckId);
                    if (loadedCards.length === 0) {
                        loadedCards = await fetchCardsByDeck(params.deckId);
                        setIsReviewingAll(true); // UX #5: no due cards, reviewing all
                    }
                } else {
                    loadedCards = await fetchDueCards();
                }

                if (loadedCards.length === 0) {
                    setPhase('empty');
                } else {
                    setCards(loadedCards);
                    setPhase('flashcard');
                }
            } catch {
                setPhase('empty');
            }
        };
        load();
    }, [params.deckId]);

    const currentCard = cards[currentIndex];

    const goToNextCard = useCallback(
        async (rating: Rating) => {
            const card = cards[currentIndex];
            if (card) {
                // Update card SRS in DB
                try {
                    await updateCardSRS(card, rating);
                } catch (e) {
                    console.warn('Failed to update SRS:', e);
                }
                // Award XP silently (no toast — too frequent in flashcard mode)
                const xpAmount = rating === 'again' ? XP.FLASHCARD_WRONG : XP.FLASHCARD_CORRECT;
                const isFirst = results.length === 0 && currentIndex === 0;
                awardXP(xpAmount, { isFirstSession: isFirst }).then((res) => {
                    setSessionXP((prev) => prev + res.xpAwarded); // UX #6: track session XP
                }).catch(() => {});
                setResults((prev) => [...prev, { rating, cardId: card.id }]);
            }
            setIsFlipped(false);
            flipRotation.value = withTiming(0, { duration: 200 });

            if (currentIndex < cards.length - 1) {
                setCurrentIndex((prev) => prev + 1);
            } else {
                // Session complete — save to DB
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                const allResults = [...results, { rating, cardId: card?.id || '' }];
                const correctCount = allResults.filter((r) => r.rating !== 'again').length;

                try {
                    await recordStudySession({
                        deckId: params.deckId || 'all',
                        cardsStudied: cards.length,
                        cardsCorrect: correctCount,
                        durationSeconds: elapsed,
                        sessionType: 'flashcard',
                    });
                } catch (e) {
                    console.warn('Failed to save study session:', e);
                }

                setPhase('results');
            }
        },
        [currentIndex, cards, results, startTime, params.deckId, awardXP, setSessionXP],
    );

    const handleSwipeComplete = useCallback(
        (direction: 'left' | 'right' | 'up') => {
            const ratingMap: Record<string, Rating> = {
                left: 'again',
                right: 'good',
                up: 'easy',
            };
            goToNextCard(ratingMap[direction]);
        },
        [goToNextCard],
    );

    // Pan gesture for swiping
    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            translateX.value = e.translationX;
            translateY.value = e.translationY;
            rotation.value = interpolate(
                e.translationX,
                [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                [-15, 0, 15],
                Extrapolation.CLAMP,
            );
        })
        .onEnd((e) => {
            if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
                const direction = e.translationX > 0 ? 'right' : 'left';
                translateX.value = withTiming(
                    e.translationX > 0 ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5,
                    { duration: 300 },
                    () => {
                        runOnJS(handleSwipeComplete)(direction);
                        translateX.value = 0;
                        translateY.value = 0;
                        rotation.value = 0;
                    },
                );
            } else if (e.translationY < -100) {
                translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 300 }, () => {
                    runOnJS(handleSwipeComplete)('up');
                    translateX.value = 0;
                    translateY.value = 0;
                    rotation.value = 0;
                });
            } else {
                translateX.value = withSpring(0, { damping: 15 });
                translateY.value = withSpring(0, { damping: 15 });
                rotation.value = withSpring(0);
            }
        });

    // Tap gesture to flip card
    const tapGesture = Gesture.Tap().onEnd(() => {
        const targetValue = flipRotation.value === 0 ? 180 : 0;
        flipRotation.value = withSpring(targetValue, {
            damping: 12,
            stiffness: 100,
        });
        runOnJS(setIsFlipped)(!isFlipped);
    });

    const composedGesture = Gesture.Race(panGesture, tapGesture);

    // Animated card style
    const cardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotation.value}deg` },
            { scale: cardScale.value },
        ],
    }));

    const frontStyle = useAnimatedStyle(() => ({
        opacity: interpolate(flipRotation.value, [0, 90, 180], [1, 0, 0]),
        transform: [{ rotateY: `${flipRotation.value}deg` }],
    }));

    const backStyle = useAnimatedStyle(() => ({
        opacity: interpolate(flipRotation.value, [0, 90, 180], [0, 0, 1]),
        transform: [{ rotateY: `${flipRotation.value - 180}deg` }],
    }));

    const leftIndicatorStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
    }));

    const rightIndicatorStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    }));

    const upIndicatorStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [-100, 0], [1, 0], Extrapolation.CLAMP),
    }));

    // Loading state
    if (phase === 'loading') {
        return (
            <View style={[styles.container, styles.centeredContent, { backgroundColor: tc.background }]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text style={[styles.loadingText, { color: tc.textSecondary }]}>Loading cards...</Text>
            </View>
        );
    }

    // Empty state
    if (phase === 'empty') {
        return (
            <View style={[styles.container, styles.centeredContent, { backgroundColor: tc.background }]}>
                <Text style={{ fontSize: 64, marginBottom: spacing.lg }}>🎉</Text>
                <Text style={[styles.resultsTitle, { color: tc.text }]}>All Caught Up!</Text>
                <Text style={[styles.resultsSubtitle, { color: tc.textSecondary }]}>
                    No cards to review right now. Create a new deck or check back later!
                </Text>
                <TouchableOpacity
                    style={[styles.doneButton, { backgroundColor: colors.primary[500] }]}
                    onPress={() => router.back()}
                >
                    <Text style={styles.doneButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Results screen
    if (phase === 'results') {
        const correctCount = results.filter((r) => r.rating !== 'again').length;
        return (
            <View style={[styles.container, { backgroundColor: tc.background }]}>
                <View style={styles.resultsContainer}>
                    <Animated.View entering={FadeInDown.duration(600)} style={styles.resultsContent}>
                        <View style={styles.resultEmoji}>
                            <Text style={{ fontSize: 64 }}>🎉</Text>
                        </View>
                        <Text style={[styles.resultsTitle, { color: tc.text }]}>Session Complete!</Text>
                        <Text style={[styles.resultsSubtitle, { color: tc.textSecondary }]}>
                            You reviewed {cards.length} cards
                        </Text>

                        <View style={[styles.resultsStats, { backgroundColor: tc.surface }]}>
                            <View style={styles.resultStat}>
                                <Text style={[styles.resultStatValue, { color: colors.success.main }]}>{correctCount}</Text>
                                <Text style={[styles.resultStatLabel, { color: tc.textMuted }]}>Correct</Text>
                            </View>
                            <View style={[styles.resultDivider, { backgroundColor: tc.border }]} />
                            <View style={styles.resultStat}>
                                <Text style={[styles.resultStatValue, { color: colors.error.main }]}>{cards.length - correctCount}</Text>
                                <Text style={[styles.resultStatLabel, { color: tc.textMuted }]}>Again</Text>
                            </View>
                            <View style={[styles.resultDivider, { backgroundColor: tc.border }]} />
                            <View style={styles.resultStat}>
                                <Text style={[styles.resultStatValue, { color: colors.primary[400] }]}>{Math.round((correctCount / cards.length) * 100)}%</Text>
                                <Text style={[styles.resultStatLabel, { color: tc.textMuted }]}>Accuracy</Text>
                            </View>
                        </View>

                        {/* UX #6: XP earned this session */}
                        {sessionXP > 0 && (
                            <Animated.View
                                entering={FadeInDown.delay(300).duration(400)}
                                style={[styles.xpEarnedRow, { backgroundColor: colors.primary[500] + '15', borderColor: colors.primary[500] + '40' }]}
                            >
                                <Text style={styles.xpEarnedEmoji}>⚡</Text>
                                <Text style={[styles.xpEarnedText, { color: colors.primary[400] }]}>
                                    +{sessionXP} XP earned this session
                                </Text>
                            </Animated.View>
                        )}

                        <TouchableOpacity
                            style={[styles.doneButton, { backgroundColor: colors.primary[500] }]}
                            onPress={() => router.back()}
                        >
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={[styles.container, { backgroundColor: tc.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: tc.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="close" size={28} color={tc.text} />
                </TouchableOpacity>
                <View style={styles.progressDots}>
                    {cards.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor:
                                        i < currentIndex
                                            ? colors.primary[500]
                                            : i === currentIndex
                                                ? colors.primary[300]
                                                : tc.border,
                                },
                            ]}
                        />
                    ))}
                </View>
                <Text style={[styles.counter, { color: tc.textSecondary }]}>
                    {currentIndex + 1}/{cards.length}
                </Text>
            </View>
            {/* UX #5: Banner when reviewing all cards (no due) */}
            {isReviewingAll && (
                <View style={[styles.reviewingAllBanner, { backgroundColor: colors.warning.main + '18' }]}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.warning.main} />
                    <Text style={[styles.reviewingAllText, { color: colors.warning.main }]}>
                        No due cards — reviewing all
                    </Text>
                </View>
            )}

            {/* Flashcard */}
            {currentCard && (
                <View style={styles.cardContainer}>
                    {/* Swipe indicators */}
                    <Animated.View style={[styles.indicator, styles.indicatorLeft, leftIndicatorStyle]}>
                        <Ionicons name="close-circle" size={48} color={colors.error.main} />
                        <Text style={[styles.indicatorText, { color: colors.error.main }]}>Again</Text>
                    </Animated.View>
                    <Animated.View style={[styles.indicator, styles.indicatorRight, rightIndicatorStyle]}>
                        <Ionicons name="checkmark-circle" size={48} color={colors.success.main} />
                        <Text style={[styles.indicatorText, { color: colors.success.main }]}>Good</Text>
                    </Animated.View>
                    <Animated.View style={[styles.indicator, styles.indicatorUp, upIndicatorStyle]}>
                        <Ionicons name="star" size={48} color={colors.warning.main} />
                        <Text style={[styles.indicatorText, { color: colors.warning.main }]}>Easy</Text>
                    </Animated.View>

                    <GestureDetector gesture={composedGesture}>
                        <Animated.View style={[styles.card, cardAnimatedStyle]}>
                            {/* Front */}
                            <Animated.View
                                style={[
                                    styles.cardFace,
                                    { backgroundColor: tc.surface },
                                    frontStyle,
                                ]}
                            >
                                <View style={[styles.cefrBadge, { backgroundColor: colors.primary[500] + '20' }]}>
                                    <Text style={[styles.cefrText, { color: colors.primary[400] }]}>
                                        {currentCard.cefrLevel}
                                    </Text>
                                </View>
                                <Text style={[styles.cardWord, { color: tc.text }]}>{currentCard.front}</Text>
                                <Text style={[styles.tapHint, { color: tc.textMuted }]}>Tap to flip</Text>
                            </Animated.View>

                            {/* Back */}
                            <Animated.View
                                style={[
                                    styles.cardFace,
                                    styles.cardBack,
                                    { backgroundColor: tc.surface },
                                    backStyle,
                                ]}
                            >
                                <Text style={[styles.cardTranslation, { color: colors.primary[400] }]}>
                                    {currentCard.back}
                                </Text>
                                {currentCard.exampleSentence && (
                                    <View style={[styles.exampleContainer, { backgroundColor: tc.surfaceElevated }]}>
                                        <Text style={[styles.exampleLabel, { color: tc.textMuted }]}>Example:</Text>
                                        <Text style={[styles.exampleTextContent, { color: tc.text }]}>
                                            {currentCard.exampleSentence}
                                        </Text>
                                    </View>
                                )}
                                <Text style={[styles.tapHint, { color: tc.textMuted }]}>Swipe to rate</Text>
                            </Animated.View>
                        </Animated.View>
                    </GestureDetector>
                </View>
            )}

            {/* Bottom buttons */}
            <Animated.View entering={FadeIn.delay(300)} style={styles.bottomButtons}>
                <TouchableOpacity
                    style={[styles.ratingButton, { backgroundColor: colors.error.main + '20' }]}
                    onPress={() => goToNextCard('again')}
                >
                    <Ionicons name="close" size={24} color={colors.error.main} />
                    <Text style={[styles.ratingText, { color: colors.error.main }]}>Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.ratingButton, { backgroundColor: colors.warning.main + '20' }]}
                    onPress={() => goToNextCard('hard')}
                >
                    <Ionicons name="remove" size={24} color={colors.warning.main} />
                    <Text style={[styles.ratingText, { color: colors.warning.main }]}>Hard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.ratingButton, { backgroundColor: colors.success.main + '20' }]}
                    onPress={() => goToNextCard('good')}
                >
                    <Ionicons name="checkmark" size={24} color={colors.success.main} />
                    <Text style={[styles.ratingText, { color: colors.success.main }]}>Good</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.ratingButton, { backgroundColor: colors.primary[400] + '20' }]}
                    onPress={() => goToNextCard('easy')}
                >
                    <Ionicons name="star" size={24} color={colors.primary[400]} />
                    <Text style={[styles.ratingText, { color: colors.primary[400] }]}>Easy</Text>
                </TouchableOpacity>
            </Animated.View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centeredContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.fontSize.base,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingTop: 60,
        paddingBottom: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backButton: {
        padding: spacing.xs,
    },
    progressDots: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: spacing.base,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    counter: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    cardContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    card: {
        width: SCREEN_WIDTH - spacing.xl * 2,
        height: SCREEN_HEIGHT * 0.45,
    },
    cardFace: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: borderRadius['2xl'],
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing['2xl'],
        backfaceVisibility: 'hidden',
        ...shadows.lg,
    },
    cardBack: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    cefrBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        position: 'absolute',
        top: spacing.lg,
        right: spacing.lg,
    },
    cefrText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '700',
    },
    cardWord: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: '700',
        textAlign: 'center',
    },
    cardTranslation: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    exampleContainer: {
        padding: spacing.base,
        borderRadius: borderRadius.md,
        width: '100%',
    },
    exampleLabel: {
        fontSize: typography.fontSize.xs,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    exampleTextContent: {
        fontSize: typography.fontSize.base,
        lineHeight: 22,
        fontStyle: 'italic',
    },
    tapHint: {
        fontSize: typography.fontSize.sm,
        position: 'absolute',
        bottom: spacing.lg,
    },
    indicator: {
        position: 'absolute',
        zIndex: 10,
        alignItems: 'center',
    },
    indicatorLeft: {
        left: spacing.xl,
        top: '40%',
    },
    indicatorRight: {
        right: spacing.xl,
        top: '40%',
    },
    indicatorUp: {
        top: spacing['2xl'],
        alignSelf: 'center',
    },
    indicatorText: {
        fontSize: typography.fontSize.md,
        fontWeight: '700',
        marginTop: 4,
    },
    bottomButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.base,
        paddingBottom: 40,
        paddingTop: spacing.base,
    },
    ratingButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.base,
        borderRadius: borderRadius.lg,
        minWidth: 72,
    },
    ratingText: {
        fontSize: typography.fontSize.xs,
        fontWeight: '600',
        marginTop: 4,
    },
    resultsContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    resultsContent: {
        alignItems: 'center',
        width: '100%',
    },
    resultEmoji: {
        marginBottom: spacing.xl,
    },
    resultsTitle: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: '700',
        marginBottom: spacing.sm,
    },
    resultsSubtitle: {
        fontSize: typography.fontSize.base,
        marginBottom: spacing['2xl'],
        textAlign: 'center',
    },
    resultsStats: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.xl,
        borderRadius: borderRadius.xl,
        width: '100%',
        marginBottom: spacing['2xl'],
        ...shadows.md,
    },
    resultStat: {
        flex: 1,
        alignItems: 'center',
    },
    resultStatValue: {
        fontSize: typography.fontSize.xl,
        fontWeight: '700',
    },
    resultStatLabel: {
        fontSize: typography.fontSize.xs,
        marginTop: 4,
    },
    resultDivider: {
        width: 1,
        height: 40,
    },
    doneButton: {
        paddingVertical: spacing.base,
        paddingHorizontal: spacing['3xl'],
        borderRadius: borderRadius.full,
    },
    doneButtonText: {
        color: '#fff',
        fontSize: typography.fontSize.md,
        fontWeight: '700',
    },
    // UX #6: XP earned row
    xpEarnedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        marginBottom: spacing.xl,
    },
    xpEarnedEmoji: { fontSize: 16 },
    xpEarnedText: { fontSize: typography.fontSize.sm, fontWeight: '800' },
    // UX #5: Reviewing all banner
    reviewingAllBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.base,
        justifyContent: 'center',
    },
    reviewingAllText: { fontSize: typography.fontSize.xs, fontWeight: '600' },
});
