import { useEffect, useRef } from 'react';
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { borderRadius, colors, shadows, spacing, typography } from '../lib/theme';
import { type LevelInfo, getNextLevel, getXPProgress } from '../lib/xpSystem';

const { width } = Dimensions.get('window');

interface LevelUpModalProps {
    visible: boolean;
    newLevel: LevelInfo;
    totalXP: number;
    onClose: () => void;
}

// Simple confetti particle
function Particle({ x, color, delay }: { x: number; color: string; delay: number }) {
    const y = useSharedValue(0);
    const opacity = useSharedValue(1);
    useEffect(() => {
        y.value = withSequence(
            withTiming(-120 - Math.random() * 80, { duration: 600 + delay }),
            withTiming(-160 - Math.random() * 60, { duration: 400 }),
        );
        opacity.value = withSequence(
            withTiming(1, { duration: 400 + delay }),
            withTiming(0, { duration: 600 }),
        );
    }, []);
    return (
        <Animated.View
            style={[
                styles.particle,
                { left: x, backgroundColor: color, opacity, transform: [{ translateY: y }] },
            ]}
        />
    );
}

const PARTICLE_COLORS = ['#F59E0B', '#6366F1', '#10B981', '#EF4444', '#8B5CF6', '#34D399', '#F472B6'];

export function LevelUpModal({ visible, newLevel, totalXP, onClose }: LevelUpModalProps) {
    const next = getNextLevel(newLevel.level);
    const scale = useSharedValue(0.5);

    useEffect(() => {
        if (visible) {
            scale.value = withSequence(
                withSpring(1.1, { damping: 6 }),
                withSpring(1, { damping: 12 }),
            );
        }
    }, [visible]);

    const particles = Array.from({ length: 18 }, (_, i) => ({
        x: (i / 18) * (width - 80),
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        delay: i * 30,
    }));

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                {/* Confetti */}
                <View style={styles.confettiArea} pointerEvents="none">
                    {particles.map((p, i) => <Particle key={i} {...p} />)}
                </View>

                <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
                    {/* Level badge */}
                    <Animated.View style={[styles.levelBadge, { backgroundColor: newLevel.color + '25', borderColor: newLevel.color }]}>
                        <Text style={styles.levelEmoji}>{newLevel.emoji}</Text>
                    </Animated.View>

                    <Text style={styles.levelUpLabel}>LEVEL UP!</Text>
                    <Text style={[styles.levelNum, { color: newLevel.color }]}>
                        Level {newLevel.level}
                    </Text>
                    <Text style={[styles.levelTitle, { color: newLevel.color }]}>
                        {newLevel.title}
                    </Text>

                    <View style={styles.xpRow}>
                        <Text style={styles.xpText}>Total XP: </Text>
                        <Text style={[styles.xpValue, { color: newLevel.color }]}>{totalXP.toLocaleString()}</Text>
                    </View>

                    {next && (
                        <Text style={styles.nextInfo}>
                            Next: {next.emoji} {next.title} (Lv {next.level}) — {next.xpRequired.toLocaleString()} XP
                        </Text>
                    )}

                    <TouchableOpacity
                        style={[styles.doneBtn, { backgroundColor: newLevel.color }]}
                        onPress={onClose}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.doneBtnText}>Continue 🚀</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    confettiArea: {
        position: 'absolute',
        bottom: '50%',
        left: 40,
        right: 40,
        height: 20,
        flexDirection: 'row',
    },
    particle: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    card: {
        width: width - 60,
        backgroundColor: '#1a1a2e',
        borderRadius: borderRadius['2xl'],
        padding: spacing['2xl'],
        alignItems: 'center',
        ...shadows.lg,
    },
    levelBadge: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    levelEmoji: { fontSize: 48 },
    levelUpLabel: {
        fontSize: typography.fontSize.sm,
        fontWeight: '800',
        color: '#ffffff80',
        letterSpacing: 3,
        marginBottom: spacing.xs,
    },
    levelNum: { fontSize: typography.fontSize['3xl'], fontWeight: '900' },
    levelTitle: { fontSize: typography.fontSize.xl, fontWeight: '700', marginBottom: spacing.lg },
    xpRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    xpText: { color: '#ffffff80', fontSize: typography.fontSize.sm },
    xpValue: { fontSize: typography.fontSize.base, fontWeight: '800' },
    nextInfo: {
        color: '#ffffff60',
        fontSize: typography.fontSize.xs,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    doneBtn: {
        paddingVertical: spacing.base,
        paddingHorizontal: spacing['3xl'],
        borderRadius: borderRadius.full,
    },
    doneBtnText: { color: '#fff', fontSize: typography.fontSize.base, fontWeight: '800' },
});
