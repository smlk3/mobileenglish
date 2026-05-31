import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
  View,
} from 'react-native';
import { borderRadius, colors, gradients, shadows, spacing, typography } from '../lib/theme';

type Variant = 'aurora' | 'fire' | 'emerald' | 'sunset';
type Size    = 'sm' | 'md' | 'lg';

interface GradientButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const GRADIENT_MAP: Record<Variant, readonly [string, string]> = {
  aurora:  gradients.aurora,
  fire:    gradients.fire,
  emerald: gradients.emerald,
  sunset:  gradients.sunset,
};

const SIZE_MAP: Record<Size, { height: number; fontSize: number; paddingH: number }> = {
  sm: { height: 40, fontSize: typography.fontSize.sm, paddingH: spacing.base },
  md: { height: 52, fontSize: typography.fontSize.base, paddingH: spacing.xl },
  lg: { height: 60, fontSize: typography.fontSize.md, paddingH: spacing['2xl'] },
};

export function GradientButton({
  label,
  variant = 'aurora',
  size = 'md',
  loading = false,
  icon,
  fullWidth = true,
  style,
  disabled,
  ...rest
}: GradientButtonProps) {
  const grad = GRADIENT_MAP[variant];
  const dim  = SIZE_MAP[size];

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      disabled={disabled || loading}
      style={[fullWidth && st.full, { opacity: disabled ? 0.5 : 1 }, style]}
      {...rest}
    >
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          st.gradient,
          {
            height: dim.height,
            paddingHorizontal: dim.paddingH,
            borderRadius: borderRadius.full,
          },
          shadows.glow(colors.primary[500], 0.35),
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <View style={st.inner}>
            {icon && <View style={st.iconWrap}>{icon}</View>}
            <Text style={[st.label, { fontSize: dim.fontSize }]}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: { marginRight: 2 },
  label: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
