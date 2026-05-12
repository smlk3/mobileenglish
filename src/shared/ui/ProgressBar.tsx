import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useProfileStore } from '../lib/stores/useProfileStore';
import { borderRadius, colors, gradients, typography } from '../lib/theme';

interface ProgressBarProps {
  /** 0–1 arası */
  progress: number;
  height?: number;
  label?: string;
  showPercent?: boolean;
  /** 'aurora' | 'fire' | 'emerald' */
  variant?: 'aurora' | 'fire' | 'emerald';
}

const GRADIENT_MAP = {
  aurora:  gradients.aurora,
  fire:    gradients.fire,
  emerald: gradients.emerald,
};

export function ProgressBar({
  progress,
  height = 8,
  label,
  showPercent = false,
  variant = 'aurora',
}: ProgressBarProps) {
  const isDark  = useProfileStore((s) => s.themeMode) === 'dark';
  const tc      = isDark ? colors.dark : colors.light;
  const grad    = GRADIENT_MAP[variant];
  const clipped = Math.min(Math.max(progress, 0), 1);

  const widthAnim = useSharedValue(0);
  useEffect(() => {
    widthAnim.value = withSpring(clipped, { damping: 18, stiffness: 120 });
  }, [clipped]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value * 100}%`,
  }));

  return (
    <View style={st.wrap}>
      {(label || showPercent) && (
        <View style={st.header}>
          {label && (
            <Text style={[st.label, { color: tc.textSecondary }]}>{label}</Text>
          )}
          {showPercent && (
            <Text style={[st.pct, { color: tc.text }]}>
              {Math.round(clipped * 100)}%
            </Text>
          )}
        </View>
      )}
      <View
        style={[
          st.track,
          {
            height,
            borderRadius: height / 2,
            backgroundColor: tc.border,
          },
        ]}
      >
        <Animated.View
          style={[{ height, borderRadius: height / 2, overflow: 'hidden' }, fillStyle]}
        >
          <LinearGradient
            colors={grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap:   { gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:  { fontSize: typography.fontSize.xs, fontWeight: '500' },
  pct:    { fontSize: typography.fontSize.xs, fontWeight: '700' },
  track:  { overflow: 'hidden' },
});
