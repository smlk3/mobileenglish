import { StyleSheet, Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import { useProfileStore } from '../lib/stores/useProfileStore';
import { borderRadius, colors, spacing, typography } from '../lib/theme';

interface ChipProps extends TouchableOpacityProps {
  label: string;
  selected?: boolean;
  color?: string;
  size?: 'sm' | 'md';
}

export function Chip({
  label,
  selected = false,
  color = colors.primary[500],
  size = 'md',
  style,
  ...rest
}: ChipProps) {
  const isDark = useProfileStore((s) => s.themeMode) === 'dark';
  const tc     = isDark ? colors.dark : colors.light;

  const isSmall = size === 'sm';

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        st.chip,
        {
          backgroundColor: selected ? `${color}22` : tc.surfaceElevated,
          borderColor: selected ? `${color}60` : tc.border,
          paddingHorizontal: isSmall ? spacing.sm : spacing.md,
          paddingVertical: isSmall ? 4 : 7,
          borderRadius: borderRadius.full,
        },
        style,
      ]}
      {...rest}
    >
      <Text
        style={[
          st.label,
          {
            color: selected ? color : tc.textSecondary,
            fontSize: isSmall ? typography.fontSize.xs : typography.fontSize.sm,
            fontWeight: selected ? '700' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  chip: { borderWidth: 1, alignSelf: 'flex-start' },
  label: { letterSpacing: 0.1 },
});
