import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeInUp,
    FadeOutUp,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { borderRadius, colors, shadows, spacing, typography } from '../lib/theme';
import { getXPColor } from '../lib/xpSystem';

interface XPToastProps {
    amount: number;
    label?: string; // e.g. "Combo x3 🔥"
    visible: boolean;
    onHide: () => void;
}

export function XPToast({ amount, label, visible, onHide }: XPToastProps) {
    const scale = useSharedValue(0.6);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (visible) {
            scale.value = withSequence(
                withSpring(1.15, { damping: 8 }),
                withSpring(1, { damping: 14 }),
            );
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(onHide, 1800);
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [visible]);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    if (!visible) return null;

    const xpColor = getXPColor(amount);

    return (
        <Animated.View
            entering={FadeInUp.duration(300).springify()}
            exiting={FadeOutUp.duration(400)}
            style={[styles.container, animStyle, { borderColor: xpColor + '60' }]}
        >
            <Text style={[styles.amount, { color: xpColor }]}>+{amount} XP</Text>
            {label && <Text style={styles.label}>{label}</Text>}
            <Text style={styles.spark}>✨</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 110,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: 'rgba(0,0,0,0.75)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1.5,
        zIndex: 999,
        ...shadows.lg,
    },
    amount: {
        fontSize: typography.fontSize.lg,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    label: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        color: '#fff',
    },
    spark: { fontSize: 14 },
});
