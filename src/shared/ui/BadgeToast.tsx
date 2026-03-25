import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight, FadeOutRight } from 'react-native-reanimated';
import { borderRadius, shadows, spacing, typography } from '../lib/theme';
import { type BadgeDefinition } from '../lib/xpSystem';

interface BadgeToastProps {
    badge: BadgeDefinition | null;
    visible: boolean;
    onHide: () => void;
}

export function BadgeToast({ badge, visible, onHide }: BadgeToastProps) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (visible && badge) {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(onHide, 3000);
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [visible, badge]);

    if (!visible || !badge) return null;

    return (
        <Animated.View
            entering={FadeInRight.duration(350).springify()}
            exiting={FadeOutRight.duration(400)}
            style={[styles.container, { borderLeftColor: badge.color }]}
        >
            <View style={[styles.iconBox, { backgroundColor: badge.color + '25' }]}>
                <Text style={styles.emoji}>{badge.emoji}</Text>
            </View>
            <View style={styles.textArea}>
                <Text style={styles.newBadge}>🎖️ New Badge!</Text>
                <Text style={styles.badgeName}>{badge.name}</Text>
                <Text style={styles.badgeDesc} numberOfLines={1}>{badge.description}</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 120,
        right: spacing.base,
        left: spacing.base,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        borderRadius: borderRadius.lg,
        borderLeftWidth: 4,
        padding: spacing.md,
        gap: spacing.md,
        zIndex: 998,
        ...shadows.lg,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emoji: { fontSize: 24 },
    textArea: { flex: 1 },
    newBadge: { fontSize: typography.fontSize.xs, color: '#ffffff60', fontWeight: '700', letterSpacing: 0.5 },
    badgeName: { fontSize: typography.fontSize.base, fontWeight: '800', color: '#fff' },
    badgeDesc: { fontSize: typography.fontSize.xs, color: '#ffffff80', marginTop: 2 },
});
