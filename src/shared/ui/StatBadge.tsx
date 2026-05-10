import { StyleSheet, Text, View } from 'react-native';
import { useProfileStore } from '../lib/stores/useProfileStore';
import { borderRadius, colors, spacing, typography } from '../lib/theme';

interface StatBadgeProps {
  value: string | number;
  label: string;
  icon?: string;
  color?: string;
  /** Büyük merkezi gösterim için */
  large?: boolean;
}

export function StatBadge({
  value,
  label,
  icon,
  color = colors.primary[400],
  large = false,
}: StatBadgeProps) {
  const isDark = useProfileStore((s) => s.themeMode) === 'dark';
  const tc     = isDark ? colors.dark : colors.light;

  return (
    <View
      style={[
        st.badge,
        {
          backgroundColor: `${color}12`,
          borderColor: `${color}28`,
          paddingHorizontal: large ? spacing.lg : spacing.md,
          paddingVertical: large ? spacing.md : spacing.sm,
          borderRadius: borderRadius.lg,
        },
      ]}
    >
      {icon && (
        <Text style={[st.icon, { fontSize: large ? 24 : 18 }]}>{icon}</Text>
      )}
      <Text
        style={[
          st.value,
          {
            color,
            fontSize: large ? typography.fontSize.xl : typography.fontSize.lg,
          },
        ]}
      >
        {value}
      </Text>
      <Text style={[st.label, { color: tc.textMuted, fontSize: large ? typography.fontSize.sm : typography.fontSize.xs }]}>
        {label}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderWidth: 1,
    gap: 2,
  },
  icon:  { lineHeight: 28 },
  value: { fontWeight: '800', letterSpacing: -0.5 },
  label: { fontWeight: '500' },
});
