import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useProfileStore } from '../lib/stores/useProfileStore';
import { colors, spacing, typography } from '../lib/theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  accentColor?: string;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  accentColor = colors.primary[400],
}: SectionHeaderProps) {
  const isDark = useProfileStore((s) => s.themeMode) === 'dark';
  const tc     = isDark ? colors.dark : colors.light;

  return (
    <View style={st.row}>
      <View style={st.titleWrap}>
        <View style={[st.dot, { backgroundColor: accentColor }]} />
        <Text style={[st.title, { color: tc.text }]}>{title}</Text>
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={[st.action, { color: accentColor }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 4, height: 18, borderRadius: 2 },
  title:  { fontSize: typography.fontSize.md, fontWeight: '700', letterSpacing: -0.3 },
  action: { fontSize: typography.fontSize.sm, fontWeight: '600' },
});
