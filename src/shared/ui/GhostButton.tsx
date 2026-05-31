import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
  View,
} from 'react-native';
import { useProfileStore } from '../lib/stores/useProfileStore';
import { borderRadius, colors, spacing, typography } from '../lib/theme';

type Size = 'sm' | 'md' | 'lg';

interface GhostButtonProps extends TouchableOpacityProps {
  label: string;
  size?: Size;
  color?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const SIZE_MAP: Record<Size, { height: number; fontSize: number; paddingH: number }> = {
  sm: { height: 36, fontSize: typography.fontSize.sm,   paddingH: spacing.base },
  md: { height: 48, fontSize: typography.fontSize.base, paddingH: spacing.xl },
  lg: { height: 56, fontSize: typography.fontSize.md,   paddingH: spacing['2xl'] },
};

export function GhostButton({
  label,
  size = 'md',
  color,
  icon,
  fullWidth = false,
  style,
  disabled,
  ...rest
}: GhostButtonProps) {
  const isDark   = useProfileStore((s) => s.themeMode) === 'dark';
  const tc       = isDark ? colors.dark : colors.light;
  const dim      = SIZE_MAP[size];
  const tint     = color ?? colors.primary[400];

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={disabled}
      style={[
        st.btn,
        {
          height: dim.height,
          paddingHorizontal: dim.paddingH,
          borderRadius: borderRadius.full,
          borderColor: `${tint}45`,
          backgroundColor: `${tint}10`,
          opacity: disabled ? 0.45 : 1,
        },
        fullWidth && st.full,
        style,
      ]}
      {...rest}
    >
      <View style={st.inner}>
        {icon && <View style={st.iconWrap}>{icon}</View>}
        <Text style={[st.label, { fontSize: dim.fontSize, color: tint }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  btn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  full: { alignSelf: 'stretch' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: { marginRight: 2 },
  label: { fontWeight: '600', letterSpacing: 0.2 },
});
