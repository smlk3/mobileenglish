import { StyleSheet, View, type ViewProps } from 'react-native';
import { useProfileStore } from '../lib/stores/useProfileStore';
import { borderRadius, colors, shadows, spacing } from '../lib/theme';

interface GlassCardProps extends ViewProps {
  padding?: number;
  radius?: number;
  /** Daha belirgin border + glow efekti */
  elevated?: boolean;
  glowColor?: string;
}

export function GlassCard({
  style,
  padding = spacing.lg,
  radius = borderRadius.xl,
  elevated = false,
  glowColor,
  children,
  ...rest
}: GlassCardProps) {
  const isDark = useProfileStore((s) => s.themeMode) === 'dark';

  const glow = glowColor
    ? shadows.glowSm(glowColor)
    : elevated
    ? shadows.md
    : {};

  return (
    <View
      style={[
        st.card,
        isDark ? st.dark : st.light,
        elevated && (isDark ? st.darkElevated : st.lightElevated),
        { padding, borderRadius: radius },
        glow,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  dark: {
    backgroundColor: 'rgba(15,17,23,0.85)',
    borderColor: colors.dark.border,
  },
  darkElevated: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: `${colors.primary[500]}28`,
  },
  light: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: colors.light.border,
  },
  lightElevated: {
    backgroundColor: colors.light.surfaceElevated,
    borderColor: `${colors.primary[300]}40`,
  },
});
